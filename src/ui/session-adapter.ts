// session-adapter.ts - The event surface the LanText UI needs from a chat
// session. Client and server orchestrators produce adapters (Phase 4); the
// UI never imports transport types (`src/client.ts`, `src/hotspot.ts`).
//
// Event payload shapes below are derived from the ACTUAL emit calls in the
// transports today, not from intent. See the per-event notes.
//
// Known gaps vs the transport reality (flagged honestly):
// - `LanClient` NEVER emits `'error'` today (also visible in client-mode.ts's
//   dead `client.on('error', ...)` listener). Phase 4 must either map
//   observable failures (surfaced today via `status`/`debug`) onto `error`,
//   or document the gap.
// - `error` payloads are preformatted STRINGS everywhere they exist
//   (LanServer emits `"Server error: ..."` / `"Client error (id): ..."`).
//   The old client-mode listener typed them as `Error` — that was dead code.
// - `clientConnected`/`clientDisconnected` are emitted with two positional
//   args by LanServer; this interface normalizes them to a single object.
// - `send()`: LanClient.send returns boolean, LanServer.send returns
//   MessageEnvelope. The adapter normalizes to a boolean success indicator.
// - No transport emits every event: LanClient covers status/debug/discovered/
//   connected/message; LanServer covers debug/message/error/ready/
//   clientConnected/clientDisconnected.

import type { MessageEnvelope } from '../utils.js';

/** Payload for client-count events (LanServer 'clientConnected'/'clientDisconnected'). */
export interface ClientCountEvent {
  /** Remote socket identity: `<ip>:<port>` as built by LanServer. */
  clientId: string;
  /** LanServer's client Set size at emit time. */
  totalClients: number;
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
  /** A chat message arrived. Payload: `MessageEnvelope` from src/utils.ts
   *  (`{ sender, timestamp, text }`). LanClient: parsed from the
   *  newline-delimited JSON stream sent by the server. LanServer: built via
   *  `createEnvelope(remoteAddress, text)`; the same envelope is broadcast
   *  to other clients. */
  message: (envelope: MessageEnvelope) => void;
  /** Fatal or recoverable failure. Payload: preformatted STRING.
   *  Emitted by LanServer only today (`Server error: ...`, `Client error
   *  (id): ...` for non-ECONNRESET socket errors). GAP: LanClient never
   *  emits `error` — Phase 4 reconciles. */
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
 * transport adapters (Phase 4) and by in-memory fakes in tests.
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
}