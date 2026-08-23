// status-bar.tsx - Bottom status line(s).
//
// Line 1: a colored state dot + connection text (listening port for the
// server, connected address or last status message for the client), with
// right-aligned chips: online client count (server mode) and a DEBUG chip
// when process.env.DEBUG is truthy.
// Line 2: the last error (THEME.error), always a fixed 1-row slot.
//
// Dot color precedence: error > server listening (accent) / client
// connected (success) / otherwise warning while unestablished.
//
// OpenTUI 0.5.6 layout facts verified in the Phase 3 app harness (via yoga
// computed heights and renderable tree dumps):
// - A nested flex ROW whose height comes from measuring its <text>
//   children can collapse to 0 in a column layout; explicit height={1}
//   pins it (the connection row). Without it, the bar's children stacked
//   ON THE SAME ROW and the error text painted over the connection line.
// - The error slot is pinned with height={1} so the bar's row structure
//   never changes and the connection row never shifts position; a
//   whitespace-only <text> collapses to 0 height and cannot reserve a row.
//
// DEBUG ROUTING: while the renderer lives, console output is captured into
// the renderer's console overlay (consoleMode default "console-overlay").
// Raw console.log must therefore NEVER be used for frame content —
// diagnostics render through this bar's slots (or the captured overlay),
// never through direct writes into the TUI frame.

import { THEME } from '../theme.js';

export interface StatusBarProps {
  status: string | null;
  connectedAddress: string | null;
  serverPort: number | null;
  clientCount: number;
  /** Server mode renders the listening state and online client count. */
  isServer: boolean;
  lastError: string | null;
}

export function StatusBar({
  status,
  connectedAddress,
  serverPort,
  clientCount,
  isServer,
  lastError,
}: StatusBarProps) {
  const debugOn = Boolean(process.env.DEBUG);
  const established = isServer ? serverPort !== null : connectedAddress !== null;
  const connection = isServer
    ? serverPort !== null
      ? `listening on :${serverPort}`
      : 'starting…'
    : connectedAddress !== null
      ? `connected to ${connectedAddress}`
      : (status ?? 'searching…');

  const dotColor = lastError !== null
    ? THEME.error
    : established
      ? (isServer ? THEME.accent : THEME.success)
      : THEME.warning;
  const textColor = lastError !== null
    ? THEME.error
    : established
      ? (isServer ? THEME.accent : THEME.info)
      : THEME.muted;

  return (
    <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingBottom={0}>
      <box flexDirection="row" height={1}>
        <text style={{ fg: dotColor }}>● </text>
        <text style={{ fg: textColor }}>{connection}</text>
        {isServer && established ? (
          <text style={{ fg: THEME.muted }}> · {clientCount} online</text>
        ) : null}
        <box flexGrow={1} />
        {debugOn ? <text style={{ fg: THEME.warning }}>DEBUG </text> : null}
        <text style={{ fg: THEME.muted }}>[</text>
        <text style={{ fg: isServer ? THEME.accent : THEME.brand }}>
          {isServer ? 'server' : 'client'}
        </text>
        <text style={{ fg: THEME.muted }}>]</text>
      </box>
      <box height={1}>
        {lastError !== null ? <text style={{ fg: THEME.error }}>✖ {lastError}</text> : null}
      </box>
    </box>
  );
}
