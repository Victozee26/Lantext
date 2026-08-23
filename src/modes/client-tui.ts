// client-tui.ts - TTY path for client mode.
// Owns transport startup after TUI mount; BufferedSession covers race.

import { LanClient } from '../client.js';
import { createClientAdapter } from '../adapters/client-adapter.js';
import { mountChatScreen } from '../ui/chat-screen.js';
import { getLocalIP } from '../protocol/network.js';
import { getVersion } from '../protocol/version.js';

export async function startClientTUI(serverAddress: string | undefined): Promise<void> {
  const client = new LanClient({ serverAddress });
  const adapter = createClientAdapter(client);
  const ctx = {
    ownSender: getLocalIP(),
    localIp: getLocalIP(),
    version: getVersion(),
  };

  try {
    await mountChatScreen(adapter, 'client', ctx);
    client.start();
  } catch (err) {
    client.stop();
    console.error(`[LANText] Failed to start client UI: ${err instanceof Error ? err.stack : String(err)}`);
    process.exit(1);
  }
}
