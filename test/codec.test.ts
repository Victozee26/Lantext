import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodePayload,
  decodePayload,
  encodeEnvelope,
  decodeEnvelope,
  splitBuffer,
  normalizeForHost,
} from '../src/protocol/codec.js';

test('encodePayload/decodePayload round-trip a single line', () => {
  const wire = encodePayload('hello');
  assert.equal(wire, 'hello\n');
  assert.equal(decodePayload(wire.trimEnd()), 'hello');
});

test('multi-line payload stays on one wire line via JSON escaping', () => {
  const text = 'line one\nline two';
  const wire = encodePayload(text);
  assert.equal(wire.split('\n').length, 2); // content + trailing newline
  assert.equal(decodePayload(wire.trimEnd()), text);
});

test('CRLF and lone CR normalize to LF', () => {
  assert.equal(decodePayload('a\r\nb'), 'a\nb');
  assert.equal(decodePayload('a\rb'), 'a\nb');
});

test('blank and whitespace-only lines are not messages', () => {
  assert.equal(decodePayload(''), null);
  assert.equal(decodePayload('   '), null);
  assert.equal(decodePayload('\r'), null);
});

test('an unterminated JSON string falls through to plain text', () => {
  assert.equal(decodePayload('"unterminated'), '"unterminated');
});

test('splitBuffer keeps the trailing partial line across chunks', () => {
  const first = splitBuffer('', 'alpha\nbeta\npar');
  assert.deepEqual(first.lines, ['alpha', 'beta']);
  assert.equal(first.rest, 'par');

  const second = splitBuffer(first.rest, 'tial\n');
  assert.deepEqual(second.lines, ['partial']);
  assert.equal(second.rest, '');
});

test('envelope encode/decode round-trips', () => {
  const env = { sender: '192.168.1.5', timestamp: 123, text: 'hi' };
  assert.deepEqual(decodeEnvelope(encodeEnvelope(env).trimEnd()), env);
});

test('decodeEnvelope rejects malformed or incomplete payloads', () => {
  assert.equal(decodeEnvelope(''), null);
  assert.equal(decodeEnvelope('not json'), null);
  assert.equal(decodeEnvelope(JSON.stringify({ sender: 'a', text: 'b' })), null);
});

test('normalizeForHost strips edge blank lines but keeps interior ones', () => {
  assert.equal(normalizeForHost('\n\na\n\nb\n\n'), 'a\n\nb');
  assert.equal(normalizeForHost('   '), '');
});
