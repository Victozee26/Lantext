// server-mode.ts - Thin orchestrator for Host mode.

import { startHostTUI } from './modes/server-tui.js';
import { startHostPlain } from './modes/server-plain.js';

export async function startHost(name?: string): Promise<void> {
  if (process.stdin.isTTY) {
    await startHostTUI(name);
  } else {
    startHostPlain(name);
  }
}
