// hotspot.ts - Combined host logic (facade).
// Delegates TCP, UDP discovery, and broadcast to focused submodules.

import type { Server, Socket } from 'node:net';
import { EventEmitter } from 'node:events';
import { createEnvelope, type MessageEnvelope } from './protocol/envelope.js';
import { normalizeForHost } from './protocol/codec.js';
import { BroadcastHub } from './server/broadcast.js';
import { createDiscoveryResponder } from './server/discovery.js';
import { createTcpServer } from './server/tcp-server.js';

export class LanServer extends EventEmitter {
  clients: Set<Socket>;
  server: Server | null;

  #discovery = createDiscoveryResponder();
  #hub: BroadcastHub;

  constructor() {
    super();
    this.clients = new Set();
    this.server = null;
    this.#hub = new BroadcastHub(this.clients);
  }

  start(): void {
    this.server = createTcpServer(this.clients, {
      onClientConnected: (id, count) => this.emit('clientConnected', id, count),
      onClientDisconnected: (id, count) => this.emit('clientDisconnected', id, count),
      onMessage: (env) => this.emit('message', env),
      onError: (msg) => this.emit('error', msg),
      onReady: (port) => this.emit('ready', port),
      broadcast: (env, exclude) => this.#hub.broadcast(env, exclude),
    });

    this.#discovery.start((msg) => this.emit('debug', msg));
  }

  broadcast(envelope: MessageEnvelope, excludeSocket: Socket | null = null): void {
    this.#hub.broadcast(envelope, excludeSocket);
  }

  send(text: string): MessageEnvelope {
    const finalText = normalizeForHost(text);
    if (finalText === '') return createEnvelope('HOST', '');
    const envelope = createEnvelope('HOST', finalText);
    this.broadcast(envelope);
    return envelope;
  }

  stop(): void {
    for (const client of this.clients) client.end();
    this.clients.clear();
    if (this.server) this.server.close();
    this.#discovery.stop();
  }
}
