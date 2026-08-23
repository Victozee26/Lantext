#!/usr/bin/env node

// main.js - Entry point for LAN Chat application
//
// CLI dispatch (modes and aliases preserved): client|wifi, hotspot|server,
// interactive default, help. Env vars DEBUG and SERVER keep their documented
// meaning (SERVER=<ip> = direct-connect server IP for client mode).
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

import { formatHelp, theme } from './ui.js';
import { startClient } from './client-mode.js';
import { startHotspot } from './server-mode.js';
import { openModeSelect } from './ui/select-screen.js';

const args = process.argv.slice(2);
const mode = args[0];

async function run(mode: string | undefined): Promise<void> {
  switch (mode) {
    case 'client':
    case 'wifi':
      await startClient();
      break;
    case 'hotspot':
    case 'server':
      await startHotspot();
      break;
    case 'help':
    case '--help':
    case '-h':
      formatHelp();
      break;
    case undefined:
      if (process.stdin.isTTY) {
        const selected = await openModeSelect();
        if (selected === 'quit') process.exit(0);
        await (selected === 'client' ? startClient() : startHotspot());
      } else {
        formatHelp();
        process.exit(0);
      }
      break;
    default:
      console.log(theme.error(`Unknown mode: ${mode}\n`));
      formatHelp();
      process.exit(1);
  }
}

run(mode).catch((err) => {
  console.error(`[LANText] Fatal: ${err instanceof Error ? err.stack : String(err)}`);
  process.exit(1);
});