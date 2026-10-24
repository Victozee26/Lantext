// discovery.ts - UDP discovery responder for LanServer.

import dgram, { type Socket as UdpSocket } from 'node:dgram';
import { PORTS, DISCOVERY_MSG, FOUND_MSG } from '../protocol/constants.js';

export interface DiscoveryResponder {
  start(onDebug: (msg: string) => void): void;
  stop(): void;
}

export function createDiscoveryResponder(): DiscoveryResponder {
  let socket: UdpSocket | null = null;

  return {
    start(onDebug) {
      if (socket) return;
      const s = dgram.createSocket('udp4');
      socket = s;
      s.bind(PORTS.UDP_DISCOVERY, () => {
        s.setBroadcast(true);
        onDebug(`Discovery listening on ${PORTS.UDP_DISCOVERY}`);
      });
      s.on('message', (msg, rinfo) => {
        if (msg.toString().trim() !== DISCOVERY_MSG) return;
        // The client connects to the address the datagram came FROM
        // (rinfo.address), so the payload carries no address field.
        const response = JSON.stringify({ type: FOUND_MSG, port: PORTS.TCP });
        s.send(response, 0, response.length, rinfo.port, rinfo.address);
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
