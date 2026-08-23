# LanText OpenTUI UI (`src/ui/`)

## Purpose

- React-over-OpenTUI terminal UI for every TTY session of LanText: the
  interactive mode-select hero screen and the chat screen (header banner,
  divider-separated message feed, composer card, status bar).
- Non-TTY sessions never enter this scope; they stay on the plain-text
  helpers in `src/ui.ts` owned by the root contract.

## Ownership

- `session-adapter.ts` - `ChatSession` event surface + typed payload docs.
  The only channel between transports and this UI; imports no transport
  module.
- `buffered-session.ts` - per-event queue flushed on first subscribe so no
  transport event is lost between transport start and React mount.
- `runtime.ts` - renderer lifecycle (`bootRuntime`, `failFast`); delegates
  `ShutdownKeys` to `runtime/shutdown-keys.tsx`.
- `runtime/shutdown-keys.tsx` - keyboard Ctrl+C path (raw-mode key event).
- `select-screen.tsx` - mode-select screen with a NON-exiting close for the
  select-to-chat handoff.
- `chat-screen.tsx` - shared chat boot wiring (`bootRuntime` + `<App>`); receives
  `ChatScreenContext` (`ownSender`, `localIp`, `version`) from orchestrators via
  `src/adapters/` + `src/modes/` — UI never imports `node:os`/`fs`.
- `hooks/use-chat-session.ts` - composition root over `hooks/use-messages.ts` +
  `hooks/use-connection.ts`; preserves `MAX_MESSAGE_ROWS` (500) and
  `appendOwn()`.
- `hooks/use-messages.ts` - message-only state (500 cap).
- `hooks/use-connection.ts` - status/discovered/connected/ready/clientCount/error state.
- `theme.ts` - palette tokens as plain hex values plus surface tokens
  (`border`, `selfBg`, `otherBg`) and `mixHex()` interpolation used for the
  mode-select gradient wordmark. No color libraries in this scope.
- `app.tsx` - layout composition; `Header`/`MessageFeed`/`Composer`/`StatusBar` + `ownSender` injection.
- `components/header.tsx` - banner; now prop-injected `localIp`/`version` (no `getLocalIP` import).
- `components/composer.tsx` + `components/composer/{normalize,bindings,use-debounce}.ts` - composer frame + paste/debounce submodules.
- `components/message-feed.tsx` + `components/message-feed/{message-row,divider,time,multiline}.ts` - feed composition + row/copy submodules.
- `components/*` (others) - presentation only; no sockets, timers, or
  protocol logic.

## Local Contracts

- Adapter boundary: transports are adapted at the orchestrator layer
  (`src/adapters/client-adapter.ts`, `src/adapters/server-adapter.ts` via
  `src/modes/*`). Payload shapes documented in
  `session-adapter.ts` reflect ACTUAL transport emit calls: `error` payloads
  are preformatted strings, not `Error`. `LanClient` has no terminal failure
  state and never emits `error`; the client adapter promotes its observable
  `Connection error: ...` debug line instead. Do not invent new semantics
  without updating both sides.
