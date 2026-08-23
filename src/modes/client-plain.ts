// client-plain.ts - Non-TTY plain-output path for client mode.

import {
  status, statusSuccess, formatIncoming, formatSent,
  createSpinner, showBanner, debug as debugLog, theme,
} from '../display/index.js';
import { LanClient } from '../client.js';
import { setupInput } from '../input.js';
import type { MessageEnvelope } from '../protocol/envelope.js';

export function startClientPlain(serverAddress: string | undefined): void {
  showBanner('client');
  const client = new LanClient({ serverAddress });
  let inputStarted = false;

  client.on('status', (msg: string) => status('CLIENT', msg));
  client.on('debug', (msg: string) => debugLog('CLIENT', msg));

  const spinner = createSpinner('Searching for LAN Chat Server...');
  client.on('status', (msg: string) => {
    if (msg.includes('Searching')) spinner.start();
  });

  client.on('discovered', (address: string) => {
    spinner.succeed(theme.success(`Server found at ${theme.info(address)}`));
  });

  client.on('connected', (address: string) => {
    statusSuccess('CLIENT', `Connected to server at ${theme.info(address)}`);
    if (!inputStarted) {
      inputStarted = true;
      setupInput((text) => {
        if (client.send(text)) {
          formatSent(text);
        }
      }, () => {
        client.stop();
      });
    }
  });

  client.on('message', (envelope: MessageEnvelope) => {
    formatIncoming(envelope);
  });

  client.start();

  process.on('SIGINT', () => {
    console.log();
    status('CLIENT', theme.muted('Shutting down...'));
    client.stop();
    process.exit(0);
  });
}
