// client-plain.ts - Non-TTY plain-output path for client mode.

import {
  status, statusSuccess, statusError, formatIncoming, formatSent,
  createSpinner, showBanner, debug as debugLog, theme,
} from '../display/index.js';
import { formatRoom, roomLabel } from '../display/rooms.js';
import { LanClient, type RoomLostState } from '../client.js';
import { setupInput } from '../input.js';
import { getVersion } from '../protocol/version.js';
import type { DiscoveryReply } from '../protocol/discovery.js';
import type { MessageEnvelope } from '../protocol/envelope.js';

export function startClientPlain(serverAddress: string | undefined): void {
  showBanner('client');
  const client = new LanClient({ serverAddress });
  const version = getVersion();
  let selectedLabel: string | null = null;
  let inputStarted = false;

  client.on('status', (msg: string) => status('CLIENT', msg));
  client.on('debug', (msg: string) => debugLog('CLIENT', msg));

  const spinner = createSpinner('Searching for LAN Chat Server...');
  client.on('status', (msg: string) => {
    if (msg.includes('Searching')) spinner.start();
  });

  client.on('rooms', (rooms: DiscoveryReply[]) => {
    if (rooms.length < 2) return;
    status('CLIENT', `Found ${rooms.length} rooms:`);
    for (const room of rooms) {
      status('CLIENT', `  ${formatRoom(room, version)}`);
    }
  });

  client.on('roomSelected', (room: DiscoveryReply) => {
    selectedLabel = roomLabel(room);
    status('CLIENT', `Joining ${theme.info(`"${selectedLabel}"`)} (${theme.info(room.address)}:${room.port})`);
  });

  client.on('discovered', (address: string) => {
    spinner.succeed(theme.success(`Server found at ${theme.info(address)}`));
  });

  client.on('roomLost', (room: RoomLostState) => {
    spinner.stop();
    statusError(
      'CLIENT',
      `Room ${theme.info(`"${room.name}"`)} is gone. Restart to choose another room.`,
    );
  });

  client.on('connected', (address: string) => {
    const where = selectedLabel ? `${theme.info(`"${selectedLabel}"`)} (${theme.info(address)})` : theme.info(address);
    statusSuccess('CLIENT', `Connected to ${where}`);
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
