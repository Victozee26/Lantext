// ui.js - Plain-text helpers for the non-TTY paths (help text, piped output
// lines, debug logging). OpenTUI rendering lives under src/ui/.
//
// Phase 5: this module is ANSI-free. The `theme` API became identity
// functions (same call shape, no color codes); the boxed banner/help layout
// is drawn with plain line characters; the spinner prints plain status lines
// when stderr is not a terminal and animates only on a TTY. All labels,
// symbols, and layout are preserved.

import { getLocalIP, getVersion, type MessageEnvelope } from './utils.js';

// ─── Plain-Text Theme ──────────────────────────────────────────
// Identity functions: call sites (theme.info(...), theme.brand.bold(...))
// keep working unchanged; output carries no escape sequences.
type PlainStyle = {
  (text: string): string;
  bold: (text: string) => string;
};

const plain: PlainStyle = Object.assign(
  (text: string) => text,
  { bold: (text: string) => text },
);

export const theme = {
  brand: plain,
  accent: plain,
  dim: plain,
  bold: plain,
  success: plain,
  error: plain,
  warning: plain,
  info: plain,
  muted: plain,
  sender: plain,
  sent: plain,
  prompt: plain,
};

// ─── Helpers ───────────────────────────────────────────────────
function timestamp() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

/** Plain line-drawing box with rounded borders: `width` is the full box
 *  width (borders included), `pad` is the padding inside each border. Long
 *  lines truncate, short lines pad with spaces. */
function box(lines: string[], width: number, pad = 0): string {
  const inner = width - 2 - pad * 2;
  const body = lines.map((line) => {
    const text = line.length > inner ? line.slice(0, inner) : line.padEnd(inner);
    return `│${' '.repeat(pad)}${text}${' '.repeat(pad)}│`;
  });
  return [
    `╭${'─'.repeat(inner + pad * 2)}╮`,
    ...body,
    `╰${'─'.repeat(inner + pad * 2)}╯`,
  ].join('\n');
}

// ─── Banner ────────────────────────────────────────────────────
export function showBanner(mode?: string): void {
  const ip = getLocalIP();
  const modeLabel = mode
    ? `  ${mode.toUpperCase()} MODE`
    : '';

  const title = `LANText`;
  const subtitle = '  Local Area Network Chat';
  const network = `  Network: ${ip}`;
  const version = `  v${getVersion()}`;

  const content = [
    '',
    `  ${title}  ${version}`,
    subtitle,
    network,
    modeLabel,
    '',
  ].filter(l => l !== undefined);

  console.log(box(content, 44, 1));
  console.log();
}

// ─── Status Lines ──────────────────────────────────────────────
export function status(label: string, msg: string): void {
  const prefix = label === 'CLIENT'
    ? `  ● ${label}`
    : `  ◆ ${label}`;
  console.log(`${prefix} │ ${msg}`);
}

export function statusSuccess(label: string, msg: string): void {
  console.log(`  ✔ ${label} │ ${msg}`);
}

export function statusError(label: string, msg: string): void {
  console.log(`  ✖ ${label} │ ${msg}`);
}

// ─── Incoming Messages ────────────────────────────────────────
export function formatIncoming(envelope: MessageEnvelope): void {
  const ts = timestamp();
  const divider = '─'.repeat(40);

  console.log();
  console.log(`  ${divider}`);
  console.log(`  ${envelope.sender}  ${ts}`);
  envelope.text.split('\n').forEach(line => {
    console.log(`  ${line}`);
  });
  console.log(`  ${divider}`);
}

// ─── Sent Messages ─────────────────────────────────────────────
export function formatSent(text: string): void {
  const ts = timestamp();
  console.log(`  ✓ Sent  ${ts}`);
  text.split('\n').forEach(line => {
    console.log(`  │ ${line}`);
  });
}

// ─── Help ──────────────────────────────────────────────────────
export function formatHelp(): void {
  const title = `LANText v${getVersion()}`;
  const desc = 'Local Area Network Chat Application';

  const sections = [
    '',
    `  ${title}`,
    `  ${desc}`,
    '',
    `  USAGE`,
    `    lantext                        Interactive mode (choose hotspot or wifi)`,
    `    lantext client                 Run as wifi client`,
    `    lantext hotspot                Run as hotspot/server`,
    `    lantext help                   Show this help message`,
    '',
    `  MODES`,
    `    client | wifi                   Connect to a server on the network`,
    `    hotspot | server               Act as a server and accept connections`,
    '',
    `  ENVIRONMENT`,
    `    DEBUG=true                    Enable debug logging`,
    `    SERVER=<ip>                  Specify server IP (for client mode)`,
    '',
    `  EXAMPLES`,
    `    $ lantext                        # Interactive mode`,
    `    $ lantext client                 # Direct client mode`,
    `    $ lantext hotspot                # Direct hotspot mode`,
    `    $ DEBUG=true lantext client      # Client with debug`,
    `    $ SERVER=192.168.1.5 lantext client  # Specific server`,
    '',
  ];

  console.log(box(sections, 72));
}

// ─── Spinner ───────────────────────────────────────────────────
// Minimal plain spinner. The client plain path only uses start()/succeed();
// when stderr is not a terminal the spinner prints plain status lines (the
// previous spinner was silent there) so piped output stays free of raw
// escapes. Animation uses \r frame updates with a trailing erase-to-EOL on
// a TTY only.
export interface Spinner {
  start(): void;
  succeed(text?: string): void;
}

export function createSpinner(text: string): Spinner {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const animated = Boolean(process.stderr.isTTY);
  let timer: NodeJS.Timeout | null = null;
  let index = 0;
  let started = false;

  const clear = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    started = false;
  };

  return {
    start(): void {
      if (started) return;
      started = true;
      if (!animated) {
        process.stderr.write(`  ${text}\n`);
        return;
      }
      process.stderr.write(`  ${frames[0]} ${text}`);
      timer = setInterval(() => {
        index = (index + 1) % frames.length;
        process.stderr.write(`\r  ${frames[index]} ${text}\x1b[K`);
      }, 80);
    },
    succeed(text?: string): void {
      clear();
      if (animated) process.stderr.write('\r\x1b[K');
      if (text !== undefined) process.stderr.write(`  ✔ ${text}\n`);
    },
  };
}

// ─── Client Connect/Disconnect Badges ──────────────────────────
export function clientConnected(clientId: string, totalClients: number): void {
  console.log(`\n  +1 Client connected: ${clientId} (${totalClients} online)`);
}

export function clientDisconnected(clientId: string, totalClients: number): void {
  console.log(`\n  -1 Client disconnected: ${clientId} (${totalClients} online)`);
}

// ─── Debug ─────────────────────────────────────────────────────
export function debug(label: string, msg: string): void {
  if (process.env.DEBUG === 'true') {
    console.log(`  [${label}] ${msg}`);
  }
}