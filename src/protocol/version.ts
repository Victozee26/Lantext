// version.ts - Shared runtime version read from package.json.
// Cached after first read; degrades to '?' on failure.
// Cannot be a JSON import because tsconfig rootDir is `src`.

import { readFileSync } from 'node:fs';

let cachedVersion: string | undefined;

export function getVersion(): string {
  if (cachedVersion === undefined) {
    try {
      const raw = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
      const pkg = JSON.parse(raw) as { version?: unknown };
      cachedVersion = typeof pkg.version === 'string' && pkg.version !== '' ? pkg.version : '?';
    } catch {
      cachedVersion = '?';
    }
  }
  return cachedVersion;
}

// test seam: reset cache
export function __resetVersionCache(): void {
  cachedVersion = undefined;
}
