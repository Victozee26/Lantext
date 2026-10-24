import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LanClient } from '../src/client.js';
import type { DiscoveryCallbacks, startDiscovery } from '../src/client/discovery.js';
import type { ConnectionCallbacks, createManagedConnection } from '../src/client/connection.js';
import type { DiscoveryReply } from '../src/protocol/discovery.js';

interface Scan {
  callbacks: DiscoveryCallbacks;
  closed: boolean;
}

interface FakeConnection {
  address: string;
  port: number;
  callbacks: ConnectionCallbacks;
  destroyed: boolean;
  sent: string[];
}

function harness() {
  const scans: Scan[] = [];
  const connections: FakeConnection[] = [];

  const starter: typeof startDiscovery = (callbacks) => {
    const scan: Scan = { callbacks, closed: false };
    scans.push(scan);
    return () => { scan.closed = true; };
  };

  const factory: typeof createManagedConnection = (address, port, callbacks) => {
    const record: FakeConnection = {
      address,
      port,
      callbacks,
      destroyed: false,
      sent: [],
    };
    connections.push(record);
    return {
      send: (text) => { record.sent.push(text); return true; },
      destroy: () => { record.destroyed = true; },
    };
  };

  return { scans, connections, starter, factory };
}

function room(
  hostId: string,
  address: string,
  clients: number,
  port = 41236,
): DiscoveryReply {
  return { hostId, name: hostId, clients, version: '3.1.0', port, address };
}

test('zero rooms schedules another scan after the retry interval', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scans, starter, factory } = harness();
  const client = new LanClient({
    startDiscovery: starter,
    createConnection: factory,
    discoveryRetryMs: 1000,
  });

  client.start();
  assert.equal(scans.length, 1);

  scans[0].callbacks.onRooms([]);
  t.mock.timers.tick(999);
  assert.equal(scans.length, 1);
  t.mock.timers.tick(1);
  assert.equal(scans.length, 2);

  client.stop();
});

test('one room connects to its advertised address and port', () => {
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({ startDiscovery: starter, createConnection: factory });
  const discovered: string[] = [];
  client.on('discovered', (address: string) => discovered.push(address));

  client.start();
  scans[0].callbacks.onRooms([room('host-a', '192.168.43.10', 2, 5000)]);

  assert.equal(connections.length, 1);
  assert.equal(connections[0].address, '192.168.43.10');
  assert.equal(connections[0].port, 5000);
  assert.deepEqual(discovered, ['192.168.43.10']);

  client.stop();
});

test('multiple rooms use the deterministic pick', () => {
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({ startDiscovery: starter, createConnection: factory });

  client.start();
  scans[0].callbacks.onRooms([
    room('host-a', '192.168.43.10', 7),
    room('host-b', '192.168.43.11', 9),
  ]);

  assert.equal(connections.length, 1);
  assert.equal(connections[0].address, '192.168.43.11');

  client.stop();
});

test('SERVER= bypasses discovery', () => {
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({
    serverAddress: '10.0.0.5',
    startDiscovery: starter,
    createConnection: factory,
  });

  client.start();

  assert.equal(scans.length, 0);
  assert.equal(connections.length, 1);
  assert.equal(connections[0].address, '10.0.0.5');
  assert.equal(connections[0].port, 41236);

  client.stop();
});

test('stop cancels a pending discovery retry', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scans, starter, factory } = harness();
  const client = new LanClient({
    startDiscovery: starter,
    createConnection: factory,
    discoveryRetryMs: 1000,
  });

  client.start();
  scans[0].callbacks.onRooms([]);
  client.stop();
  t.mock.timers.tick(5000);

  assert.equal(scans.length, 1);
});
