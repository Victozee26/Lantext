// help.ts - Help text rendering.

import { getVersion } from '../protocol/version.js';

export function formatHelp(injectedVersion?: string): void {
  const title = `LANText v${injectedVersion ?? getVersion()}`;
  const desc = 'Local Area Network Chat Application';

  const sections = [
    '',
    `  ${title}`,
    `  ${desc}`,
    '',
    `  USAGE`,
    `    lantext                        Interactive mode (choose host or client)`,
    `    lantext host  (-h, --host)      Run as host`,
    `    lantext client (-c, --client)   Run as client`,
    `    lantext help (--help)          Show this help message`,
    '',
    `  MODES`,
    `    host (-h, --host)               Act as host and accept connections`,
    `    client (-c, --client)           Connect to a host on the network`,
    '',
    `  ENVIRONMENT`,
    `    DEBUG=true                    Enable debug logging`,
    `    SERVER=<ip>                  Specify host IP (for client mode)`,
    '',
    `  EXAMPLES`,
    `    $ lantext                        # Interactive mode`,
    `    $ lantext client                 # Direct client mode`,
    `    $ lantext host                   # Direct host mode`,
    `    $ lantext -c                     # Short alias for client`,
    `    $ lantext -h                     # Short alias for host`,
    `    $ DEBUG=true lantext client      # Client with debug`,
    `    $ SERVER=192.168.1.5 lantext client  # Specific host`,
    `    $ SERVER=127.0.0.1 lantext client    # Localhost test`,
    '',
  ];

  console.log(sections.join('\n'));
}
