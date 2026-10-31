import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRunElapsed, formatRunElapsedCompact } from '../../packages/theia-extension/src/browser/run-elapsed.ts';

test('run elapsed uses a live clock and freezes at the recorded end', () => {
    const start = '2026-10-30T12:00:00.000Z';
    assert.equal(formatRunElapsed(start, undefined, Date.parse(start) + 65_000), '00:01:05');
    assert.equal(formatRunElapsed(start, '2026-10-30T13:02:03.000Z', Date.parse(start) + 10_000), '01:02:03');
    assert.equal(formatRunElapsed(start, '2026-10-30T11:00:00.000Z'), '00:00:00');
    assert.equal(formatRunElapsed('invalid'), undefined);
});

test('active run displays a compact elapsed counter', () => {
    const start = '2026-10-30T12:00:00.000Z';
    const at = (seconds: number) => Date.parse(start) + seconds * 1000;
    assert.equal(formatRunElapsedCompact(start, at(0)), '0s');
    assert.equal(formatRunElapsedCompact(start, at(332)), '5m32s');
    assert.equal(formatRunElapsedCompact(start, at(3752)), '1h2m32s');
});
