// chat-screen.tsx - Boots the chat runtime for a session adapter.
//
// Thin shared wiring so both mode orchestrators (src/client-mode.ts,
// src/server-mode.ts — plain .ts files) mount the same OpenTUI chat screen
// without holding JSX themselves: bootRuntime + <App> with the adapter, the
// runtime teardown as the keyboard-shutdown sink, the explicit mode badge,
// and failFast for transport throws (the renderer's own uncaughtException
// handler swallows throws, so fatal errors are routed to failFast here).
//
// The orchestrator starts its transport AFTER this resolves; any events that
// still race ahead of the React mount effect are covered by the adapter's
// BufferedSession (see src/ui/buffered-session.ts).

import { bootRuntime, type RuntimeApi } from './runtime.js';
import { App } from './app.js';
import type { ChatSession } from './session-adapter.js';
import type { LanTextMode } from './components/header.js';

export interface ChatScreenContext {
  ownSender: string;
  localIp: string;
  version: string;
}

export async function mountChatScreen(
  adapter: ChatSession,
  mode: LanTextMode,
  ctx: ChatScreenContext,
): Promise<void> {
  await bootRuntime(adapter, (api: RuntimeApi) => (
    <App
      adapter={adapter}
      shutdown={() => api.teardown()}
      mode={mode}
      ownSender={ctx.ownSender}
      localIp={ctx.localIp}
      version={ctx.version}
      failFast={(message) => api.failFast(message)}
    />
  ));
}