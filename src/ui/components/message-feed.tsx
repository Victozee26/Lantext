// message-feed.tsx - Scrollable message history rendered from transport
// MessageEnvelope rows.
//
// Own-sent vs received (MARKER approach): rows whose envelope.sender matches
// the `ownSender` prop render with a '❯' marker and THEME.sent text; every
// other row gets a '·' marker and default text. Sender names are always
// THEME.sender (purple, matching the old non-TTY UI) and timestamps always
// THEME.muted. Phase 4 supplies ownSender once the orchestrators define the
// local operator identity; until then no row matches and every row renders
// in received style.
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
  /** Sender identity styled as own-sent rows; null/undefined disables it. */
  ownSender?: string | null;
}

export function MessageFeed({ messages, ownSender }: MessageFeedProps) {
  return (
    <scrollbox stickyScroll stickyStart="bottom" flexGrow={1} focused={false}>
      {messages.map((envelope, index) => (
        <MessageRow key={index} envelope={envelope} own={envelope.sender === ownSender} />
      ))}
    </scrollbox>
  );
}

function MessageRow({ envelope, own }: { envelope: MessageEnvelope; own: boolean }) {
  const ts = formatTimestamp(envelope.timestamp);
  return (
    <box flexDirection="row" paddingLeft={1} paddingRight={1}>
      <text style={{ fg: own ? THEME.sent : THEME.muted }}>{own ? '❯' : '·'}</text>
      <text style={{ fg: own ? THEME.sent : THEME.sender }}> {envelope.sender}</text>
      <text style={{ fg: THEME.muted }}> {ts}</text>
      <text style={{ fg: own ? THEME.sent : undefined }}>  {envelope.text}</text>
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