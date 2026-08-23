// message-feed.tsx - Scrollable message history rendered from transport
// MessageEnvelope rows as messenger-style chat bubbles.
//
// Own-sent vs received (MARKER approach): rows whose envelope.sender matches
// the `ownSender` prop render as right-aligned green-tinted bubbles with the
// timestamp in the top border title; every other row renders as a
// left-aligned slate bubble titled with the sender (purple) and a muted
// timestamp row inside. Phase 4 note: app.tsx now always supplies ownSender
// ('HOTSPOT' for server mode, getLocalIP() for client mode), and sent
// messages are echoed locally by use-chat-session.appendOwn — transports do
// not loop local sends back into 'message'.
//
// Layout facts relied on (see AGENTS.md):
// - Bubble boxes shrink-wrap via alignSelf ("flex-end"/"flex-start") inside
//   the scrollbox column; maxWidth "80%" forces word wrap of long lines.
// - The inner meta ROW (timestamp) carries explicit height={1}: nested flex
//   rows measuring <text> children can collapse to 0 in a column layout.
// - Content <text> nodes measure their wrapped height; wrapMode="word".
//
// Auto-scroll: ScrollBox `stickyScroll` + `stickyStart="bottom"` — the
// renderable tracks sticky state internally and disengages on manual
// scroll-up (ScrollBoxRenderable.syncManualScrollState).
//
// focused={false} keeps keyboard focus on the composer.

import type { MessageEnvelope } from '../../utils.js';
import { THEME } from '../theme.js';

export interface MessageFeedProps {
  messages: MessageEnvelope[];
  /** Sender identity styled as own-sent bubbles; null/undefined disables it. */
  ownSender?: string | null;
}

export function MessageFeed({ messages, ownSender }: MessageFeedProps) {
  return (
    <scrollbox
      stickyScroll
      stickyStart="bottom"
      flexGrow={1}
      focused={false}
      verticalScrollbarOptions={{
        trackOptions: { foregroundColor: THEME.border },
      }}
    >
      {messages.length === 0 ? (
        <box flexDirection="column" alignItems="center" width="100%" paddingTop={1}>
          <text style={{ fg: THEME.muted }}>no messages yet — say something</text>
        </box>
      ) : null}
      {messages.map((envelope, index) => (
        <MessageBubble key={index} envelope={envelope} own={envelope.sender === ownSender} />
      ))}
    </scrollbox>
  );
}

function MessageBubble({ envelope, own }: { envelope: MessageEnvelope; own: boolean }) {
  const ts = formatTimestamp(envelope.timestamp);
  if (own) {
    return (
      <box
        alignSelf="flex-end"
        maxWidth="80%"
        borderStyle="rounded"
        border
        borderColor={THEME.sent}
        backgroundColor={THEME.selfBg}
        title={` ${ts} `}
        titleColor={THEME.muted}
        paddingLeft={2}
        paddingRight={2}
      >
        <text style={{ fg: THEME.sent }} wrapMode="word">{envelope.text}</text>
      </box>
    );
  }
  return (
    <box
      alignSelf="flex-start"
      maxWidth="80%"
      borderStyle="rounded"
      border
      borderColor={THEME.border}
      backgroundColor={THEME.otherBg}
      title={` ${envelope.sender} `}
      titleColor={THEME.sender}
      paddingLeft={2}
      paddingRight={2}
    >
      <box flexDirection="row" height={1}>
        <box flexGrow={1} />
        <text style={{ fg: THEME.muted }}>{ts}</text>
      </box>
      <text wrapMode="word">{envelope.text}</text>
    </box>
  );
}

function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
