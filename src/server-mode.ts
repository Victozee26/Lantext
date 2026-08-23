// server-mode.js - Orchestrator for Hotspot/Server mode.
//
// Two execution paths, chosen by process.stdin.isTTY (mirrors
// src/client-mode.ts):
// - TTY: build the ChatSession adapter (wrapping LanServer), boot the
//   OpenTUI chat runtime via mountChatScreen (<App mode="server">), THEN
//   start the transport. Early events (e.g. the 'debug' discovery line)
//   are buffered by src/ui/buffered-session.ts until the React mount
//   effect subscribes — nothing is lost.
// - Non-TTY: today's plain-output path (banner, status lines, formatted
//   messages, client badges) with piped input via src/input.ts. No
//   renderer.
//
// Adapter notes: LanServer emits 'error' with preformatted STRING payloads
// and clientConnected/clientDisconnected with two positional args; the
// adapter normalizes both to the ChatSession contract. LanServer.send
// returns a MessageEnvelope; the adapter normalizes to the boolean
// success indicator the UI wants (true = broadcast attempted).

import {
  status, statusSuccess, statusError,
  formatIncoming, formatSent, clientConnected, clientDisconnected,
  showBanner, debug as debugLog, theme,
} from './ui.js';
import { LanServer } from './hotspot.js';
import { setupInput } from './input.js';
import { BufferedSession } from './ui/buffered-session.js';
import { mountChatScreen } from './ui/chat-screen.js';
import type { ChatSession } from './ui/session-adapter.js';
import type { MessageEnvelope } from './utils.js';

/** Adapter wrapping LanServer into the UI's ChatSession contract. */
function createServerAdapter(server: LanServer): ChatSession {
  const buffered = new BufferedSession();

  server.on('debug', (message: string) => buffered.emit('debug', message));
  server.on('error', (message: string) => buffered.emit('error', message));
  server.on('ready', (port: number) => buffered.emit('ready', port));
  server.on('message', (envelope: MessageEnvelope) => buffered.emit('message', envelope));
  server.on('clientConnected', (clientId: string, totalClients: number) => {
    buffered.emit('clientConnected', { clientId, totalClients });
  });
  server.on('clientDisconnected', (clientId: string, totalClients: number) => {
    buffered.emit('clientDisconnected', { clientId, totalClients });
  });

  return {
    on: (event, listener) => buffered.on(event, listener),
    off: (event, listener) => buffered.off(event, listener),
    send: (text) => {
      server.send(text);
      return true;
    },
    stop: () => server.stop(),
  };
}

/** TTY path: OpenTUI chat screen. The transport starts only after the
 *  runtime is up; the adapter's BufferedSession covers the remaining gap. */
async function startHotspotTUI(): Promise<void> {
  const server = new LanServer();
  const adapter = createServerAdapter(server);

  try {
    await mountChatScreen(adapter, 'server');
    server.start();
  } catch (err) {
    server.stop();
    console.error(`[LANText] Failed to start hotspot UI: ${err instanceof Error ? err.stack : String(err)}`);
    process.exit(1);
  }
}

/** Non-TTY path: today's plain-output behavior (banner, status lines,
 *  formatted messages, client badges) with piped input. */
function startHotspotPlain(): void {
  showBanner('hotspot');
  const server = new LanServer();
  // Piped input is registered once (guarded: 'ready' fires once, but the
  // guard keeps the shape robust against transport changes).
  let inputStarted = false;

  server.on('ready', (port: number) => {
    statusSuccess('HOTSPOT', `Server listening on port ${theme.info(String(port))}`);
    status('HOTSPOT', 'Waiting for clients...');
    if (!inputStarted) {
      inputStarted = true;
      setupInput((text) => {
        server.send(text);
        formatSent(text);
      });
    }
  });

  server.on('clientConnected', (id: string, count: number) => {
    clientConnected(id, count);
  });

  server.on('clientDisconnected', (id: string, count: number) => {
    clientDisconnected(id, count);
  });

  server.on('message', (envelope: MessageEnvelope) => {
    formatIncoming(envelope);
  });

  server.on('error', (msg: string) => statusError('HOTSPOT', msg));
  server.on('debug', (msg: string) => debugLog('HOTSPOT', msg));

  server.start();

  process.on('SIGINT', () => {
    console.log();
    status('HOTSPOT', theme.muted('Shutting down hotspot...'));
    server.stop();
    process.exit(0);
  });
}

export async function startHotspot(): Promise<void> {
  if (process.stdin.isTTY) {
    await startHotspotTUI();
  } else {
    startHotspotPlain();
  }
}