import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Socket as UdpSocket } from 'node:dgram';
import { startDiscovery } from '../src/client/discovery.js';
import { PORTS, DISCOVERY_MSG } from '../src/protocol/constants.js';
import type { DiscoveryReply } from '../src/protocol/discovery.js';

type Handler = (...args: unknown[]) => void;

interface FakeUdp {
  sends: Array<{ msg: string; port: number; address: string }>;
  closed: boolean;
  handlers: Map<string, Handler>;
  on(event: string, handler: Handler): void;
  removeListener(event: string, handler: Handler): void;
  send(msg: Buffer, offset: number, length: number, port: number, address: string): void;
  close(): void;
  emit(event: string, ...args: unknown[]): void;
}

function fakeUdp(): FakeUdp {
  const sends: Array<{ msg: string; port: number; address: string }> = [];
  const handlers = new Map<string, Handler>();
  const socket: FakeUdp = {
    sends,
    closed: false,
    handlers,
    on(event, handler) {
      handlers.set(event, handler);
    },
    removeListener(event, handler) {
      if (handlers.get(event) === handler) handlers.delete(event);
    },
    send(msg, _offset, _length, port, address) {
      sends.push({ msg: msg.toString(), port, address });
    },
    close() {
      socket.closed = true;
    },
    emit(event, ...args) {
      handlers.get(event)?.(...args);
    },
  };
  return socket;
}

function asUdp(socket: FakeUdp): UdpSocket {
  return socket as unknown as UdpSocket;
}

function reply(hostId: string, name: string, extra: Record<string, unknown> = {}): Buffer {
  return Buffer.from(JSON.stringify({
    type: 'SERVER_FOUND',
    hostId,
    name,
    clients: 1,
    version: '3.1.0',
    port: PORTS.TCP,
    ...extra,
  }));
}

function legacyReply(): Buffer {
  return Buffer.from(JSON.stringify({ type: 'SERVER_FOUND', port: PORTS.TCP }));
}

test('scans the /24 plus loopback with the discovery message', () => {
  const udp = fakeUdp();
  const cleanup = startDiscovery(
    { onRooms: () => {}, onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '192.168.43' },
  );

  assert.equal(udp.sends.length, 255);
  assert.equal(udp.sends[0].address, '192.168.43.1');
  assert.equal(udp.sends[253].address, '192.168.43.254');
  assert.equal(udp.sends[254].address, '127.0.0.1');
  assert.equal(udp.sends[0].port, PORTS.UDP_DISCOVERY);
  assert.equal(udp.sends[0].msg, DISCOVERY_MSG);

  cleanup();
});

test('collects every room and closes after the window from the first reply', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const udp = fakeUdp();
  let result: DiscoveryReply[] | null = null;

  const cleanup = startDiscovery(
    { onRooms: (rooms) => { result = rooms; }, onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '192.168.43' },
  );

  udp.emit('message', reply('host-a', 'Room A'), { address: '192.168.43.10' });
  t.mock.timers.tick(200);
  udp.emit('message', reply('host-b', 'Room B'), { address: '192.168.43.11' });

  t.mock.timers.tick(499);
  assert.equal(result, null);
  t.mock.timers.tick(1);

  assert.deepEqual(
    (result as DiscoveryReply[] | null)?.map((room) => room.hostId),
    ['host-a', 'host-b'],
  );
  assert.equal(udp.closed, true);
  cleanup();
});

test('dedupes by hostId and prefers the non-loopback address', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const udp = fakeUdp();
  let result: DiscoveryReply[] = [];

  const cleanup = startDiscovery(
    { onRooms: (rooms) => { result = rooms; }, onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '192.168.43' },
  );

  udp.emit('message', reply('same-host', 'Room'), { address: '127.0.0.1' });
  udp.emit('message', reply('same-host', 'Room'), { address: '192.168.43.10' });
  t.mock.timers.tick(700);

  assert.equal(result.length, 1);
  assert.equal(result[0].hostId, 'same-host');
  assert.equal(result[0].address, '192.168.43.10');
  cleanup();
});

