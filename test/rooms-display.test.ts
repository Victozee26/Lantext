import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRoom, roomLabel } from '../src/display/rooms.js';
import type { DiscoveryReply } from '../src/protocol/discovery.js';

function room(overrides: Partial<DiscoveryReply> = {}): DiscoveryReply {
  return {
    hostId: '6f1c2a9e-6b1f-4c1e-9a4e-2f7c1b0d8e33',
    name: "Victor's room",
    clients: 3,
    version: '3.1.0',
    port: 41236,
    address: '192.168.43.10',
    ...overrides,
  };
}

test('roomLabel prefers the name and falls back to the address', () => {
  assert.equal(roomLabel(room()), "Victor's room");
  assert.equal(roomLabel(room({ name: null })), '192.168.43.10');
});

test('formatRoom shows endpoint and population', () => {
  assert.equal(
    formatRoom(room(), '3.1.0'),
    "Victor's room · 192.168.43.10:41236 · 3 online",
  );
});

test('a major-version mismatch adds a warning but still formats', () => {
  assert.match(formatRoom(room({ version: '2.9.0' }), '3.1.0'), /⚠ host v2\.9\.0/);
});

test('same major or unknown version does not warn', () => {
  assert.doesNotMatch(formatRoom(room({ version: '3.9.9' }), '3.1.0'), /⚠/);
  assert.doesNotMatch(formatRoom(room({ version: null }), '3.1.0'), /⚠/);
});
