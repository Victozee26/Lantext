import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LanClient, type RoomLostState } from '../src/client.js';
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

test('interactive N>1 waits for selectRoom and reports the selected room', () => {
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({
    startDiscovery: starter,
    createConnection: factory,
    interactive: true,
  });
  const seen: DiscoveryReply[][] = [];
  const selected: DiscoveryReply[] = [];
  client.on('rooms', (rooms: DiscoveryReply[]) => seen.push(rooms));
  client.on('roomSelected', (room: DiscoveryReply) => selected.push(room));

  client.start();
  scans[0].callbacks.onRooms([
    room('host-a', '10.0.0.1', 7),
    room('host-b', '10.0.0.2', 9),
  ]);

  assert.equal(connections.length, 0);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].length, 2);

  assert.equal(client.selectRoom('host-b'), true);
  assert.equal(connections.length, 1);
  assert.equal(connections[0].address, '10.0.0.2');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].hostId, 'host-b');

  client.stop();
});

test('non-interactive N>1 emits rooms and still auto-connects', () => {
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({ startDiscovery: starter, createConnection: factory });
  const seen: DiscoveryReply[][] = [];
  client.on('rooms', (rooms: DiscoveryReply[]) => seen.push(rooms));

  client.start();
  scans[0].callbacks.onRooms([
    room('host-a', '10.0.0.1', 7),
    room('host-b', '10.0.0.2', 9),
  ]);

  assert.equal(seen.length, 1);
  assert.equal(connections.length, 1);
  assert.equal(connections[0].address, '10.0.0.2');

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

test('reconnect sticks to the same hostId and follows a new address', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({
    startDiscovery: starter,
    createConnection: factory,
    retryDelay: 10,
  });

  client.start();
  scans[0].callbacks.onRooms([room('host-a', '10.0.0.1', 1)]);
  connections[0].callbacks.onDisconnect('server closed');
  t.mock.timers.tick(10);

  assert.equal(scans.length, 2);
  scans[1].callbacks.onRooms([
    room('host-b', '10.0.0.2', 9),
    room('host-a', '10.0.0.9', 2, 5001),
  ]);

  assert.equal(connections.length, 2);
  assert.equal(connections[1].address, '10.0.0.9');
  assert.equal(connections[1].port, 5001);
  assert.equal(client.selectedRoom?.hostId, 'host-a');

  client.stop();
});

test('a different host is never substituted; three misses emit roomLost', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({
    startDiscovery: starter,
    createConnection: factory,
    retryDelay: 10,
  });
  const lost: RoomLostState[] = [];
  client.on('roomLost', (state: RoomLostState) => lost.push(state));

  client.start();
  scans[0].callbacks.onRooms([room('host-a', '10.0.0.1', 1)]);
  connections[0].callbacks.onDisconnect('server closed');
  t.mock.timers.tick(10);

  for (let miss = 0; miss < 3; miss++) {
    assert.equal(scans.length, 2 + miss);
    scans[1 + miss].callbacks.onRooms([room('host-b', `10.0.0.${miss + 2}`, 9)]);
    if (miss < 2) t.mock.timers.tick(1000);
  }

  assert.equal(connections.length, 1);
  assert.equal(lost.length, 1);
  assert.deepEqual(lost[0], { hostId: 'host-a', name: 'host-a', address: '10.0.0.1' });

  t.mock.timers.tick(5000);
  assert.equal(scans.length, 4);

  client.stop();
});

test('SERVER= reconnects to the same address without discovery', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({
    serverAddress: '10.0.0.5',
    startDiscovery: starter,
    createConnection: factory,
    retryDelay: 10,
  });

  client.start();
  connections[0].callbacks.onDisconnect('server closed');
  t.mock.timers.tick(10);

  assert.equal(scans.length, 0);
  assert.equal(connections.length, 2);
  assert.equal(connections[1].address, '10.0.0.5');

  client.stop();
});

test('a live connection drop emits exactly one disconnected event', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({
    startDiscovery: starter,
    createConnection: factory,
    retryDelay: 10,
  });
  const disconnected: string[] = [];
  client.on('disconnected', () => disconnected.push('event'));

  client.start();
  scans[0].callbacks.onRooms([room('host-a', '10.0.0.1', 1)]);
  connections[0].callbacks.onConnected('10.0.0.1');
  connections[0].callbacks.onDisconnect('server closed');

  assert.equal(disconnected.length, 1);

  // A socket can report both 'error' and 'end'; the second report is stale.
  connections[0].callbacks.onDisconnect('error');
  assert.equal(disconnected.length, 1);

  client.stop();
  assert.equal(disconnected.length, 1);
});

test('retryRoom re-scans for the remembered host after roomLost', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({
    startDiscovery: starter,
    createConnection: factory,
    retryDelay: 10,
  });

  client.start();
  scans[0].callbacks.onRooms([room('host-a', '10.0.0.1', 1)]);
  connections[0].callbacks.onDisconnect('server closed');
  t.mock.timers.tick(10);
  scans[1].callbacks.onRooms([]);
  t.mock.timers.tick(1000);
  scans[2].callbacks.onRooms([]);
  t.mock.timers.tick(1000);
  scans[3].callbacks.onRooms([]);
  assert.notEqual(client.roomLost, null);

  client.retryRoom();
  assert.equal(client.roomLost, null);
  assert.equal(scans.length, 5);

  scans[4].callbacks.onRooms([room('host-a', '10.0.0.9', 1)]);
  assert.equal(connections.length, 2);
  assert.equal(connections[1].address, '10.0.0.9');

  client.stop();
});

test('chooseAnotherRoom clears the old identity and connects to the pick', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scans, connections, starter, factory } = harness();
  const client = new LanClient({
    startDiscovery: starter,
    createConnection: factory,
    retryDelay: 10,
  });

  client.start();
  scans[0].callbacks.onRooms([room('host-a', '10.0.0.1', 1)]);
  connections[0].callbacks.onDisconnect('server closed');
  t.mock.timers.tick(10);
  scans[1].callbacks.onRooms([]);
  t.mock.timers.tick(1000);
  scans[2].callbacks.onRooms([]);
  t.mock.timers.tick(1000);
  scans[3].callbacks.onRooms([]);

  client.chooseAnotherRoom();
  assert.equal(client.roomLost, null);
  assert.equal(scans.length, 5);

  scans[4].callbacks.onRooms([room('host-b', '10.0.0.2', 3)]);
  assert.equal(connections.length, 2);
  assert.equal(connections[1].address, '10.0.0.2');
  assert.equal(client.selectedRoom?.hostId, 'host-b');

  client.stop();
});
