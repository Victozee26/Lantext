// mode-select.tsx - Interactive mode picker (WiFi Client / Hotspot Server).
//
// <select> with the two LanText modes; Enter confirms via onSelect. q or
// ESC quits cleanly via onQuit — handled with useKeyboard (a global handler,
// dispatched before focused renderables), so they work while the select
// holds focus.
//
// SelectRenderable has no intrinsic measure: it needs explicit width and
// height (2 options × 2 lines with descriptions = 4 rows).

import { useKeyboard } from '@opentui/react';
import type { KeyEvent, SelectOption } from '@opentui/core';
import { THEME } from '../theme.js';
import type { LanTextMode } from './header.js';

export interface ModeSelectProps {
  onSelect: (mode: LanTextMode) => void;
  onQuit: () => void;
}

const OPTIONS: SelectOption[] = [
  { name: 'WiFi Client', description: 'Connect to a server on the local network', value: 'client' },
  { name: 'Hotspot Server', description: 'Accept connections from clients', value: 'server' },
];

export function ModeSelect({ onSelect, onQuit }: ModeSelectProps) {
  useKeyboard((key: KeyEvent) => {
    if (key.name === 'escape') onQuit();
    if (key.name === 'q' && !key.ctrl && !key.meta && !key.shift) onQuit();
  });

  return (
    <box flexDirection="column" alignItems="center" flexGrow={1}>
      <box paddingTop={4} />
      <text style={{ fg: THEME.brand }}>LANText</text>
      <text style={{ fg: THEME.muted }}>Choose a mode</text>
      <box paddingTop={1} />
      <select
        options={OPTIONS}
        onSelect={(_index, option) => {
          if (option) onSelect(option.value as LanTextMode);
        }}
        focused
        width={36}
        height={5}
        wrapSelection
        showDescription
        selectedIndex={0}
        textColor={THEME.muted}
        focusedTextColor={THEME.muted}
        selectedTextColor={THEME.brand}
        descriptionColor={THEME.muted}
        selectedDescriptionColor={THEME.info}
        selectedBackgroundColor="transparent"
        backgroundColor="transparent"
      />
      <box paddingTop={2} />
      <text style={{ fg: THEME.muted }}>q or ESC to quit</text>
    </box>
  );
}