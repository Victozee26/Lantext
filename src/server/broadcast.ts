// broadcast.ts - Message fan-out to connected clients.
// Single responsibility: encode once, write to every writable client except
// the originating socket.
//
// There is no dedup layer here on purpose: the transport never loops a
// client's own line back to it (the sender socket is excluded), and the host
// never re-emits its own sends, so a duplicate would mean a real duplicate on
// the wire. Suppressing messages by `sender:text` would silently swallow
// legitimate repeats ("ok", "lol") inside the window.

import type { Socket } from 'node:net';
import { encodeEnvelope } from '../protocol/codec.js';
import type { MessageEnvelope } from '../protocol/envelope.js';

export class BroadcastHub {
  constructor(private readonly clients: Set<Socket>) {}

  broadcast(envelope: MessageEnvelope, excludeSocket: Socket | null = null): void {
    const message = encodeEnvelope(envelope);
    for (const client of this.clients) {
      if (client !== excludeSocket && client.writable) client.write(message);
    }
  }
}
