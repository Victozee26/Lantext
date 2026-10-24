import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DiscoveryReply } from '../src/protocol/discovery.js';
import { pickRoom, rankRooms } from '../src/client/selection.js';

function room(hostId: string | null, address: string, clients = 0): DiscoveryReply {
  return { hostId, name: hostId ?? address, clients, version: null, port: 41236, address };
}

test('no rooms means no pick', () => {
  assert.equal(pickRoom([]), null);
});

test('the busiest room wins', () => {
  const chosen = pickRoom([
    room('host-a', '10.0.0.1', 1),
    room('host-b', '10.0.0.2', 5),
    room('host-c', '10.0.0.3', 3),
  ]);
  assert.equal(chosen?.hostId, 'host-b');
});

test('ties break on lexicographic hostId, not packet order', () => {
  const chosen = pickRoom([
    room('host-z', '10.0.0.1', 2),
    room('host-a', '10.0.0.2', 2),
  ]);
  assert.equal(chosen?.hostId, 'host-a');
});

test('legacy rooms fall back to the address for tie-breaking', () => {
  const chosen = pickRoom([
    room(null, '10.0.0.9', 2),
    room(null, '10.0.0.2', 2),
  ]);
  assert.equal(chosen?.address, '10.0.0.2');
});

test('ranking does not mutate the input', () => {
  const input = [
    room('host-z', '10.0.0.1', 2),
    room('host-a', '10.0.0.2', 2),
  ];
  const ranked = rankRooms(input);
  assert.deepEqual(input.map((item) => item.hostId), ['host-z', 'host-a']);
  assert.deepEqual(ranked.map((item) => item.hostId), ['host-a', 'host-z']);
});
