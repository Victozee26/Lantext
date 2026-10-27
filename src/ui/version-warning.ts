// version-warning.ts - Pure advisory version comparison for the TUI.
//
// Room versions arrive as advisory strings (or null for legacy hosts). The
// major component decides compatibility: a different major is worth showing
// in both the room picker and the status bar, but never blocks a connection.
// No React/OpenTUI imports here so the rules stay unit-testable.

/** Leading version component, or null when the version is absent/blank. */
export function majorVersion(version: string | null): string | null {
  if (!version) return null;
  const [first] = version.split('.');
  return first || null;
}

/** True when both versions are known and their major components differ. */
export function hasMajorVersionMismatch(
  remoteVersion: string | null,
  localVersion: string,
): boolean {
  const remote = majorVersion(remoteVersion);
  const local = majorVersion(localVersion);
  return remote !== null && local !== null && remote !== local;
}

/** One-line warning text for a mismatched room, or null when compatible. */
export function versionWarning(
  remoteVersion: string | null,
  localVersion: string,
): string | null {
  return hasMajorVersionMismatch(remoteVersion, localVersion)
    ? `⚠ host v${remoteVersion}`
    : null;
}
