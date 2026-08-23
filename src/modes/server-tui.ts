// server-tui.ts - TTY path for hotspot/server mode.

import { LanServer } from '../hotspot.js';
import { createServerAdapter } from '../adapters/server-adapter.js';
import { mountChatScreen } from '../ui/chat-screen.js';
import { getLocalIP } from '../protocol/network.js';
import { getVersion } from '../protocol/version.js';

export async function startHotspotTUI(): Promise<void> {
  const server = new LanServer();
  const adapter = createServerAdapter(server);
  const ctx = {
    ownSender: 'HOTSPOT',
    localIp: getLocalIP(),
    version: getVersion(),
  };

  try {
    await mountChatScreen(adapter, 'server', ctx);
    server.start();
  } catch (err) {
    server.stop();
    console.error(`[LANText] Failed to start hotspot UI: ${err instanceof Error ? err.stack : String(err)}`);
    process.exit(1);
  }
}
