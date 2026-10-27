import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasMajorVersionMismatch,
  majorVersion,
  versionWarning,
} from '../src/ui/version-warning.js';

test('majorVersion returns the leading component', () => {
  assert.equal(majorVersion('3.1.0'), '3');
  assert.equal(majorVersion('10.0.0-beta.1'), '10');
});

test('majorVersion returns null for missing or blank versions', () => {
  assert.equal(majorVersion(null), null);
  assert.equal(majorVersion(''), null);
  assert.equal(majorVersion('.'), null);
});

test('hasMajorVersionMismatch compares only the major component', () => {
  assert.equal(hasMajorVersionMismatch('2.9.0', '3.1.0'), true);
  assert.equal(hasMajorVersionMismatch('3.9.9', '3.1.0'), false);
});

test('hasMajorVersionMismatch ignores legacy rooms and unknown local versions', () => {
  assert.equal(hasMajorVersionMismatch(null, '3.1.0'), false);
  assert.equal(hasMajorVersionMismatch('3.1.0', ''), false);
});

test('versionWarning is advisory text only for known mismatches', () => {
  assert.equal(versionWarning('2.9.0', '3.1.0'), '⚠ host v2.9.0');
  assert.equal(versionWarning('3.9.9', '3.1.0'), null);
  assert.equal(versionWarning(null, '3.1.0'), null);
});
