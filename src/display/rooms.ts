// rooms.ts - Plain-text room formatting for non-TTY client output.

import type { DiscoveryReply } from '../protocol/discovery.js';

/** Human label: room name, falling back to the address for legacy hosts. */
export function roomLabel(room: Pick<DiscoveryReply, 'name' | 'address'>): string {
  return room.name ?? room.address;
}

function major(version: string | null): string | null {
  if (!version) return null;
  const [first] = version.split('.');
  return first || null;
}

/** True when both versions are known and their major components differ.
 *  Advisory only: a mismatch never blocks the connection. */
function versionMismatch(roomVersion: string | null, localVersion: string): boolean {
  const remote = major(roomVersion);
  const local = major(localVersion);
  return remote !== null && local !== null && remote !== local;
}

/** One-line room summary: label, endpoint, population, and version warning. */
export function formatRoom(room: DiscoveryReply, localVersion: string): string {
  const parts = [
    roomLabel(room),
    `${room.address}:${room.port}`,
    `${room.clients} online`,
  ];
  if (versionMismatch(room.version, localVersion)) {
    parts.push(`⚠ host v${room.version}`);
  }
  return parts.join(' · ');
}
