import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';
import {
  defaultHostConfigPath,
  mergeIdentityWarnings,
  resolveHostIdentity,
} from '../src/server/identity.js';

function tempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), 'lantext-identity-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('identity persists across loads', (t) => {
  const dir = tempDir(t);
  const configPath = join(dir, 'host.json');

  const first = resolveHostIdentity({
    configPath,
    hostname: () => 'first-host',
    randomUUID: () => 'id-one',
  });
  assert.deepEqual(
    { hostId: first.hostId, name: first.name, persisted: first.persisted, warning: first.warning },
    { hostId: 'id-one', name: 'first-host', persisted: true, warning: null },
  );

  const second = resolveHostIdentity({
    configPath,
    hostname: () => 'second-host',
    randomUUID: () => 'id-two',
  });
  assert.equal(second.hostId, 'id-one');
  assert.equal(second.name, 'first-host');
});

test('an explicit name is persisted without changing the identity', (t) => {
  const dir = tempDir(t);
  const configPath = join(dir, 'host.json');

  resolveHostIdentity({ configPath, hostname: () => 'first-host', randomUUID: () => 'id-one' });
  const renamed = resolveHostIdentity({ configPath, name: 'Victor room' });
  assert.equal(renamed.hostId, 'id-one');
  assert.equal(renamed.name, 'Victor room');
  assert.equal(renamed.persisted, true);

  const reloaded = resolveHostIdentity({ configPath });
  assert.equal(reloaded.name, 'Victor room');
});

test('room names are trimmed to a single line', (t) => {
  const dir = tempDir(t);
  const configPath = join(dir, 'host.json');

  const result = resolveHostIdentity({
    configPath,
    name: '  Victor\n\tRoom  ',
    hostname: () => 'first-host',
    randomUUID: () => 'id-one',
  });

  assert.equal(result.name, 'Victor Room');
  assert.deepEqual(JSON.parse(readFileSync(configPath, 'utf8')), {
    hostId: 'id-one',
    name: 'Victor Room',
  });
});

test('corrupt JSON regenerates and overwrites the file', (t) => {
  const dir = tempDir(t);
  const configPath = join(dir, 'host.json');
  writeFileSync(configPath, '{ broken');

  const result = resolveHostIdentity({
    configPath,
    hostname: () => 'fresh-host',
    randomUUID: () => 'fresh-id',
  });

  assert.equal(result.hostId, 'fresh-id');
  assert.equal(result.name, 'fresh-host');
  assert.equal(result.persisted, true);
  assert.match(result.warning ?? '', /invalid/i);
  assert.deepEqual(JSON.parse(readFileSync(configPath, 'utf8')), {
    hostId: 'fresh-id',
    name: 'fresh-host',
  });
});

test('an unwritable path falls back to an in-memory identity without throwing', (t) => {
  const dir = tempDir(t);
  const blocker = join(dir, 'not-a-directory');
  writeFileSync(blocker, 'file');

  const result = resolveHostIdentity({
    configPath: join(blocker, 'host.json'),
    hostname: () => 'session-host',
    randomUUID: () => 'session-id',
  });

  assert.equal(result.hostId, 'session-id');
  assert.equal(result.name, 'session-host');
  assert.equal(result.persisted, false);
  assert.match(result.warning ?? '', /Could not persist/i);
});

test('identity warnings merge without dropping distinct diagnostics', () => {
  assert.equal(mergeIdentityWarnings(null, undefined, '   '), null);
  assert.equal(mergeIdentityWarnings('same warning', 'same warning'), 'same warning');
  assert.equal(
    mergeIdentityWarnings('identity was invalid; regenerated', 'could not persist identity'),
    'identity was invalid; regenerated could not persist identity',
  );
});

test('config path follows XDG, HOME, and APPDATA rules', () => {
  assert.equal(
    defaultHostConfigPath({ XDG_CONFIG_HOME: '/xdg' }, 'linux', '/home/vic'),
    join('/xdg', 'lantext', 'host.json'),
  );
  assert.equal(
    defaultHostConfigPath({}, 'linux', '/home/vic'),
    join('/home/vic', '.config', 'lantext', 'host.json'),
  );
  assert.equal(
    defaultHostConfigPath({ XDG_CONFIG_HOME: '   ' }, 'linux', '/home/vic'),
    join('/home/vic', '.config', 'lantext', 'host.json'),
  );
  assert.equal(
    defaultHostConfigPath({ APPDATA: 'C:\\Users\\vic\\AppData\\Roaming' }, 'win32', 'C:\\Users\\vic'),
    win32.join('C:\\Users\\vic\\AppData\\Roaming', 'lantext', 'host.json'),
  );
});
