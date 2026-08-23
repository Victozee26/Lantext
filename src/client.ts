// client.ts - Client for WiFi devices (facade over modular transport layers).
// Delegates discovery, connection, and reconnect scheduling to focused submodules.

import type { Socket } from 'node:net';
import { EventEmitter } from 'node:events';
import { PORTS } from './protocol/constants.js';
import { encodePayload } from './protocol/codec.js';
import { startDiscovery } from './client/discovery.js';
import { createManagedConnection, type ManagedConnection } from './client/connection.js';
import { createReconnectPolicy } from './client/reconnect.js';

export interface LanClientOptions {
  serverAddress?: string;
  /** @internal DI seams — injectable for tests */
  discoveryTimeout?: number;
  retryDelay?: number;
}

export class LanClient extends EventEmitter {
  fixedAddress: string | null;
  serverAddress: string | null;
  serverPort: number;
  connection: Socket | null;
  discoveryTimeout: number;
  retryDelay: number;
  isStopped: boolean;
  isSearching: boolean;
  _discoveryTimer: ReturnType<typeof setTimeout> | null;
  _reconnectTimer: ReturnType<typeof setTimeout> | null;

  #managed: ManagedConnection | null = null;
  #discoveryCleanup: (() => void) | null = null;
  #reconnect = createReconnectPolicy(2000);

  constructor(options: LanClientOptions = {}) {
    super();
    this.fixedAddress = options.serverAddress || null;
    this.serverAddress = this.fixedAddress;
    this.serverPort = PORTS.TCP;
    this.connection = null;
    this.discoveryTimeout = options.discoveryTimeout ?? 5000;
    this.retryDelay = options.retryDelay ?? 2000;
    this.isStopped = false;
    this.isSearching = false;
    this._discoveryTimer = null;
    this._reconnectTimer = null;
    this.#reconnect = createReconnectPolicy(this.retryDelay);
  }

  discover(): void {
    if (this.isStopped) return;
    if (!this.isSearching) {
      this.emit('status', 'Searching for LAN Chat Server...');
      this.isSearching = true;
    }

    let found = false;
    const cleanup = startDiscovery(
      {
        onFound: (address) => {
          if (found) return;
          found = true;
          this.isSearching = false;
          if (this._discoveryTimer) { clearTimeout(this._discoveryTimer); this._discoveryTimer = null; }
          this.serverAddress = address;
          this.emit('discovered', address);
          this.connect();
        },
        onDebug: (msg) => this.emit('debug', msg),
      },
      { discoveryTimeout: this.discoveryTimeout },
    );
    this.#discoveryCleanup = cleanup;

    // Retry if not found within timeout + grace
    const retryTimeout = setTimeout(() => {
      if (!found && !this.isStopped) {
        this._discoveryTimer = setTimeout(() => this.discover(), 1000);
      }
    }, this.discoveryTimeout + 50);
    // store to allow stop() to clear it
    const prevCleanup = this.#discoveryCleanup;
    this.#discoveryCleanup = () => {
      clearTimeout(retryTimeout);
      prevCleanup();
    };
  }

  connect(address: string | null = this.serverAddress): void {
    if (this.connection || this.isStopped) return;
    if (!address) return;
    this.serverAddress = address;

    const managed = createManagedConnection(
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
    this.connection = managed.socket;
  }

  #handleDisconnect(reason: string): void {
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
      this.#managed = null;
    }
    if (this.isStopped) return;
    this.emit('status', `Disconnected (${reason}). Reconnecting...`);
    this.isSearching = false;
    if (!this.fixedAddress) this.serverAddress = null;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this.#reconnect.schedule(() => this.start());
  }

  send(text: string): boolean {
    if (this.#managed) return this.#managed.send(text);
    if (this.connection && this.connection.writable) {
      this.connection.write(encodePayload(text));
      return true;
    }
    return false;
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
    if (this._discoveryTimer) { clearTimeout(this._discoveryTimer); this._discoveryTimer = null; }
    this.#reconnect.cancel();
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    if (this.#managed) { this.#managed.destroy(); this.#managed = null; }
    if (this.connection) {
      this.connection.end();
      this.connection.destroy();
      this.connection = null;
    }
  }
}
