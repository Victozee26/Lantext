// shutdown-keys.tsx - Keyboard shutdown path (Ctrl+C) for the TUI.
// In raw mode Ctrl+C is a key event (c + ctrl), not SIGINT.

import { useKeyboard } from '@opentui/react';
import type { KeyEvent } from '@opentui/core';

export interface ShutdownKeysProps {
  onShutdown: () => void;
}

export function ShutdownKeys({ onShutdown }: ShutdownKeysProps): null {
  useKeyboard((key: KeyEvent) => {
    if (key.ctrl && key.name === 'c') {
      onShutdown();
    }
  });
  return null;
}
