import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { createDiscoveryResponder } from '../src/server/discovery.js';
import { DISCOVERY_MSG } from '../src/protocol/constants.js';
import { parseDiscoveryReply } from '../src/protocol/discovery.js';

const ROOM_NAME = 'Café ☕';

test('responder sends a multi-byte room name without truncating the datagram', { timeout: 5000 }, async () => {
  const responder = createDiscoveryResponder({
    hostId: 'room-id',
    name: ROOM_NAME,
    version: '3.1.0',
    getClientCount: () => 1,
    port: 0,
  });
  const client = dgram.createSocket('udp4');

  try {
    const ready = new Promise<number>((resolve) => {
      responder.start((msg) => {
        const match = /^Discovery listening on (\d+)$/.exec(msg);
        if (match) resolve(Number(match[1]));
      });
    });

    await new Promise<void>((resolve, reject) => {
      client.once('error', reject);
      client.bind(0, '127.0.0.1', () => {
        client.off('error', reject);
        resolve();
      });
    });

    const port = await ready;
    const datagram = await new Promise<Buffer>((resolve, reject) => {
      client.once('error', reject);
      client.once('message', resolve);
      client.send(DISCOVERY_MSG, port, '127.0.0.1', (err) => {
        if (err) reject(err);
      });
    });

    const reply = parseDiscoveryReply(datagram.toString('utf8'), '127.0.0.1');
    assert.equal(reply?.name, ROOM_NAME);
  } finally {
    responder.stop();
    try {
      client.close();
    } catch {}
  }
});
