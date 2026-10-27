// discovery.ts - UDP discovery responder for LanServer.
// Answers the fixed `LAN_CHAT_DISCOVERY` probe with the host's room identity.
// The reply is unicast to the datagram source; the client connects to that
// source address, so no connect address is carried on the wire.

import dgram, { type Socket as UdpSocket } from 'node:dgram';
import { PORTS, DISCOVERY_MSG } from '../protocol/constants.js';
import { encodeDiscoveryReply } from '../protocol/discovery.js';

export interface DiscoveryResponderOptions {
  hostId: string;
  name: string;
  version: string;
  /** Read lazily so every reply reflects the current client set. */
  getClientCount: () => number;
  /** UDP port to bind. Defaults to PORTS.UDP_DISCOVERY; tests use 0. */
  port?: number;
}

export interface DiscoveryResponder {
  start(onDebug: (msg: string) => void): void;
  stop(): void;
}

export function createDiscoveryResponder(options: DiscoveryResponderOptions): DiscoveryResponder {
  let socket: UdpSocket | null = null;

  return {
    start(onDebug) {
      if (socket) return;
      const s = dgram.createSocket('udp4');
      socket = s;
      s.bind(options.port ?? PORTS.UDP_DISCOVERY, () => {
        s.setBroadcast(true);
        onDebug(`Discovery listening on ${s.address().port}`);
      });
      s.on('message', (msg, rinfo) => {
        if (msg.toString().trim() !== DISCOVERY_MSG) return;
        const response = encodeDiscoveryReply({
          hostId: options.hostId,
          name: options.name,
          clients: options.getClientCount(),
          version: options.version,
          port: PORTS.TCP,
        });
        s.send(response, rinfo.port, rinfo.address);
      });
      s.on('error', (err) => onDebug(`Discovery socket error: ${err.message}`));
    },
    stop() {
      if (!socket) return;
      const s = socket;
      socket = null;
      try { s.close(); } catch {}
    },
  };
}
