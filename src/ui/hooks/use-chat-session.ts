// use-chat-session.ts - Bridges adapter events into React state (composition root).
// Delegates to focused hooks (SRP) and composes their state for backward compat.

import type { MessageEnvelope } from '../../protocol/envelope.js';
import type { ChatSession } from '../session-adapter.js';
import { useConnection, MAX_DISCOVERED_PEERS } from './use-connection.js';
import { useMessages, MAX_MESSAGE_ROWS } from './use-messages.js';

export { MAX_MESSAGE_ROWS } from './use-messages.js';
export { MAX_DISCOVERED_PEERS } from './use-connection.js';

export interface ChatSessionState {
  messages: MessageEnvelope[];
  status: string | null;
  discoveredPeers: string[];
  connectedAddress: string | null;
  serverPort: number | null;
  clientCount: number;
  lastError: string | null;
  appendOwn: (envelope: MessageEnvelope) => void;
}

export function useChatSession(adapter: ChatSession): ChatSessionState {
  const { messages, appendOwn } = useMessages(adapter);
  const { status, discoveredPeers, connectedAddress, serverPort, clientCount, lastError } =
    useConnection(adapter);

  return {
    messages,
    status,
    discoveredPeers,
    connectedAddress,
    serverPort,
    clientCount,
    lastError,
    appendOwn,
  };
}