// use-chat-session.ts - Bridges adapter events into React state (composition root).
// Delegates to focused hooks (SRP).

import type { MessageEnvelope } from '../../protocol/envelope.js';
import type { ChatSession, RoomInfo, RoomLostInfo } from '../session-adapter.js';
import { useConnection } from './use-connection.js';
import { useMessages } from './use-messages.js';

export interface ChatSessionState {
  messages: MessageEnvelope[];
  status: string | null;
  connectedAddress: string | null;
  serverPort: number | null;
  clientCount: number;
  lastError: string | null;
  rooms: RoomInfo[];
  selectedRoom: RoomInfo | null;
  roomLost: RoomLostInfo | null;
  appendOwn: (envelope: MessageEnvelope) => void;
  selectRoom: (key: string) => boolean;
  retryRoom: () => void;
  chooseAnotherRoom: () => void;
}

export function useChatSession(adapter: ChatSession): ChatSessionState {
  const { messages, appendOwn } = useMessages(adapter);
  const {
    status, connectedAddress, serverPort, clientCount, lastError,
    rooms, selectedRoom, roomLost, selectRoom, retryRoom, chooseAnotherRoom,
  } = useConnection(adapter);

  return {
    messages,
    status,
    connectedAddress,
    serverPort,
    clientCount,
    lastError,
    rooms,
    selectedRoom,
    roomLost,
    appendOwn,
    selectRoom,
    retryRoom,
    chooseAnotherRoom,
  };
}
