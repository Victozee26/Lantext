// server-mode.js - Orchestrator for Hotspot/Server mode
import { 
  status, statusSuccess, statusError, 
  formatIncoming, formatSent, 
  getPrompt, clientConnected, clientDisconnected, 
  debug as debugLog, theme
} from './ui.js';
import { LanServer } from './hotspot.js';
import { setupInput } from './input.js';
import type { Interface } from 'node:readline';

export async function startHotspot(): Promise<void> {
  const server = new LanServer();
  let rl: Interface | null = null;

  server.on('ready', (port: number) => {
    statusSuccess('HOTSPOT', `Server listening on port ${theme.info(String(port))}`);
    status('HOTSPOT', 'Waiting for clients...');
    if (!rl) {
      rl = setupInput((text) => {
        server.send(text);
        formatSent(text);
      }, getPrompt);
    }
    rl?.prompt();
  });

  server.on('clientConnected', (id: string, count: number) => {
    clientConnected(id, count);
    rl?.prompt();
  });

  server.on('clientDisconnected', (id: string, count: number) => {
    clientDisconnected(id, count);
    rl?.prompt();
  });

  server.on('message', (envelope: import('./utils.js').MessageEnvelope) => {
    formatIncoming(envelope);
    rl?.prompt();
  });

  server.on('error', (msg: string) => statusError('HOTSPOT', msg));
  server.on('debug', (msg: string) => debugLog('HOTSPOT', msg));

  server.start();

  process.on('SIGINT', () => {
    console.log();
    status('HOTSPOT', theme.muted('Shutting down hotspot...'));
    server.stop();
    if (rl) rl.close();
    process.exit(0);
  });
}
