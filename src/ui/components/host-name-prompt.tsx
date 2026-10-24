// host-name-prompt.tsx - Room-name input shown before a TTY host starts.
//
// The persisted name is pre-filled and selected, so Enter keeps it and typing
// replaces it. Empty (or whitespace-only) input falls back to the default.
// Escape cancels; Enter submits. `q` is deliberately NOT a quit key here: the
// user is editing text and will type it inside room names.

import { useEffect, useRef } from 'react';
import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import type { InputRenderable, KeyEvent } from '@opentui/core';
import { THEME } from '../theme.js';

export interface HostNamePromptProps {
  /** Persisted room name, used when the input is left empty. */
  defaultName: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function HostNamePrompt({
  defaultName,
  onSubmit,
  onCancel,
}: HostNamePromptProps) {
  const { width: termWidth } = useTerminalDimensions();
  const inputRef = useRef<InputRenderable>(null);

  // Pre-select the default so the first keystroke replaces it instead of
  // appending to it. If selection is unsupported, the input still works.
  useEffect(() => {
    inputRef.current?.selectAll();
  }, []);

  useKeyboard((key: KeyEvent) => {
    if (key.name === 'escape') onCancel();
  });

  const width = Math.max(30, Math.min(56, (termWidth || 80) - 8));

  return (
    <box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <text style={{ fg: THEME.accent }}>host a room</text>
      <text style={{ fg: THEME.muted }}>Clients on this network will see this name.</text>
      <box paddingTop={1} />
      <box
        borderStyle="rounded"
        border
        borderColor={THEME.border}
        title=" room name "
        titleColor={THEME.brand}
        paddingLeft={2}
        paddingRight={2}
      >
        <input
          ref={inputRef}
          value={defaultName}
          onSubmit={() => {
            const value = inputRef.current?.value ?? defaultName;
            onSubmit(value.trim() || defaultName);
          }}
          focused
          width={width}
          textColor={THEME.info}
          focusedTextColor={THEME.info}
          backgroundColor="transparent"
          focusedBackgroundColor="transparent"
        />
      </box>
      <box paddingTop={1} />
      <box flexDirection="row" height={1}>
        <text style={{ fg: THEME.muted }}>enter start · </text>
        <text style={{ fg: THEME.brand }}>esc</text>
        <text style={{ fg: THEME.muted }}> cancel</text>
      </box>
    </box>
  );
}
