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
  - `src/main.ts` handles CLI dispatch and interactive mode selection.
  - `src/client-mode.ts` and `src/server-mode.ts` coordinate runtime modes.
  - `src/client.ts` and `src/hotspot.ts` own network behavior and lifecycle.
  - `src/input.ts` owns terminal and piped-input behavior.
  - `src/ui.ts` owns terminal rendering and display helpers.
  - `src/utils.ts` owns shared constants, network helpers, and message shape.

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
- Preserve documented CLI modes and aliases (`client`/`wifi` and
  `hotspot`/`server`) unless a breaking change is intentional and documented.
- Treat UDP discovery, TCP messaging, configured ports, discovery messages, and
  newline-delimited JSON envelopes as protocol contracts. Change them only as
  a deliberate, end-to-end change.
- Clean up sockets, timers, readline interfaces, and process handlers on every
  shutdown or retry path.
- Keep terminal rendering concerns in `src/ui.ts`; do not bury network or
  protocol behavior in presentation helpers.
- Keep environment-variable behavior (`DEBUG` and `SERVER`) compatible with
  the README unless the documentation is updated in the same change.
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

- There is currently no automated test script in `package.json`.
- For TypeScript changes, run `npm run build` and `node --check` on emitted JavaScript files.
- Run the relevant manual smoke check when behavior permits:
  - `npm start` for interactive mode selection
  - `npm run client` for client mode
  - `npm run hotspot` for hotspot/server mode
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

- No child `AGENTS.md` files currently exist.
- `src/` - Application source for CLI dispatch, input, UI, network transport,
  and runtime mode orchestration. The root document owns this scope until a
  narrower durable boundary requires a child contract.
- `asset/` - Project assets. The root document owns this scope until a narrower
  durable boundary requires a child contract.
- `plans/` - Durable implementation plans for approved multi-phase work. The
  root document owns this scope; plans are work contracts until superseded or
  completed and archived.
- `.agents/` - Vendored third-party skill documentation pinned by
  `skills-lock.json`. Treat as read-only reference material; do not edit
  generated content by hand. The root document owns this scope.
