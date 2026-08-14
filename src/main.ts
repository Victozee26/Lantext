#!/usr/bin/env node

// main.js - Entry point for LAN Chat application
import { select, intro, outro, isCancel } from '@clack/prompts';
import { showBanner, formatHelp, theme } from './ui.js';
import { startClient } from './client-mode.js';
import { startHotspot } from './server-mode.js';

const args = process.argv.slice(2);
const mode = args[0];

async function askMode(): Promise<void> {
  showBanner();
  intro(theme.bold('Choose your connection mode'));

  const selected = await select({
    message: 'How are you connecting?',
    options: [
      {
        value: 'wifi',
        label: `${theme.brand('📡  WiFi Client')}`,
        hint: 'Connect to an existing server on the network',
      },
      {
        value: 'hotspot',
        label: `${theme.accent('📶  Hotspot Server')}`,
        hint: 'Create a server and accept connections',
      },
    ],
  });

  if (isCancel(selected)) {
    outro(theme.muted('Cancelled. Goodbye!'));
    process.exit(0);
  }

  if (selected === 'wifi') {
    outro(theme.success('Starting WiFi client mode...'));
    startClient();
  } else if (selected === 'hotspot') {
    outro(theme.success('Starting hotspot/server mode...'));
    startHotspot();
  }
}

async function run(mode: string | undefined): Promise<void> {
  process.stdout.write('\x1Bc');
  switch (mode) {
    case 'client':
    case 'wifi':
      showBanner('client');
      startClient();
      break;
    case 'hotspot':
    case 'server':
      showBanner('hotspot');
      startHotspot();
      break;
    case 'help':
    case '--help':
    case '-h':
      formatHelp();
      break;
    case undefined:
      await askMode();
      break;
    default:
      console.log(theme.error(`Unknown mode: ${mode}\n`));
      formatHelp();
      process.exit(1);
  }
}

run(mode);
