// composer.tsx - Multi-line message input (OpenTUI <textarea>).
//
// Key bindings: the default textarea map binds Enter to newline and
// Meta+Enter to submit; we override it with an explicit custom map. Custom
// bindings are merged over the defaults by exact name:ctrl:shift:meta:super
// key (mergeKeyBindings in @opentui/core), so:
//   Enter       -> submit      (overrides the default newline)
//   Shift+Enter -> newline
//   Meta+Enter  -> newline     (overrides the default submit)
// Bracketed paste reaches the renderable's native handlePaste and is
// inserted as text; the old 50 ms readline paste heuristic is NOT
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

import { useRef, useState } from 'react';
import type { KeyBinding, KeyEvent, TextareaRenderable } from '@opentui/core';
import { THEME } from '../theme.js';

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

  const handleSubmit = (): void => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = editor.plainText;
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
    <box flexDirection="column" paddingLeft={1} paddingRight={1} paddingBottom={1}>
      {notConnected ? (
        <text style={{ fg: THEME.warning }}>not connected — message kept, press Enter to retry</text>
      ) : null}
      <textarea
        ref={editorRef}
        keyBindings={COMPOSER_KEY_BINDINGS}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        focused
        minHeight={1}
        maxHeight={3}
        placeholder={placeholder ?? 'Message (Enter to send · Shift+Enter newline)'}
        placeholderColor={THEME.muted}
      />
    </box>
  );
}