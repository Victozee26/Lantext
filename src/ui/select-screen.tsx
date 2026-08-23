// select-screen.tsx - Owns the mode-select screen lifecycle: a lightweight
// renderer boot whose close path does NOT exit the process.
//
// bootRuntime (runtime.ts) always process.exits on teardown, which is right
// for the chat screens but wrong for the mode picker: selecting a mode must
// hand off to the chat orchestrator in the SAME process. Lifecycle contract:
//   - On selection or quit the renderer is destroyed (restores raw mode, the
//     alt screen, and the global console) and its signal handlers are
//     removed — idempotent, and it does NOT exit.
//   - The caller decides the exit: on 'quit' the caller exits 0; on a
//     selection the caller boots the chat runtime, which owns the process
//     from then on. The select -> chat transition therefore leaves zero
//     orphaned listeners/handles and a clean terminal between the two
//     screens (each screen manages its own alt screen).
//   - SIGINT/SIGTERM while the picker is up close the screen and resolve
//     'quit' (the caller exits 0). Raw mode swallows interactive Ctrl+C as a
//     key event, so <ShutdownKeys> (runtime.ts) covers the keyboard path.
//
// Renderer hardening matches bootRuntime: exitSignals: [] and
// exitOnCtrlC: false — WE own shutdown.

import { createCliRenderer, type CliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { ShutdownKeys } from './runtime.js';
import { ModeSelect } from './components/mode-select.js';
import type { LanTextMode } from './components/header.js';

/** Result of the picker: a chosen mode, or 'quit' (q / ESC / Ctrl+C / signal). */
export type ModeSelectResult = LanTextMode | 'quit';

const EXIT_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

export async function openModeSelect(): Promise<ModeSelectResult> {
  const renderer: CliRenderer = await createCliRenderer({
    exitSignals: [],
    exitOnCtrlC: false,
  });

  let settled = false;
  const signalHandlers = new Map<NodeJS.Signals, () => void>();

  let resolve!: (result: ModeSelectResult) => void;
  const done = new Promise<ModeSelectResult>((res) => {
    resolve = res;
  });

  /** Idempotent: stop the picker WITHOUT exiting (see module docs). */
  const close = (): void => {
    if (settled) return;
    settled = true;
    for (const [signal, handler] of signalHandlers) {
      process.removeListener(signal, handler);
    }
    signalHandlers.clear();
    renderer.destroy();
  };

  for (const signal of EXIT_SIGNALS) {
    const handler = (): void => {
      close();
      resolve('quit');
    };
    process.on(signal, handler);
    signalHandlers.set(signal, handler);
  }

  createRoot(renderer).render(
    <>
      <ModeSelect
        onSelect={(mode) => {
          close();
          resolve(mode);
        }}
        onQuit={() => {
          close();
          resolve('quit');
        }}
      />
      <ShutdownKeys
        onShutdown={() => {
          close();
          resolve('quit');
        }}
      />
    </>,
  );

  return done;
}