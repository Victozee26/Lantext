// broadcast.ts - Message broadcast with dedup history window.
// Single responsibility: encode, dedup, and fan-out.

import type { Socket } from 'node:net';
import { encodeEnvelope } from '../protocol/codec.js';
import type { MessageEnvelope } from '../protocol/envelope.js';

export class BroadcastHub {
  constructor(
    private readonly clients: Set<Socket>,
    private readonly history: Map<string, number>,
    private readonly windowMs: number,
  ) {}

  broadcast(envelope: MessageEnvelope, excludeSocket: Socket | null = null): void {
    const message = encodeEnvelope(envelope);
    const key = `${envelope.sender}:${envelope.text}`;
    this.history.set(key, envelope.timestamp);
    // clean
    const now = Date.now();
    for (const [key, ts] of this.history.entries()) {
      if (now - ts > this.windowMs) this.history.delete(key);
    }
    for (const client of this.clients) {
      if (client !== excludeSocket && client.writable) client.write(message);
    }
  }
}
