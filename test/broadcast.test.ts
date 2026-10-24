import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Socket } from 'node:net';
import { BroadcastHub } from '../src/server/broadcast.js';

interface FakeSocket {
  writable: boolean;
  writes: string[];
  write(chunk: string): boolean;
}

function fakeSocket(writable = true): FakeSocket {
  const writes: string[] = [];
  return {
    writable,
    writes,
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
  };
}

const asSocket = (s: FakeSocket): Socket => s as unknown as Socket;

test('broadcast writes one encoded line to every other writable client', () => {
  const a = fakeSocket();
  const b = fakeSocket();
  const hub = new BroadcastHub(new Set([asSocket(a), asSocket(b)]));

  hub.broadcast({ sender: 'HOST', timestamp: 1, text: 'hi' }, asSocket(a));

  assert.equal(a.writes.length, 0);
  assert.equal(b.writes.length, 1);
  assert.deepEqual(JSON.parse(b.writes[0]), { sender: 'HOST', timestamp: 1, text: 'hi' });
  assert.ok(b.writes[0].endsWith('\n'));
});

test('broadcast skips sockets that are no longer writable', () => {
  const dead = fakeSocket(false);
  const live = fakeSocket();
  const hub = new BroadcastHub(new Set([asSocket(dead), asSocket(live)]));

  hub.broadcast({ sender: 'HOST', timestamp: 1, text: 'hi' });

  assert.equal(dead.writes.length, 0);
  assert.equal(live.writes.length, 1);
});

test('repeated identical messages are NOT suppressed', () => {
  // Dedup by sender:text used to be dead ceremony. If it is ever added back,
  // it must not swallow legitimate repeats ("ok", "lol", "hahaha").
  const peer = fakeSocket();
  const hub = new BroadcastHub(new Set([asSocket(peer)]));
  const envelope = { sender: '192.168.1.5', timestamp: 1, text: 'ok' };

  hub.broadcast(envelope);
  hub.broadcast(envelope);

  assert.equal(peer.writes.length, 2);
});
