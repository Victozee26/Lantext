// input.js - Piped (non-TTY) input handling.
//
// Phase 4: the TTY branch (readline multi-line input with the paste
// heuristic) was removed. TTY stdin now routes into the OpenTUI chat screen
// (src/ui/chat-screen.tsx), where the composer owns keyboard input, so this
// module serves ONLY the piped/non-TTY path.

import type { Interface } from 'node:readline';

type MessageHandler = (message: string) => void;

/**
 * Sets up traditional stdin handling for piped input.
 */
function setupPipedInput(onMessage: MessageHandler): void {
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
}

/**
 * Sets up stdin handling for the non-TTY path. Always returns null: a
 * readline interface is only meaningful on a TTY, and TTY sessions now use
 * the OpenTUI composer instead.
 */
export function setupInput(onMessage: MessageHandler): Interface | null {
  setupPipedInput(onMessage);
  return null;
}
