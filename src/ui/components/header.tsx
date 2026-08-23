// header.tsx - Top bar: LANText wordmark, local IP, mode badge, and version.
//
// The version is read at RUNTIME from package.json via fs.readFileSync: a
// direct JSON import is impossible because tsconfig rootDir is `src` and
// package.json lives at the repository root. Parsed once at module load;
// any read/parse failure degrades to '?' instead of throwing.
//
// Note: the plan's URL was "../../package.json", written for a file one
// level shallower; from src/ui/components/ the repo root is three levels up.

import { readFileSync } from 'node:fs';
import { getLocalIP } from '../../utils.js';
import { THEME } from '../theme.js';

/** Chat mode label for the header badge and the mode-select screen. */
export type LanTextMode = 'client' | 'server';

function loadVersion(): string {
  try {
    const raw = readFileSync(new URL('../../../package.json', import.meta.url), 'utf8');
    const pkg = JSON.parse(raw) as { version?: unknown };
    return typeof pkg.version === 'string' && pkg.version !== '' ? pkg.version : '?';
  } catch {
    return '?';
  }
}

const VERSION = loadVersion();

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