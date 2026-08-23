// client-mode.js - Orchestrator for Client mode.
//
// Two execution paths, chosen by process.stdin.isTTY:
// - TTY: build the ChatSession adapter (wrapping LanClient), boot the
//   OpenTUI chat runtime via mountChatScreen (<App mode="client">), THEN
//   start the transport. Events that fire before the React mount effect
//   subscribes (e.g. LanClient's synchronous 'status' from discover()) are
//   buffered by src/ui/buffered-session.ts — nothing is lost.
// - Non-TTY: today's plain-output path (banner, status lines, spinner,
//   formatIncoming/formatSent) with piped input via src/input.ts. No
//   renderer.
//
// 'error'-gap reconciliation (see src/ui/session-adapter.ts): LanClient
// NEVER emits 'error'. The only observable connection-level failure is the
// debug line `Connection error: <msg>` (src/client.ts:135). The adapter
// promotes those debug lines to adapter `error` events so the TUI error
// slot can surface them (the UI does not render debug events). Everything
// else — reconnect cycles, discovery retries — keeps surfacing via
// status/debug; no invented semantics. This mapping intentionally does NOT
// treat "Disconnected ... Reconnecting..." as an error: that is expected
// retry behavior already rendered via status.

import {
  status, statusSuccess, formatIncoming, formatSent,
  createSpinner, showBanner, debug as debugLog, theme,
} from './ui.js';
import { LanClient } from './client.js';
import { setupInput } from './input.js';
import { BufferedSession } from './ui/buffered-session.js';
import { mountChatScreen } from './ui/chat-screen.js';
import type { ChatSession } from './ui/session-adapter.js';
import type { MessageEnvelope } from './utils.js';

/** Adapter wrapping LanClient into the UI's ChatSession contract. Transport
 *  events are forwarded into a BufferedSession (per-event queue until the
 *  first subscriber attaches, then live). send()/stop() delegate straight
 *  to the client — LanClient.send already returns the boolean the contract
 *  wants. */
function createClientAdapter(client: LanClient): ChatSession {
  const buffered = new BufferedSession();

  client.on('status', (message: string) => buffered.emit('status', message));
  client.on('discovered', (address: string) => buffered.emit('discovered', address));
  client.on('connected', (address: string) => buffered.emit('connected', address));
  client.on('message', (envelope: MessageEnvelope) => buffered.emit('message', envelope));
  client.on('debug', (message: string) => {
    buffered.emit('debug', message);
    if (message.startsWith('Connection error')) {
      buffered.emit('error', message);
    }
  });

  return {
    on: (event, listener) => buffered.on(event, listener),
    off: (event, listener) => buffered.off(event, listener),
    send: (text) => client.send(text),
    stop: () => client.stop(),
  };
}

/** TTY path: OpenTUI chat screen. The transport starts only after the
 *  runtime is up; the adapter's BufferedSession covers the remaining gap. */
async function startClientTUI(serverAddress: string | undefined): Promise<void> {
  const client = new LanClient({ serverAddress });
  const adapter = createClientAdapter(client);

  try {
    await mountChatScreen(adapter, 'client');
    client.start();
  } catch (err) {
    client.stop();
    console.error(`[LANText] Failed to start client UI: ${err instanceof Error ? err.stack : String(err)}`);
    process.exit(1);
  }
}

/** Non-TTY path: today's plain-output behavior (banner, status lines,
 *  spinner, formatted messages) with piped input. */
function startClientPlain(serverAddress: string | undefined): void {
  showBanner('client');
  const client = new LanClient({ serverAddress });
  // Piped input is registered once (guarded: 'connected' can fire again
  // after a reconnect, and re-registering would duplicate listeners).
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

  // Note: the old `client.on('error', ...)` listener was dead code —
  // LanClient never emits 'error' (see adapter doc above).
  client.start();

  process.on('SIGINT', () => {
    console.log();
    status('CLIENT', theme.muted('Shutting down...'));
    client.stop();
    process.exit(0);
  });
}

export async function startClient(serverAddress = process.env.SERVER): Promise<void> {
  if (process.stdin.isTTY) {
    await startClientTUI(serverAddress);
  } else {
    startClientPlain(serverAddress);
  }
}