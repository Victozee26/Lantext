# LanText Engineering Rules

## Purpose

- LanText is a Node.js ESM command-line application for real-time chat over a
  local network.
- This file is the project-wide work contract. It applies to every file unless
  a closer `AGENTS.md` provides more specific rules.

## Architecture and Code Structure

- Keep the code loosely coupled and modular whenever possible.
- Follow:
  - Separation of Concerns (SoC)
  - Single Responsibility Principle (SRP)
  - Deep modules with clear, small public interfaces
- Structure changes for maintainability, scalability, testability, and
  readability.
- Keep network transport, input handling, application orchestration, and
  terminal presentation in focused modules.
- Preserve the existing boundaries unless a change explicitly requires
  restructuring them:
- `src/main.ts` handles CLI dispatch and interactive mode selection
  (OpenTUI mode-select screen on TTY stdin; plain help fallback otherwise).
- `src/bin.ts` is the self-relaunching bin shim behind the global
  `lantext` command: re-execs Node with `--experimental-ffi`, forwarding
  args, SIGINT/SIGTERM, and exit codes (128 + signal number).
   - `src/client-mode.ts` and `src/server-mode.ts` are thin routers (TTY vs non-TTY).
  - `src/modes/` owns mode TUI/plain presenters (`client-tui`, `client-plain`, `server-tui`, `server-plain`) for host/client.
  - `src/adapters/` owns ChatSession translation (`client-adapter`, `server-adapter`).
  - `src/client.ts` + `src/client/` and `src/hotspot.ts` + `src/server/` own transport facades and focused submodules (discovery, selection, connection/broadcast, reconnect).
  - `src/protocol/` is single source for wire contracts (`constants`, `envelope`, `codec`, `discovery`, `version`, `network`).
  - `src/server/identity.ts` owns the persisted per-install room identity
    (`hostId`, `name`) and its corrupt/unwritable recovery policy;
    `src/server/discovery.ts` advertises that identity in every UDP reply.
  - `src/display/` owns plain-text display atoms (`banner`, `status`, `format`, `help`, `spinner`, `clients`, `debug`, `theme`, `box`).
  - `src/ui.ts` and `src/utils.ts` were removed in 3.1. Import the concrete
    module (`src/display/*`, `src/protocol/*`) — no barrels.
  - `src/input.ts` owns piped (non-TTY) input behavior.

## Development Approach

Before modifying anything:

1. Observe the existing architecture and use focused exploration for unfamiliar
   areas.
2. Understand the current execution and data flow.
3. Analyze imports, dependencies, and affected interfaces.
4. Identify possible side effects, including sockets, timers, streams, process
   handlers, and terminal state.
5. Read the applicable DOX documentation chain described below.

### Rules

- Avoid making assumptions about behavior, protocol details, or user intent.
- If requirements are unclear, ask questions before editing.
- Do not guess at an API, dependency, file ownership, or test pattern.
- Do not create technical debt disguised as confidence.
- Prefer the smallest change that satisfies the requirement without weakening
  existing behavior.

## Communication and Clarification

- Ask as many clarification questions as necessary when requirements or
  expected behavior are ambiguous.
- Continue refining the understanding until there is at least 90% confidence
  in the requirements and expected behavior.
- Recommend relevant best practices proactively.
- Report assumptions, verification gaps, and intentional documentation changes
  in the final result.

## Code Quality Standards

### Prefer

- Reusable and composable modules
- Explicit lifecycle management
- Dependency injection where it improves isolation or testability
- Interface-driven boundaries appropriate to the language and runtime
- Clear abstractions with predictable inputs and outputs
- Error handling that preserves useful context without hiding failures

### Avoid

- Tightly coupled logic
- God classes or functions
- Duplicated logic
- Hidden side effects
- Unrelated refactors mixed into feature or bug changes
- New dependencies when existing platform or project capabilities are enough

## LanText Local Contracts

- Preserve the Node.js ESM model and the supported Node.js engine range unless
  the task explicitly changes them.
- Preserve documented CLI modes and aliases (`client`/`-c`/`--client` and `host`/`-h`/`--host`) unless a breaking change is intentional and documented.
- Treat UDP discovery, TCP messaging, configured ports, discovery messages, and
  newline-delimited JSON envelopes as protocol contracts. Change them only as
  a deliberate, end-to-end change.
- Room identity is a persisted per-install contract. A host process is one
  room: `hostId` must stay stable across restarts and must never be derived
  from IP, MAC, or hostname. The identity file lives at
  `$XDG_CONFIG_HOME/lantext/host.json` (fallback `~/.config/lantext/host.json`;
  `%APPDATA%\lantext\host.json` on Windows). Corrupt files regenerate;
  unwritable paths fall back to an in-memory identity and must never block
  hosting. Recovery warnings reach the host debug channel even when the TTY
  room-name prompt resolved the identity first. Discovery replies stay
  additive (`hostId`, `name`, `clients`,
  `version`, `port`) and must remain legacy-tolerant: a missing `hostId` is an
  anonymous room. `--name "<room>"` sets and persists the room name. Without
  `--name`, a TTY host prompts before starting, defaulting to the persisted
  name; cancelling starts no server. The chosen name is shown in the host
  status bar.
