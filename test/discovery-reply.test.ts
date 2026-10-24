import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PORTS } from '../src/protocol/constants.js';
import { encodeDiscoveryReply, parseDiscoveryReply } from '../src/protocol/discovery.js';

test('parses a full identity reply', () => {
  const reply = parseDiscoveryReply(
    JSON.stringify({
      type: 'SERVER_FOUND',
      hostId: '6f1c2a9e-6b1f-4c1e-9a4e-2f7c1b0d8e33',
      name: "Victor's room",
      clients: 3,
      version: '3.0.0',
      port: 41236,
    }),
    '192.168.43.12',
  );

  assert.deepEqual(reply, {
    hostId: '6f1c2a9e-6b1f-4c1e-9a4e-2f7c1b0d8e33',
    name: "Victor's room",
    clients: 3,
    version: '3.0.0',
    port: 41236,
    address: '192.168.43.12',
  });
});

test('a legacy reply without identity fields still parses', () => {
  const reply = parseDiscoveryReply(
    JSON.stringify({ type: 'SERVER_FOUND', port: 41236 }),
    '10.0.0.7',
  );

  assert.deepEqual(reply, {
    hostId: null,
    name: null,
    clients: 0,
    version: null,
    port: 41236,
    address: '10.0.0.7',
  });
});

test('missing or invalid fields fall back to safe defaults', () => {
  const reply = parseDiscoveryReply(
    JSON.stringify({
      type: 'SERVER_FOUND',
      hostId: '   ',
      name: 42,
      clients: -2,
      version: '',
      port: 99999,
    }),
    '10.0.0.8',
  );

  assert.deepEqual(reply, {
    hostId: null,
    name: null,
    clients: 0,
    version: null,
    port: PORTS.TCP,
    address: '10.0.0.8',
  });
});

test('malformed JSON, wrong shape, and wrong type are rejected', () => {
  assert.equal(parseDiscoveryReply('not json', '10.0.0.1'), null);
  assert.equal(parseDiscoveryReply('null', '10.0.0.1'), null);
  assert.equal(parseDiscoveryReply('[]', '10.0.0.1'), null);
  assert.equal(parseDiscoveryReply(JSON.stringify({ type: 'SOMETHING_ELSE' }), '10.0.0.1'), null);
});

test('unknown fields are ignored, so mixed versions stay compatible', () => {
  const reply = parseDiscoveryReply(
    JSON.stringify({ type: 'SERVER_FOUND', port: 41236, future: { nope: true } }),
    '10.0.0.9',
  );

  assert.equal(reply?.port, 41236);
  assert.equal(reply?.hostId, null);
});

test('encodeDiscoveryReply emits the fields the parser expects', () => {
  const encoded = encodeDiscoveryReply({
    hostId: 'room-id',
    name: 'Room',
    clients: 1,
    version: '3.1.0',
  });
  const reply = parseDiscoveryReply(encoded, '192.168.1.20');

  assert.equal(reply?.hostId, 'room-id');
  assert.equal(reply?.name, 'Room');
  assert.equal(reply?.clients, 1);
  assert.equal(reply?.version, '3.1.0');
  assert.equal(reply?.port, PORTS.TCP);
});
