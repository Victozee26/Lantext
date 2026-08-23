// server-adapter.ts - Adapter wrapping LanServer into ChatSession.

import type { LanServer } from '../hotspot.js';
import { BufferedSession } from '../ui/buffered-session.js';
import type { ChatSession } from '../ui/session-adapter.js';
import type { MessageEnvelope } from '../protocol/envelope.js';

export function createServerAdapter(server: LanServer): ChatSession {
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
