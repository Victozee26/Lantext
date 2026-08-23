// client.js - Client for WiFi devices
import net, { type Socket } from 'node:net';
import dgram, { type Socket as UdpSocket } from 'node:dgram';
import { EventEmitter } from 'node:events';
import { PORTS, DISCOVERY_MSG, FOUND_MSG, getSubnet, type MessageEnvelope } from './utils.js';

interface LanClientOptions {
  serverAddress?: string;
}

export class LanClient extends EventEmitter {
  fixedAddress: string | null;
  serverAddress: string | null;
  serverPort: number;
  connection: Socket | null;
  discoveryTimeout: number;
  retryDelay: number;
  isStopped: boolean;
  isSearching: boolean;
  _discoveryTimer: ReturnType<typeof setTimeout> | null;
  _reconnectTimer: ReturnType<typeof setTimeout> | null;

  constructor(options: LanClientOptions = {}) {
    super();
    this.fixedAddress = options.serverAddress || null;
    this.serverAddress = this.fixedAddress;
    this.serverPort = PORTS.TCP;
    this.connection = null;
    this.discoveryTimeout = 5000;
    this.retryDelay = 2000;
    this.isStopped = false;
    this.isSearching = false;
    this._discoveryTimer = null;
    this._reconnectTimer = null;
  }

  discover(): void {
    if (this.isStopped) return;
    
    if (!this.isSearching) {
      this.emit('status', 'Searching for LAN Chat Server...');
      this.isSearching = true;
    }

    const discoverySocket: UdpSocket = dgram.createSocket('udp4');
    const subnet = getSubnet();
    const msg = Buffer.from(DISCOVERY_MSG);

    let found = false;
    const timeout = setTimeout(() => {
      discoverySocket.close();
      if (!found && !this.isStopped) {
        // Retry discovery without emitting error to avoid UI spam
        this._discoveryTimer = setTimeout(() => this.discover(), 1000);
      }
    }, this.discoveryTimeout);

    // Scan subnet
    for (let i = 1; i <= 254; i++) {
      discoverySocket.send(msg, 0, msg.length, PORTS.UDP_DISCOVERY, `${subnet}.${i}`);
    }

    // Loopback probe: makes same-host testing deterministic
    discoverySocket.send(msg, 0, msg.length, PORTS.UDP_DISCOVERY, '127.0.0.1');

    discoverySocket.on('message', (msg, rinfo) => {
      try {
        const response = JSON.parse(msg.toString());
        if (response.type === FOUND_MSG && !found) {
          found = true;
          this.isSearching = false;
          clearTimeout(timeout);
          discoverySocket.close();
          this.serverAddress = rinfo.address;
          this.emit('discovered', this.serverAddress);
          this.connect();
        }
      } catch (err) {
        this.emit('debug', `Invalid discovery response: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    discoverySocket.on('error', (err) => {
      this.emit('debug', `Discovery error: ${err.message}`);
    });
  }

  connect(address: string | null = this.serverAddress): void {
    if (this.connection || this.isStopped) return;
    if (!address) return;
    this.serverAddress = address;

    this.connection = net.createConnection({ host: address, port: this.serverPort }, () => {
      this.emit('connected', address);
    });

    this.connection.setEncoding('utf8');

    let buffer = '';
    this.connection.on('data', (data) => {
      buffer += data;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      lines.forEach(line => {
        if (line.trim()) {
          try {
            const envelope = JSON.parse(line) as MessageEnvelope;
            this.emit('message', envelope);
          } catch (err) {
            this.emit('debug', `Failed to parse message: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      });
    });

    const handleDisconnect = (reason: string): void => {
      if (this.connection) {
        this.connection.destroy();
        this.connection = null;
      }
      
      if (this.isStopped) return;

      this.emit('status', `Disconnected (${reason}). Reconnecting...`);
      this.isSearching = false;
      
      // If we discovered the address, clear it so we re-discover
      if (!this.fixedAddress) {
        this.serverAddress = null;
      }

      if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
      this._reconnectTimer = setTimeout(() => this.start(), this.retryDelay);
    };

    this.connection.on('error', (err) => {
      this.emit('debug', `Connection error: ${err.message}`);
      handleDisconnect('error');
    });

    this.connection.on('end', () => {
      handleDisconnect('server closed');
    });
  }

  send(text: string): boolean {
    if (this.connection && this.connection.writable) {
      // Normalize line endings and preserve multi-line pastes unambiguously.
      // Plain `text + '\n'` is ambiguous when `text` itself contains `\n`:
      // the server's line splitter would treat interior `\n` as separate
      // messages. For multi-line payloads we JSON-encode the string so
      // interior `\n` becomes the escape `\n` (two chars) and the outer
      // delimiter remains the single trailing `\n`. Single-line payloads are
      // left as-is for backward compatibility.
      const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const payload = normalized.includes('\n')
        ? JSON.stringify(normalized) + '\n'
        : normalized + '\n';
      this.connection.write(payload);
      return true;
    }
    return false;
  }

  start(): void {
    this.isStopped = false;
    if (this.serverAddress) {
      this.connect();
    } else {
      this.discover();
    }
  }

  stop(): void {
    this.isStopped = true;
    this.isSearching = false;
    if (this._discoveryTimer) clearTimeout(this._discoveryTimer);
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.connection) {
      this.connection.end();
      this.connection.destroy();
      this.connection = null;
    }
  }
}
