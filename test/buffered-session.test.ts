import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BufferedSession } from '../src/ui/buffered-session.js';

test('events emitted before the first subscriber flush in order', () => {
  const session = new BufferedSession();
  session.emit('status', 'one');
  session.emit('status', 'two');

  const seen: string[] = [];
  session.on('status', (message) => seen.push(message));

  assert.deepEqual(seen, ['one', 'two']);
});

test('events flow live after the first subscriber attaches', () => {
  const session = new BufferedSession();
  const seen: string[] = [];
  session.on('status', (message) => seen.push(message));

  session.emit('status', 'live');

  assert.deepEqual(seen, ['live']);
});

test('the queue is per event, not global', () => {
  const session = new BufferedSession();
  session.emit('status', 'pending status');
  session.emit('error', 'pending error');

  const statuses: string[] = [];
  session.on('status', (message) => statuses.push(message));

  assert.deepEqual(statuses, ['pending status']);
});

test('off detaches a listener', () => {
  const session = new BufferedSession();
  const seen: string[] = [];
  const listener = (message: string): void => {
    seen.push(message);
  };

  session.on('status', listener);
  session.emit('status', 'before');
  session.off('status', listener);
  session.emit('status', 'after');

  assert.deepEqual(seen, ['before']);
});

test('the buffer is capped, dropping the oldest payloads', () => {
  const session = new BufferedSession();
  for (let i = 0; i < 105; i++) session.emit('status', `m${i}`);

  const seen: string[] = [];
  session.on('status', (message) => seen.push(message));

  assert.equal(seen.length, 100);
  assert.equal(seen[0], 'm5');
  assert.equal(seen[99], 'm104');
});
