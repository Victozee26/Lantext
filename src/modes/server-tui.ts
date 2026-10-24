// server-tui.ts - TTY path for host mode.
//
// Without `--name`, the host prompts for a room name before any socket opens.
// The default is the persisted name, so a returning host keeps its identity
// and can accept it with Enter. Cancelling the prompt returns without starting
// a server. The chosen name is handed to LanServer, which persists it through
// src/server/identity.ts.

import { LanServer } from '../hotspot.js';
import { resolveHostIdentity } from '../server/identity.js';
import { createServerAdapter } from '../adapters/server-adapter.js';
import { mountChatScreen } from '../ui/chat-screen.js';
import { openHostNamePrompt } from '../ui/host-name-screen.js';
import { getLocalIP } from '../protocol/network.js';
import { getVersion } from '../protocol/version.js';

export async function startHostTUI(name?: string): Promise<void> {
  let server: LanServer | null = null;

  try {
    let roomName = name;
    if (roomName === undefined) {
      const identity = resolveHostIdentity();
      const chosen = await openHostNamePrompt(identity.name);
      if (chosen === null) return;
      roomName = chosen;
    }

    server = new LanServer({ name: roomName });
    const adapter = createServerAdapter(server);
    const ctx = {
      ownSender: 'HOST',
      localIp: getLocalIP(),
      version: getVersion(),
      roomName: server.identity.name,
    };

    await mountChatScreen(adapter, 'host', ctx);
    server.start();
  } catch (err) {
    server?.stop();
    console.error(`[LANText] Failed to start host UI: ${err instanceof Error ? err.stack : String(err)}`);
    process.exit(1);
  }
}
