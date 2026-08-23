# LanText OpenTUI UI (`src/ui/`)

## Purpose

- React-over-OpenTUI terminal UI for every TTY session of LanText: the
  interactive mode-select hero screen and the chat screen (header banner,
  bubble feed, composer card, status bar).
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
  messages capped at `MAX_MESSAGE_ROWS` (500). Also exposes `appendOwn()`
  for the display-only local echo (see Local Contracts).
- `theme.ts` - palette tokens as plain hex values plus surface tokens
  (`border`, `selfBg`, `otherBg`) and `mixHex()` interpolation used for the
  mode-select gradient wordmark. No color libraries in this scope.
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
- Own-sender identity + local echo: transports do NOT loop local sends back
  into `message` (the server excludes the originating socket from broadcast
  and never re-emits its own sends). `App` therefore derives `ownSender`
  (`'HOTSPOT'` for server, `getLocalIP()` for client — matching how the
  server stamps envelopes) and echoes successful sends via
  `useChatSession.appendOwn`. Echo rows are display-only; they never touch
  the wire and are capped by the same `MAX_MESSAGE_ROWS`.
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
  buffer and would clobber it). The card border turns warning-colored while
  the retry hint is up; the textarea contract (minHeight 1 / maxHeight 3)
  is preserved but bracketed paste is intercepted via `usePaste` to
  `decodePasteBytes` → `stripAnsiSequences` → CRLF/CR→LF normalization
  before `insertText`, preventing stray `\r`/ANSI and keeping a single undo
  entry; `handleSubmit` also normalizes CRLF/CR→LF and strips leading/
  trailing blank lines before `onSubmit`, preserving interior `\n` as a
  single multi-line message. The compose card reserves its two border rows
  plus one editor row (`minHeight={3}`) and the card/editor/composer wrapper
  use `flexShrink={0}`; reduced terminal height must shrink the feed before
  putting editor text on a border.
- Layout facts: nested flex rows measure 0 height in a column layout -
  give status-bar rows explicit `height={1}`; `<select>` needs explicit
  width/height. Feed auto-scroll uses `stickyScroll` +
  `stickyStart: "bottom"`; its scrollbar thumb is recolored via
  `verticalScrollbarOptions.trackOptions.foregroundColor`.
- Gradient text shape (mode-select): render per-character colors as styled
  `<span>` children INSIDE one `<text>`. Do NOT restructure them into many
  sibling 1-char `<text>` nodes in a row box: under a centered column such
  rows intermittently measure to zero and drop out of layout AND paint
  (observed on 0.5.6; spans inside a single text renderable are reliable).
- Bubble layout: bubbles shrink-wrap via `alignSelf` ("flex-end" own /
  "flex-start" incoming) inside the scrollbox column; `maxWidth: "80%"`
  forces `wrapMode="word"` wrapping; no timestamps rendered; incoming
  bubble title = sender name (purple), own bubble has no title; bubbles
  are border-only with no `backgroundColor` (prevents rounded-corner bleed);
  multi-line `envelope.text` is split on `\n` and rendered with `<br />`
  inside a single `<text>` so pasted line breaks survive layout; scroll
  feed uses `gap={1}` between bubbles.
- Bubble copy: each bubble is `onMouseDown` double-click (400 ms) →
  `createHostClipboard` + `createClipboard({ host, terminal:
  createRendererClipboardAdapter(renderer) })` → `writeText(text,
  { destination: "best-available" })` with OSC52 fallback via
  `renderer.copyToClipboardOSC52`; success shows `THEME.success`
  border + `bottomTitle=" copied "` for 900 ms (per-bubble state,
  timeout cleared on unmount). Only primary button (0) triggers; bubbling
  from inner `<text>` to outer `<box>` is intentional.

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
- Known proot test limitation: processes spawned under `script(1)` here
  inherit `SigIgn=6` (SIGINT/SIGTERM ignored — verified via `/proc`),
  so external-signal teardown (`kill -INT`/`kill -TERM`) cannot be exercised
  in this environment. The keyboard path (\x03 through the pty) IS verified
  end-to-end; signal paths remain valid on real hardware.

## Verification

- `npm run typecheck && npm run build` after every change.
- Interactive smoke: `script -qec "node --experimental-ffi dist/main.js"
  /tmp/opencode/select.log` then feed `q` -> exit 0; alt-screen restore
  sequences present in the transcript.
- End-to-end (verified 14/14): background hotspot + client with
  `SERVER=127.0.0.1`, message exchange both directions, own-echo rendered
  locally on both sides, Ctrl+C (`\x03` via pty) teardown -> exit 0 +
  alt-screen leave on both transcripts. Final-frame assertions must rebuild
  a cursor-addressed grid from the transcript (linear grep of stripped ANSI
  is unreliable: diff-painted frames fragment text across writes).
- Teardown routes: ctrl+c keyboard path verified above; app-level
  SIGINT/SIGTERM handlers exist but external delivery is untestable under
  proot `script` (see Work Guidance).

## Child DOX Index

- No child `AGENTS.md` files exist under `src/ui/`.
