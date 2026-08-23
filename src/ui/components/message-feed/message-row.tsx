// message-row.tsx - Single message row with copy-on-double-click.

import { useEffect, useRef, useState } from 'react';
import { TextAttributes } from '@opentui/core';
import { useRenderer } from '@opentui/react';
import {
  createClipboard,
  createHostClipboard,
  createRendererClipboardAdapter,
  type MouseEvent,
} from '@opentui/core';
import type { MessageEnvelope } from '../../../protocol/envelope.js';
import { THEME } from '../../theme.js';
import { formatTime } from './time.js';
import { renderMultiline } from './multiline.js';
import { Divider } from './divider.js';

const DOUBLE_CLICK_MS = 400;
const COPIED_MS = 900;

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

export interface MessageRowProps {
  envelope: MessageEnvelope;
  own: boolean;
  isLast: boolean;
}

export function MessageRow({ envelope, own, isLast }: MessageRowProps) {
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
      <box
        flexDirection="column"
        width="100%"
        border={['left']}
        borderColor={copied ? THEME.success : accent}
        customBorderChars={ACCENT_BORDER_CHARS}
      >
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
        <box paddingLeft={2} paddingRight={1} flexDirection="column">
          <text selectable wrapMode="word">
            {renderMultiline(envelope.text)}
          </text>
        </box>
      </box>
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
