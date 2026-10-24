// use-chat-session.ts - Bridges adapter events into React state (composition root).
// Delegates to focused hooks (SRP).

import type { MessageEnvelope } from '../../protocol/envelope.js';
import type { ChatSession } from '../session-adapter.js';
import { useConnection } from './use-connection.js';
import { useMessages } from './use-messages.js';

export interface ChatSessionState {
  messages: MessageEnvelope[];
  status: string | null;
  connectedAddress: string | null;
  serverPort: number | null;
  clientCount: number;
  lastError: string | null;
  appendOwn: (envelope: MessageEnvelope) => void;
}

export function useChatSession(adapter: ChatSession): ChatSessionState {
  const { messages, appendOwn } = useMessages(adapter);
  const { status, connectedAddress, serverPort, clientCount, lastError } =
    useConnection(adapter);

  return {
    messages,
    status,
    connectedAddress,
    serverPort,
    clientCount,
    lastError,
    appendOwn,
  };
}
