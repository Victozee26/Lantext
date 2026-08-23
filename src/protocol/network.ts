// network.ts - Host network helpers.
// Injectable os dependency keeps module testable and UI-decoupled.

import os from 'node:os';

export type NetworkInterfacesProvider = typeof os.networkInterfaces;

export function getLocalIP(provider: NetworkInterfacesProvider = os.networkInterfaces): string {
  const interfaces = provider();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

export function getSubnet(provider: NetworkInterfacesProvider = os.networkInterfaces): string {
  const ip = getLocalIP(provider);
  return ip.split('.').slice(0, 3).join('.');
}
