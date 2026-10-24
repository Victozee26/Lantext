#!/usr/bin/env node

// main.js - Entry point for LAN Chat application
//
// CLI dispatch: host, client, interactive default, help. Env vars DEBUG and
// SERVER keep their documented meaning (SERVER=<ip> = direct-connect server IP
// for client mode).
//
// TTY vs non-TTY:
// - TTY default (no args): OpenTUI mode-select screen (src/ui/select-screen.tsx).
//   A selection tears down ONLY the select screen, then dispatches into the
//   chosen orchestrator, which boots its own chat runtime. q / ESC / Ctrl+C
//   exit 0 cleanly. The select screen and the chat screen each manage their
//   own alt screen; the transition leaves zero orphaned listeners/handles.
// - Non-TTY stdin with no args: plain-output fallback (help text, exit 0) —
//   a non-interactive stdin cannot drive the TUI (help printed, exit 0).
// - Direct modes: the orchestrators pick the TUI (TTY stdin) or the
//   plain-output + piped-input path (non-TTY stdin) internally.
// - help: plain text, printed BEFORE any renderer starts.
// - No \x1Bc clear-screen hack: the renderer manages the alt screen.

import { formatHelp } from './display/help.js';
import { theme } from './display/theme.js';
import { startClient } from './client-mode.js';
import { startHost } from './server-mode.js';
import { openModeSelect } from './ui/select-screen.js';

const args = process.argv.slice(2);

interface ParsedArgs {
  mode: string | undefined;
  name: string | undefined;
  error: string | null;
}

/** Extract `--name "<room>"` anywhere in argv, then treat the first remaining
 *  positional argument as the mode. Keeps the documented aliases intact. */
function parseArgs(argv: string[]): ParsedArgs {
  const rest = [...argv];
  const index = rest.indexOf('--name');
  if (index === -1) return { mode: rest[0], name: undefined, error: null };

  const name = rest[index + 1];
  if (!name || name.startsWith('-')) {
    return { mode: rest[0], name: undefined, error: '--name requires a room name' };
  }
  rest.splice(index, 2);
  return { mode: rest[0], name, error: null };
}

const parsed = parseArgs(args);

async function run(requested: string | undefined, name: string | undefined): Promise<void> {
  switch (requested) {
    case 'client':
    case '-c':
    case '--client':
      await startClient();
      break;
    case 'host':
    case '-h':
    case '--host':
      await startHost(name);
      break;
    case 'help':
    case '--help':
      formatHelp();
      break;
    case undefined:
      if (process.stdin.isTTY) {
        const selected = await openModeSelect();
        if (selected === 'quit') process.exit(0);
        await (selected === 'client' ? startClient() : startHost(name));
      } else {
        formatHelp();
        process.exit(0);
      }
      break;
    default:
      console.log(theme.error(`Unknown mode: ${requested}\n`));
      formatHelp();
      process.exit(1);
  }
}

if (parsed.error) {
  console.error(theme.error(`[LANText] ${parsed.error}\n`));
  formatHelp();
  process.exit(1);
}

run(parsed.mode, parsed.name).catch((err) => {
  console.error(`[LANText] Fatal: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});