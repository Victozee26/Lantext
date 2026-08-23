// server-mode.ts - Thin orchestrator for Hotspot/Server mode.

import { startHotspotTUI } from './modes/server-tui.js';
import { startHotspotPlain } from './modes/server-plain.js';

export { createServerAdapter } from './adapters/server-adapter.js';

export async function startHotspot(): Promise<void> {
  if (process.stdin.isTTY) {
    await startHotspotTUI();
  } else {
    startHotspotPlain();
  }
}
