// header.tsx - Top banner: LANText wordmark, version, local IP, and a
// mode chip with a status dot.
//
// The version comes from the shared getVersion() helper (src/utils.ts): read
// at RUNTIME from package.json (a direct JSON import is impossible because
// tsconfig rootDir is `src` and package.json lives at the repository root).
// Cached after first read; any failure degrades to '?'.
//
// Layout: a rounded-border banner box (explicit height={3}: top border +
// one content row + bottom border). The inner flex ROW carries explicit
// height={1} per the nested-row collapse fact in AGENTS.md.

import { TextAttributes } from '@opentui/core';
import { getLocalIP, getVersion } from '../../utils.js';
import { THEME } from '../theme.js';

/** Chat mode label for the header badge and the mode-select screen. */
export type LanTextMode = 'client' | 'server';

const VERSION = getVersion();

export interface HeaderProps {
  mode: LanTextMode;
}

export function Header({ mode }: HeaderProps) {
  const isServer = mode === 'server';
  const badgeColor = isServer ? THEME.accent : THEME.brand;
  return (
    <box
      borderStyle="rounded"
      border
      borderColor={THEME.border}
      height={3}
      paddingLeft={2}
      paddingRight={2}
    >
      <box flexDirection="row" alignItems="center" height={1}>
        <text style={{ fg: THEME.accent }}>◆ </text>
        <text style={{ fg: THEME.brand, attributes: TextAttributes.BOLD }}>LANText</text>
        <text style={{ fg: THEME.muted }}> v{VERSION}</text>
        <box flexGrow={1} />
        <text style={{ fg: THEME.muted }}>{getLocalIP()}</text>
        <text style={{ fg: badgeColor }}> ● {mode}</text>
      </box>
    </box>
  );
}
