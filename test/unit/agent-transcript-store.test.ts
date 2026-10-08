import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { AGENT_TRANSCRIPT_ENTRY_LIMIT, AGENT_TRANSCRIPT_PAGE_LIMIT } from '../../packages/agent-core/lib/transcript.js';

const at = '2026-10-08T12:00:00Z';
const task = { version: 1, id: 'task-1', createdAt: at, objective: 'Work', instructions: 'Edit one file',
    projectRoot: '.', modelPolicy: { kind: 'follow-coding-agent' }, controls: {},
    authority: { profile: 'phase-8b-project' }, completion: { validation: [], requireValidationPass: false },
    origin: { kind: 'direct' } };
const run = { version: 1, id: 'run-1', taskId: 'task-1', status: 'pending', grantId: 'grant-1',
    grantRevision: 0, requestedPolicy: { kind: 'follow-coding-agent' }, projectRoot: '.',
    createdAt: at, changedFiles: [], validationResults: [] };

async function fixture(work: (root: string, store: AgentStore, file: string) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'dope-transcript-'));
    const store = new AgentStore();
    try {
        await store.createTask(root, task);
        await store.createRun(root, run);
        await work(root, store, join(root, '.dope/agent/runs/run-1/transcript.jsonl'));
    } finally { await rm(root, { recursive: true, force: true }); }
}

test('ordered append, command reconstruction, pagination and reopen without activity fabrication', async () => fixture(async (root, store) => {
    assert.deepEqual(await store.readTranscript(root, 'run-1', 0, 2), {
        state: 'not-recorded', entries: [], nextSequence: 0, hasMore: false, incomplete: false });
    await store.appendEvent(root, { version: 1, runId: 'run-1', sequence: 1, at, kind: 'message', summary: 'Agent message received' });
    assert.equal((await new AgentStore().readTranscript(root, 'run-1', 0, 1)).state, 'not-recorded');
    await store.appendTranscript(root, 'run-1', { kind: 'message', at, text: 'Visible first paragraph.\n\nSecond paragraph.' });
    await store.appendTranscript(root, 'run-1', { kind: 'command-start', at, commandId: 'cmd-1', command: 'npm test', cwd: 'src' });
    await store.appendTranscript(root, 'run-1', { kind: 'message', at, text: 'Tests are running.' });
    await store.appendTranscript(root, 'run-1', { kind: 'command-finish', at, commandId: 'cmd-1',
        status: 'completed', exitCode: 0, durationMs: 25, stdout: 'passed', stdoutTruncated: true, stderr: '' });
    await store.appendTranscript(root, 'run-1', { kind: 'marker', at, code: 'run-ended' });
    const reopened = new AgentStore();
    const first = await reopened.readTranscript(root, 'run-1', 0, 2);
    assert.equal(first.state, 'recorded');
    assert.deepEqual(first.entries.map(item => item.sequence), [1, 2]);
    assert.equal(first.entries[0].kind, 'message');
    assert.equal(first.entries[0].text, 'Visible first paragraph.\n\nSecond paragraph.');
    assert.deepEqual(first.entries[1], { version: 1, runId: 'run-1', sequence: 2, at, kind: 'command',
        commandId: 'cmd-1', command: 'npm test', commandTruncated: false, cwd: 'src', status: 'completed',
        completedSequence: 4, exitCode: 0, durationMs: 25, stdout: 'passed', stdoutTruncated: true,
        stderr: '', stderrTruncated: false });
    assert.equal(first.hasMore, true);
    const second = await reopened.readTranscript(root, 'run-1', first.nextSequence, 2);
    assert.deepEqual(second.entries.map(item => item.sequence), [3, 5]);
    assert.equal(second.hasMore, false);
    assert.equal((await reopened.readEvents(root, 'run-1', 0, 10)).events.length, 1);
    await assert.rejects(reopened.readTranscript(root, 'run-1', 6, 1), /cursor/);
    await assert.rejects(reopened.readTranscript(root, 'run-1', 0, AGENT_TRANSCRIPT_PAGE_LIMIT + 1), /integer/);
}));

