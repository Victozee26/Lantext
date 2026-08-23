# Plan: LanText UI Refactor to OpenTUI React

Status: approved; reviewed (verdict READY WITH CHANGES, all findings folded
in); not started
Owner: root `AGENTS.md` until `src/ui/` earns a child contract
Target: replace the entire terminal UI surface (clack prompts, banner, chat
screen) with an OpenTUI React application while preserving transport,
protocol, and piped-input behavior.

## Locked Decisions

- Full takeover: OpenTUI replaces `@clack/prompts` mode selection, banners,
  and chat screens. `chalk`, `boxen`, `ora` are dropped once nothing uses them.
- Chat layout: header (brand + IP + mode), scrollable message feed, status bar
  with live client count, focused composer at the bottom.
- Piped input (`stdin` is not a TTY) keeps the existing fallback path with
  plain console output. Only TTY sessions get the OpenTUI renderer.
- Node contract moves to `>=26.4.0` engines plus `--experimental-ffi` in every
  script that boots the UI. README documents the flag and proot/Termux notes.
- Bin compatibility: a global `lantext`/`npx lantext` invocation cannot carry
  `--experimental-ffi` through the `bin` field. Preferred fix: self-relaunching
  shim (bin re-execs `node --experimental-ffi dist/main.js`, forwarding args,
  signals, and exit codes); documented `NODE_OPTIONS=--experimental-ffi` as
  fallback if the shim proves fragile.

## Verified Foundations

- Environment: proot Debian, glibc arm64, Node v26.5.0.
- `@opentui/core-linux-arm64/libopentui.so` loads; `createCliRenderer()` +
  `destroy()` smoke test passed on-device under `node --experimental-ffi`.
- Installed: `@opentui/core@0.5.6`, `@opentui/react@0.5.6`, `react@19.2.8`.
  React meets the `>=19.2.0` peer requirement.
- Renderer lifecycle facts driving design:
  - Default renderer signal handlers only call `destroy()`; they cannot stop
    application-owned sockets. We must set `exitSignals: []`,
    `exitOnCtrlC: false`, and install app handlers:
    stop transport → destroy renderer → exit.
  - Interactive Ctrl+C is NOT a SIGINT: raw mode disables ISIG, so it arrives
    as a key event (`c` + ctrl). With `exitOnCtrlC: false` nothing consumes it
    by default — the teardown chain needs an explicit keyboard path in addition
    to process SIGINT/SIGTERM handlers (which cover kill and terminal close).
  - `renderer.destroy()` unmounts React roots automatically.
  - Docs pin Node.js acceptance at exactly 26.4.0; v26.5.0 works here but is
    recorded as an environment note, not a supported claim.
- API audit: every API this plan relies on was cross-checked against the
  installed 0.5.6 type declarations (`renderer.d.ts:22-24` for
  `exitSignals`/`exitOnCtrlC`; `<textarea>`/`<select>`/`<scrollbox>` JSX,
  `useKeyboard`, `useTerminalDimensions`, `usePaste`, ScrollBox
  `stickyScroll`). Zero unverified assumptions remain.
- Tooling gap found in review: no `@types/react` is installed, and react@19
  ships no types of its own. Without it, `tsc` passes vacuously under
  `skipLibCheck: true` while emitting untyped JSX.

## Invariants (must not change)

- Transport modules `src/client.ts` and `src/hotspot.ts`: untouched.
- Protocol contracts: TCP port 41236, UDP discovery 41237, discovery messages,
  newline-delimited JSON envelopes (`src/utils.ts`).
- CLI modes and aliases: `client`/`wifi`, `hotspot`/`server`, interactive
  default, `help`. Env vars `DEBUG` and `SERVER` keep their documented meaning.
- Every shutdown/retry path closes sockets, timers, readline handles, and the
  renderer. No orphaned listeners.

---

## Phase 1 — Toolchain Enablement

Goal: build `.tsx` and boot an OpenTUI app through npm scripts.

Files:

- `tsconfig.json`: add `"jsx": "react-jsx"`,
  `"jsxImportSource": "@opentui/react"`, widen include to `src/**/*.ts{,x}`.
