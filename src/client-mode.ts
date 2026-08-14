// client-mode.js - Orchestrator for Client mode
import { 
  status, statusSuccess, statusError, 
  formatIncoming, formatSent, createSpinner, 
  getPrompt, debug as debugLog, theme
} from './ui.js';
import { LanClient } from './client.js';
import { setupInput } from './input.js';
import type { Interface } from 'node:readline';

export async function startClient(serverAddress = process.env.SERVER): Promise<void> {
  const client = new LanClient({ serverAddress });
  let rl: Interface | null = null;

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
    if (!rl) {
      rl = setupInput((text) => {
        if (client.send(text)) {
          formatSent(text);
        }
      }, getPrompt);
    }
    rl?.prompt();
  });

  client.on('message', (envelope: import('./utils.js').MessageEnvelope) => {
    formatIncoming(envelope);
    rl?.prompt();
  });

  client.on('error', (err: Error) => {
    if (spinner.isSpinning) spinner.fail(theme.error(err.message));
    else statusError('CLIENT', err.message);
  });

  client.start();

  process.on('SIGINT', () => {
    console.log();
    status('CLIENT', theme.muted('Shutting down...'));
    client.stop();
    if (rl) rl.close();
    process.exit(0);
  });
}
