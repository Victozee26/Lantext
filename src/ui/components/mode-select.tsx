// mode-select.tsx - Interactive mode picker (Client / Host),
// presented as a centered hero card.
//
// Wordmark + rule gradients: per-character colors via styled <span> children
// INSIDE one <text> (mixHex from theme.ts, bold attributes on the wordmark).
// Do NOT restructure these into sibling <text> nodes in a row box: multiple
// 1-char <text> siblings under a centered column intermittently measure to
// zero and drop out of layout+paint (observed on 0.5.6; spans inside a
// single text renderable are the reliable shape).
//
// <select> with the two LanText modes; Enter confirms via onSelect. q or
// ESC quits cleanly via onQuit — handled with useKeyboard (a global handler,
// dispatched before focused renderables), so they work while the select
// holds focus.
//
// SelectRenderable has no intrinsic measure: it needs explicit width and
// height (2 options × 2 lines with descriptions = 4 rows).

import { useKeyboard } from '@opentui/react';
import { TextAttributes } from '@opentui/core';
import type { KeyEvent, SelectOption } from '@opentui/core';
import { THEME, mixHex } from '../theme.js';
import type { LanTextMode } from './header.js';

export interface ModeSelectProps {
  onSelect: (mode: LanTextMode) => void;
  onQuit: () => void;
}

const OPTIONS: SelectOption[] = [
  { name: 'Client', description: 'connect to a host', value: 'client' },
  { name: 'Host', description: 'accept incoming clients', value: 'host' },
];

const WORDMARK = 'LANText'.split('');
const RULE = '─────'.split('');

function GradientWordmark() {
  const last = WORDMARK.length - 1;
  return (
    <text>
      {WORDMARK.map((char, index) => (
        <span
          key={index}
          style={{
            fg: mixHex(THEME.brand, THEME.accent, index / last),
            attributes: TextAttributes.BOLD,
          }}
        >
          {char}
        </span>
      ))}
    </text>
  );
}

function GradientRule() {
  const total = WORDMARK.length + RULE.length - 1;
  return (
    <text>
      {RULE.map((char, index) => (
        <span
          key={index}
          style={{ fg: mixHex(THEME.brand, THEME.accent, (WORDMARK.length + index) / total) }}
        >
          {char}
        </span>
      ))}
    </text>
  );
}

export function ModeSelect({ onSelect, onQuit }: ModeSelectProps) {
  useKeyboard((key: KeyEvent) => {
    if (key.name === 'escape') onQuit();
    if (key.name === 'q' && !key.ctrl && !key.meta && !key.shift) onQuit();
  });

  return (
    <box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <GradientWordmark />
      <GradientRule />
      <text style={{ fg: THEME.muted }}>local-network chat</text>
      <box paddingTop={2} />
      <box
        borderStyle="rounded"
        border
        borderColor={THEME.border}
        title=" mode "
        titleColor={THEME.brand}
        paddingLeft={2}
        paddingRight={4}
        paddingTop={0}
        paddingBottom={0}
      >
        <select
          options={OPTIONS}
          onSelect={(_index, option) => {
            if (option) onSelect(option.value as LanTextMode);
          }}
          focused
          width={40}
          height={4}
          wrapSelection
          showDescription
          selectedIndex={0}
          textColor={THEME.muted}
          focusedTextColor={THEME.info}
          selectedTextColor={THEME.info}
          descriptionColor={THEME.muted}
          selectedDescriptionColor={THEME.accent}
          selectedBackgroundColor="transparent"
          backgroundColor="transparent"
        />
      </box>
      <box paddingTop={1} />
      <box flexDirection="row" height={1}>
        <text style={{ fg: THEME.muted }}>↑↓ navigate · enter select · </text>
        <text style={{ fg: THEME.brand }}>q</text>
        <text style={{ fg: THEME.muted }}> quit</text>
      </box>
    </box>
  );
}
