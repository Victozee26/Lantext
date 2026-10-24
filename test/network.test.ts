import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { NetworkInterfaceInfo } from 'node:os';
import { getLocalIP, getSubnet } from '../src/protocol/network.js';
import type { NetworkInterfacesProvider } from '../src/protocol/network.js';

type IfaceMap = NodeJS.Dict<NetworkInterfaceInfo[]>;

function v4(address: string, internal = false): NetworkInterfaceInfo {
  return {
    address,
    netmask: '255.255.255.0',
    family: 'IPv4',
    mac: '00:00:00:00:00:00',
    internal,
    cidr: `${address}/24`,
  };
}

function provider(map: IfaceMap): NetworkInterfacesProvider {
  return () => map;
}

beforeEach(() => {
  delete process.env.LAN_TEXT_IFACE;
});

afterEach(() => {
  delete process.env.LAN_TEXT_IFACE;
});

test('single LAN interface: picks it and derives the /24', () => {
  const p = provider({ wlan0: [v4('192.168.43.57')] });
  assert.equal(getLocalIP(p), '192.168.43.57');
  assert.equal(getSubnet(p), '192.168.43');
});

test('docker bridge listed first does not win over real WiFi', () => {
  const p = provider({
    docker0: [v4('172.17.0.1')],
    wlan0: [v4('192.168.43.57')],
  });
  assert.equal(getLocalIP(p), '192.168.43.57');
  assert.equal(getSubnet(p), '192.168.43');
});

test('VPN tunnel does not win over real WiFi', () => {
  const p = provider({
    utun3: [v4('10.8.0.6')],
    en0: [v4('192.168.1.20')],
  });
  assert.equal(getLocalIP(p), '192.168.1.20');
});

test('non-private real interface is still better than nothing', () => {
  const p = provider({ eth0: [v4('203.0.113.9')] });
  assert.equal(getLocalIP(p), '203.0.113.9');
});

test('internal-only interfaces fall back to loopback', () => {
  const p = provider({ lo: [v4('127.0.0.1', true)] });
  assert.equal(getLocalIP(p), '127.0.0.1');
  assert.equal(getSubnet(p), '127.0.0');
});

test('explicit interface name overrides the heuristic', () => {
  const p = provider({
    docker0: [v4('172.17.0.1')],
    wlan0: [v4('192.168.43.57')],
  });
  assert.equal(getLocalIP(p, 'docker0'), '172.17.0.1');
  assert.equal(getSubnet(p, 'docker0'), '172.17.0');
});

test('LAN_TEXT_IFACE is honoured when no name is passed', () => {
  process.env.LAN_TEXT_IFACE = 'wlan0';
  const p = provider({
    docker0: [v4('172.17.0.1')],
    wlan0: [v4('192.168.43.57')],
  });
  assert.equal(getLocalIP(p), '192.168.43.57');
});

test('unknown LAN_TEXT_IFACE falls back to the heuristic', () => {
  process.env.LAN_TEXT_IFACE = 'nope0';
  const p = provider({ wlan0: [v4('192.168.43.57')] });
  assert.equal(getLocalIP(p), '192.168.43.57');
});
