// composer.tsx - Multi-line message input (OpenTUI <textarea>) framed by a
// rounded-border compose card.
//
// Key bindings: the default textarea map binds Enter to newline and
// Meta+Enter to submit; we override it with an explicit custom map. Custom
// bindings are merged over the defaults by exact name:ctrl:shift:meta:super
// key (mergeKeyBindings in @opentui/core), so:
//   Enter       -> submit      (overrides the default newline)
//   Shift+Enter -> newline
//   Meta+Enter  -> newline     (overrides the default submit)
//   Ctrl+J      -> newline     (raw terminals: LF is linefeed; kitty: j+ctrl)
// Bracketed paste is intercepted via usePaste: raw bytes are decoded,
// ANSI escapes stripped, and CRLF/CR normalized to LF before insertion.
// This preserves intentional multi-line pastes as a single editable buffer
// (Shift+Enter semantics) while preventing stray \r, ANSI, or trailing
// newline artifacts.
// Non-bracketed pastes (e.g. Gboard clipboard picks on Termux) arrive as
// rapid key events without the ESC[200~…ESC[201~ envelope, so each \n would
// otherwise fire the submit binding and send every line as a separate chat
// message. The composer therefore debounces submit: rapid successive Enters
// are coalesced into a single multi-line insert (see handleSubmit).
//
// Submit contract: empty input is a no-op. onSubmit(text) returns the send
// success flag; on false the text is kept and a transient "not connected"
// hint is shown, cleared on the next non-Enter keystroke (onKeyDown) or a
// successful submit. The hint is NOT cleared via onContentChange: that
// event is fed by deferred NATIVE edit-buffer events that arrive after the
// submit dispatch and would clobber the hint (verified in the Phase 3
// harness; key events are synchronous, content events are not).
// The textarea grows with content up to 33 % of the terminal height and
// scrolls internally beyond that (reactive via useTerminalDimensions).
//
// Frame: the card's border turns warning-colored while the retry hint is
// up. The hint row sits ABOVE the card and only renders when set (same
// conditional-row shape as before); the card itself keeps a constant
// structure. The textarea is wrapped in a padded inner box so text never
// touches the border. The card is never allowed to shrink below its two
// border rows plus one editor row: a short terminal (for example, when an
// on-screen keyboard reduces its height) must shrink the feed before it
// overlaps the composer border.

import { useEffect, useRef, useState } from 'react';
import type { KeyBinding, KeyEvent, TextareaRenderable } from '@opentui/core';
import { decodePasteBytes, stripAnsiSequences } from '@opentui/core';
import { usePaste, useTerminalDimensions } from '@opentui/react';
import { THEME } from '../theme.js';

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function normalizeForSend(text: string): string {
  let out = normalizeLineEndings(text);
  // Strip leading/trailing blank lines introduced by a trailing newline in the
  // paste payload, but preserve intentional leading spaces on the first line
  // and interior blank lines. Interior \n are kept as-is.
  out = out.replace(/^\n+/, '').replace(/\n+$/, '');
  return out;
}

const COMPOSER_KEY_BINDINGS: KeyBinding[] = [
  { name: 'return', action: 'submit' },
  { name: 'kpenter', action: 'submit' },
  // Plain linefeed (LF / raw Ctrl+J) -> newline so Ctrl+J inserts a new line.
  // Enter still submits via return/kpenter.
  { name: 'linefeed', action: 'newline' },
  { name: 'return', shift: true, action: 'newline' },
  { name: 'kpenter', shift: true, action: 'newline' },
  { name: 'linefeed', shift: true, action: 'newline' },
  { name: 'return', meta: true, action: 'newline' },
  { name: 'kpenter', meta: true, action: 'newline' },
  { name: 'linefeed', meta: true, action: 'newline' },
  // Kitty protocol reports Ctrl+J as j+ctrl; also cover linefeed+ctrl for completeness.
  { name: 'j', ctrl: true, action: 'newline' },
  { name: 'linefeed', ctrl: true, action: 'newline' },
];

export interface ComposerProps {
  /** Submit one chat line; return true when the transport accepted it. */
  onSubmit: (text: string) => boolean;
  placeholder?: string;
}

