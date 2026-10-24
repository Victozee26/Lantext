// identity.ts - Persisted host room identity.
//
// One host process = one room. `hostId` is stable across restarts (per
// install, not per process); `name` is user-facing and editable. Identity is
// deliberately NOT derived from IP, MAC, or hostname: all three change, and a
// room that silently renames itself breaks sticky reconnect.
//
// Failure policy: identity must never block hosting. A corrupt file is
// regenerated, and an unwritable path falls back to an in-memory identity for
// the current session with a warning surfaced through the host debug channel.

import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { dirname, join, win32 } from 'node:path';

export interface HostIdentity {
  hostId: string;
  name: string;
}

export interface HostIdentityResult extends HostIdentity {
  /** True when the identity was read from or written to disk. */
  persisted: boolean;
  /** Non-fatal persistence/read problem, suitable for the DEBUG channel. */
  warning: string | null;
}

export interface HostIdentityOptions {
  /** Explicit config path; tests and unusual deployments can override. */
  configPath?: string;
  /** Explicit room name; persisted when different from the stored one. */
  name?: string;
  /** @internal DI seams */
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  home?: string;
  hostname?: () => string;
  randomUUID?: () => string;
}

type ReadResult =
  | { kind: 'ok'; identity: HostIdentity }
  | { kind: 'missing' }
  | { kind: 'invalid'; detail: string }
  | { kind: 'error'; detail: string };

function normalizeNonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Room names are rendered in a one-line status bar and a select row.
  // Collapse arbitrary whitespace (including CLI-supplied newlines/tabs) so a
  // name cannot break TUI layout or plain output.
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

/**
 * Platform config location:
 * - Windows: `%APPDATA%\lantext\host.json` (fallback `~\AppData\Roaming`).
 * - Everywhere else: `$XDG_CONFIG_HOME/lantext/host.json`, then
 *   `~/.config/lantext/host.json` when XDG is unset or blank.
 */
export function defaultHostConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
): string {
  if (platform === 'win32') {
    const appData = normalizeNonEmpty(env.APPDATA);
    return win32.join(appData ?? win32.join(home, 'AppData', 'Roaming'), 'lantext', 'host.json');
  }
  const xdg = normalizeNonEmpty(env.XDG_CONFIG_HOME);
  return join(xdg ?? join(home, '.config'), 'lantext', 'host.json');
}

function readIdentity(path: string): ReadResult {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { kind: 'missing' };
    return { kind: 'error', detail: err instanceof Error ? err.message : String(err) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { kind: 'invalid', detail: err instanceof Error ? err.message : String(err) };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'invalid', detail: 'expected a JSON object' };
  }

  const record = parsed as Record<string, unknown>;
  const hostId = normalizeNonEmpty(record.hostId);
  const name = normalizeNonEmpty(record.name);
  if (!hostId || !name) {
    return { kind: 'invalid', detail: 'missing hostId or name' };
  }
  return { kind: 'ok', identity: { hostId, name } };
}

function writeIdentity(path: string, identity: HostIdentity): { persisted: boolean; warning: string | null } {
  const temp = `${path}.${process.pid}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temp, `${JSON.stringify(identity, null, 2)}\n`, { mode: 0o600 });
    renameSync(temp, path);
    return { persisted: true, warning: null };
  } catch (err) {
    try {
      rmSync(temp, { force: true });
    } catch {
      // Nothing useful to add; the write failure below is the real problem.
    }
    return {
      persisted: false,
      warning: `Could not persist host identity at ${path}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Load the persisted room identity, create it on first run, or recover from a
 * corrupt file. Never throws for filesystem problems.
 */
export function resolveHostIdentity(options: HostIdentityOptions = {}): HostIdentityResult {
  const path = options.configPath
    ?? defaultHostConfigPath(options.env, options.platform, options.home ?? homedir());
  const requestedName = normalizeNonEmpty(options.name);
  const read = readIdentity(path);

  if (read.kind === 'ok') {
    const name = requestedName ?? read.identity.name;
    if (name === read.identity.name) {
      return { ...read.identity, persisted: true, warning: null };
    }
    const saved = writeIdentity(path, { hostId: read.identity.hostId, name });
    return { hostId: read.identity.hostId, name, ...saved };
  }

  // Missing (first run), invalid JSON, or unreadable: regenerate. A corrupt
  // file is overwritten so the next start is stable again.
  const identity: HostIdentity = {
    hostId: (options.randomUUID ?? randomUUID)(),
    name: requestedName ?? (options.hostname ?? hostname)(),
  };
  const saved = writeIdentity(path, identity);
  const recoveryWarning = read.kind === 'invalid'
    ? `Host identity at ${path} was invalid (${read.detail}); regenerated.`
    : read.kind === 'error'
      ? `Could not read host identity at ${path} (${read.detail}); using a new identity.`
      : null;

  return {
    ...identity,
    persisted: saved.persisted,
    warning: [recoveryWarning, saved.warning].filter((line): line is string => line !== null).join(' ') || null,
  };
}
