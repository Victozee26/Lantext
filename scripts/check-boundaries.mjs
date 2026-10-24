#!/usr/bin/env node
// check-boundaries.mjs - Architecture guard for src/.
//
// Replaces .dependency-cruiser.cjs, which cannot parse TypeScript 7: its
// transpiler peer range is typescript <7, so it cruised 0 modules and still
// printed "no dependency violations found". A guard that checks nothing is
// worse than no guard.
//
// This script reads import/export specifiers directly. It works on any
// TypeScript version, needs no build, and refuses to report success when it
// scanned zero files.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const SOURCE_EXT = /\.(ts|tsx)$/;

/** Rules mirror src/AGENTS.md and src/ui/AGENTS.md. */
const RULES = [
  {
    name: 'ui-no-transport',
    from: /^src\/ui\//,
    to: /^src\/(client|hotspot)$|^src\/(client|server)\//,
    message: 'UI must go through adapters, not transports',
  },
  {
    name: 'ui-no-node-io',
    from: /^src\/ui\//,
    to: /^node:(net|dgram|os|fs)$/,
    message: 'UI is presentation-only — no node:net/dgram/os/fs',
  },
  {
    name: 'ui-no-protocol-network',
    from: /^src\/ui\/(components|hooks|app\.tsx)/,
    to: /^src\/protocol\/network/,
    message: 'UI must receive network info via props (ChatScreenContext)',
  },
  {
    name: 'ui-no-protocol-version',
    from: /^src\/ui\//,
    to: /^src\/protocol\/version/,
    message: 'UI must receive the version via props',
  },
  {
    name: 'no-dead-barrels',
    from: /^src\//,
    to: /^src\/(utils|ui)$|^src\/protocol\/index$/,
    message: 'barrel was removed — import the concrete module',
  },
];

/** `from 'x'` / `import('x')` / `export ... from 'x'` */
const FROM_SPECIFIER = /\bfrom\s*['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const SIDE_EFFECT_IMPORT = /^\s*import\s+['"]([^'"]+)['"]/gm;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (SOURCE_EXT.test(entry.name)) out.push(path);
  }
  return out;
}

const posix = (path) => path.split(sep).join('/');

function normalise(file, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const absolute = resolve(dirname(file), specifier);
  return posix(relative(ROOT, absolute)).replace(/\.(js|jsx|mjs|cjs)$/, '');
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

const files = walk(SRC);
if (files.length === 0) {
  console.error('boundary check: scanned 0 source files — refusing to report success');
  process.exit(1);
}

const violations = [];
let importCount = 0;

for (const file of files) {
  const from = posix(relative(ROOT, file));
  const source = readFileSync(file, 'utf8');

  for (const pattern of [FROM_SPECIFIER, DYNAMIC_IMPORT, SIDE_EFFECT_IMPORT]) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const target = normalise(file, match[1]);
      importCount += 1;

      for (const rule of RULES) {
        if (rule.from.test(from) && rule.to.test(target)) {
          violations.push({
            rule: rule.name,
            file: from,
            line: lineOf(source, match.index ?? 0),
            target,
            message: rule.message,
          });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`boundary check: ${violations.length} violation(s)\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.target}`);
    console.error(`    ${v.message}\n`);
  }
  process.exit(1);
}

console.log(`boundary check: ${files.length} files, ${importCount} imports, 0 violations`);
