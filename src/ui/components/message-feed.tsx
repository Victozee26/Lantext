// message-feed.tsx - Scrollable message history as a flat divider-separated
// log (no chat bubbles).
//
// Replaces the previous messenger-bubble layout which shrink-wrapped each
// row into a rounded 80%-width border box (alignSelf flex-end / flex-start).
// The new layout is full-width, minimal, and inspired by the user's
// `____________` divider sketch — but polished with OpenTUI primitives:
//
// - Each message is a full-width row: header (sender · time) + body wrapped
//   in a native left-border accent (`border={["left"]}` +
//   `customBorderChars={{vertical:"┃"}}`, `borderColor` = sender purple /
//   sent green, cloned from `../opencode/packages/tui/src/ui/border.ts` +
//   `packages/tui/src/routes/session/index.tsx:1398` UserMessage). The border
//   is Box chrome (not Text), so it never enters Selection.getSelectedText().
// - Sender is bold-purple (incoming) / bold-green (own). Time is muted
//   HH:MM from envelope.timestamp. Own rows show an extra "· you" marker.
// - Messages are separated by a thin full-width rule (THEME.border, "─"
//   repeated and clipped via overflow:hidden) — a crisper version of the
//   plain `________` the user sketched.
// - No timestamps were shown in the bubble design; the log now renders them
//   because a divider log without time feels unanchored.
// - Double-click → copy and the 900ms "✓ copied" inline feedback are
//   preserved; previously this tinted the bubble border + bottomTitle, now
//   it renders inline in the header row (and tints the left border).
// - Auto-scroll + sticky behaviour unchanged (ScrollBox stickyScroll/bottom).
// - focused={false} keeps keyboard focus on the composer.

import { useEffect, useRef, useState } from 'react';
import { TextAttributes } from '@opentui/core';
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

// Native left-accent border — mirrors opencode's `SplitBorder` in
// `../opencode/packages/tui/src/ui/border.ts:15`. `EmptyBorder` zeroes
// every other glyph so only the left vertical shows as "┃".
const ACCENT_BORDER_CHARS = {
  topLeft: '',
  topRight: '',
  bottomLeft: '',
  bottomRight: '',
  horizontal: ' ',
  vertical: '┃',
  topT: '',
  bottomT: '',
  leftT: '',
  rightT: '',
  cross: '',
} as const;

export interface MessageFeedProps {
  messages: MessageEnvelope[];
  /** Sender identity styled as own-sent rows; null/undefined disables own styling. */
  ownSender?: string | null;
}

export function MessageFeed({ messages, ownSender }: MessageFeedProps) {
  return (
    <scrollbox
      stickyScroll
      stickyStart="bottom"
      flexGrow={1}
      focused={false}
      gap={0}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      // No right scrollbar — the previous `verticalScrollbarOptions.trackOptions`
      // drew a 1-col thumb (█) on the right edge that was included in terminal
      // native selection. Hiding it keeps manual drag-copy clean; scroll still
      // works via wheel/key.
      verticalScrollbarOptions={{ visible: false }}
      horizontalScrollbarOptions={{ visible: false }}
    >
      {messages.length === 0 ? (
        <box flexDirection="column" alignItems="center" width="100%" paddingTop={1}>
          <text selectable={false} style={{ fg: THEME.muted }}>
            no messages yet — say something
          </text>
        </box>
      ) : null}
      {messages.map((envelope, index) => (
        <MessageRow
          key={index}
          envelope={envelope}
          own={envelope.sender === ownSender}
          isLast={index === messages.length - 1}
        />
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

function formatTime(ts: number): string {
  try {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

function Divider() {
  // Full-width thin rule — repeats "─" and clips via intrinsic overflow.
  // Using a long repeat + overflow hidden guarantees it spans the available
  // width regardless of terminal resize without needing Yoga percentage math.
  // Non-selectable so drag-copy of a message doesn't pick up the rule.
  return (
    <box height={1} width="100%" overflow="hidden" paddingTop={0} paddingBottom={0}>
      <text selectable={false} style={{ fg: THEME.border }}>
        {"─".repeat(300)}
      </text>
    </box>
  );
}

function MessageRow({
  envelope,
  own,
  isLast,
}: {
  envelope: MessageEnvelope;
  own: boolean;
  isLast: boolean;
}) {
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
          (renderer as unknown as { copyToClipboardOSC52?: (t: string) => boolean })?.copyToClipboardOSC52?.(text);
          setCopied(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setCopied(false), COPIED_MS);
        }
      } finally {
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

  const accent = own ? THEME.sent : THEME.sender;
  const time = formatTime(envelope.timestamp);

  return (
    <box flexDirection="column" width="100%" gap={0} onMouseDown={handleMouseDown}>
      {/* Native left accent: Box border left with custom glyph "┃" (opencode
          pattern). Wraps header+body so the bar spans the full message height;
          border is Box chrome, never Text, so drag-copy stays clean. */}
      <box
        flexDirection="column"
        width="100%"
        border={['left']}
        borderColor={copied ? THEME.success : accent}
        customBorderChars={ACCENT_BORDER_CHARS}
      >
        {/* Header: sender · time  [· you]  [✓ copied] — non-selectable chrome */}
        <box flexDirection="row" height={1} alignItems="center" gap={1} paddingLeft={2} paddingRight={1}>
          <text selectable={false} style={{ fg: accent, attributes: TextAttributes.BOLD }}>
            {envelope.sender}
          </text>
          {own ? (
            <text selectable={false} style={{ fg: THEME.muted }}>
              · you
            </text>
          ) : null}
          <text selectable={false} style={{ fg: THEME.muted }}>
            {time ? `· ${time}` : null}
          </text>
          <box flexGrow={1} />
          {copied ? (
            <text selectable={false} style={{ fg: THEME.success }}>
              ✓ copied
            </text>
          ) : null}
        </box>

        {/* Body: only the message <text> is selectable */}
        <box paddingLeft={2} paddingRight={1} flexDirection="column">
          <text selectable wrapMode="word" style={{ fg: own ? undefined : undefined }}>
            {renderMultiline(envelope.text)}
          </text>
        </box>
      </box>

      {/* Divider after every row except the last; adds breathing room */}
      {!isLast ? (
        <box flexDirection="column" width="100%" paddingTop={1} paddingBottom={0} paddingLeft={1} paddingRight={1}>
          <Divider />
        </box>
      ) : (
        <box height={1} />
      )}
    </box>
  );
}
