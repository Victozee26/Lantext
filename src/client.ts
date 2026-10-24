// client.ts - Client for WiFi devices (facade over modular transport layers).
// Delegates discovery, connection, and reconnect scheduling to focused
// submodules. Discovery now returns every room in the collect window; the
// caller applies a deterministic selection policy until the picker UI lands.

import { EventEmitter } from 'node:events';
import { PORTS } from './protocol/constants.js';
import type { DiscoveryReply } from './protocol/discovery.js';
import { startDiscovery as defaultStartDiscovery } from './client/discovery.js';
import { pickRoom } from './client/selection.js';
import {
  createManagedConnection as defaultCreateConnection,
  type ManagedConnection,
} from './client/connection.js';
import { createReconnectPolicy } from './client/reconnect.js';

const DISCOVERY_RETRY_MS = 1000;

export interface LanClientOptions {
  serverAddress?: string;
  /** Collection window after the first reply. Default 700 ms. */
  discoveryWindowMs?: number;
  /** Hard cap from scan start. Default 1500 ms. */
  discoveryScanMs?: number;
  retryDelay?: number;
  /** @internal DI seams — injectable for tests */
  startDiscovery?: typeof defaultStartDiscovery;
  createConnection?: typeof defaultCreateConnection;
  discoveryRetryMs?: number;
}

export class LanClient extends EventEmitter {
  fixedAddress: string | null;
  serverAddress: string | null;
  serverPort: number;
  /** Last discovery result. Empty until a scan completes. */
  rooms: DiscoveryReply[];
  discoveryWindowMs: number;
  discoveryScanMs: number;
  retryDelay: number;
  isStopped: boolean;
  isSearching: boolean;
  discoveryTimer: ReturnType<typeof setTimeout> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;

  #managed: ManagedConnection | null = null;
  #discoveryCleanup: (() => void) | null = null;
  #reconnect = createReconnectPolicy(2000);
  #startDiscovery: typeof defaultStartDiscovery;
  #createConnection: typeof defaultCreateConnection;
  #discoveryRetryMs: number;

  constructor(options: LanClientOptions = {}) {
    super();
    this.fixedAddress = options.serverAddress || null;
    this.serverAddress = this.fixedAddress;
    this.serverPort = PORTS.TCP;
    this.rooms = [];
    this.discoveryWindowMs = options.discoveryWindowMs ?? 700;
    this.discoveryScanMs = options.discoveryScanMs ?? 1500;
    this.retryDelay = options.retryDelay ?? 2000;
    this.isStopped = false;
    this.isSearching = false;
    this.discoveryTimer = null;
    this.reconnectTimer = null;
    this.#reconnect = createReconnectPolicy(this.retryDelay);
    this.#startDiscovery = options.startDiscovery ?? defaultStartDiscovery;
    this.#createConnection = options.createConnection ?? defaultCreateConnection;
    this.#discoveryRetryMs = options.discoveryRetryMs ?? DISCOVERY_RETRY_MS;
  }

  discover(): void {
    if (this.isStopped) return;
    if (this.#discoveryCleanup) return;

    if (this.discoveryTimer) {
      clearTimeout(this.discoveryTimer);
      this.discoveryTimer = null;
    }
    if (!this.isSearching) {
      this.emit('status', 'Searching for LAN Chat Server...');
      this.isSearching = true;
    }

    this.#discoveryCleanup = this.#startDiscovery(
      {
        onRooms: (rooms) => {
          this.#discoveryCleanup = null;
          if (this.isStopped) return;

          this.rooms = rooms;
          const chosen = pickRoom(rooms);
          if (!chosen) {
            this.emit('debug', 'No rooms answered discovery');
            this.#scheduleDiscoveryRetry();
            return;
          }

          this.isSearching = false;
          this.serverAddress = chosen.address;
          this.serverPort = chosen.port;
          this.emit('discovered', chosen.address);
          this.connect(chosen.address);
        },
        onDebug: (msg) => this.emit('debug', msg),
      },
      {
        collectWindowMs: this.discoveryWindowMs,
        scanTimeoutMs: this.discoveryScanMs,
      },
    );
  }

  #scheduleDiscoveryRetry(): void {
    if (this.isStopped) return;
    if (this.discoveryTimer) clearTimeout(this.discoveryTimer);
    this.discoveryTimer = setTimeout(() => {
      this.discoveryTimer = null;
      this.discover();
    }, this.#discoveryRetryMs);
  }

  connect(address: string | null = this.serverAddress): void {
    if (this.#managed || this.isStopped) return;
    if (!address) return;
    this.serverAddress = address;

    const managed = this.#createConnection(
      address,
      this.serverPort,
      {
        onConnected: (addr) => this.emit('connected', addr),
        onMessage: (env) => this.emit('message', env),
        onDebug: (msg) => this.emit('debug', msg),
        onDisconnect: (reason) => this.#handleDisconnect(reason),
      },
    );
    this.#managed = managed;
  }

  #handleDisconnect(reason: string): void {
    if (this.#managed) {
      this.#managed.destroy();
      this.#managed = null;
    }
    if (this.isStopped) return;
    this.emit('status', `Disconnected (${reason}). Reconnecting...`);
    this.isSearching = false;
    if (!this.fixedAddress) this.serverAddress = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.#reconnect.schedule(() => this.start());
  }

  send(text: string): boolean {
    return this.#managed ? this.#managed.send(text) : false;
  }

  start(): void {
    this.isStopped = false;
    this.#reconnect.cancel();
    if (this.serverAddress) {
      this.connect();
    } else {
      this.discover();
    }
  }

  stop(): void {
    this.isStopped = true;
    this.isSearching = false;
    if (this.#discoveryCleanup) { this.#discoveryCleanup(); this.#discoveryCleanup = null; }
    if (this.discoveryTimer) { clearTimeout(this.discoveryTimer); this.discoveryTimer = null; }
    this.#reconnect.cancel();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.#managed) { this.#managed.destroy(); this.#managed = null; }
  }
}
