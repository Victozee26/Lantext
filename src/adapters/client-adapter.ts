// client-adapter.ts - Adapter wrapping LanClient into ChatSession.
// Single responsibility: translate transport events → ChatSession contract.
// BufferedSession covers early-event gap (see src/ui/buffered-session.ts).

import type { LanClient } from '../client.js';
import { BufferedSession } from '../ui/buffered-session.js';
import type { ChatSession } from '../ui/session-adapter.js';
import type { MessageEnvelope } from '../protocol/envelope.js';

export function createClientAdapter(client: LanClient): ChatSession {
  const buffered = new BufferedSession();

  client.on('status', (message: string) => buffered.emit('status', message));
  client.on('discovered', (address: string) => buffered.emit('discovered', address));
  client.on('connected', (address: string) => buffered.emit('connected', address));
  client.on('message', (envelope: MessageEnvelope) => buffered.emit('message', envelope));
  client.on('debug', (message: string) => {
    buffered.emit('debug', message);
    if (message.startsWith('Connection error')) {
      buffered.emit('error', message);
    }
  });

  return {
    on: (event, listener) => buffered.on(event, listener),
    off: (event, listener) => buffered.off(event, listener),
    send: (text) => client.send(text),
    stop: () => client.stop(),
  };
}
