// selection.ts - Pure room ranking policy.
// Kept separate from transport lifecycle so it can be tested without sockets.
//
// Deterministic pick: most online clients, then lexicographic hostId (legacy
// rooms use their address because they have no hostId). Never "first packet
// wins" — packet order is not a policy.

import type { DiscoveryReply } from '../protocol/discovery.js';

function roomSortKey(room: DiscoveryReply): string {
  return room.hostId ?? room.address;
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Rank rooms best-first without mutating the input. */
export function rankRooms(rooms: readonly DiscoveryReply[]): DiscoveryReply[] {
  // ES2022 target has no Array#toSorted; copy first so the input is untouched.
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...rooms].sort((a, b) => {
    if (a.clients !== b.clients) return b.clients - a.clients;
    return compareStrings(roomSortKey(a), roomSortKey(b));
  });
}

/** Deterministic room choice, or null when discovery found nothing. */
export function pickRoom(rooms: readonly DiscoveryReply[]): DiscoveryReply | null {
  return rankRooms(rooms)[0] ?? null;
}
