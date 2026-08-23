// codec.ts - Wire codec for LANText messaging.
// Single source for newline-delimited framing and multi-line payload handling.
// Byte-identical to the previous inline implementations in client.ts / hotspot.ts.

import type { MessageEnvelope } from './envelope.js';

// ── Helpers ──────────────────────────────────────────────────────

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripEdgeBlankLines(text: string): string {
  const stripped = text.replace(/^\n+/, '').replace(/\n+$/, '');
  return stripped.length ? stripped : text;
}

// ── Payload (client → server plain text, line-delimited) ────────

/** Encode a user text line for the TCP wire. Multi-line payloads are
 *  JSON-stringified so interior `\n` survives the line splitter. */
export function encodePayload(text: string): string {
  const normalized = normalizeLineEndings(text);
  if (normalized.includes('\n')) {
    return JSON.stringify(normalized) + '\n';
  }
  return normalized + '\n';
}

/** Decode one raw line from the wire into the original user text.
 *  Returns null for empty/whitespace lines (no message). */
export function decodePayload(rawLine: string): string | null {
  if (rawLine.length === 0) return null;
  const trimmed = rawLine.trim();
  if (trimmed.length >= 2 && trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') {
        let text = normalizeLineEndings(parsed);
        text = stripEdgeBlankLines(text);
        return text.trim() === '' ? null : text;
      }
    } catch {
      // fall through to plain handling
    }
  }
  let plain = rawLine;
  if (plain.endsWith('\r')) plain = plain.slice(0, -1);
  if (plain.trim() === '') return null;
  let text = normalizeLineEndings(plain);
  text = stripEdgeBlankLines(text);
  return text.trim() === '' ? null : text;
}

/** Host-side send: strip edge blank lines then keep as-is. */
export function normalizeForHost(text: string): string {
  const normalized = normalizeLineEndings(text);
  const stripped = normalized.replace(/^\n+/, '').replace(/\n+$/, '');
  const finalText = stripped.length ? stripped : normalized;
  return finalText.trim() === '' ? '' : finalText;
}
export const normalizeForHotspot = normalizeForHost;

// ── Envelope (server → clients, JSON per line) ──────────────────

export function encodeEnvelope(envelope: MessageEnvelope): string {
  return JSON.stringify(envelope) + '\n';
}

export function decodeEnvelope(line: string): MessageEnvelope | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as MessageEnvelope;
    if (typeof parsed.sender === 'string' && typeof parsed.text === 'string' && typeof parsed.timestamp === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Framing helper ───────────────────────────────────────────────

export interface SplitResult {
  lines: string[];
  rest: string;
}

/** Split buffered data on `\n` boundaries. */
export function splitBuffer(buffer: string, chunk: string): SplitResult {
  const combined = buffer + chunk;
  const lines = combined.split('\n');
  const rest = lines.pop() ?? '';
  return { lines, rest };
}

export interface PayloadSplitResult {
  texts: string[];
  rest: string;
}
