// select-screen.tsx - Mode-select screen lifecycle.
//
// Uses the shared non-exiting screen lifecycle (ephemeral-screen.ts): choosing
// a mode destroys the renderer and resolves, then the caller boots the chat
// runtime in the SAME process. The select -> chat transition therefore leaves
// zero orphaned listeners/handles and a clean terminal between the two
// screens (each screen manages its own alt screen).
//
// SIGINT/SIGTERM while the picker is up resolve 'quit' (the caller exits 0).
// Raw mode swallows interactive Ctrl+C as a key event, so <ShutdownKeys>
// covers the keyboard path.

import { openEphemeralScreen } from './ephemeral-screen.js';
import { ShutdownKeys } from './runtime.js';
import { ModeSelect } from './components/mode-select.js';
import type { LanTextMode } from './components/header.js';

/** Result of the picker: a chosen mode, or 'quit' (q / ESC / Ctrl+C / signal). */
export type ModeSelectResult = LanTextMode | 'quit';

export async function openModeSelect(): Promise<ModeSelectResult> {
  return openEphemeralScreen<ModeSelectResult>({
    signalResult: 'quit',
    render: (settle) => (
      <>
        <ModeSelect
          onSelect={settle}
          onQuit={() => settle('quit')}
        />
        <ShutdownKeys onShutdown={() => settle('quit')} />
      </>
    ),
  });
}
