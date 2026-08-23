// input.js - Piped (non-TTY) input handling.
//
// Phase 4: the TTY branch (readline multi-line input with the paste
// heuristic) was removed. TTY stdin now routes into the OpenTUI chat screen
// (src/ui/chat-screen.tsx), where the composer owns keyboard input, so this
// module serves ONLY the piped/non-TTY path.

import type { Interface } from 'node:readline';

type MessageHandler = (message: string) => void;
type EndHandler = () => void;

/**
 * Sets up traditional stdin handling for piped input. The optional end
 * handler fires on stdin EOF so callers can shut down cleanly instead of
 * lingering with open sockets.
 */
function setupPipedInput(onMessage: MessageHandler, onEnd?: EndHandler): void {
  process.stdin.setEncoding('utf8');
  let pipeBuffer = '';

  process.stdin.on('data', (data) => {
    pipeBuffer += data;
    const lines = pipeBuffer.split('\n');
    pipeBuffer = lines.pop() || '';

    lines.forEach(line => {
      const message = line.trim();
      if (message) {
        onMessage(message);
      }
    });
  });

  if (onEnd) {
    process.stdin.on('end', onEnd);
  }
}

/**
 * Sets up stdin handling for the non-TTY path. Always returns null: a
 * readline interface is only meaningful on a TTY, and TTY sessions now use
 * the OpenTUI composer instead.
 */
export function setupInput(onMessage: MessageHandler, onEnd?: EndHandler): Interface | null {
  setupPipedInput(onMessage, onEnd);
  return null;
}
