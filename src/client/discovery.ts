// discovery.ts - UDP discovery collection for LanClient.
//
// A LAN sweep is not a race. The old implementation connected to the first
// reply and closed the socket, which made the outcome depend on packet
// ordering. This module probes the /24 + loopback, then keeps collecting for
// a short window so the caller can see every room before choosing.
//
// Timing contract:
//   - hard cap      1500 ms from scan start (no reply still reports []),
//   - collect window 700 ms from the FIRST valid reply,
//   - both timers are finalize paths; whichever fires first wins.
//
// Dedupe: by hostId when present, otherwise by source address. A legacy host
// has no identity, so two replies from one IP are one room. When the same
// hostId answers from several interfaces, prefer the non-loopback address
// (other devices can reach it) and then the lexicographically smaller address
// so the result does not depend on packet order.

import dgram, { type Socket as UdpSocket } from 'node:dgram';
import { PORTS, DISCOVERY_MSG } from '../protocol/constants.js';
import { parseDiscoveryReply, type DiscoveryReply } from '../protocol/discovery.js';
import { getSubnet } from '../protocol/network.js';

export interface DiscoveryDeps {
  getSubnet?: () => string;
  createSocket?: () => UdpSocket;
  /** Collection window after the first valid reply. Default 700 ms. */
  collectWindowMs?: number;
  /** Hard cap from scan start. Default 1500 ms. */
  scanTimeoutMs?: number;
}

export interface DiscoveryCallbacks {
  /** Called exactly once with every deduped room (empty when nobody answers). */
  onRooms: (rooms: DiscoveryReply[]) => void;
  onDebug: (msg: string) => void;
}

function isLoopback(address: string): boolean {
  return address === '127.0.0.1' || address === '::1';
}

function addressRank(address: string): string {
  return `${isLoopback(address) ? '1' : '0'}:${address}`;
}

function roomKey(room: DiscoveryReply): string {
  return room.hostId ? `host:${room.hostId}` : `addr:${room.address}`;
}

/** Start one discovery scan. Returns cleanup that closes the socket + timers. */
export function startDiscovery(
  callbacks: DiscoveryCallbacks,
  deps: DiscoveryDeps = {},
): () => void {
  const getSubnetFn = deps.getSubnet ?? getSubnet;
  const createSocket = deps.createSocket ?? (() => dgram.createSocket('udp4'));
  const collectWindowMs = deps.collectWindowMs ?? 700;
  const scanTimeoutMs = deps.scanTimeoutMs ?? 1500;

  const discoverySocket = createSocket();
  const subnet = getSubnetFn();
  const msg = Buffer.from(DISCOVERY_MSG);
  const rooms = new Map<string, DiscoveryReply>();

  let finished = false;
  let collectTimer: ReturnType<typeof setTimeout> | null = null;
  let scanTimer: ReturnType<typeof setTimeout> | null = null;

  const detach = (): void => {
    discoverySocket.removeListener('message', onMessage as never);
    discoverySocket.removeListener('error', onError);
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    if (collectTimer) { clearTimeout(collectTimer); collectTimer = null; }
    if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
    detach();
    try { discoverySocket.close(); } catch {}
    callbacks.onRooms([...rooms.values()]);
  };

  const onMessage = (buf: Buffer, rinfo: { address: string }): void => {
    if (finished) return;
    const room = parseDiscoveryReply(buf.toString(), rinfo.address);
    if (!room) {
      callbacks.onDebug(`Invalid discovery reply from ${rinfo.address}`);
      return;
    }

    const key = roomKey(room);
    const existing = rooms.get(key);
    if (!existing || addressRank(room.address) < addressRank(existing.address)) {
      rooms.set(key, room);
    }

    if (!collectTimer) {
      collectTimer = setTimeout(finish, collectWindowMs);
    }
  };

  const onError = (err: Error): void => {
    callbacks.onDebug(`Discovery error: ${err.message}`);
  };

  discoverySocket.on('message', onMessage as Parameters<UdpSocket['on']>[1]);
  discoverySocket.on('error', onError);

  scanTimer = setTimeout(finish, scanTimeoutMs);

  // Scan subnet, then probe loopback last. The loopback probe races the LAN
  // sweep, but the collect window means the race no longer decides the result.
  for (let i = 1; i <= 254; i++) {
    discoverySocket.send(msg, 0, msg.length, PORTS.UDP_DISCOVERY, `${subnet}.${i}`);
  }
  discoverySocket.send(msg, 0, msg.length, PORTS.UDP_DISCOVERY, '127.0.0.1');

  return () => {
    if (finished) {
      detach();
      return;
    }
    finished = true;
    if (collectTimer) { clearTimeout(collectTimer); collectTimer = null; }
    if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
    detach();
    try { discoverySocket.close(); } catch {}
  };
}
