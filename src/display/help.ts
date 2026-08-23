// help.ts - Help text rendering.

import { box } from './box.js';
import { getVersion } from '../protocol/version.js';

export function formatHelp(): void {
  const title = `LANText v${getVersion()}`;
  const desc = 'Local Area Network Chat Application';

  const sections = [
    '',
    `  ${title}`,
    `  ${desc}`,
    '',
    `  USAGE`,
    `    lantext                        Interactive mode (choose hotspot or wifi)`,
    `    lantext client                 Run as wifi client`,
    `    lantext hotspot                Run as hotspot/server`,
    `    lantext help                   Show this help message`,
    '',
    `  MODES`,
    `    client | wifi                   Connect to a server on the network`,
    `    hotspot | server               Act as a server and accept connections`,
    '',
    `  ENVIRONMENT`,
    `    DEBUG=true                    Enable debug logging`,
    `    SERVER=<ip>                  Specify server IP (for client mode)`,
    '',
    `  EXAMPLES`,
    `    $ lantext                        # Interactive mode`,
    `    $ lantext client                 # Direct client mode`,
    `    $ lantext hotspot                # Direct hotspot mode`,
    `    $ DEBUG=true lantext client      # Client with debug`,
    `    $ SERVER=192.168.1.5 lantext client  # Specific server`,
    `    $ SERVER=127.0.0.1 lantext client    # Localhost test`,
    '',
  ];

  console.log(box(sections, 72));
}
