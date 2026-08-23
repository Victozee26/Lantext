// envelope.ts - MessageEnvelope shape and factory.
// Wire envelope is JSON-serialized per line (newline-delimited).

export interface MessageEnvelope {
  sender: string;
  timestamp: number;
  text: string;
}

export function createEnvelope(sender: string | undefined, text: string): MessageEnvelope {
  return {
    sender: sender ?? 'UNKNOWN',
    timestamp: Date.now(),
    text,
  };
}
