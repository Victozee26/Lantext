// ui.js - Shared UI helpers (Claude Code-style terminal UI)
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { getLocalIP, type MessageEnvelope } from './utils.js';

// ─── Color Theme ───────────────────────────────────────────────
export const theme = {
  brand: chalk.hex('#4A9EFF'),       // LAN blue
  accent: chalk.hex('#36D399'),       // Teal green
  dim: chalk.dim,
  bold: chalk.bold,
  success: chalk.hex('#36D399'),
  error: chalk.hex('#F87171'),
  warning: chalk.hex('#FBBF24'),
  info: chalk.hex('#60A5FA'),
  muted: chalk.hex('#6B7280'),
  sender: chalk.hex('#C084FC'),       // Purple for senders
  sent: chalk.hex('#34D399'),
  prompt: chalk.hex('#4A9EFF'),
};

// ─── Helpers ───────────────────────────────────────────────────
function timestamp() {
  const now = new Date();
  return theme.muted(
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  );
}

// ─── Banner ────────────────────────────────────────────────────
export function showBanner(mode?: string): void {
  const ip = getLocalIP();
  const modeLabel = mode
    ? theme.accent(`  ${mode.toUpperCase()} MODE`)
    : '';

  const title = `${theme.brand.bold('LAN')}${theme.accent.bold('Text')}`;
  const subtitle = theme.muted('  Local Area Network Chat');
  const network = theme.muted(`  Network: ${theme.info(ip)}`);
  const version = theme.muted('  v1.0.0');

  const content = [
    '',
    `  ${title}  ${version}`,
    subtitle,
    network,
    modeLabel,
    '',
  ].filter(l => l !== undefined).join('\n');

  console.log(boxen(content, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderColor: '#4A9EFF',
    borderStyle: 'round',
    dimBorder: false,
    width: 44,
  }));
  console.log();
}

// ─── Status Lines ──────────────────────────────────────────────
export function status(label: string, msg: string): void {
  const prefix = label === 'CLIENT'
    ? theme.brand(`  ● ${label}`)
    : theme.accent(`  ◆ ${label}`);
  console.log(`${prefix} ${theme.dim('│')} ${msg}`);
}

export function statusSuccess(label: string, msg: string): void {
  const icon = theme.success('✔');
  const prefix = label === 'CLIENT'
    ? theme.brand(label)
    : theme.accent(label);
  console.log(`  ${icon} ${prefix} ${theme.dim('│')} ${msg}`);
}

export function statusError(label: string, msg: string): void {
  const icon = theme.error('✖');
  const prefix = label === 'CLIENT'
    ? theme.brand(label)
    : theme.accent(label);
  console.log(`  ${icon} ${prefix} ${theme.dim('│')} ${theme.error(msg)}`);
}

export function statusWarn(label: string, msg: string): void {
  const icon = theme.warning('⚠');
  const prefix = label === 'CLIENT'
    ? theme.brand(label)
    : theme.accent(label);
  console.log(`  ${icon} ${prefix} ${theme.dim('│')} ${theme.warning(msg)}`);
}

// ─── Incoming Messages ────────────────────────────────────────
export function formatIncoming(envelope: MessageEnvelope): void {
  const ts = timestamp();
  const sender = theme.sender.bold(envelope.sender);
  const divider = theme.dim('─'.repeat(40));

  console.log();
  console.log(`  ${divider}`);
  console.log(`  ${sender}  ${ts}`);
  envelope.text.split('\n').forEach(line => {
    console.log(`  ${line}`);
  });
  console.log(`  ${divider}`);
}

// ─── Sent Messages ─────────────────────────────────────────────
export function formatSent(text: string): void {
  const icon = theme.sent('✓');
  const ts = timestamp();
  console.log(`  ${icon} ${theme.sent('Sent')}  ${ts}`);
  text.split('\n').forEach(line => {
    console.log(`  ${theme.dim('│')} ${line}`);
  });
}

// ─── Help ──────────────────────────────────────────────────────
export function formatHelp(): void {
  const title = `${theme.brand.bold('LAN')}${theme.accent.bold('Text')} ${theme.muted('v1.0.0')}`;
  const desc = theme.dim('Local Area Network Chat Application');

  const sections = [
    '',
    `  ${title}`,
    `  ${desc}`,
    '',
    `  ${theme.bold('USAGE')}`,
    `    ${theme.accent('lantext')}                        ${theme.dim('Interactive mode (choose hotspot or wifi)')}`,
    `    ${theme.accent('lantext')} ${theme.info('client')}                 ${theme.dim('Run as wifi client')}`,
    `    ${theme.accent('lantext')} ${theme.info('hotspot')}                ${theme.dim('Run as hotspot/server')}`,
    `    ${theme.accent('lantext')} ${theme.info('help')}                   ${theme.dim('Show this help message')}`,
    '',
    `  ${theme.bold('MODES')}`,
    `    ${theme.info('client')} ${theme.dim('|')} ${theme.info('wifi')}                   ${theme.dim('Connect to a server on the network')}`,
    `    ${theme.info('hotspot')} ${theme.dim('|')} ${theme.info('server')}               ${theme.dim('Act as a server and accept connections')}`,
    '',
    `  ${theme.bold('ENVIRONMENT')}`,
    `    ${theme.warning('DEBUG')}${theme.dim('=')}true                    ${theme.dim('Enable debug logging')}`,
    `    ${theme.warning('SERVER')}${theme.dim('=')}${theme.muted('<ip>')}                  ${theme.dim('Specify server IP (for client mode)')}`,
    '',
    `  ${theme.bold('EXAMPLES')}`,
    `    ${theme.muted('$')} lantext                        ${theme.dim('# Interactive mode')}`,
    `    ${theme.muted('$')} lantext client                 ${theme.dim('# Direct client mode')}`,
    `    ${theme.muted('$')} lantext hotspot                ${theme.dim('# Direct hotspot mode')}`,
    `    ${theme.muted('$')} DEBUG=true lantext client      ${theme.dim('# Client with debug')}`,
    `    ${theme.muted('$')} SERVER=192.168.1.5 lantext client  ${theme.dim('# Specific server')}`,
    '',
  ];

  console.log(boxen(sections.join('\n'), {
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
    borderColor: '#4A9EFF',
    borderStyle: 'round',
    width: 72,
  }));
}

// ─── Spinner ───────────────────────────────────────────────────
export function createSpinner(text: string) {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots',
  });
}

// ─── Prompt ────────────────────────────────────────────────────
export function getPrompt() {
  return theme.prompt('❯ ');
}

// ─── Client Connect/Disconnect Badges ──────────────────────────
export function clientConnected(clientId: string, totalClients: number): void {
  const badge = theme.success.bold(` +1 `);
  console.log(`\n  ${badge} ${theme.dim('Client connected:')} ${theme.info(clientId)} ${theme.muted(`(${totalClients} online)`)}`);
}

export function clientDisconnected(clientId: string, totalClients: number): void {
  const badge = theme.error.bold(` -1 `);
  console.log(`\n  ${badge} ${theme.dim('Client disconnected:')} ${theme.muted(clientId)} ${theme.muted(`(${totalClients} online)`)}`);
}

// ─── Debug ─────────────────────────────────────────────────────
export function debug(label: string, msg: string): void {
  if (process.env.DEBUG === 'true') {
    console.log(`  ${theme.muted(`[${label}]`)} ${theme.dim(msg)}`);
  }
}
