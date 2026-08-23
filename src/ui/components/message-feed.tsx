// message-feed.tsx - Scrollable message history (thin composition).

import { TextAttributes } from '@opentui/core';
import type { MessageEnvelope } from '../../protocol/envelope.js';
import { THEME } from '../theme.js';
import { MessageRow } from './message-feed/message-row.js';

const TIPS: readonly string[] = [
  "Tip: Double-click a message to copy it",
] as const;

export interface MessageFeedProps {
  messages: MessageEnvelope[];
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
      verticalScrollbarOptions={{ visible: false }}
      horizontalScrollbarOptions={{ visible: false }}
    >
      {messages.length === 0 ? (
        <box flexDirection="column" alignItems="center" width="100%" paddingTop={1} gap={1}>
          <text selectable={false} style={{ fg: THEME.muted }}>
            no messages yet — say something
          </text>
          {TIPS[0] ? (
            <text selectable={false} style={{ fg: THEME.muted, attributes: TextAttributes.DIM }}>
              {TIPS[0]}
            </text>
          ) : null}
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
