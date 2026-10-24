// network.ts - Host network helpers.
// Injectable os dependency keeps module testable and UI-decoupled.
//
// Interface selection matters: `os.networkInterfaces()` returns interfaces in
// OS-dependent order, and a laptop/phone commonly has several non-internal
// IPv4 addresses (WiFi + mobile data, VPN, docker bridge, VM adapters). Picking
// the first one can advertise or scan the wrong subnet, which looks exactly
// like "discovery is broken".
//
// Selection order:
//   1. `LAN_TEXT_IFACE` (explicit override, matched by interface name)
//   2. first non-virtual interface with a private IPv4 address
//   3. first non-virtual interface
//   4. first IPv4 candidate
//   5. 127.0.0.1
//
// Known limit: `getSubnet()` assumes a /24. That is true for essentially every
// consumer hotspot and home router; a wider LAN needs the explicit `SERVER=`
// address path.

import os from 'node:os';

export type NetworkInterfacesProvider = typeof os.networkInterfaces;

/** Interface names that are almost never the LAN link a user means. */
const VIRTUAL_IFACE = /^(lo|docker|br-|veth|virbr|vmnet|vboxnet|utun|tun|tap|wg|zt|tailscale)/i;

interface Candidate {
  name: string;
  address: string;
  virtual: boolean;
  private: boolean;
}

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local
  return false;
}

function collect(provider: NetworkInterfacesProvider): Candidate[] {
  const interfaces = provider();
  const candidates: Candidate[] = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const iface of addrs ?? []) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      candidates.push({
        name,
        address: iface.address,
        virtual: VIRTUAL_IFACE.test(name),
        private: isPrivateV4(iface.address),
      });
    }
  }
  return candidates;
}

export function getLocalIP(
  provider: NetworkInterfacesProvider = os.networkInterfaces,
  ifaceName?: string,
): string {
  const override = ifaceName ?? process.env.LAN_TEXT_IFACE;
  const candidates = collect(provider);
  const named = override ? candidates.find((c) => c.name === override) : undefined;
  const pick =
    named ??
    candidates.find((c) => !c.virtual && c.private) ??
    candidates.find((c) => !c.virtual) ??
    candidates[0];
  return pick?.address ?? '127.0.0.1';
}

export function getSubnet(
  provider: NetworkInterfacesProvider = os.networkInterfaces,
  ifaceName?: string,
): string {
  const ip = getLocalIP(provider, ifaceName);
  return ip.split('.').slice(0, 3).join('.');
}
