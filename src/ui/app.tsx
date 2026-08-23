// app.tsx - Full LanText TUI layout: header on top, scrollable message feed
// in the middle, composer at the bottom, status bar bottom-most. Mode badge,
// server-only bits (client count, listening state) and the keyboard shutdown
// path are wired from the real useChatSession state.

import { useChatSession } from './hooks/use-chat-session.js';
import { ShutdownKeys } from './runtime.js';
import type { ChatSession } from './session-adapter.js';
import { Composer } from './components/composer.js';
import { Header, type LanTextMode } from './components/header.js';
import { MessageFeed } from './components/message-feed.js';
import { StatusBar } from './components/status-bar.js';

export interface AppProps {
  adapter: ChatSession;
  /** Runtime teardown, forwarded to the keyboard-shutdown component. */
  shutdown: () => void;
  /** Header badge mode. Optional: Phase 4 passes it; when absent the mode is
   *  derived from session state (serverPort events -> server). */
  mode?: LanTextMode;
}

export function App({ adapter, shutdown, mode }: AppProps) {
  const session = useChatSession(adapter);
  const chatMode: LanTextMode = mode ?? (session.serverPort !== null ? 'server' : 'client');

  return (
    <box flexDirection="column" flexGrow={1}>
      <ShutdownKeys onShutdown={shutdown} />
      <Header mode={chatMode} />
      <MessageFeed messages={session.messages} />
      <Composer onSubmit={(text) => adapter.send(text)} />
      <StatusBar
        status={session.status}
        connectedAddress={session.connectedAddress}
        serverPort={session.serverPort}
        clientCount={session.clientCount}
        isServer={chatMode === 'server'}
        lastError={session.lastError}
      />
    </box>
  );
}