- Major-version comparison is advisory and shared: the room picker and the
  client status bar (`joining ...` / `connected to ...`) warn with
  `⚠ host v<version>` when the selected room's major differs from the local
  version. Legacy rooms (`version === null`) and the server status bar never
  warn.
- Client discovery is a collection, not a race. Keep the 700 ms window from
  the first valid reply, the 1500 ms hard cap, dedupe by `hostId` (or source
  address for legacy hosts), and the deterministic tie-break (most clients,
  then lexicographic `hostId`/address). Never restore "first packet wins".
- Reconnect is sticky by `hostId`. A restart or DHCP move reconnects to the
  same room; a different host is never an automatic substitute. Three
  consecutive scans without the remembered `hostId` enter `roomLost` and stop
  retrying. `SERVER=` is an explicit address, not a room, and bypasses this
  check. Legacy anonymous rooms have no identity, so they fall back to normal
  discovery: a TTY client shows the picker when several rooms answer, and the
  deterministic pick applies otherwise.
- Client room UX: a TTY with more than one room waits for the picker; plain
  mode prints the alternatives and uses the deterministic pick. `roomLost`
  disables the composer and binds `r`/`c` to retry/choose another. The picker
  must always disambiguate with IP:port and a short `hostId` prefix, and a
  major-version mismatch is a warning only.
- Every launch path (`bin` shim relaunch and the npm scripts) passes
  `--disable-warning=ExperimentalWarning`: node's FFI warning writes to
  stderr mid-frame and corrupts TUI paint. Keep the flag on new launch
  paths.
- Clean up sockets, timers, readline interfaces, and process handlers on every
  shutdown or retry path.
- Keep terminal rendering concerns in `src/display/` (plain-text non-TTY
  atoms) and `src/ui/` (OpenTUI); do not bury network or protocol behavior
  in presentation helpers. Session adapters (`ChatSession` in
  `src/ui/session-adapter.ts` via `src/adapters/*`) are the only channel between transports and
  the UI, and they buffer events emitted before the first subscriber
  attaches (`src/ui/buffered-session.ts`) so no transport event is lost.
- Enforce strict import boundaries: `src/ui/**` may not import `node:net|dgram|os|fs` or `src/protocol/network|version` directly — network/version are injected as props via `src/adapters/` + `src/modes/` + `src/ui/chat-screen.tsx` context. Guarded by `scripts/check-boundaries.mjs` (`npm run lint:deps`). The script parses import specifiers directly and fails when it scans zero files.
- Toolchain constraint: TypeScript 7's compiler API is not published yet. `typescript-eslint` refuses to run and `dependency-cruiser` silently cruises 0 modules. Do not reintroduce them until they support TS 7; use `oxlint` + `scripts/check-boundaries.mjs` + `knip` instead. `tsc` owns type correctness, including `noUnusedLocals`/`noUnusedParameters`.
- Keep environment-variable behavior (`DEBUG`, `SERVER`, `LAN_TEXT_IFACE`)
  compatible with the README unless the documentation is updated in the same
  change.
- Update `package.json`, lockfiles, and documentation together when a change
  affects dependencies, commands, supported runtime behavior, or public usage.
- Keep `opencode.json` valid against its declared schema. Review changes to
  plugins, models, agent settings, or LSP configuration for workflow and
  security impact.

## Core Principle

Every module, class, and function should:

- Have one clear responsibility
- Be easy to replace
- Be easy to test
- Be easy to extend
- Avoid breaking unrelated parts of the system

## Agent Usage

- Use the `explore` agent for focused codebase mapping, file discovery, and
  tracing unfamiliar flows when it keeps the main context focused.
- Use the `general` agent for complex research or multi-step work that does not
  fit a more specific capability.
- Validate delegated results against the repository before editing or reporting
  them as facts.

## Verification

- `npm test` runs the `node:test` suite (80 tests: codec, envelope, network
  interface selection, broadcast, discovery, discovery reply parsing, discovery
  responder, room selection, host identity, identity warning merge, buffered
  session, reconnect, client disconnect, plain room display, UI major-version
  warning).
  It compiles `src/` + `test/` to `dist-test/`; it does not use `dist/`.
- `npm run typecheck` must pass. `strict` plus `noUnusedLocals`,
  `noUnusedParameters`, `noImplicitReturns`, and `noFallthroughCasesInSwitch`
  are enabled.
- `npm run lint` = `oxlint src` + `npm run lint:deps` (architecture guard).
- `npm run knip` must report no unused files, exports, or dependencies.
- For TypeScript changes, run `npm run build` and `node --check` on emitted JavaScript files.
- Run the relevant manual smoke check when behavior permits:
  - `npm start` for interactive mode selection
  - `npm run client` for client mode
  - `npm run host` for host mode
