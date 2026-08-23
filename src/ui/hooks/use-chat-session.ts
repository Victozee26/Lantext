// use-chat-session.ts - Bridges adapter events into React state.
// Subscribes on mount (or adapter change) and removes EVERY listener on
// cleanup. Message rows preserve the transport envelope shape exactly
// (MessageEnvelope from src/utils.ts) and are capped to guard scrollback
// memory growth (plan risk #5).

import { useEffect, useState } from 'react';
import type { MessageEnvelope } from '../../utils.js';
import type { ChatSession } from '../session-adapter.js';

/** Cap for the messages array (oldest rows dropped first). */
export const MAX_MESSAGE_ROWS = 500;

/** Cap for the discovered-peers list (kept for the status bar in Phase 3). */
export const MAX_DISCOVERED_PEERS = 20;

export interface ChatSessionState {
  /** Chat rows, oldest first, capped at MAX_MESSAGE_ROWS. */
  messages: MessageEnvelope[];
  /** Last `status` event message, or null before the first one. */
  status: string | null;
  /** Server addresses found via discovery, capped at MAX_DISCOVERED_PEERS. */
  discoveredPeers: string[];
  /** Server address of the last `connected` event, or null. */
  connectedAddress: string | null;
  /** Listening port from `ready` (server mode), or null. */
  serverPort: number | null;
  /** Online client count from clientConnected/clientDisconnected (server mode). */
  clientCount: number;
  /** Last `error` event message, or null. */
  lastError: string | null;
}

function pushCapped<T>(prev: T[], value: T, cap: number): T[] {
  if (prev.length < cap) return [...prev, value];
  return [...prev.slice(-(cap - 1)), value];
}

export function useChatSession(adapter: ChatSession): ChatSessionState {
  const [messages, setMessages] = useState<MessageEnvelope[]>([]);
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
    const onMessage = (envelope: MessageEnvelope): void => {
      setMessages((prev) => pushCapped(prev, envelope, MAX_MESSAGE_ROWS));
    };
    const onError = (message: string): void => setLastError(message);
    const onReady = (port: number): void => setServerPort(port);
    const onClientConnected = (event: { totalClients: number }): void => setClientCount(event.totalClients);
    const onClientDisconnected = (event: { totalClients: number }): void => setClientCount(event.totalClients);

    adapter.on('status', onStatus);
    adapter.on('discovered', onDiscovered);
    adapter.on('connected', onConnected);
    adapter.on('message', onMessage);
    adapter.on('error', onError);
    adapter.on('ready', onReady);
    adapter.on('clientConnected', onClientConnected);
    adapter.on('clientDisconnected', onClientDisconnected);

    return () => {
      adapter.off('status', onStatus);
      adapter.off('discovered', onDiscovered);
      adapter.off('connected', onConnected);
      adapter.off('message', onMessage);
      adapter.off('error', onError);
      adapter.off('ready', onReady);
      adapter.off('clientConnected', onClientConnected);
      adapter.off('clientDisconnected', onClientDisconnected);
    };
  }, [adapter]);

  return { messages, status, discoveredPeers, connectedAddress, serverPort, clientCount, lastError };
}