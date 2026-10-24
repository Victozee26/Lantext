// client-adapter.ts - Adapter wrapping LanClient into ChatSession.
// Single responsibility: translate transport events → ChatSession contract.
// BufferedSession covers early-event gap (see src/ui/buffered-session.ts).

import type { LanClient } from '../client.js';
import { BufferedSession } from '../ui/buffered-session.js';
import type { ChatSession, RoomLostInfo } from '../ui/session-adapter.js';
import type { MessageEnvelope } from '../protocol/envelope.js';
import type { DiscoveryReply } from '../protocol/discovery.js';

export function createClientAdapter(client: LanClient): ChatSession {
  const buffered = new BufferedSession();

  client.on('status', (message: string) => buffered.emit('status', message));
  client.on('discovered', (address: string) => buffered.emit('discovered', address));
  client.on('connected', (address: string) => buffered.emit('connected', address));
  client.on('message', (envelope: MessageEnvelope) => buffered.emit('message', envelope));
  client.on('rooms', (rooms: DiscoveryReply[]) => buffered.emit('rooms', rooms));
  client.on('roomSelected', (room: DiscoveryReply) => buffered.emit('roomSelected', room));
  client.on('roomLost', (room: RoomLostInfo) => buffered.emit('roomLost', room));
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
    selectRoom: (key) => client.selectRoom(key),
    retryRoom: () => client.retryRoom(),
    chooseAnotherRoom: () => client.chooseAnotherRoom(),
  };
}