- For networking changes, verify discovery, connection, messaging, reconnect,
  and shutdown behavior with the appropriate local devices or processes.
- Run `git diff --check` before closeout.
- When changing `opencode.json`, validate its JSON syntax and schema-compatible
  fields before closeout.
- Do not claim tests passed when only syntax checks or manual inspection were
  performed.

# DOX Framework

- DOX is the `AGENTS.md` hierarchy and documentation contract for this project.
- Agents must follow DOX instructions for every edit.

## Core Contract

- `AGENTS.md` files are binding work contracts for their subtrees.
- Work products, source materials, instructions, records, assets, and durable
  documentation must remain understandable from the nearest applicable
  `AGENTS.md` and every parent `AGENTS.md` above it.

## Read Before Editing

1. Read the root `AGENTS.md`.
2. Identify every file or folder expected to be touched.
3. Walk from the repository root to each target path.
4. Read every `AGENTS.md` found along each route.
5. If a parent `AGENTS.md` lists a child `AGENTS.md` whose scope contains the
   path, read that child and continue from there.
6. Use the nearest `AGENTS.md` as the local contract and parent documents for
   repository-wide rules.
7. If documents conflict, the closer document controls local work details, but
   no child document may weaken DOX.

Do not rely on memory. Re-read the applicable DOX chain in the current session
before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning `AGENTS.md` when a change affects:

- Purpose, scope, ownership, or responsibilities
- Durable structure, contracts, workflows, or operating rules
- Required inputs, outputs, permissions, constraints, side effects, or
  artifacts
- User preferences about behavior, communication, process, organization, or
  quality
- `AGENTS.md` creation, deletion, movement, renaming, or index contents

Update parent documents when parent-level structure, ownership, workflow, or a
child index changes. Update child documents when parent changes alter local
rules. Remove stale or contradictory text immediately. Small edits that do not
change behavior or contracts may leave documents unchanged, but the DOX pass
still must happen.

## Hierarchy

- The root `AGENTS.md` is the DOX rail: project-wide instructions, global
  preferences, durable workflow rules, and the top-level Child DOX Index.
- Child `AGENTS.md` files own domain-specific instructions and their own Child
  DOX Index.
- Each parent explains what its direct children cover and what remains owned by
  the parent.
- The closer a document is to the work, the more specific and practical it must
  be.

## Child Document Shape

- Create a child `AGENTS.md` when a folder becomes a durable boundary with its
  own purpose, rules, responsibilities, workflow, materials, or quality
  standards.
- Work Guidance must reflect current project or user standards. If no specific
  standards exist yet, leave it empty.
- Verification must reflect an existing check. If no verification framework
  exists yet, leave it empty and update it when one exists.

Default section order:

- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep documents concise, current, and operational.
- Use structured text because these documents are instructions for agents.
- Document stable contracts, not diary entries.
- Put broad rules in parent documents and concrete details in child documents.
- Prefer direct bullets with explicit names.
- Do not duplicate rules across many files unless each scope needs a local
  version.
- Delete stale notes instead of explaining history.
- Trim obvious statements, repeated rules, misplaced detail, and warnings for
  risks that no longer exist.

## Closeout

1. Re-check changed paths against the DOX chain.
2. Update the nearest owning documents and any affected parents or children.
3. Refresh every affected Child DOX Index.
4. Remove stale or contradictory text.
5. Run existing verification when relevant.
6. Report any documents intentionally left unchanged and why.

## User Preferences

When the user requests a durable behavior change, record it here or in the
relevant child `AGENTS.md`.

## Child DOX Index

- `src/protocol/` - Wire contracts: constants, envelope, codec, discovery reply parser/encoder, version, network. Single source of truth for ports/discovery/envelope.
- `src/display/` - Plain-text display atoms for non-TTY paths. The root document owns this scope.
- `src/client/` + `src/server/` - Focused transport submodules (discovery, room selection, connection/broadcast, persisted host identity). Facades `src/client.ts`/`src/hotspot.ts` own lifecycle.
- `src/adapters/` - ChatSession adapters over transports. The root document owns this scope.
- `src/modes/` - Mode presenters (TUI vs plain for host/client). The root document owns this scope.
- `src/ui/` - OpenTUI React terminal UI: session adapter boundary, room
  picker, host room-name prompt, renderer runtime and shutdown ownership,
  chat screen, and mode-select screen. Owns TTY presentation; non-TTY display
  stays in `src/display/` under the root contract.
- `src/` (outside above) - CLI dispatch, bin shim, input, and orchestration routers. The root document owns this scope.
- `asset/` - Project assets. The root document owns this scope until a narrower
  durable boundary requires a child contract.
- `plans/` - Durable implementation plans for approved multi-phase work. The
  root document owns this scope; plans are work contracts until superseded or
  completed and archived.
- `.agents/` - Vendored third-party skill documentation pinned by
  `skills-lock.json`. Treat as read-only reference material; do not edit
  generated content by hand. The root document owns this scope.