test('bounded content redacts secrets and private paths, rejects non-visible content and marks ceiling', async () => fixture(async (root, store, file) => {
    await store.appendTranscript(root, 'run-1', { kind: 'message', at,
        text: `A normal explanation with password=abc123 and /home/alice/private/file, then ${'x'.repeat(13_000)}` });
    const first = (await store.readTranscript(root, 'run-1', 0, 1)).entries[0];
    assert.equal(first.kind, 'message');
    assert.equal(first.truncated, true);
    assert.match(first.text, /A normal explanation/);
    assert.match(first.text, /\[redacted\]/);
    assert.doesNotMatch(await readFile(file, 'utf8'), /abc123|alice/);
    await assert.rejects(store.appendTranscript(root, 'run-1', { kind: 'message', at, text: '<think>secret</think>' }), /Unsafe/);
    await assert.rejects(store.appendTranscript(root, 'run-1', { kind: 'message', at, text: '{"method":"turn/start","params":{}}' }), /Unsafe/);
    await assert.rejects(store.appendTranscript(root, 'run-1', { kind: 'message', at, text: 'A=1\nB=2\nC=3' }), /Unsafe/);
    await assert.rejects(store.appendTranscript(root, 'run-1', { kind: 'command-start', at, commandId: 'cmd-2', command: 'pwd', cwd: '../escape' }), /path/);
    await store.appendTranscript(root, 'run-1', { kind: 'command-start', at, commandId: 'cmd-2', command: 'echo password=abc123' });
    await store.appendTranscript(root, 'run-1', { kind: 'command-finish', at, commandId: 'cmd-2', status: 'failed',
        exitCode: 1, stderr: 'problem: Bearer abcdefghijklmnopqrstuvwxyz then ' + 'z'.repeat(5000) });
    const command = (await store.readTranscript(root, 'run-1', 1, 2)).entries[0];
    assert.equal(command.kind, 'command');
    assert.equal(command.stderrTruncated, true);
    assert.doesNotMatch(JSON.stringify(command), /abc123|abcdefghijklmnopqrstuvwxyz/);
    const seed = await readFile(file, 'utf8');
    const padding = Array.from({ length: AGENT_TRANSCRIPT_ENTRY_LIMIT - 5 }, (_, index) =>
        JSON.stringify({ version: 1, runId: 'run-1', sequence: index + 4, at, kind: 'marker', code: 'run-started' }) + '\n').join('');
    await writeFile(file, seed + padding);
    assert.equal((await store.appendTranscript(root, 'run-1', { kind: 'marker', at, code: 'run-ended' })).recorded, true);
    assert.deepEqual(await store.appendTranscript(root, 'run-1', { kind: 'message', at, text: 'over ceiling' }),
        { recorded: false, incomplete: true, sequence: AGENT_TRANSCRIPT_ENTRY_LIMIT });
    assert.deepEqual(await store.appendTranscript(root, 'run-1', { kind: 'message', at, text: 'still over' }),
        { recorded: false, incomplete: true, sequence: AGENT_TRANSCRIPT_ENTRY_LIMIT });
    const final = await new AgentStore().readTranscript(root, 'run-1', AGENT_TRANSCRIPT_ENTRY_LIMIT - 1, 1);
    assert.equal(final.incomplete, true);
    assert.equal(final.entries[0].kind, 'marker');
    assert.equal(final.entries[0].code, 'transcript-incomplete');
}));

test('malformed, future, path escape and symlink transcript fail closed', async () => fixture(async (root, store, file) => {
    await assert.rejects(store.readTranscript(root, '../run-1', 0, 1), /identity/);
    await assert.rejects(store.appendTranscript(root, '../run-1', { kind: 'message', at, text: 'hello' }), /identity/);
    for (const contents of ['{"version":2,"runId":"run-1","sequence":1,"at":"2026-10-08T12:00:00Z","kind":"message","text":"hi","truncated":false}\n',
        '{broken}\n', '{"version":1}\n', 'partial',
        JSON.stringify({ version: 1, runId: 'run-1', sequence: 1, at, kind: 'command-finish', commandId: 'orphan', status: 'completed' }) + '\n',
        JSON.stringify({ version: 1, runId: 'run-1', sequence: 1, at, kind: 'message', text: 'password=private', truncated: false }) + '\n']) {
        await writeFile(file, contents);
        await assert.rejects(store.readTranscript(root, 'run-1', 0, 1), /Corrupt/);
        await assert.rejects(store.appendTranscript(root, 'run-1', { kind: 'message', at, text: 'hello' }), /Corrupt/);
    }
    await rm(file);
    const outside = join(root, 'outside');
    await writeFile(outside, '');
    await symlink(outside, file);
    await assert.rejects(store.readTranscript(root, 'run-1', 0, 1), /Unsafe/);
    await assert.rejects(store.appendTranscript(root, 'run-1', { kind: 'message', at, text: 'hello' }), /Unsafe/);
    await rm(file);
    await mkdir(join(root, '.dope/agent/runs/other'));
    await rm(join(root, '.dope/agent/runs/other'), { recursive: true });
    await symlink(root, join(root, '.dope/agent/runs/other'));
    await assert.rejects(store.readTranscript(root, 'other', 0, 1), /Unsafe/);
}));
