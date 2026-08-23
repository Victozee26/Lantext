// header.tsx - Top bar: LANText wordmark, local IP, mode badge, and version.
//
// The version comes from the shared getVersion() helper (src/utils.ts): read
// at RUNTIME from package.json (a direct JSON import is impossible because
// tsconfig rootDir is `src` and package.json lives at the repository root).
// Cached after first read; any failure degrades to '?'.

import { getLocalIP, getVersion } from '../../utils.js';
import { THEME } from '../theme.js';

/** Chat mode label for the header badge and the mode-select screen. */
export type LanTextMode = 'client' | 'server';

const VERSION = getVersion();

export interface HeaderProps {
  mode: LanTextMode;
}

export function Header({ mode }: HeaderProps) {
  const badgeColor = mode === 'server' ? THEME.accent : THEME.brand;
  return (
    <box flexDirection="row" alignItems="center" paddingLeft={1} paddingRight={1}>
      <text style={{ fg: THEME.brand }}>LANText</text>
      <text style={{ fg: THEME.muted }}> v{VERSION}</text>
      <box flexGrow={1} />
      <text style={{ fg: THEME.muted }}>{getLocalIP()}</text>
      <text style={{ fg: badgeColor }}> [{mode}]</text>
    </box>
  );
}