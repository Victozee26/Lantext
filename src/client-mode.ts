// client-mode.ts - Thin orchestrator for Client mode.
// Dispatches to TTY (TUI) or plain path; adapter logic lives in src/adapters/*.

import { startClientTUI } from './modes/client-tui.js';
import { startClientPlain } from './modes/client-plain.js';

// Re-export adapter factory for backward compat (external callers).
export { createClientAdapter } from './adapters/client-adapter.js';

export async function startClient(serverAddress = process.env.SERVER): Promise<void> {
  if (process.stdin.isTTY) {
    await startClientTUI(serverAddress);
  } else {
    startClientPlain(serverAddress);
  }
}
