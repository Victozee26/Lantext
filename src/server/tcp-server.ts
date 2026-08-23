// tcp-server.ts - TCP accept + per-socket line framing for LanServer.

import net, { type Server, type Socket } from 'node:net';
import { PORTS } from '../protocol/constants.js';
import { createEnvelope } from '../protocol/envelope.js';
import { decodePayload, splitBuffer } from '../protocol/codec.js';

export interface TcpServerEvents {
  onClientConnected: (id: string, count: number) => void;
  onClientDisconnected: (id: string, count: number) => void;
  onMessage: (envelope: ReturnType<typeof createEnvelope>) => void;
  onError: (msg: string) => void;
  onReady: (port: number) => void;
  broadcast: (envelope: ReturnType<typeof createEnvelope>, exclude: Socket | null) => void;
}

export function createTcpServer(
  clients: Set<Socket>,
  events: TcpServerEvents,
): Server {
  const server = net.createServer((socket) => {
    const clientId = `${socket.remoteAddress ?? 'unknown'}:${socket.remotePort ?? 'unknown'}`;
    clients.add(socket);
    events.onClientConnected(clientId, clients.size);

    socket.setEncoding('utf8');
    let buffer = '';
    const flushLine = (rawLine: string): void => {
      const text = decodePayload(rawLine);
      if (text === null) return;
      const envelope = createEnvelope(socket.remoteAddress, text);
      events.broadcast(envelope, socket);
      events.onMessage(envelope);
    };

    socket.on('data', (data) => {
      const { lines, rest } = splitBuffer(buffer, data.toString());
      buffer = rest;
      for (const raw of lines) flushLine(raw);
    });

    socket.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') {
        events.onError(`Client error (${clientId}): ${err.message}`);
      }
    });

    socket.on('end', () => {
      if (buffer.trim() !== '') { flushLine(buffer); buffer = ''; }
      clients.delete(socket);
      events.onClientDisconnected(clientId, clients.size);
    });

    socket.on('close', () => {
      if (buffer.trim() !== '') { flushLine(buffer); buffer = ''; }
    });
  });

  server.listen(PORTS.TCP, '0.0.0.0', () => events.onReady(PORTS.TCP));
  server.on('error', (err) => events.onError(`Server error: ${err.message}`));
  return server;
}