test('legacy replies dedupe by source address', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const udp = fakeUdp();
  let result: DiscoveryReply[] = [];

  const cleanup = startDiscovery(
    { onRooms: (rooms) => { result = rooms; }, onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '192.168.43' },
  );

  udp.emit('message', legacyReply(), { address: '192.168.43.10' });
  udp.emit('message', legacyReply(), { address: '192.168.43.10' });
  udp.emit('message', legacyReply(), { address: '192.168.43.11' });
  t.mock.timers.tick(700);

  assert.equal(result.length, 2);
  assert.equal(result[0].hostId, null);
  assert.deepEqual(result.map((room) => room.address).sort(), ['192.168.43.10', '192.168.43.11']);
  cleanup();
});

test('no replies finalizes an empty result at the hard cap', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const udp = fakeUdp();
  let result: DiscoveryReply[] | null = null;

  const cleanup = startDiscovery(
    { onRooms: (rooms) => { result = rooms; }, onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '10.0.0' },
  );

  t.mock.timers.tick(1499);
  assert.equal(result, null);
  t.mock.timers.tick(1);

  assert.deepEqual(result, []);
  assert.equal(udp.closed, true);
  cleanup();
});

test('the hard cap wins over a late first reply', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const udp = fakeUdp();
  let result: DiscoveryReply[] | null = null;

  const cleanup = startDiscovery(
    { onRooms: (rooms) => { result = rooms; }, onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '10.0.0' },
  );

  t.mock.timers.tick(1400);
  udp.emit('message', reply('late-host', 'Late'), { address: '10.0.0.9' });
  t.mock.timers.tick(99);
  assert.equal(result, null);
  t.mock.timers.tick(1);

  assert.equal((result as DiscoveryReply[] | null)?.length, 1);
  assert.equal((result as DiscoveryReply[] | null)?.[0].hostId, 'late-host');
  cleanup();
});

test('invalid and non-discovery replies are debug lines, not rooms', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const udp = fakeUdp();
  const debug: string[] = [];
  let result: DiscoveryReply[] | null = null;

  const cleanup = startDiscovery(
    { onRooms: (rooms) => { result = rooms; }, onDebug: (msg) => debug.push(msg) },
    { createSocket: () => asUdp(udp), getSubnet: () => '192.168.43' },
  );

  udp.emit('message', Buffer.from('not json'), { address: '192.168.43.10' });
  udp.emit('message', Buffer.from(JSON.stringify({ type: 'OTHER' })), { address: '192.168.43.11' });
  t.mock.timers.tick(1500);

  assert.deepEqual(result, []);
  assert.equal(debug.length, 2);
  assert.match(debug[0], /Invalid discovery reply/);
  cleanup();
});

test('replies after close are ignored', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const udp = fakeUdp();
  let result: DiscoveryReply[] | null = null;
  let calls = 0;

  const cleanup = startDiscovery(
    { onRooms: (rooms) => { calls += 1; result = rooms; }, onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '10.0.0' },
  );

  t.mock.timers.tick(1500);
  assert.equal(calls, 1);
  udp.emit('message', reply('late', 'Late'), { address: '10.0.0.8' });
  t.mock.timers.tick(5000);

  assert.equal(calls, 1);
  assert.deepEqual(result, []);
  cleanup();
});

test('cleanup cancels a pending scan and detaches listeners', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const udp = fakeUdp();
  let called = false;

  const cleanup = startDiscovery(
    { onRooms: () => { called = true; }, onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '10.0.0' },
  );

  cleanup();
  t.mock.timers.tick(5000);

  assert.equal(called, false);
  assert.equal(udp.closed, true);
  assert.equal(udp.handlers.has('message'), false);
  assert.equal(udp.handlers.has('error'), false);
  cleanup();
});
