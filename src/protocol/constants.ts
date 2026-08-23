// constants.ts - Protocol-level constants (ports, discovery messages).
// Single source of truth for UDP/TCP contracts.

export const PORTS = {
  TCP: 41236,
  UDP_DISCOVERY: 41237,
} as const;

export const DISCOVERY_MSG = 'LAN_CHAT_DISCOVERY';
export const FOUND_MSG = 'SERVER_FOUND';
