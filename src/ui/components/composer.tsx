// composer.tsx - Multi-line message input (OpenTUI <textarea>) framed by a
// rounded-border compose card. Delegates normalization, bindings, and
// paste-debounce coalescing to focused submodules (SRP).

import { useRef, useState } from 'react';
import type { KeyEvent, TextareaRenderable } from '@opentui/core';
import { decodePasteBytes, stripAnsiSequences } from '@opentui/core';
import { usePaste, useTerminalDimensions } from '@opentui/react';
import { THEME } from '../theme.js';
import { normalizeForSend, normalizeLineEndings } from './composer/normalize.js';
import { COMPOSER_KEY_BINDINGS } from './composer/bindings.js';
import { useDebouncedSubmit } from './composer/use-debounce.js';

export interface ComposerProps {
  onSubmit: (text: string) => boolean;
  placeholder?: string;
  /** Room-lost state: keep the card visible but stop input/submission. */
  disabled?: boolean;
}

export function Composer({ onSubmit, placeholder, disabled = false }: ComposerProps) {
  const editorRef = useRef<TextareaRenderable>(null);
  const [notConnected, setNotConnected] = useState(false);
  const { height: termHeight } = useTerminalDimensions();
  const computedMaxHeight = Math.max(3, Math.floor((termHeight || 24) * 0.33));

  const debounced = useDebouncedSubmit(
    editorRef,
    disabled ? () => false : onSubmit,
    setNotConnected,
  );

  usePaste((event) => {
    if (disabled) return;
    try {
      const raw = decodePasteBytes(event.bytes);
      const normalized = normalizeLineEndings(stripAnsiSequences(raw));
      if (!normalized) return;
      event.preventDefault();
      editorRef.current?.insertText(normalized);
      setNotConnected(false);
    } catch {
      // Fall back to native handling on decode failure.
    }
  });

  const handleSubmit = (): void => {
    if (disabled) return;
    const editor = editorRef.current;
    if (!editor) return;
    const text = normalizeForSend(editor.plainText);
    if (text.trim() === '') {
      if (debounced.hasPending()) debounced.bufferBlank();
      return;
    }
    debounced.bufferLine(text);
  };

  const handleKeyDown = (key: KeyEvent): void => {
    if (disabled) return;
    const isPlainEnter =
      (key.name === 'return' || key.name === 'kpenter') && !key.shift && !key.meta && !key.ctrl;
    if (!isPlainEnter) setNotConnected(false);
  };

  return (
    <box flexDirection="column" flexShrink={0} paddingLeft={1} paddingRight={1}>
      {notConnected && !disabled ? (
        <box flexDirection="row" height={1}>
          <text style={{ fg: THEME.warning }}>
            not connected — message kept, press Enter to retry
          </text>
        </box>
      ) : null}
      <box
        borderStyle="rounded"
        border
        borderColor={disabled || notConnected ? THEME.warning : THEME.border}
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
          focused={!disabled}
          minHeight={1}
          maxHeight={computedMaxHeight}
          flexShrink={0}
          placeholder={
            disabled
              ? 'Room lost — press r to retry or c to choose another'
              : (placeholder ?? 'Message (Enter to send · Shift+Enter / Ctrl+J newline)')
          }
          placeholderColor={THEME.muted}
        />
      </box>
    </box>
  );
}
