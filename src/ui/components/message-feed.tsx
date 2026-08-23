// message-feed.tsx - Scrollable message history rendered from transport
// MessageEnvelope rows as messenger-style chat bubbles.
//
// Own-sent vs received: rows whose envelope.sender matches the `ownSender`
// prop render as right-aligned green-tinted bubbles; every other row renders
// as a left-aligned slate bubble titled with the sender (purple). Timestamps
// are intentionally not rendered. Phase 4 note: app.tsx always supplies
// ownSender ('HOTSPOT' for server, getLocalIP() for client), and sent
// messages are echoed locally by use-chat-session.appendOwn — transports do
// not loop local sends back into 'message'.
//
// Layout facts relied on (see AGENTS.md):
// - Bubble boxes shrink-wrap via alignSelf ("flex-end"/"flex-start") inside
//   the scrollbox column; maxWidth "80%" forces word wrap of long lines.
// - Bubbles are border-only (no backgroundColor) — avoids fill bleeding
//   outside rounded corners and keeps the near-black terminal background.
// - Content <text> nodes measure their wrapped height; wrapMode="word".
//
// Auto-scroll: ScrollBox `stickyScroll` + `stickyStart="bottom"` — the
// renderable tracks sticky state internally and disengages on manual
// scroll-up (ScrollBoxRenderable.syncManualScrollState).
//
// focused={false} keeps keyboard focus on the composer.

import { useEffect, useRef, useState } from 'react';
import { useRenderer } from '@opentui/react';
import {
  createClipboard,
  createHostClipboard,
  createRendererClipboardAdapter,
  type MouseEvent,
} from '@opentui/core';
import type { MessageEnvelope } from '../../utils.js';
import { THEME } from '../theme.js';

const DOUBLE_CLICK_MS = 400;
const COPIED_MS = 900;

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
      gap={1}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
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

function renderMultiline(text: string) {
  const lines = text.split('\n');
  if (lines.length === 1) return lines[0];
  return lines.map((line, idx) => (
    <span key={idx}>
      {line}
      {idx < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

function MessageBubble({ envelope, own }: { envelope: MessageEnvelope; own: boolean }) {
  const renderer = useRenderer();
  const lastClickRef = useRef(0);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleCopy = async (): Promise<void> => {
    const text = envelope.text;
    if (!text) return;
    // Prefer host+terminal clipboard; fall back to OSC52 directly.
    try {
      const host = createHostClipboard();
      const clipboard = createClipboard({
        host,
        terminal: createRendererClipboardAdapter(renderer as unknown as Parameters<typeof createRendererClipboardAdapter>[0]),
      });
      try {
        const result = await clipboard.writeText(text, { destination: 'best-available' });
        const ok = result.host.status === 'written' || result.terminal.status === 'attempted';
        if (ok) {
          setCopied(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setCopied(false), COPIED_MS);
        } else {
          // Fallback to raw OSC52
          (renderer as unknown as { copyToClipboardOSC52?: (t: string) => boolean })?.copyToClipboardOSC52?.(text);
          setCopied(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setCopied(false), COPIED_MS);
        }
      } finally {
        // Keep provider alive briefly for Linux (see clipboard docs), then dispose.
        setTimeout(() => {
          clipboard.dispose().catch(() => {});
        }, 1500);
      }
    } catch {
      try {
        (renderer as unknown as { copyToClipboardOSC52?: (t: string) => boolean })?.copyToClipboardOSC52?.(text);
        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), COPIED_MS);
      } catch {}
    }
  };

  const handleMouseDown = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const now = Date.now();
    const delta = now - lastClickRef.current;
    lastClickRef.current = now;
    if (delta < DOUBLE_CLICK_MS && delta > 0) {
      event.preventDefault?.();
      event.stopPropagation?.();
      void handleCopy();
    }
  };

  const borderColor = copied ? THEME.success : own ? THEME.sent : THEME.border;
  const bottomTitle = copied ? ' copied ' : undefined;

  if (own) {
    return (
      <box
        alignSelf="flex-end"
        maxWidth="80%"
        borderStyle="rounded"
        border
        borderColor={borderColor}
        title={undefined}
        bottomTitle={bottomTitle}
        bottomTitleAlignment="right"
        paddingLeft={2}
        paddingRight={2}
        onMouseDown={handleMouseDown}
      >
        <text style={{ fg: THEME.sent }} wrapMode="word">
          {renderMultiline(envelope.text)}
        </text>
      </box>
    );
  }
  return (
    <box
      alignSelf="flex-start"
      maxWidth="80%"
      borderStyle="rounded"
      border
      borderColor={borderColor}
      title={` ${envelope.sender} `}
      titleColor={THEME.sender}
      bottomTitle={bottomTitle}
      bottomTitleAlignment="right"
      paddingLeft={2}
      paddingRight={2}
      onMouseDown={handleMouseDown}
    >
      <text wrapMode="word">{renderMultiline(envelope.text)}</text>
    </box>
  );
}
