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
// Bracketed paste is intercepted via usePaste: raw bytes are decoded,
// ANSI escapes stripped, and CRLF/CR normalized to LF before insertion.
// This preserves intentional multi-line pastes as a single editable buffer
// (Shift+Enter semantics) while preventing stray \r, ANSI, or trailing
// newline artifacts. The old 50 ms readline paste heuristic is NOT
// reimplemented.
//
// Submit contract: empty input is a no-op. onSubmit(text) returns the send
// success flag; on false the text is kept and a transient "not connected"
// hint is shown, cleared on the next non-Enter keystroke (onKeyDown) or a
// successful submit. The hint is NOT cleared via onContentChange: that
// event is fed by deferred NATIVE edit-buffer events that arrive after the
// submit dispatch and would clobber the hint (verified in the Phase 3
// harness; key events are synchronous, content events are not).
// The textarea grows with content up to maxHeight (3 lines) and scrolls
// internally beyond that.
//
// Frame: the card's border turns warning-colored while the retry hint is
// up. The hint row sits ABOVE the card and only renders when set (same
// conditional-row shape as before); the card itself keeps a constant
// structure. The textarea is wrapped in a padded inner box so text never
// touches the border. The card is never allowed to shrink below its two
// border rows plus one editor row: a short terminal (for example, when an
// on-screen keyboard reduces its height) must shrink the feed before it
// overlaps the composer border.

import { useRef, useState } from 'react';
import type { KeyBinding, KeyEvent, TextareaRenderable } from '@opentui/core';
import { decodePasteBytes, stripAnsiSequences } from '@opentui/core';
import { usePaste } from '@opentui/react';
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
  { name: 'linefeed', action: 'submit' },
  { name: 'return', shift: true, action: 'newline' },
  { name: 'kpenter', shift: true, action: 'newline' },
  { name: 'linefeed', shift: true, action: 'newline' },
  { name: 'return', meta: true, action: 'newline' },
  { name: 'kpenter', meta: true, action: 'newline' },
  { name: 'linefeed', meta: true, action: 'newline' },
];

export interface ComposerProps {
  /** Submit one chat line; return true when the transport accepted it. */
  onSubmit: (text: string) => boolean;
  placeholder?: string;
}

export function Composer({ onSubmit, placeholder }: ComposerProps) {
  const editorRef = useRef<TextareaRenderable>(null);
  const [notConnected, setNotConnected] = useState(false);

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
    if (text.trim() === '') return;
    if (onSubmit(text)) {
      editor.clear();
      setNotConnected(false);
    } else {
      setNotConnected(true);
    }
  };

  const handleKeyDown = (key: KeyEvent): void => {
    const isPlainEnter =
      (key.name === 'return' || key.name === 'kpenter' || key.name === 'linefeed') &&
      !key.shift && !key.meta && !key.ctrl;
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
          maxHeight={3}
          flexShrink={0}
          placeholder={placeholder ?? 'Message (Enter to send · Shift+Enter newline)'}
          placeholderColor={THEME.muted}
        />
      </box>
    </box>
  );
}
