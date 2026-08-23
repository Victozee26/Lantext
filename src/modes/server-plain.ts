// server-plain.ts - Non-TTY plain-output path for hotspot mode.

import {
  status, statusSuccess, statusError,
  formatIncoming, formatSent, clientConnected, clientDisconnected,
  showBanner, debug as debugLog, theme,
} from '../display/index.js';
import { LanServer } from '../hotspot.js';
import { setupInput } from '../input.js';
import type { MessageEnvelope } from '../protocol/envelope.js';

export function startHotspotPlain(): void {
  showBanner('hotspot');
  const server = new LanServer();
  let inputStarted = false;

  server.on('ready', (port: number) => {
    statusSuccess('HOTSPOT', `Server listening on port ${theme.info(String(port))}`);
    status('HOTSPOT', 'Waiting for clients...');
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

  server.on('error', (msg: string) => statusError('HOTSPOT', msg));
  server.on('debug', (msg: string) => debugLog('HOTSPOT', msg));

  server.start();

  process.on('SIGINT', () => {
    console.log();
    status('HOTSPOT', theme.muted('Shutting down hotspot...'));
    server.stop();
    process.exit(0);
  });
}
