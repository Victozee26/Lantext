// discovery.ts - UDP discovery responder for LanServer.

import dgram, { type Socket as UdpSocket } from 'node:dgram';
import { PORTS, DISCOVERY_MSG, FOUND_MSG } from '../protocol/constants.js';

export interface DiscoveryResponder {
  start(onDebug: (msg: string) => void): UdpSocket;
  stop(): void;
}

export function createDiscoveryResponder(): DiscoveryResponder {
  let socket: UdpSocket | null = null;
  return {
    start(onDebug) {
      const s = dgram.createSocket('udp4');
      socket = s;
      s.bind(PORTS.UDP_DISCOVERY, () => {
        s.setBroadcast(true);
        onDebug(`Discovery listening on ${PORTS.UDP_DISCOVERY}`);
      });
      s.on('message', (msg, rinfo) => {
        if (msg.toString().trim() === DISCOVERY_MSG) {
          const response = JSON.stringify({ type: FOUND_MSG, port: PORTS.TCP, address: '0.0.0.0' });
          s.send(response, 0, response.length, rinfo.port, rinfo.address);
        }
      });
      return s;
    },
    stop() {
      if (socket) { try { socket.close(); } catch {} socket = null; }
    },
  };
}
