// banner.ts - Banner rendering for non-TTY display.

import { box } from './box.js';
import { getLocalIP } from '../protocol/network.js';
import { getVersion } from '../protocol/version.js';

export function showBanner(mode?: string): void {
  const ip = getLocalIP();
  const modeLabel = mode ? `  ${mode.toUpperCase()} MODE` : '';

  const title = `LANText`;
  const subtitle = '  Local Area Network Chat';
  const network = `  Network: ${ip}`;
  const version = `  v${getVersion()}`;

  const content = [
    '',
    `  ${title}  ${version}`,
    subtitle,
    network,
    modeLabel,
    '',
  ].filter((l) => l !== undefined);

  console.log(box(content, 44, 1));
  console.log();
}
