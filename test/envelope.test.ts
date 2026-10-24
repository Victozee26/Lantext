import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEnvelope } from '../src/protocol/envelope.js';

test('createEnvelope defaults an unknown sender and stamps a timestamp', () => {
  const env = createEnvelope(undefined, 'hi');
  assert.equal(env.sender, 'UNKNOWN');
  assert.equal(env.text, 'hi');
  assert.equal(typeof env.timestamp, 'number');
  assert.ok(env.timestamp > 0);
});

test('createEnvelope keeps a provided sender', () => {
  assert.equal(createEnvelope('10.0.0.2', 'x').sender, '10.0.0.2');
});
