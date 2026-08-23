// hotspot.ts - Combined server logic for hotspot devices (facade).
// Delegates TCP, UDP discovery, and broadcast to focused submodules.

import type { Server, Socket } from 'node:net';
import type { Socket as UdpSocket } from 'node:dgram';
import { EventEmitter } from 'node:events';
import { createEnvelope, type MessageEnvelope } from './protocol/envelope.js';
import { normalizeForHotspot } from './protocol/codec.js';
import { BroadcastHub } from './server/broadcast.js';
import { createDiscoveryResponder } from './server/discovery.js';
import { createTcpServer } from './server/tcp-server.js';

export class LanServer extends EventEmitter {
  clients: Set<Socket>;
  messageHistory: Map<string, number>;
  HISTORY_WINDOW: number;
  server: Server | null;
  discoverySocket: UdpSocket | null;

  #discovery = createDiscoveryResponder();
  #hub: BroadcastHub;

  constructor() {
    super();
    this.clients = new Set();
    this.messageHistory = new Map();
    this.HISTORY_WINDOW = 2000;
    this.server = null;
    this.discoverySocket = null;
    this.#hub = new BroadcastHub(this.clients, this.messageHistory, this.HISTORY_WINDOW);
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

    this.discoverySocket = this.#discovery.start((msg) => this.emit('debug', msg));
  }

  broadcast(envelope: MessageEnvelope, excludeSocket: Socket | null = null): void {
    this.#hub.broadcast(envelope, excludeSocket);
  }

  cleanHistory(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.messageHistory.entries()) {
      if (now - timestamp > this.HISTORY_WINDOW) {
        this.messageHistory.delete(key);
      }
    }
  }

  send(text: string): MessageEnvelope {
    const finalText = normalizeForHotspot(text);
    if (finalText === '') return createEnvelope('HOTSPOT', '');
    const envelope = createEnvelope('HOTSPOT', finalText);
    this.broadcast(envelope);
    return envelope;
  }

  stop(): void {
    for (const client of this.clients) client.end();
    if (this.server) this.server.close();
    this.#discovery.stop();
    if (this.discoverySocket) { try { this.discoverySocket.close(); } catch {} this.discoverySocket = null; }
  }
}