- `package.json`: engines `"node": ">=26.4.0"`; devDependency
  `@types/react@^19`; scripts `start`, `client`, `hotspot`, `dev` gain
  `--experimental-ffi`; retarget `client` and `hotspot` to
  `node --experimental-ffi dist/main.js client|hotspot` (they currently point
  at transport modules that run nothing); add a temporary `ui:smoke` script if
  useful.

Tasks:

1. Apply tsconfig changes; install `@types/react`.
2. Add a throwaway `.tsx` hello-renderer probe that actually imports React
   JSX through `@opentui/react`, proving build → typecheck with real types →
   run → clean exit through the real script path.
3. Revert the throwaway probe.

Acceptance:

- `npm run build` emits JS from `.tsx` sources without errors.
- `npm run typecheck` passes WITH the `.tsx` probe present — proves React
  declarations resolve rather than passing vacuously under `skipLibCheck`.
- A script-launched renderer opens, draws one frame, exits, and restores the
  terminal on this proot Debian device.

## Phase 2 — UI Core Layers (no components yet)

Goal: theme, session adapter, runtime/shutdown orchestration, state bridge.

New files under `src/ui/`:

- `theme.ts`: ports the full current palette (#4A9EFF brand/prompt,
  #36D399 accent/success, #F87171 error, #FBBF24 warning, #60A5FA info,
  #6B7280 muted, #C084FC sender, #34D399 sent) into OpenTUI style values.
  All tokens carried over — info and muted are still used by surviving
  non-TTY helpers. No chalk.
- `session-adapter.ts`: interface describing the event surface the UI needs
  (`status`, `debug`, `discovered`, `connected`, `message`, `error`,
  `ready`, `clientConnected`, `clientDisconnected`) plus `send(text)` and
  `stop()`. Client and server orchestrators produce adapters; the UI never
  imports transport types. Known gap to reconcile in Phase 4: `LanClient`
  never emits `'error'` today.
- `runtime.ts`: owns `createCliRenderer({ exitSignals: [], exitOnCtrlC: false })`
  and `createRoot(renderer).render(<App …/>)`. One idempotent teardown function
  (adapter.stop() → renderer.destroy(), which auto-unmounts React → process
  exit) triggered from ALL paths:
  - keyboard: `useKeyboard` matching `c` + ctrl (interactive Ctrl+C — raw mode
    means no SIGINT is delivered),
  - signals: app-level SIGINT/SIGTERM handlers (`kill`, terminal close),
  - any fatal error path.
- `hooks/use-chat-session.ts`: subscribes to the adapter's EventEmitter-style
  events into React state (messages array, connection state, client count,
  last error). Cleans up all listeners on unmount.

Acceptance:

- `npm run typecheck` passes; only a stub `<App>` exists — no production
  components.
- Teardown coverage documented in code structure: exactly one function tears
  down sockets + renderer, reachable from both the key path and the signal
  path, idempotent under repeated triggers.

## Phase 3 — Components

Goal: full chat layout and mode-select screen.

New files under `src/ui/components/`:

- `header.tsx`: LANText wordmark, local IP (`getLocalIP`), mode badge, version
  read at runtime via `fs.readFileSync(new URL("../../package.json",
  import.meta.url))` (direct JSON import violates `rootDir: src`) — fixes
  today's hardcoded `v1.0.0`.
- `message-feed.tsx`: `<scrollbox>` of message rows; sender-colored names,
  muted timestamps, sent-vs-received alignment or markers. Auto-scroll via
  ScrollBox `stickyScroll` + `stickyStart: "bottom"` (disengages on manual
  scroll-up) instead of hand-rolled scrollTop tracking.
- `composer.tsx`: `<textarea>` (grows to ~3 lines). The default textarea
  binding is Meta+Enter = submit — override with explicit custom
  `keyBindings`: Enter sends, Shift+Enter / Meta+Enter inserts newline.
  Bracketed paste arrives natively; the old 50 ms readline paste heuristic
  dies with the TTY path. Decision point: fall back to single-line
  `<input onSubmit>` if the custom bindings or paste handling misbehave
  on-device.
- `status-bar.tsx`: connection state, online count for server mode, DEBUG
  indicator. DEBUG lines render here or in the renderer's captured console —
  never raw `console.log` inside the TUI frame.
- `mode-select.tsx`: `<select>` with WiFi Client / Hotspot Server; q/ESC quits
  cleanly.

Acceptance:

- Each component renders in isolation via a temporary harness before wiring.

## Phase 4 — Orchestrator Rewire

Goal: real entry paths use the TUI; fallbacks preserved.

Files changed:

- `src/main.ts`: dispatch table stays; TTY default flow launches the OpenTUI
  mode-select inside the renderer; `help` prints plain text before any
  renderer starts; remove the `\x1Bc` clear-screen hack (renderer manages the
  alt screen).
- `src/client-mode.ts` / `src/server-mode.ts`: build adapters, start transport,
  hand off to `runtime.ts` when `process.stdin.isTTY`; otherwise keep today's
  plain-output + piped-input behavior. Reconcile the dead client-side `error`
  channel: map observable `LanClient` failures (connection failures surfaced
  via status/debug) onto adapter error events where possible; otherwise
  document the gap in the Phase 6 child contract.
- `src/input.ts`: remains solely for the piped/non-TTY path; TTY branch is
  removed from active use (delete or keep behind the fallback decision).
- `src/ui.ts`: shrinks to plain-text helpers still used by non-TUI paths
  (help screen text, piped output lines, debug logging).

Acceptance:

- Interactive select → both modes work end-to-end on one device (server
  process + client process exchange messages).
- Ctrl+C in every state (searching, connected, idle server) stops sockets and
  restores the terminal with zero residue — exercised through the keyboard
  path (`c`+ctrl) AND a `kill -INT`/`kill -TERM` to prove both teardown routes.
- `lantext client < file` regression still delivers messages.
- Resize redraws correctly (`useTerminalDimensions` where needed).

## Phase 5 — Dependency and Documentation Cleanup

Files changed:

- `package.json`: remove `@clack/prompts`, `ora`, `boxen`; remove `chalk` too
  if the non-TTY output goes ANSI-free (preferred); lockfile refresh.
- `README.md`: Node >=26.4.0 requirement (wording: "OpenTUI acceptance pins
  26.4.0; LanText tested on 26.5.0"), `--experimental-ffi` flag in all
  examples, proot/Termux note (verified on glibc arm64), unchanged env vars
  and modes, tested-platform scope statement (Linux glibc arm64 verified here;
  upstream Node acceptance is Linux x64; darwin/win32 native artifacts exist
  but are untested by this project).
- `bin` compatibility: implement the self-relaunching shim for the global
  `lantext` binary (re-exec with `--experimental-ffi`, forwarding args,
  signals, exit codes) or fall back to documented `NODE_OPTIONS` — per the
  Locked Decision above.
- Version strings unified with `package.json` (no more hardcoded `v1.0.0`).

Acceptance:

- `npm prune`-clean tree; grep finds no dead imports of removed packages.
- README examples match actual scripts.

## Phase 6 — DOX Pass and Closeout

- Create `src/ui/AGENTS.md` child contract: purpose, ownership, local
  contracts (adapter boundary, shutdown ownership rule, DEBUG routing),
  verification commands.
- Update root `AGENTS.md` Child DOX Index: add `src/ui/` (`plans/` is already
  indexed).
- Run: `npm run build`, `node --check dist/main.js` (+ siblings),
  `git diff --check`.
- Report honestly which checks are syntax-only vs behavioral.

---

## Risks and Open Decision Points

| # | Risk / decision | Resolution path |
|---|-----------------|-----------------|
| 1 | `<textarea>` paste/newline semantics on-device | Fall back to `<input>` + Enter-send; note limitation |
| 2 | Node 26.5.0 vs docs' exact-26.4.0 acceptance pin | Works empirically; README states tested version |
| 3 | Raw stdout writes corrupting TUI frames | Route ALL debug/status through components or captured console |
| 4 | Signal handling races during discovery spin-up | Single teardown function guarded by an idempotence flag |
| 5 | Scrollback memory growth on long sessions | Cap message state (e.g., 500 rows) in `use-chat-session` |
| 6 | Global `lantext` bin cannot carry `--experimental-ffi` | Self-relaunching shim preferred; `NODE_OPTIONS` docs as fallback |
| 7 | Cross-platform scope untested (darwin/win32 artifacts exist; upstream Node acceptance is Linux x64 only) | README states tested platforms honestly; no support claims beyond them |

## Execution Order and Checkpoints

Phases are strictly sequential; each ends with its acceptance list checked on
device before the next begins. Phases 2–3 may interleave commits but not skip
acceptance.