export function Composer({ onSubmit, placeholder }: ComposerProps) {
  const editorRef = useRef<TextareaRenderable>(null);
  const [notConnected, setNotConnected] = useState(false);
  const { height: termHeight } = useTerminalDimensions();
  // 33 % of the terminal height, at least 3 rows so a tiny terminal still
  // shows the previous 3-line behaviour. Falls back to 3 before the first
  // dimension measurement arrives.
  const computedMaxHeight = Math.max(3, Math.floor((termHeight || 24) * 0.33));

  // ---------------------------------------------------------------------------
  // Non-bracketed paste coalescing (Termux + Gboard)
  //
  // Bracketed paste never reaches handleSubmit — it is intercepted by usePaste
  // above. Gboard's clipboard, however, commits text as ordinary key events:
  // each interior \n arrives as a plain Enter and would otherwise submit
  // every line as its own message.  We debounce submit so a burst of Enters
  // is treated as a single multi-line *insert* rather than N sends.
  //
  // Strategy: each submit's line is buffered and the editor is cleared so the
  // next line's characters start from an empty buffer. A short timer
  // (PASTE_DEBOUNCE_MS) is (re)armed; if it fires with a single buffered
  // line and no trailing text, it was a normal single-line send. If it fires
  // with multiple lines (or a buffered line plus a trailing partial line that
  // didn't end with Enter), the burst is coalesced into one multi-line
  // insertion and left in the editor for the user to send explicitly.
  // ---------------------------------------------------------------------------
  const PASTE_DEBOUNCE_MS = 40;
  const pendingLinesRef = useRef<string[]>([]);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush the debounced buffer. Called on timeout or on unmount.
  const flushPending = (): void => {
    const editor = editorRef.current;
    if (!editor) {
      pendingLinesRef.current = [];
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      return;
    }

    const lines = pendingLinesRef.current;
    // Text that was typed after the last submitted Enter but didn't end with
    // Enter yet (e.g. the final line of a "a\nb" paste without trailing \n).
    // The editor was cleared after each buffered submit, so this is exactly
    // the trailing partial line.  It is captured raw and normalized lazily.
    const rawRemaining = editor.plainText;
    const remaining = normalizeForSend(rawRemaining);
    const remainingText = remaining.trim() === '' ? '' : remaining;
    const hasLines = lines.length > 0;
    const hasRemainingText = remainingText !== '';

    // Nothing to do
    if (!hasLines && !hasRemainingText) {
      pendingLinesRef.current = [];
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      return;
    }

    // Snapshot and reset state before possibly re-entering React state updates.
    const snapshot = [...lines];
    pendingLinesRef.current = [];
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }

    const totalEntries = snapshot.length + (hasRemainingText ? 1 : 0);
    // Multi-line burst -> coalesce into one editor insertion, don't send yet.
    if (totalEntries > 1) {
      const all = [...snapshot];
      if (hasRemainingText) all.push(remainingText);
      const joined = all.join('\n');
      // Replace editor contents with the coalesced multi-line text.
      // clear() + insertText keeps a single undo step for the join.
      editor.clear();
      if (joined) editor.insertText(joined);
      setNotConnected(false);
      return;
    }

    // Single-line case -> actually send.
    // Priority: if we have a pending snapshot line, that's the line to send;
    // otherwise the remaining text is a single line without a prior Enter
    // (shouldn't happen here but handle defensively).
    const singleText = snapshot.length === 1 ? snapshot[0] : remainingText;
    if (!singleText || singleText.trim() === '') {
      // No valid single line (e.g. empty). Ensure editor reflects remaining
      // if any (already there).
      return;
    }
    if (onSubmit(singleText)) {
      editor.clear();
      setNotConnected(false);
    } else {
      // Restore for retry
      editor.clear();
      editor.insertText(singleText);
      setNotConnected(true);
    }
  };

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, []);

  // Intercept bracketed paste before the textarea's native handlePaste.
  // Native handler would insert raw bytes with \r preserved and only strip
  // ANSI; we normalize to LF and strip ANSI ourselves, then insert via the
  // editor API. This keeps a single undo entry and prevents stray \r/ANSI
  // from entering the buffer.
  usePaste((event) => {
    try {
      const raw = decodePasteBytes(event.bytes);
      const normalized = normalizeLineEndings(stripAnsiSequences(raw));
      if (!normalized) return;
      // Prevent the textarea's default paste (which would insert unnormalized
      // \r) and insert the sanitized form instead.
      event.preventDefault();
      editorRef.current?.insertText(normalized);
      setNotConnected(false);
    } catch {
      // Fall back to native handling on decode failure.
    }
  });

  const handleSubmit = (): void => {
    const editor = editorRef.current;
    if (!editor) return;
    const raw = editor.plainText;
    const text = normalizeForSend(raw);

    // Empty submit: only preserve as interior blank line if we're already in
    // a burst. Otherwise it's a plain no-op (user pressed Enter on empty).
    if (text.trim() === '') {
      if (pendingLinesRef.current.length > 0 || pendingTimerRef.current) {
        // Interior blank line of a rapid multi-line paste (e.g. "a\n\nb").
        pendingLinesRef.current.push('');
        editor.clear();
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = setTimeout(flushPending, PASTE_DEBOUNCE_MS);
      }
      return;
    }

    // Buffer this line and debounce; clear the editor so the next line's
    // characters are isolated. The actual send vs. coalesced-insert decision
    // is made when the debounce timer fires (see flushPending).
    pendingLinesRef.current.push(text);
    editor.clear();
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(flushPending, PASTE_DEBOUNCE_MS);
  };

  const handleKeyDown = (key: KeyEvent): void => {
    const isPlainEnter =
      (key.name === 'return' || key.name === 'kpenter') && !key.shift && !key.meta && !key.ctrl;
    if (!isPlainEnter) setNotConnected(false);
  };

  return (
    <box flexDirection="column" flexShrink={0} paddingLeft={1} paddingRight={1}>
      {notConnected ? (
        <box flexDirection="row" height={1}>
          <text style={{ fg: THEME.warning }}>
            not connected — message kept, press Enter to retry
          </text>
        </box>
      ) : null}
      <box
        borderStyle="rounded"
        border
        borderColor={notConnected ? THEME.warning : THEME.border}
        minHeight={3}
        flexShrink={0}
        paddingLeft={1}
        paddingRight={1}
      >
        <textarea
          ref={editorRef}
          keyBindings={COMPOSER_KEY_BINDINGS}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          focused
          minHeight={1}
          maxHeight={computedMaxHeight}
          flexShrink={0}
          placeholder={placeholder ?? 'Message (Enter to send · Shift+Enter / Ctrl+J newline)'}
          placeholderColor={THEME.muted}
        />
      </box>
    </box>
  );
}
