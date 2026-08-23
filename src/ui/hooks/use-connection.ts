// use-connection.ts - Connection/status state bridge.

import { useEffect, useState } from 'react';
import type { ChatSession } from '../session-adapter.js';

export const MAX_DISCOVERED_PEERS = 20;

function pushCapped<T>(prev: T[], value: T, cap: number): T[] {
  if (prev.length < cap) return [...prev, value];
  return [...prev.slice(-(cap - 1)), value];
}

export function useConnection(adapter: ChatSession) {
  const [status, setStatus] = useState<string | null>(null);
  const [discoveredPeers, setDiscoveredPeers] = useState<string[]>([]);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [clientCount, setClientCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const onStatus = (message: string): void => setStatus(message);
    const onDiscovered = (address: string): void => {
      setDiscoveredPeers((prev) => pushCapped(prev, address, MAX_DISCOVERED_PEERS));
    };
    const onConnected = (address: string): void => setConnectedAddress(address);
    const onError = (message: string): void => setLastError(message);
    const onReady = (port: number): void => setServerPort(port);
    const onClientConnected = (event: { totalClients: number }): void => setClientCount(event.totalClients);
    const onClientDisconnected = (event: { totalClients: number }): void => setClientCount(event.totalClients);

    adapter.on('status', onStatus);
    adapter.on('discovered', onDiscovered);
    adapter.on('connected', onConnected);
    adapter.on('error', onError);
    adapter.on('ready', onReady);
    adapter.on('clientConnected', onClientConnected);
    adapter.on('clientDisconnected', onClientDisconnected);

    return () => {
      adapter.off('status', onStatus);
      adapter.off('discovered', onDiscovered);
      adapter.off('connected', onConnected);
      adapter.off('error', onError);
      adapter.off('ready', onReady);
      adapter.off('clientConnected', onClientConnected);
      adapter.off('clientDisconnected', onClientDisconnected);
    };
  }, [adapter]);

  return { status, discoveredPeers, connectedAddress, serverPort, clientCount, lastError };
}
