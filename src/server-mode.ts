// server-mode.ts - Thin orchestrator for Host mode.

import { startHostTUI } from './modes/server-tui.js';
import { startHostPlain } from './modes/server-plain.js';

export { createServerAdapter } from './adapters/server-adapter.js';

export async function startHost(): Promise<void> {
  if (process.stdin.isTTY) {
    await startHostTUI();
  } else {
    startHostPlain();
  }
}

// Deprecated alias (removed: use startHost)
export const startHotspot = startHost;
