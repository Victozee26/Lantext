# LanText OpenTUI UI (`src/ui/`)

## Purpose

- React-over-OpenTUI terminal UI for every TTY session of LanText: the
  interactive mode-select screen and the chat screen (header, message feed,
  composer, status bar).
- Non-TTY sessions never enter this scope; they stay on the plain-text
  helpers in `src/ui.ts` owned by the root contract.

## Ownership

- `session-adapter.ts` - `ChatSession` event surface + typed payload docs.
  The only channel between transports and this UI; imports no transport
  module.
- `buffered-session.ts` - per-event queue flushed on first subscribe so no
  transport event is lost between transport start and React mount.
- `runtime.ts` - renderer lifecycle and the single idempotent teardown;
  `bootRuntime`, `failFast`, `<ShutdownKeys>`.
- `select-screen.tsx` - mode-select screen with a NON-exiting close for the
  select-to-chat handoff.
- `chat-screen.tsx` - shared chat boot wiring (`bootRuntime` + `<App>`); the
  plain `.ts` orchestrators hold no JSX.
- `hooks/use-chat-session.ts` - adapter events to React state bridge;
  messages capped at `MAX_MESSAGE_ROWS` (500).
- `theme.ts` - the eight palette tokens as plain hex values. No color
  libraries in this scope.
- `app.tsx`, `components/*` - presentation only; no sockets, timers, or
  protocol logic.

## Local Contracts

- Adapter boundary: transports are adapted at the orchestrator layer
  (`src/client-mode.ts`, `src/server-mode.ts`). Payload shapes documented in
  `session-adapter.ts` reflect ACTUAL transport emit calls: `error` payloads
  are preformatted strings, not `Error`. `LanClient` has no terminal failure
  state and never emits `error`; the client adapter promotes its observable
  `Connection error: ...` debug line instead. Do not invent new semantics
  without updating both sides.
- Shutdown ownership rule: the renderer is created with
  `exitSignals: []` and `exitOnCtrlC: false`; this UI owns shutdown. Exactly
  one idempotent function runs adapter.stop() -> renderer.destroy() ->
  process exit, reachable from three paths: ctrl+c keyboard event (raw mode
  disables ISIG, so Ctrl+C is a key event, not SIGINT), app-level
  SIGINT/SIGTERM handlers (removed on teardown), and `failFast`.
- Fatal routing: the renderer's own `uncaughtException` handler swallows
  throws and keeps rendering. Any code inside the tree that can throw
  (e.g. send) must catch and route to `failFast`; it cannot rely on process
  crash behavior.
- DEBUG routing: while a renderer lives, global console is captured into an
  overlay; raw `console.log` cannot corrupt frames but is invisible by
  design. Diagnostics surface through components (status bar) or the
  captured console channel only.
- Composer bindings: custom `keyBindings` merge over textarea defaults by
  exact name+modifier key. Enter submits; Shift+Enter / Meta+Enter insert a
  newline. Failed sends keep text and show the hint via `onKeyDown`
  clearing (content-change events arrive deferred from the native edit
  buffer and would clobber it).
- Layout facts: nested flex rows measure 0 height in a column layout -
  give status-bar rows explicit `height={1}`; `<select>` needs explicit
  width/height. Feed auto-scroll uses `stickyScroll` +
  `stickyStart: "bottom"`.

## Work Guidance

- Check API shapes against the installed declarations
  (`node_modules/@opentui/core/dist/*.d.ts`,
  `node_modules/@opentui/react/dist/*.d.ts`) before use; do not guess prop
  names or lifecycle details.
- Isolation harness pattern for component work: temporary entry under
  `src/ui/`, run through `script -qec "node --experimental-ffi dist/<path>"
  <log>`, assert rendered output, then delete src and dist artifacts
  including `.d.ts`/`.map` siblings.
- Synthesized keys bypass the terminal parser: they prove binding wiring,
  not real-keyboard delivery. Shift/meta/paste semantics need a human on a
  real terminal before claiming support.
- Known upstream caveat: on 0.5.6 in this proot environment, SIGWINCH
  updates geometry but no post-resize frame is emitted; resize redraw is
  unverified end-to-end.

## Verification

- `npm run typecheck && npm run build` after every change.
- Interactive smoke: `script -qec "node --experimental-ffi dist/main.js"
  /tmp/opencode/select.log` then feed `q` -> exit 0; alt-screen restore
  sequences present in the transcript.
- End-to-end: background server (`npm run hotspot`), client with
  `SERVER=127.0.0.1`, message exchange both directions.
- Teardown routes: ctrl+c into the pty session AND `kill -INT`/`kill -TERM`;
  afterwards ports 41236/41237 free and transcripts end with alt-screen
  leave.

## Child DOX Index

- No child `AGENTS.md` files exist under `src/ui/`.
