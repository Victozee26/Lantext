#!/usr/bin/env node

// bin.js - Self-relaunching shim for the `lantext` bin (global/npx installs).
//
// The `bin` field cannot carry --experimental-ffi (Locked Decision in
// plans/ui-refactor-opentui.md, risk #6), so the installed `lantext` command
// re-execs Node with the flag when it is not already present. npm scripts
// embed the flag themselves; this shim only matters for `lantext` /
// `npx lantext` invocations.
//
// Behavior:
// - process.execArgv already contains --experimental-ffi (node was started
//   with the flag): load the real entry (dist/main.js) directly with the
//   same argv layout — no relaunch, no loop risk.
// - Otherwise: spawn `node --experimental-ffi <dist/main.js>` with all user
//   args and inherited stdio; forward SIGINT/SIGTERM to the child while it
//   runs; propagate the child's exit code, or 128 + signal number when it
//   died from a signal.
// - The node FFI ExperimentalWarning writes to stderr mid-frame and would
//   corrupt the TUI's first paint, so the relaunch also passes
//   --disable-warning=ExperimentalWarning (npm scripts embed it too).
// - Spawn failure: one concise stderr line, exit 127.

import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { constants } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FFI_FLAG = '--experimental-ffi';
const WARNING_FLAG = '--disable-warning=ExperimentalWarning';

if (process.execArgv.includes(FFI_FLAG)) {
  await import('./main.js');
} else {
  // Resolve the shim's REAL path: npm global installs symlink the bin into
  // the prefix's bin dir, and dist/main.js sits next to the real dist/bin.js
  // inside the package, not next to the symlink. fileURLToPath + realpathSync
  // handles both direct and symlinked launches.
  const shimPath = realpathSync(fileURLToPath(import.meta.url));
  const mainPath = join(dirname(shimPath), 'main.js');

  const child = spawn(process.execPath, [FFI_FLAG, WARNING_FLAG, mainPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
  });

  const forward = (signal: NodeJS.Signals): void => {
    if (child.exitCode === null) child.kill(signal);
  };
  process.on('SIGINT', forward);
  process.on('SIGTERM', forward);

  child.on('error', (err) => {
    console.error(`[lantext] failed to launch: ${err.message}`);
    process.exit(127);
  });

  child.on('exit', (code, signal) => {
    if (signal !== null) {
      const signo = constants.signals[signal] ?? 1;
      process.exit(128 + signo);
    }
    process.exit(code ?? 0);
  });
}