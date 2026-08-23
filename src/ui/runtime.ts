// runtime.ts - Renderer lifecycle and shutdown orchestration for the LanText
// TUI.
//
// Ownership (per plans/ui-refactor-opentui.md, Verified Foundations):
// - Renderer is created with `exitSignals: []` and `exitOnCtrlC: false` so
//   the DEFAULT renderer handlers never tear the app down behind our back
//   (they only call destroy() and cannot stop application sockets).
// - Interactive Ctrl+C is NOT a SIGINT in raw mode: it arrives as a key
//   event (`c` + ctrl). Teardown therefore has THREE entry paths, all
//   funneling into ONE idempotent function:
//     1. keyboard   -> <ShutdownKeys> component inside the React tree
//     2. signals    -> app-level process.on('SIGINT'|'SIGTERM') handlers
//                      registered at boot, removed on teardown
//     3. fatal      -> failFast() logs via the renderer's captured console
//                      channel, then tears down with a nonzero exit
// - teardown order: adapter.stop() -> renderer.destroy() (auto-unmounts the
//   React root via the renderer's DESTROY event; restores raw mode, alt
//   screen, and global console) -> process exit.
// - Idempotence flag guards the whole chain; repeated triggers (including a
//   signal racing a keypress during discovery spin-up) are safe no-ops.
//
// Testability: bootRuntime takes the adapter and an app factory (no
// hardcoded imports of future components), and accepts an injectable `exit`
// function so tests can observe teardown without killing the process.

import { createCliRenderer, type CliRenderer } from '@opentui/core';
import { createRoot, type Root } from '@opentui/react';
import type { ReactNode } from 'react';
import type { ChatSession } from './session-adapter.js';

/** Surface handed to the app factory; the app passes `teardown` down to
 *  components (e.g. <ShutdownKeys>) so the tree can trigger shutdown. */
export interface RuntimeApi {
  /** Idempotent full shutdown: stop adapter -> destroy renderer -> exit. */
  teardown(exitCode?: number): void;
  /** Log a fatal error via the captured console channel, then teardown(1). */
  failFast(message: string): void;
}

/** Renders the app tree for a boot. Returns the same type `Root.render`
 *  accepts (OpenTUI's JSX.Element is React.ReactNode). */
export type AppFactory = (api: RuntimeApi) => ReactNode;

export interface LanTextRuntime extends RuntimeApi {
  readonly adapter: ChatSession;
  readonly renderer: CliRenderer;
  /** True once teardown has run (or is running); stays true afterwards. */
  readonly isTornDown: boolean;
}

export interface BootRuntimeOptions {
  /** Process signals that trigger teardown(0). Default ['SIGINT', 'SIGTERM']. */
  exitSignals?: NodeJS.Signals[];
  /** Exit implementation; injectable for tests. Default process.exit. */
  exit?: (code: number) => never;
}

const DEFAULT_EXIT_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

export async function bootRuntime(
  adapter: ChatSession,
  renderApp: AppFactory,
  options: BootRuntimeOptions = {},
): Promise<LanTextRuntime> {
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const exitSignals = options.exitSignals ?? DEFAULT_EXIT_SIGNALS;

  // Renderer owns stream acquisition, raw mode, and the alt screen.
  // Default exit behavior disabled: WE own shutdown (see module docs).
  const renderer = await createCliRenderer({
    exitSignals: [],
    exitOnCtrlC: false,
  });

  let tornDown = false;
  const signalHandlers = new Map<NodeJS.Signals, () => void>();

  const teardown = (exitCode = 0): void => {
    if (tornDown) return;
    tornDown = true;
    for (const [signal, handler] of signalHandlers) {
      process.removeListener(signal, handler);
    }
    signalHandlers.clear();
    try {
      adapter.stop();
    } catch (err) {
      // Preserve context, never hide the failure, never abort the chain.
      console.error(`[LANText] adapter.stop() failed during shutdown: ${err instanceof Error ? err.stack : String(err)}`);
    }
    // destroy() also unmounts the React root (createRoot hooks the
    // renderer's DESTROY event) and restores terminal/console state.
    renderer.destroy();
    exit(exitCode);
  };

  const failFast = (message: string): void => {
    // global console is captured into the renderer's overlay while the
    // renderer lives, so this cannot corrupt the TUI frame (plan risk #3).
    console.error(`[LANText] Fatal: ${message}`);
    teardown(1);
  };

  for (const signal of exitSignals) {
    const handler = (): void => teardown(0);
    process.on(signal, handler);
    signalHandlers.set(signal, handler);
  }

  const root: Root = createRoot(renderer);
  // renderer.destroy() auto-unmounts this root via the renderer's DESTROY
  // event (createRoot wires the cleanup), so no manual unmount here.
  root.render(renderApp({ teardown, failFast }));

  return {
    adapter,
    renderer,
    teardown,
    failFast,
    get isTornDown(): boolean {
      return tornDown;
    },
  };
}

// Re-export for backward compat — new code imports from './runtime/shutdown-keys.js'
export { ShutdownKeys } from './runtime/shutdown-keys.js';
export type { ShutdownKeysProps } from './runtime/shutdown-keys.js';