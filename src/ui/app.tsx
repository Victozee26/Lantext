// app.tsx - Full LanText TUI layout: header banner on top, scrollable
// divider-separated message feed in the middle, composer card at the bottom,
// status bar bottom-most. Mode badge, server-only bits (client count,
// listening state) and the keyboard shutdown path are wired from the real
// useChatSession state.
//
// Own-sender identity (row accent + local echo): the host stamps
// its own sends 'HOST' (src/hotspot.ts); a client's messages are stamped
// by the server with the client's IP (createEnvelope(socket.remoteAddress)),
// which equals getLocalIP() locally. Transports never loop local sends back
// into 'message', so App echoes successful sends via session.appendOwn.

import { useKeyboard } from '@opentui/react';
import type { KeyEvent } from '@opentui/core';
import { useChatSession } from './hooks/use-chat-session.js';
import { ShutdownKeys } from './runtime.js';
import type { ChatSession } from './session-adapter.js';
import { Composer } from './components/composer.js';
import { Header, type LanTextMode } from './components/header.js';
import { MessageFeed } from './components/message-feed.js';
import { RoomPicker } from './components/room-picker.js';
import { StatusBar } from './components/status-bar.js';
import { THEME } from './theme.js';
import type { MessageEnvelope } from '../protocol/envelope.js';

export interface AppProps {
  adapter: ChatSession;
  /** Runtime teardown, forwarded to the keyboard-shutdown component. */
  shutdown: () => void;
  /** Header badge mode. Optional: Phase 4 passes it; when absent the mode is
   *  derived from session state (serverPort events -> server). */
  mode?: LanTextMode;
  /** Sender identity for local echo and row accent; injected by orchestrator (SRP: UI is pure). */
  ownSender: string;
  /** Network identity for header; injected. */
  localIp: string;
  /** Version string for header; injected. */
  version: string;
  /** Host-only room name for the status bar; injected by server-tui. */
  roomName?: string | null;
  /** Fatal-error sink. The renderer's own uncaughtException handler swallows
   *  throws and keeps rendering, so transport throws are routed to the
   *  runtime's failFast explicitly instead of being hidden. */
  failFast?: (message: string) => void;
}

export function App({
  adapter,
  shutdown,
  mode,
  ownSender,
  localIp,
  version,
  roomName = null,
  failFast,
}: AppProps) {
  const session = useChatSession(adapter);
  const chatMode: LanTextMode = mode ?? (session.serverPort !== null ? 'host' : 'client');
  const pickingRoom =
    chatMode === 'client'
    && session.rooms.length > 1
    && session.selectedRoom === null
    && session.roomLost === null;

  useKeyboard((key: KeyEvent) => {
    if (session.roomLost === null) return;
    if (key.name === 'r' && !key.ctrl && !key.meta && !key.shift) session.retryRoom();
    if (key.name === 'c' && !key.ctrl && !key.meta && !key.shift) session.chooseAnotherRoom();
  });

  if (pickingRoom) {
    return (
      <box flexDirection="column" flexGrow={1}>
        <ShutdownKeys onShutdown={shutdown} />
        <RoomPicker
          rooms={session.rooms}
          localVersion={version}
          onSelect={(key) => { session.selectRoom(key); }}
          onQuit={shutdown}
        />
      </box>
    );
  }

  const handleSend = (text: string): boolean => {
    if (session.roomLost !== null) return false;
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
      <Header mode={chatMode} localIp={localIp} version={version} />
      <MessageFeed messages={session.messages} ownSender={ownSender} />
      {session.roomLost !== null ? (
        <box flexDirection="row" height={1} paddingLeft={2} paddingRight={2}>
          <text style={{ fg: THEME.error }}>Room "{session.roomLost.name}" is gone. </text>
          <text style={{ fg: THEME.muted }}>[</text>
          <text style={{ fg: THEME.brand }}>r</text>
          <text style={{ fg: THEME.muted }}>]etry  [</text>
          <text style={{ fg: THEME.brand }}>c</text>
          <text style={{ fg: THEME.muted }}>]hoose another</text>
        </box>
      ) : null}
      <Composer onSubmit={handleSend} disabled={session.roomLost !== null} />
      <StatusBar
        status={session.status}
        connectedAddress={session.connectedAddress}
        serverPort={session.serverPort}
        clientCount={session.clientCount}
        isServer={chatMode === 'host'}
        lastError={session.lastError}
        selectedRoom={session.selectedRoom}
        roomLost={session.roomLost}
        hostRoomName={roomName}
      />
    </box>
  );
}
