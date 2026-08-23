// hotspot.js - Combined server + client logic for hotspot devices
import net, { type Server, type Socket } from 'node:net';
import dgram, { type Socket as UdpSocket } from 'node:dgram';
import { EventEmitter } from 'node:events';
import { PORTS, DISCOVERY_MSG, FOUND_MSG, createEnvelope, type MessageEnvelope } from './utils.js';

export class LanServer extends EventEmitter {
  clients: Set<Socket>;
  messageHistory: Map<string, number>;
  HISTORY_WINDOW: number;
  server: Server | null;
  discoverySocket: UdpSocket | null;

  constructor() {
    super();
    this.clients = new Set();
    this.messageHistory = new Map();
    this.HISTORY_WINDOW = 2000;
    this.server = null;
    this.discoverySocket = null;
  }

  start(): void {
    // TCP Server
    this.server = net.createServer((socket) => {
      const clientId = `${socket.remoteAddress ?? 'unknown'}:${socket.remotePort ?? 'unknown'}`;
      this.clients.add(socket);
      this.emit('clientConnected', clientId, this.clients.size);

      socket.setEncoding('utf8');
      let buffer = '';
      const flushLine = (rawLine: string): void => {
        if (rawLine.length === 0) return;
        // Preserve leading spaces for code pastes; only skip truly empty lines.
        // Detect JSON-string encoded multi-line payloads (client sends
        // JSON.stringify(text) when text contains \n).
        let text: string | null = null;
        const trimmed = rawLine.trim();
        if (trimmed.length >= 2 && trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') {
          try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === 'string') text = parsed;
          } catch {
            // fall through to plain
          }
        }
        if (text === null) {
          let plain = rawLine;
          if (plain.endsWith('\r')) plain = plain.slice(0, -1);
          if (plain.trim() === '') return;
          text = plain;
        }
        // Normalize line endings that may have survived transport.
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // Strip a single trailing/leading blank line that a paste ending with
        // \n would otherwise leave; interior blank lines are preserved.
        const sendText = text.replace(/^\n+/, '').replace(/\n+$/, '');
        const finalText = sendText.length ? sendText : text;
        if (finalText.trim() === '') return;
        const envelope = createEnvelope(socket.remoteAddress, finalText);
        this.broadcast(envelope, socket);
        this.emit('message', envelope);
      };

      socket.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const rawLine of lines) {
          flushLine(rawLine);
        }
      });

      socket.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') {
          this.emit('error', `Client error (${clientId}): ${err.message}`);
        }
      });

      socket.on('end', () => {
        if (buffer.trim() !== '') {
          flushLine(buffer);
          buffer = '';
        }
        this.clients.delete(socket);
        this.emit('clientDisconnected', clientId, this.clients.size);
      });

      socket.on('close', () => {
        if (buffer.trim() !== '') {
          flushLine(buffer);
          buffer = '';
        }
      });
    });

    this.server.listen(PORTS.TCP, '0.0.0.0', () => {
      this.emit('ready', PORTS.TCP);
    });

    this.server.on('error', (err) => {
      this.emit('error', `Server error: ${err.message}`);
    });

    // UDP Discovery
    this.discoverySocket = dgram.createSocket('udp4');
    const discoverySocket = this.discoverySocket;
    discoverySocket.bind(PORTS.UDP_DISCOVERY, () => {
      discoverySocket.setBroadcast(true);
      this.emit('debug', `Discovery listening on ${PORTS.UDP_DISCOVERY}`);
    });

    discoverySocket.on('message', (msg, rinfo) => {
      if (msg.toString().trim() === DISCOVERY_MSG) {
        const response = JSON.stringify({
          type: FOUND_MSG,
          port: PORTS.TCP,
          address: '0.0.0.0',
        });
        discoverySocket.send(response, 0, response.length, rinfo.port, rinfo.address);
      }
    });
  }

  broadcast(envelope: MessageEnvelope, excludeSocket: Socket | null = null): void {
    const message = JSON.stringify(envelope) + '\n';
    const messageKey = `${envelope.sender}:${envelope.text}`;

    this.messageHistory.set(messageKey, envelope.timestamp);
    this.cleanHistory();

    this.clients.forEach((client) => {
      if (client !== excludeSocket && client.writable) {
        client.write(message);
      }
    });
  }

  cleanHistory(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.messageHistory.entries()) {
      if (now - timestamp > this.HISTORY_WINDOW) {
        this.messageHistory.delete(key);
      }
    }
  }

  send(text: string): MessageEnvelope {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const sendText = normalized.replace(/^\n+/, '').replace(/\n+$/, '');
    const finalText = sendText.length ? sendText : normalized;
    const envelope = createEnvelope('HOTSPOT', finalText);
    this.broadcast(envelope);
    return envelope;
  }

  stop(): void {
    this.clients.forEach(client => client.end());
    if (this.server) this.server.close();
    if (this.discoverySocket) this.discoverySocket.close();
  }
}
