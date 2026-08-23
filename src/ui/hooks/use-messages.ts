// use-messages.ts - Message list state bridge (SRP: only message events).

import { useEffect, useState } from 'react';
import type { MessageEnvelope } from '../../protocol/envelope.js';
import type { ChatSession } from '../session-adapter.js';

export const MAX_MESSAGE_ROWS = 500;

function pushCapped<T>(prev: T[], value: T, cap: number): T[] {
  if (prev.length < cap) return [...prev, value];
  return [...prev.slice(-(cap - 1)), value];
}

export function useMessages(adapter: ChatSession) {
  const [messages, setMessages] = useState<MessageEnvelope[]>([]);

  useEffect(() => {
    const onMessage = (envelope: MessageEnvelope): void => {
      setMessages((prev) => pushCapped(prev, envelope, MAX_MESSAGE_ROWS));
    };
    adapter.on('message', onMessage);
    return () => { adapter.off('message', onMessage); };
  }, [adapter]);

  const appendOwn = (envelope: MessageEnvelope): void => {
    setMessages((prev) => pushCapped(prev, envelope, MAX_MESSAGE_ROWS));
  };

  return { messages, appendOwn };
}
