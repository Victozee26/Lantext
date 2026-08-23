// app.tsx - Full LanText TUI layout: header banner on top, scrollable
// divider-separated message feed in the middle, composer card at the bottom,
// status bar bottom-most. Mode badge, server-only bits (client count,
// listening state) and the keyboard shutdown path are wired from the real
// useChatSession state.
//
// Own-sender identity (row accent + local echo): the server stamps
// its own sends 'HOTSPOT' (src/hotspot.ts); a client's messages are stamped
// by the server with the client's IP (createEnvelope(socket.remoteAddress)),
// which equals getLocalIP() locally. Transports never loop local sends back
// into 'message', so App echoes successful sends via session.appendOwn.

import { useChatSession } from './hooks/use-chat-session.js';
import { ShutdownKeys } from './runtime.js';
import type { ChatSession } from './session-adapter.js';
import { Composer } from './components/composer.js';
import { Header, type LanTextMode } from './components/header.js';
import { MessageFeed } from './components/message-feed.js';
import { StatusBar } from './components/status-bar.js';
import { getLocalIP, type MessageEnvelope } from '../utils.js';

export interface AppProps {
  adapter: ChatSession;
  /** Runtime teardown, forwarded to the keyboard-shutdown component. */
  shutdown: () => void;
  /** Header badge mode. Optional: Phase 4 passes it; when absent the mode is
   *  derived from session state (serverPort events -> server). */
  mode?: LanTextMode;
  /** Fatal-error sink. The renderer's own uncaughtException handler swallows
   *  throws and keeps rendering, so transport throws are routed to the
   *  runtime's failFast explicitly instead of being hidden. */
  failFast?: (message: string) => void;
}

export function App({ adapter, shutdown, mode, failFast }: AppProps) {
  const session = useChatSession(adapter);
  const chatMode: LanTextMode = mode ?? (session.serverPort !== null ? 'server' : 'client');
  const ownSender = chatMode === 'server' ? 'HOTSPOT' : getLocalIP();

  const handleSend = (text: string): boolean => {
    try {
      const accepted = adapter.send(text);
      if (accepted) {
        // Display-only echo; see module docs. Timestamped at send time.
        const envelope: MessageEnvelope = {
          sender: ownSender,
          timestamp: Date.now(),
          text,
        };
        session.appendOwn(envelope);
      }
      return accepted;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      if (failFast) failFast(`send failed: ${detail}`);
      return false;
    }
  };

  return (
    <box flexDirection="column" flexGrow={1}>
      <ShutdownKeys onShutdown={shutdown} />
      <Header mode={chatMode} />
      <MessageFeed messages={session.messages} ownSender={ownSender} />
      <Composer onSubmit={handleSend} />
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
