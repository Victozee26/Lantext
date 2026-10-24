// discovery.ts - Discovery reply wire contract.
// Legacy-tolerant parser for the unicast JSON datagram a host sends back.
// The request stays the raw `LAN_CHAT_DISCOVERY` string (constants.ts); only
// the reply gained identity fields in 3.1.0.
//
// Trust boundary: `address` always comes from the UDP datagram source
// (rinfo.address), never from the payload. A host cannot advertise an
// arbitrary connect address.

import { FOUND_MSG, PORTS } from './constants.js';

export interface DiscoveryReply {
  /** Stable room identity. Null for legacy 3.0 hosts that do not send it. */
  hostId: string | null;
  /** Human-readable room name. Null for legacy hosts. */
  name: string | null;
  /** Advertised online client count. Zero when absent or invalid. */
  clients: number;
  /** Advertised host version. Null for legacy hosts. */
  version: string | null;
  /** Advertised TCP port; falls back to the protocol default. */
  port: number;
  /** Source address of the UDP datagram (rinfo.address). */
  address: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function validPort(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65535
    ? value
    : null;
}

/**
 * Parse one discovery reply datagram. Returns null for malformed JSON, a
 * non-object payload, or a non-`SERVER_FOUND` type. Unknown JSON fields are
 * ignored, so a new client can talk to a legacy host and vice versa.
 */
export interface DiscoveryReplyInput {
  hostId: string;
  name: string;
  clients: number;
  version: string;
  /** Defaults to the protocol TCP port. */
  port?: number;
}

/** Encode the host side of the reply. Keeps fields in one module so server
 *  and client cannot drift apart. */
export function encodeDiscoveryReply(input: DiscoveryReplyInput): string {
  return JSON.stringify({
    type: FOUND_MSG,
    hostId: input.hostId,
    name: input.name,
    clients: input.clients,
    version: input.version,
    port: validPort(input.port) ?? PORTS.TCP,
  });
}

/**
 * Parse one discovery reply datagram. Returns null for malformed JSON, a
 * non-object payload, or a non-`SERVER_FOUND` type. Unknown JSON fields are
 * ignored, so a new client can talk to a legacy host and vice versa.
 */
export function parseDiscoveryReply(raw: string, address: string): DiscoveryReply | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.type !== FOUND_MSG) return null;

  return {
    hostId: nonEmptyString(parsed.hostId),
    name: nonEmptyString(parsed.name),
    clients: nonNegativeInteger(parsed.clients) ?? 0,
    version: nonEmptyString(parsed.version),
    port: validPort(parsed.port) ?? PORTS.TCP,
    address,
  };
}
