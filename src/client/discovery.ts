// discovery.ts - UDP discovery for LanClient.
// Single responsibility: scan subnet + loopback, emit found/debug.

import dgram, { type Socket as UdpSocket } from 'node:dgram';
import { PORTS, DISCOVERY_MSG, FOUND_MSG } from '../protocol/constants.js';
import { getSubnet } from '../protocol/network.js';

export interface DiscoveryDeps {
  getSubnet?: () => string;
  createSocket?: () => UdpSocket;
  discoveryTimeout?: number;
}

export interface DiscoveryCallbacks {
  onFound: (address: string) => void;
  onDebug: (msg: string) => void;
}

/** Starts one discovery scan. Returns cleanup that closes socket + timers. */
export function startDiscovery(
  callbacks: DiscoveryCallbacks,
  deps: DiscoveryDeps = {},
): () => void {
  const getSubnetFn = deps.getSubnet ?? getSubnet;
  const createSocket = deps.createSocket ?? (() => dgram.createSocket('udp4'));
  const timeoutMs = deps.discoveryTimeout ?? 5000;

  const discoverySocket = createSocket();
  const subnet = getSubnetFn();
  const msg = Buffer.from(DISCOVERY_MSG);

  let found = false;
  let closed = false;

  const close = (): void => {
    if (!closed) {
      closed = true;
      try { discoverySocket.close(); } catch {}
    }
  };

  const timeout = setTimeout(() => {
    close();
    // caller handles retry via onFound not fired; no emit here to avoid spam
  }, timeoutMs);

  const onMessage = (buf: Buffer, rinfo: { address: string }): void => {
    try {
      const response = JSON.parse(buf.toString());
      if (response.type === FOUND_MSG && !found) {
        found = true;
        clearTimeout(timeout);
        close();
        callbacks.onFound(rinfo.address);
      }
    } catch (err) {
      callbacks.onDebug(`Invalid discovery response: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const onError = (err: Error): void => {
    callbacks.onDebug(`Discovery error: ${err.message}`);
  };

  discoverySocket.on('message', onMessage as Parameters<UdpSocket['on']>[1]);
  discoverySocket.on('error', onError);

  // Scan subnet
  for (let i = 1; i <= 254; i++) {
    discoverySocket.send(msg, 0, msg.length, PORTS.UDP_DISCOVERY, `${subnet}.${i}`);
  }
  // Loopback probe for same-host determinism
  discoverySocket.send(msg, 0, msg.length, PORTS.UDP_DISCOVERY, '127.0.0.1');

  return () => {
    clearTimeout(timeout);
    close();
    discoverySocket.removeListener('message', onMessage as never);
    discoverySocket.removeListener('error', onError);
  };
}
