// format.ts - Message formatting for piped output.

import type { MessageEnvelope } from '../protocol/envelope.js';

function timestamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

export function formatIncoming(envelope: MessageEnvelope): void {
  const ts = timestamp();
  const divider = '─'.repeat(40);

  console.log();
  console.log(`  ${divider}`);
  console.log(`  ${envelope.sender}  ${ts}`);
  envelope.text.split('\n').forEach((line) => {
    console.log(`  ${line}`);
  });
  console.log(`  ${divider}`);
}

export function formatSent(text: string): void {
  const ts = timestamp();
  console.log(`  ✓ Sent  ${ts}`);
  text.split('\n').forEach((line) => {
    console.log(`  │ ${line}`);
  });
}
