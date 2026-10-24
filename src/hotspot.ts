// hotspot.ts - Combined host logic (facade).
// Delegates TCP, UDP discovery, and broadcast to focused submodules.

import type { Server, Socket } from 'node:net';
import { EventEmitter } from 'node:events';
import { createEnvelope, type MessageEnvelope } from './protocol/envelope.js';
import { normalizeForHost } from './protocol/codec.js';
import { getVersion } from './protocol/version.js';
import { BroadcastHub } from './server/broadcast.js';
import { createDiscoveryResponder } from './server/discovery.js';
import { resolveHostIdentity, type HostIdentity, type HostIdentityOptions } from './server/identity.js';
import { createTcpServer } from './server/tcp-server.js';

export interface LanServerOptions {
  /** Explicit room name; persisted to the host identity file. */
  name?: string;
  /** Pre-resolved identity (the TTY orchestrator prompts before starting). */
  identity?: HostIdentity;
  /** Advertised version; defaults to the build-injected package version. */
  version?: string;
  /** @internal DI seams for identity storage. */
  identityOptions?: HostIdentityOptions;
}

export class LanServer extends EventEmitter {
  clients: Set<Socket>;
  server: Server | null;
  /** Stable room identity for this host install. */
  identity: HostIdentity;

  #discovery: ReturnType<typeof createDiscoveryResponder>;
  #hub: BroadcastHub;
  #identityWarning: string | null;

  constructor(options: LanServerOptions = {}) {
    super();
    this.clients = new Set();
    this.server = null;

    const resolved = options.identity
      ? {
          hostId: options.identity.hostId,
          name: options.name ?? options.identity.name,
          warning: null as string | null,
        }
      : resolveHostIdentity({ ...options.identityOptions, name: options.name });

    this.identity = { hostId: resolved.hostId, name: resolved.name };
    this.#identityWarning = resolved.warning;
    this.#hub = new BroadcastHub(this.clients);
    this.#discovery = createDiscoveryResponder({
      hostId: this.identity.hostId,
      name: this.identity.name,
      version: options.version ?? getVersion(),
      getClientCount: () => this.clients.size,
    });
  }

  start(): void {
    if (this.#identityWarning) this.emit('debug', this.#identityWarning);
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
