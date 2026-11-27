import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('new title source exists', () => {
  const text = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(text, /Meteor Dodge Command/);
});
