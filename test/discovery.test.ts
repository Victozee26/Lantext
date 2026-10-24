import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Socket as UdpSocket } from 'node:dgram';
import { startDiscovery } from '../src/client/discovery.js';
import { PORTS, DISCOVERY_MSG, FOUND_MSG } from '../src/protocol/constants.js';

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

test('scans the /24 plus loopback with the discovery message', () => {
  const udp = fakeUdp();
  const cleanup = startDiscovery(
    { onFound: () => {}, onDebug: () => {} },
    {
      createSocket: () => asUdp(udp),
      getSubnet: () => '192.168.43',
      discoveryTimeout: 60_000,
    },
  );

  assert.equal(udp.sends.length, 255);
  assert.equal(udp.sends[0].address, '192.168.43.1');
  assert.equal(udp.sends[253].address, '192.168.43.254');
  assert.equal(udp.sends[254].address, '127.0.0.1');
  assert.equal(udp.sends[0].port, PORTS.UDP_DISCOVERY);
  assert.equal(udp.sends[0].msg, DISCOVERY_MSG);

  cleanup();
});

test('the first valid responder wins and closes the socket', () => {
  const udp = fakeUdp();
  const found: string[] = [];
  const cleanup = startDiscovery(
    { onFound: (address) => found.push(address), onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '192.168.43', discoveryTimeout: 60_000 },
  );

  udp.emit('message', Buffer.from(JSON.stringify({ type: FOUND_MSG })), { address: '192.168.43.12' });
  udp.emit('message', Buffer.from(JSON.stringify({ type: FOUND_MSG })), { address: '192.168.43.99' });

  assert.deepEqual(found, ['192.168.43.12']);
  assert.equal(udp.closed, true);

  cleanup();
});

test('non-discovery replies are reported as debug, not as a host', () => {
  const udp = fakeUdp();
  const found: string[] = [];
  const debug: string[] = [];
  const cleanup = startDiscovery(
    { onFound: (address) => found.push(address), onDebug: (msg) => debug.push(msg) },
    { createSocket: () => asUdp(udp), getSubnet: () => '192.168.43', discoveryTimeout: 60_000 },
  );

  udp.emit('message', Buffer.from('not json'), { address: '192.168.43.12' });

  assert.deepEqual(found, []);
  assert.equal(debug.length, 1);
  assert.match(debug[0], /Invalid discovery response/);

  cleanup();
});

test('cleanup closes the socket and detaches listeners', () => {
  const udp = fakeUdp();
  const cleanup = startDiscovery(
    { onFound: () => {}, onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '10.0.0', discoveryTimeout: 60_000 },
  );

  cleanup();

  assert.equal(udp.closed, true);
  assert.equal(udp.handlers.has('message'), false);
  assert.equal(udp.handlers.has('error'), false);
});

test('the scan gives up after the discovery timeout', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const udp = fakeUdp();
  const found: string[] = [];

  startDiscovery(
    { onFound: (address) => found.push(address), onDebug: () => {} },
    { createSocket: () => asUdp(udp), getSubnet: () => '10.0.0', discoveryTimeout: 5000 },
  );

  t.mock.timers.tick(4999);
  assert.equal(udp.closed, false);

  t.mock.timers.tick(1);
  assert.equal(udp.closed, true);
  assert.deepEqual(found, []);
});
