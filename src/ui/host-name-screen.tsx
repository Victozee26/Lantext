// host-name-screen.tsx - Pre-host room-name prompt lifecycle.
//
// Returns the chosen name, or null when the user cancels. The caller owns
// persistence: server-tui passes the returned name to LanServer, which writes
// it through src/server/identity.ts. This screen imports no filesystem code.

import { openEphemeralScreen } from './ephemeral-screen.js';
import { ShutdownKeys } from './runtime.js';
import { HostNamePrompt } from './components/host-name-prompt.js';

export async function openHostNamePrompt(defaultName: string): Promise<string | null> {
  return openEphemeralScreen<string | null>({
    signalResult: null,
    render: (settle) => (
      <>
        <HostNamePrompt
          defaultName={defaultName}
          onSubmit={settle}
          onCancel={() => settle(null)}
        />
        <ShutdownKeys onShutdown={() => settle(null)} />
      </>
    ),
  });
}