- Own-sender identity + local echo: transports do NOT loop local sends back
  into `message` (the server excludes the originating socket from broadcast
  and never re-emits its own sends). `ChatScreenContext` (`ownSender`,
  `localIp`, `version`) is built by `src/modes/*` from `src/protocol/*` and
  injected into `App`/`Header`; `App` echoes successful sends via
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
  exact name+modifier key. Enter submits; Shift+Enter / Meta+Enter / Ctrl+J
  insert a newline (Ctrl+J: `linefeed` plain for raw terminals, `j+ctrl` for
  kitty keyboard). Failed sends keep text and show the hint via `onKeyDown`
  clearing (content-change events arrive deferred from the native edit
  buffer and would clobber it). The card border turns warning-colored while
  the retry hint is up; the textarea grows `minHeight 1` to
  `maxHeight = max(3, floor(termHeight * 0.33))` via `useTerminalDimensions`
  (33 % of screen, reactive) and scrolls beyond; bracketed paste is
  intercepted via `usePaste` to `decodePasteBytes` → `stripAnsiSequences` →
  CRLF/CR→LF normalization before `insertText`, preventing stray `\r`/ANSI
  and keeping a single undo entry; `handleSubmit` also normalizes
  CRLF/CR→LF and strips leading/trailing blank lines before `onSubmit`,
  preserving interior `\n` as a single multi-line message. Non-bracketed
  pastes (e.g. Gboard clipboard on Termux, which commits text as rapid key
  events without the ESC[200~…ESC[201~ envelope) are coalesced by a
  40 ms submit debounce: each Enter's line is buffered and the editor is
  cleared for the next line; the timer is rearmed per Enter. On flush a
  single buffered line is sent normally; multiple buffered lines (or a
  buffered line plus a trailing partial line that didn't end with Enter)
  are joined with `\n` and inserted back into the editor as a single
  multi-line buffer (Shift+Enter semantics) so the user can send once.
  Interior blank lines are preserved via empty buffered entries. The compose
  card reserves its two border rows plus one editor row (`minHeight={3}`) and
  the card/editor/composer wrapper use `flexShrink={0}`; reduced terminal
  height must shrink the feed before putting editor text on a border.
- Layout facts: nested flex rows measure 0 height in a column layout -
  give status-bar rows explicit `height={1}`; `<select>` needs explicit
  width/height. Feed auto-scroll uses `stickyScroll` +
  `stickyStart: "bottom"` with both scrollbars hidden
  (`verticalScrollbarOptions={{visible:false}}` / `horizontalScrollbarOptions`)
  so no right thumb (█) is drawn — the thumb was included in terminal
  native selection and polluted manual copy.
- Gradient text shape (mode-select): render per-character colors as styled
  `<span>` children INSIDE one `<text>`. Do NOT restructure them into many
  sibling 1-char `<text>` nodes in a row box: under a centered column such
  rows intermittently measure to zero and drop out of layout AND paint
  (observed on 0.5.6; spans inside a single text renderable are reliable).
- Message feed layout: full-width divider log (replaces 80%-width rounded
  bubbles). Each row is a native left-border box
  `border={["left"]} borderColor={accent} customBorderChars={{vertical:"┃"}}`
  (mirrors `../opencode/packages/tui/src/ui/border.ts:15` `SplitBorder` and
  `packages/tui/src/routes/session/index.tsx:1398` `UserMessage` — `EmptyBorder`
  zeroed + `vertical:"┃"`). The border wraps header+body so `┃` spans the
  full wrapped height (Box chrome, never Text, so drag-copy clean). Header
  is `height={1}` `paddingLeft={2}` (sender bold purple/green + muted
  `· HH:MM` + `· you` + `✓ copied`). Body is `paddingLeft={2}` `wrapMode="word"`.
  No `alignSelf`/`maxWidth`. Dividers are `height={1} width="100%"
  overflow="hidden"` with `"─".repeat(300)` in `THEME.border` clipped to
  width — the polished `THEME.border` version of the user's `________`
  sketch — wrapped in `paddingTop={1}`; scrollbox `gap={0}` last row spacer
  `height={1}`. Multi-line `envelope.text` split on `\n` with `<br />`
  inside single `<text>`; `formatTime()` `HH:MM`. Chrome excluded via
  `selectable={false}` on header/divider/placeholder so
  `Selection.getSelectedText()` only returns bodies.
- Import boundary (strict): `src/ui/**` may not import `node:net|dgram|os|fs` or `src/protocol/network|version`; network/version are injected as props via `ChatScreenContext`. `MessageEnvelope` type from `src/protocol/envelope.ts` is the only allowed protocol import. Guarded by `eslint` + `.dependency-cruiser.cjs`.
- Message copy: each row is `onMouseDown` double-click (400 ms) →
  `createHostClipboard` + `createClipboard({ host, terminal:
  createRendererClipboardAdapter(renderer) })` → `writeText(text,
  { destination: "best-available" })` with OSC52 fallback via
  `renderer.copyToClipboardOSC52`; success shows inline `✓ copied` in the
  header + tints the left accent `THEME.success` for 900 ms (per-row state,
  timeout cleared on unmount). Only primary button (0) triggers; bubbling
  from inner `<text>` to outer `<box>` is intentional. Drag selection uses
  the same `selectable` boundary — dragging across bodies yields only bodies
  (verified via `mockMouse.drag` + `getSelectedText()`), while dragging
  on header/divider yields no selection.

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
