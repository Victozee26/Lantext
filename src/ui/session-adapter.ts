// session-adapter.ts - The event surface the LanText UI needs from a chat
// session. Client and server orchestrators produce adapters
// (`src/adapters/*`); the UI never imports transport types (`src/client.ts`,
// `src/hotspot.ts`).
//
// Event payload shapes below are derived from the ACTUAL emit calls in the
// transports today, not from intent. See the per-event notes.
//
// Transport reality:
// - `LanClient` never emits `'error'`; the client adapter promotes its
//   `Connection error: ...` debug line to `error`.
// - `error` payloads are preformatted STRINGS everywhere they exist
//   (LanServer emits `"Server error: ..."` / `"Client error (id): ..."`).
// - `clientConnected`/`clientDisconnected` are emitted with two positional
//   args by LanServer; this interface normalizes them to a single object.
// - `send()`: LanClient.send returns boolean, LanServer.send returns
//   MessageEnvelope. The adapter normalizes to a boolean success indicator.
// - No transport emits every event: LanClient covers status/debug/discovered/
//   connected/rooms/roomSelected/roomLost/message; LanServer covers
//   debug/message/error/ready/clientConnected/clientDisconnected.

import type { MessageEnvelope } from '../protocol/envelope.js';

/** Payload for client-count events (LanServer 'clientConnected'/'clientDisconnected'). */
interface ClientCountEvent {
  /** Remote socket identity: `<ip>:<port>` as built by LanServer. */
  clientId: string;
  /** LanServer's client Set size at emit time. */
  totalClients: number;
}

/** One discovered room, as shown by the picker and status bar. Structurally
 *  matches the transport's `DiscoveryReply` without importing transport code. */
export interface RoomInfo {
  /** Stable room identity; null for legacy 3.0 hosts. */
  hostId: string | null;
  /** Human room name; null for legacy hosts. */
  name: string | null;
  /** Advertised online client count. */
  clients: number;
  /** Advertised host version; null for legacy hosts. */
  version: string | null;
  /** Advertised TCP port. */
  port: number;
  /** Source IP of the discovery reply. */
  address: string;
}

/** Payload for the explicit roomLost event. */
export interface RoomLostInfo {
  hostId: string;
  name: string;
  address: string;
}

/**
 * Typed event map for a chat session. Each key maps to the listener
 * signature; `Parameters<ChatSessionEventMap[K]>` gives the payload types.
 */
export interface ChatSessionEventMap {
  /** Human-readable lifecycle line. Payload: message string.
   *  Emitted by LanClient: `'Searching for LAN Chat Server...'` (discovery
   *  start) and `` `Disconnected (${reason}). Reconnecting...` ``. */
  status: (message: string) => void;
  /** Diagnostic line (rendered only when DEBUG=true in the non-TTY path).
   *  Payload: message string. LanClient: invalid discovery response,
   *  discovery socket error, connection error, message-parse failure.
   *  LanServer: `'Discovery listening on 41237'`. */
  debug: (message: string) => void;
  /** A server was found via UDP discovery. Payload: server IP string
   *  (e.g. `'192.168.1.5'`). Emitted by LanClient only. */
  discovered: (address: string) => void;
  /** TCP connection to the server established. Payload: server IP string.
   *  Emitted by LanClient only. */
  connected: (address: string) => void;
  /** Multiple rooms answered discovery. Payload: every deduped room.
   *  Emitted by LanClient only. Interactive clients wait for `selectRoom()`;
   *  non-interactive clients immediately connect to the deterministic pick. */
  rooms: (rooms: RoomInfo[]) => void;
  /** The room this client is attached to (auto-selected or human choice).
   *  Payload: `RoomInfo`. Emitted by LanClient only. */
  roomSelected: (room: RoomInfo) => void;
  /** Sticky reconnect gave up after three scans without the remembered
   *  `hostId`. Payload: `RoomLostInfo`. Emitted by LanClient only. */
  roomLost: (room: RoomLostInfo) => void;
  /** A chat message arrived. Payload: `MessageEnvelope` from
   *  src/protocol/envelope.ts (`{ sender, timestamp, text }`). LanClient: parsed from the
   *  newline-delimited JSON stream sent by the server. LanServer: built via
   *  `createEnvelope(remoteAddress, text)`; the same envelope is broadcast
   *  to other clients. */
  message: (envelope: MessageEnvelope) => void;
  /** Fatal or recoverable failure. Payload: preformatted STRING. LanServer
   *  emits `Server error: ...` / `Client error (id): ...`; the client adapter
   *  promotes `Connection error: ...` debug lines. */
  error: (message: string) => void;
  /** Server is listening. Payload: TCP port number (41236). Emitted by
   *  LanServer only. */
  ready: (port: number) => void;
  /** A client socket joined the server. Emitted by LanServer only. */
  clientConnected: (event: ClientCountEvent) => void;
  /** A client socket ended. Emitted by LanServer only (socket `'end'`;
   *  note: sockets that error with non-ECONNRESET are not removed and do
   *  not emit this today). */
  clientDisconnected: (event: ClientCountEvent) => void;
}

export type ChatSessionEventName = keyof ChatSessionEventMap;

/**
 * Minimal typed EventEmitter-style contract for the UI. Implemented by
 * `src/adapters/*` and by in-memory fakes in tests.
 * Deliberately NOT Node's EventEmitter class: keeps `src/ui/` decoupled,
 * typed per event, and trivially fakeable.
 */
export interface ChatSession {
  on<K extends ChatSessionEventName>(event: K, listener: ChatSessionEventMap[K]): void;
  off<K extends ChatSessionEventName>(event: K, listener: ChatSessionEventMap[K]): void;
  /** Send one chat line. Returns false when the transport cannot send
   *  (e.g. no live connection). Normalized from the transports' differing
   *  return types. */
  send(text: string): boolean;
  /** Stop transport sockets/timers. Must be safe to call once only;
   *  repeated calls are guarded by the runtime's idempotent teardown. */
  stop(): void;
  /** Client-only: pick a room from the last `rooms` payload. Key is `hostId`,
   *  or the address for legacy hosts. Returns false when the room is gone. */
  selectRoom?(key: string): boolean;
  /** Client-only: retry the lost room after `roomLost`. */
  retryRoom?(): void;
  /** Client-only: leave the lost room and discover again. */
  chooseAnotherRoom?(): void;
}