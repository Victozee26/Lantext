import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReconnectPolicy } from '../src/client/reconnect.js';

test('schedule fires after the configured delay', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const policy = createReconnectPolicy(2000);
  let fired = 0;

  policy.schedule(() => {
    fired += 1;
  });

  t.mock.timers.tick(1999);
  assert.equal(fired, 0);

  t.mock.timers.tick(1);
  assert.equal(fired, 1);
});

test('cancel prevents the pending call', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const policy = createReconnectPolicy(1000);
  let fired = 0;

  policy.schedule(() => {
    fired += 1;
  });
  policy.cancel();
  t.mock.timers.tick(5000);

  assert.equal(fired, 0);
});

test('scheduling again replaces the pending call', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const policy = createReconnectPolicy(1000);
  const fired: string[] = [];

  policy.schedule(() => fired.push('first'));
  policy.schedule(() => fired.push('second'));
  t.mock.timers.tick(1000);

  assert.deepEqual(fired, ['second']);
});
