// connection.ts - TCP connection handling for LanClient.
// Owns socket lifecycle, framing via protocol/codec, and disconnect detection.

import net, { type Socket } from 'node:net';
import { decodeEnvelope, splitBuffer, encodePayload } from '../protocol/codec.js';
import type { MessageEnvelope } from '../protocol/envelope.js';

export interface ConnectionDeps {
  createConnection?: typeof net.createConnection;
}

export interface ConnectionCallbacks {
  onMessage: (envelope: MessageEnvelope) => void;
  onDebug: (msg: string) => void;
  onConnected: (address: string) => void;
  onDisconnect: (reason: string) => void;
}

export interface ManagedConnection {
  socket: Socket;
  send: (text: string) => boolean;
  destroy: () => void;
}

export function createManagedConnection(
  address: string,
  port: number,
  callbacks: ConnectionCallbacks,
  deps: ConnectionDeps = {},
): ManagedConnection {
  const createConnection = deps.createConnection ?? net.createConnection;

  const socket = createConnection({ host: address, port }, () => {
    callbacks.onConnected(address);
  });

  socket.setEncoding('utf8');

  let buffer = '';
  socket.on('data', (data) => {
    const { lines, rest } = splitBuffer(buffer, data.toString());
    buffer = rest;
    for (const line of lines) {
      if (!line.trim()) continue;
      const envelope = decodeEnvelope(line);
      if (envelope) callbacks.onMessage(envelope);
      else callbacks.onDebug(`Failed to parse message: ${line.slice(0, 80)}`);
    }
  });

  const handleDisconnect = (reason: string): void => {
    callbacks.onDisconnect(reason);
  };

  socket.on('error', (err) => {
    callbacks.onDebug(`Connection error: ${err.message}`);
    handleDisconnect('error');
  });

  socket.on('end', () => handleDisconnect('server closed'));

  return {
    socket,
    send: (text: string) => {
      if ((socket as Socket).writable) {
        socket.write(encodePayload(text));
        return true;
      }
      return false;
    },
    destroy: () => {
      try { socket.destroy(); } catch {}
      const leftover = buffer.trim();
      if (leftover) {
        const env = decodeEnvelope(leftover);
        if (env) callbacks.onMessage(env);
      }
    },
  };
}
