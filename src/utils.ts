// utils.js - Shared utilities and constants
import { readFileSync } from 'node:fs';
import os from 'node:os';

export interface MessageEnvelope {
  sender: string;
  timestamp: number;
  text: string;
}

let cachedVersion: string | undefined;

/** Shared runtime version read from package.json. Cached after the first
 *  read; any read/parse failure degrades to '?' instead of throwing. A
 *  direct JSON import is impossible because tsconfig rootDir is `src` and
 *  package.json lives at the repository root (compiled code resolves
 *  ../package.json relative to dist/). */
export function getVersion(): string {
  if (cachedVersion === undefined) {
    try {
      const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
      const pkg = JSON.parse(raw) as { version?: unknown };
      cachedVersion = typeof pkg.version === 'string' && pkg.version !== '' ? pkg.version : '?';
    } catch {
      cachedVersion = '?';
    }
  }
  return cachedVersion;
}

export const PORTS = {
  TCP: 41236,
  UDP_DISCOVERY: 41237,
};

export const DISCOVERY_MSG = 'LAN_CHAT_DISCOVERY';
export const FOUND_MSG = 'SERVER_FOUND';

export function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

export function getSubnet() {
  const ip = getLocalIP();
  return ip.split('.').slice(0, 3).join('.');
}

export function createEnvelope(sender: string | undefined, text: string): MessageEnvelope {
  return {
    sender: sender ?? 'UNKNOWN',
    timestamp: Date.now(),
    text,
  };
}
