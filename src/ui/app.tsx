// app.tsx - STUB App for Phase 2. Proves the layers compose: adapter ->
// useChatSession state -> themed rendering + the keyboard shutdown path.
// The real layout (header/feed/composer/status-bar/mode-select) lands in
// Phase 3.

import { useChatSession } from './hooks/use-chat-session.js';
import { ShutdownKeys } from './runtime.js';
import type { ChatSession } from './session-adapter.js';
import { THEME } from './theme.js';

export interface AppProps {
  adapter: ChatSession;
  /** Runtime teardown, forwarded to the keyboard-shutdown component. */
  shutdown: () => void;
}

export function App({ adapter, shutdown }: AppProps) {
  const session = useChatSession(adapter);
  return (
    <box flexDirection="column" padding={1}>
      <ShutdownKeys onShutdown={shutdown} />
      <text style={{ fg: THEME.brand }}>LANText TUI core layers alive</text>
      <text style={{ fg: THEME.muted }}>
        status: {session.status ?? 'idle'} · messages: {session.messages.length} · clients: {session.clientCount}
      </text>
      {session.lastError !== null ? (
        <text style={{ fg: THEME.error }}>error: {session.lastError}</text>
      ) : null}
      {session.messages.length > 0 ? (
        <text style={{ fg: THEME.sender }}>
          last: {session.messages[session.messages.length - 1].sender} —{' '}
          {session.messages[session.messages.length - 1].text}
        </text>
      ) : null}
    </box>
  );
}