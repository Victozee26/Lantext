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
const ROOM_LOST_AFTER_SCANS = 3;

export interface RoomLostState {
  hostId: string;
  name: string;
  address: string;
}

export interface LanClientOptions {
  serverAddress?: string;
  /** Collection window after the first reply. Default 700 ms. */
  discoveryWindowMs?: number;
  /** Hard cap from scan start. Default 1500 ms. */
  discoveryScanMs?: number;
  retryDelay?: number;
  /** Interactive mode defers N>1 room choices to the UI picker. */
  interactive?: boolean;
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
  /** Room this client is attached to (null for SERVER= or before selection). */
  selectedRoom: DiscoveryReply | null;
  /** Set after three reconnect scans cannot find the selected hostId. */
  roomLost: RoomLostState | null;
  discoveryWindowMs: number;
  discoveryScanMs: number;
  retryDelay: number;
  /** True when a TTY picker can resolve N>1 rooms. */
  interactive: boolean;
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
  #reconnectTarget: string | null = null;
  #reconnectMisses = 0;

  constructor(options: LanClientOptions = {}) {
    super();
    this.fixedAddress = options.serverAddress || null;
    this.serverAddress = this.fixedAddress;
    this.serverPort = PORTS.TCP;
    this.rooms = [];
    this.selectedRoom = null;
    this.roomLost = null;
    this.discoveryWindowMs = options.discoveryWindowMs ?? 700;
    this.discoveryScanMs = options.discoveryScanMs ?? 1500;
    this.retryDelay = options.retryDelay ?? 2000;
    this.interactive = options.interactive ?? false;
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
    if (this.isStopped || this.roomLost) return;
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
          if (this.#reconnectTarget) {
            this.#handleReconnectRooms(rooms);
            return;
          }

          const chosen = pickRoom(rooms);
          if (!chosen) {
            this.emit('debug', 'No rooms answered discovery');
            this.#scheduleDiscoveryRetry();
            return;
          }

          if (rooms.length > 1) {
            this.emit('rooms', rooms);
            if (this.interactive) {
              this.isSearching = false;
              this.emit('status', `Found ${rooms.length} rooms — choose one`);
              return;
            }
          }

          this.isSearching = false;
          this.#connectToRoom(chosen);
        },
        onDebug: (msg) => this.emit('debug', msg),
      },
      {
        collectWindowMs: this.discoveryWindowMs,
        scanTimeoutMs: this.discoveryScanMs,
      },
    );
  }

  /** Sticky reconnect: only the remembered hostId may satisfy the scan. A
   *  different host answering is never an automatic substitute. */
  #handleReconnectRooms(rooms: DiscoveryReply[]): void {
    const target = this.#reconnectTarget;
    if (!target) return;

    const match = rooms.find((room) => room.hostId === target);
    if (match) {
      this.#reconnectMisses = 0;
      this.isSearching = false;
      this.#connectToRoom(match);
      return;
    }

    this.#reconnectMisses += 1;
    const name = this.selectedRoom?.name ?? this.selectedRoom?.address ?? target.slice(0, 8);
    if (this.#reconnectMisses >= ROOM_LOST_AFTER_SCANS) {
      const lost: RoomLostState = {
        hostId: target,
        name,
        address: this.selectedRoom?.address ?? '',
      };
      this.isSearching = false;
      this.roomLost = lost;
      this.emit('roomLost', lost);
      return;
    }

    this.emit(
      'status',
      `Room "${name}" not found (${this.#reconnectMisses}/${ROOM_LOST_AFTER_SCANS}). Retrying...`,
    );
    this.#scheduleDiscoveryRetry();
  }

  #connectToRoom(room: DiscoveryReply): void {
    this.selectedRoom = room;
    this.roomLost = null;
    this.#reconnectTarget = room.hostId;
    this.#reconnectMisses = 0;
    this.serverAddress = room.address;
    this.serverPort = room.port;
    this.emit('roomSelected', room);
    this.emit('discovered', room.address);
    this.connect(room.address);
  }

  /** Pick a room from the last discovery result. Key is hostId, or the
   *  address for legacy hosts. Used by the interactive picker. */
  selectRoom(key: string): boolean {
    const room = this.rooms.find((candidate) => (candidate.hostId ?? candidate.address) === key);
    if (!room) return false;
    if (this.#discoveryCleanup) { this.#discoveryCleanup(); this.#discoveryCleanup = null; }
    if (this.discoveryTimer) { clearTimeout(this.discoveryTimer); this.discoveryTimer = null; }
    this.isStopped = false;
    this.#reconnect.cancel();
    this.#connectToRoom(room);
    return true;
  }

  /** Retry the remembered room after a roomLost state. */
  retryRoom(): void {
    if (!this.roomLost) return;
    this.roomLost = null;
    this.#reconnectMisses = 0;
    this.#reconnectTarget = this.selectedRoom?.hostId ?? null;
    this.serverAddress = null;
    this.isStopped = false;
    this.#reconnect.cancel();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.discover();
  }

  /** Leave the lost room and discover again. Interactive mode will show the
   *  picker; non-TTY mode uses the deterministic pick. */
  chooseAnotherRoom(): void {
    this.roomLost = null;
    this.selectedRoom = null;
    this.#reconnectTarget = null;
    this.#reconnectMisses = 0;
    this.serverAddress = null;
    this.serverPort = PORTS.TCP;
    this.isStopped = false;
    this.#reconnect.cancel();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.discover();
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
    const stickyId = this.fixedAddress ? null : this.selectedRoom?.hostId ?? null;
    const roomLabel = this.selectedRoom?.name ?? this.selectedRoom?.address;
    this.emit(
      'status',
      stickyId
        ? `Disconnected (${reason}). Reconnecting to "${roomLabel}"...`
        : `Disconnected (${reason}). Reconnecting...`,
    );
    this.isSearching = false;
    if (!this.fixedAddress) {
      this.serverAddress = null;
      this.#reconnectTarget = stickyId;
    }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.#reconnect.schedule(() => this.start());
  }

  send(text: string): boolean {
    return this.#managed ? this.#managed.send(text) : false;
  }

  start(): void {
    if (this.roomLost) return;
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
