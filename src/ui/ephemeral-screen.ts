// ephemeral-screen.ts - Non-exiting renderer lifecycle for transient screens.
//
// `bootRuntime` is for chat screens and owns process exit. Picker screens
// (mode select, host room name) must hand the terminal back to the
// orchestrator so the next screen can boot in the SAME process. This helper
// centralizes that lifecycle: destroy the renderer, remove signal handlers,
// resolve a result, and never call process.exit.
//
// Renderer hardening matches bootRuntime: exitSignals: [] and exitOnCtrlC:
// false, because teardown is ours. SIGINT/SIGTERM resolve `signalResult` (the
// caller decides what that means); raw-mode Ctrl+C is handled by
// <ShutdownKeys> in the screen tree.

import { createCliRenderer, type CliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import type { ReactNode } from 'react';

const EXIT_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

export interface EphemeralScreenOptions<T> {
  /** Result to resolve when SIGINT/SIGTERM arrives. */
  signalResult: T;
  /** Render the screen. `settle` destroys the renderer and resolves once. */
  render: (settle: (result: T) => void) => ReactNode;
}

export async function openEphemeralScreen<T>(
  options: EphemeralScreenOptions<T>,
): Promise<T> {
  const renderer: CliRenderer = await createCliRenderer({
    exitSignals: [],
    exitOnCtrlC: false,
  });

  let settled = false;
  const signalHandlers = new Map<NodeJS.Signals, () => void>();

  let resolve!: (result: T) => void;
  const done = new Promise<T>((res) => {
    resolve = res;
  });

  /** Idempotent: stop the screen WITHOUT exiting (see module docs). */
  const close = (): boolean => {
    if (settled) return false;
    settled = true;
    for (const [signal, handler] of signalHandlers) {
      process.removeListener(signal, handler);
    }
    signalHandlers.clear();
    renderer.destroy();
    return true;
  };

  const settle = (result: T): void => {
    if (close()) resolve(result);
  };

  for (const signal of EXIT_SIGNALS) {
    const handler = (): void => settle(options.signalResult);
    process.on(signal, handler);
    signalHandlers.set(signal, handler);
  }

  try {
    createRoot(renderer).render(options.render(settle));
  } catch (err) {
    close();
    throw err;
  }

  return done;
}
