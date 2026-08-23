// server-plain.ts - Non-TTY plain-output path for host mode.

import {
  status, statusSuccess, statusError,
  formatIncoming, formatSent, clientConnected, clientDisconnected,
  showBanner, debug as debugLog, theme,
} from '../display/index.js';
import { LanServer } from '../hotspot.js';
import { setupInput } from '../input.js';
import type { MessageEnvelope } from '../protocol/envelope.js';

export function startHostPlain(): void {
  showBanner('host');
  const server = new LanServer();
  let inputStarted = false;

  server.on('ready', (port: number) => {
    statusSuccess('HOST', `Host listening on port ${theme.info(String(port))}`);
    status('HOST', 'Waiting for clients...');
    if (!inputStarted) {
      inputStarted = true;
      setupInput((text) => {
        server.send(text);
        formatSent(text);
      }, () => {
        server.stop();
      });
    }
  });

  server.on('clientConnected', (id: string, count: number) => {
    clientConnected(id, count);
  });

  server.on('clientDisconnected', (id: string, count: number) => {
    clientDisconnected(id, count);
  });

  server.on('message', (envelope: MessageEnvelope) => {
    formatIncoming(envelope);
  });

  server.on('error', (msg: string) => statusError('HOST', msg));
  server.on('debug', (msg: string) => debugLog('HOST', msg));

  server.start();

  process.on('SIGINT', () => {
    console.log();
    status('HOST', theme.muted('Shutting down host...'));
    server.stop();
    process.exit(0);
  });
}

export const startHotspotPlain = startHostPlain;
