import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AgentStore, AGENT_EVENT_LIMIT, AGENT_EVENT_PAGE_LIMIT } from '../../packages/agent-core/lib/node/agent-store.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

const at = '2026-10-05T12:00:00Z';
const later = '2026-10-05T12:00:01Z';
const task = (id = 'task-1') => ({ version: 1, id, createdAt: at, objective: 'Edit one file',
    instructions: 'Edit src/a.ts and run tests', projectRoot: '.', modelPolicy: { kind: 'follow-coding-agent' },
    controls: {}, authority: { profile: 'phase-8b-project' },
    completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' } });
const run = (id = 'run-1', taskId = 'task-1') => ({ version: 1, id, taskId, status: 'pending',
    grantId: 'grant-1', grantRevision: 0, requestedPolicy: { kind: 'follow-coding-agent' },
    projectRoot: '.', createdAt: at, changedFiles: [], validationResults: [] });
const event = (sequence: number, summary = 'Started') => ({ version: 1, runId: 'run-1', sequence,
    at: later, kind: 'message', summary });

async function folders(work: (a: string, b: string) => Promise<void>) {
    const base = await mkdtemp(join(tmpdir(), 'dope-agent-store-'));
    const a = join(base, 'a'), b = join(base, 'b');
    try { await mkdir(a); await mkdir(b); await work(a, b); } finally { await rm(base, { recursive: true, force: true }); }
}

test('atomic task/run round trip, legal transitions, events and terminal restart truth', async () => folders(async (a) => {
    const store = new AgentStore();
    const changes: string[] = [];
    store.onChange((_root, change) => changes.push(`${change.kind}:${change.id}`));
    assert.deepEqual(await store.createTask(a, task()), task());
    assert.deepEqual(await store.createRun(a, run()), run());
    const active = { ...run(), status: 'running', startedAt: later };
    await store.updateRun(a, run(), active);
    await assert.rejects(store.updateRun(a, run(), active), /Stale/);
    const evidenced = { ...active, changedFiles: ['src/a.ts'],
        validationBasis: 'execution-workspace',
        candidateDelta: { version: 1, effects: [{ kind: 'modify', path: 'src/a.ts',
            before: 'a'.repeat(64), after: 'b'.repeat(64) }] },
        authorityDecision: { allowed: true, blocked: [] }, appliedFiles: ['src/a.ts'],
        validationResults: [{ version: 1, kind: 'test', label: 'unit', status: 'passed' }] };
    await store.updateRun(a, active, evidenced);
    await assert.rejects(store.updateRun(a, evidenced, active), /Immutable AgentRun evidence/);
    assert.deepEqual(await new AgentStore().readRun(a, 'run-1'), evidenced);
    await assert.rejects(store.updateRun(a, evidenced, { ...evidenced, status: 'pending', startedAt: undefined }), /Illegal|lifecycle/);
    await store.appendEvent(a, event(1));
    await store.appendEvent(a, event(2, 'Edited src/a.ts'));
    const done = { ...evidenced, status: 'completed', endedAt: later };
    await store.updateRun(a, evidenced, done);
    await assert.rejects(store.updateRun(a, done, active), /Illegal|lifecycle/);
    const restarted = new AgentStore();
    assert.deepEqual(await restarted.readTask(a, 'task-1'), task());
    assert.deepEqual(await restarted.readRun(a, 'run-1'), done);
    assert.deepEqual((await restarted.readEvents(a, 'run-1', 0, 1)).events, [event(1)]);
    assert.deepEqual((await restarted.readEvents(a, 'run-1', 1, 10)).events, [event(2, 'Edited src/a.ts')]);
    assert.deepEqual(changes, ['task:task-1', 'run:run-1', 'run:run-1', 'run:run-1', 'event:run-1', 'event:run-1', 'run:run-1']);
    assert.deepEqual(await restarted.listTasks(a), [task()]);
    assert.deepEqual(await restarted.listRuns(a), [done]);
    assert.equal((await readFile(join(a, '.dope/agent/runs/run-1/events.jsonl'), 'utf8')).trim().split('\n').length, 2);
}));

test('project isolation, canonical attach, handle isolation and move/copy portability', async () => folders(async (a, b) => {
    const store = new AgentStore();
    const changed: string[] = [];
    const one = new AgentRuntimeBackend(store, { notifyAgentStateChanged: change => changed.push(change.id) });
    const two = new AgentRuntimeBackend(store, { notifyAgentStateChanged: () => assert.fail('wrong project notification') });
    const handle = (await one.attach(pathToFileURL(a).href)).projectHandle;
    const other = (await two.attach(pathToFileURL(b).href)).projectHandle;
    await one.createTask(handle, task());
    await store.createRun(a, run());
    assert.deepEqual(changed, ['task-1', 'run-1']);
    assert.deepEqual(await two.listTasks(other), []);
    assert.throws(() => two.readTask(handle, 'task-1'), /handle/);
    await assert.rejects(one.attach(pathToFileURL(b).href), /different/);
    await assert.rejects(one.attach('https://example.com/repo'), /local file/);
    await assert.rejects(one.attach('file:///../etc'), /traversal/);
    await assert.rejects(store.root('file:///%2e%2e/etc'), /traversal/);
    const copied = join(b, 'copy');
    await mkdir(copied);
    await cp(join(a, '.dope'), join(copied, '.dope'), { recursive: true });
    assert.deepEqual(await store.readTask(copied, 'task-1'), task());
    const moved = join(b, 'moved');
    await rename(a, moved);
    assert.deepEqual(await store.readRun(moved, 'run-1'), run());
    one.dispose(); two.dispose();
    assert.throws(() => one.readTask(handle, 'task-1'), /handle/);
}));

test('malformed and future-schema bytes remain untouched', async () => folders(async (a) => {
    const store = new AgentStore();
    await store.createTask(a, task());
    const file = join(a, '.dope/agent/tasks/task-1.json');
    for (const bytes of ['{', JSON.stringify({ ...task(), version: 99 })]) {
        await writeFile(file, bytes);
        await assert.rejects(store.readTask(a, 'task-1'), /Corrupt or unsupported/);
        await assert.rejects(store.listTasks(a), /Corrupt or unsupported/);
        await assert.rejects(store.createTask(a, task()), /Corrupt or unsupported/);
        assert.equal(await readFile(file, 'utf8'), bytes);
    }
    await writeFile(file, Buffer.from([0xff, 0xfe]));
    await assert.rejects(store.readTask(a, 'task-1'), /Corrupt or unsupported/);
    assert.deepEqual(await readFile(file), Buffer.from([0xff, 0xfe]));
    await writeFile(file, JSON.stringify(task()));
    await store.createRun(a, run());
    const runFile = join(a, '.dope/agent/runs/run-1/run.json');
    for (const bytes of ['{', JSON.stringify({ ...run(), version: 99 })]) {
        await writeFile(runFile, bytes);
        await assert.rejects(store.readRun(a, 'run-1'), /Corrupt or unsupported/);
        await assert.rejects(store.listRuns(a), /Corrupt or unsupported/);
        assert.equal(await readFile(runFile, 'utf8'), bytes);
    }
}));

test('JSONL bounds, sequence order, concurrent writer exclusion and corruption', async () => folders(async (a) => {
    const left = new AgentStore(), right = new AgentStore();
    await left.createTask(a, task()); await left.createRun(a, run());
    await left.appendEvent(a, event(1));
    await assert.rejects(left.appendEvent(a, event(3)), /sequence/);
    await assert.rejects(left.appendEvent(a, event(2, 'é'.repeat(1000))), /size limit/);
    await assert.rejects(left.readEvents(a, 'run-1', 0, AGENT_EVENT_PAGE_LIMIT + 1), /integer/);
    const lock = join(a, '.dope/agent/runs/run-1/.write.lock');
    await writeFile(lock, 'other writer');
    await assert.rejects(right.appendEvent(a, event(2)), /locked/);
    await rm(lock);
    const results = await Promise.allSettled([left.appendEvent(a, event(2)), right.appendEvent(a, event(2))]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.deepEqual((await left.readEvents(a, 'run-1', 0, 10)).events.map(item => item.sequence), [1, 2]);
    const file = join(a, '.dope/agent/runs/run-1/events.jsonl');
    const bytes = await readFile(file, 'utf8');
    await writeFile(file, `${bytes}{`);
    await assert.rejects(left.readEvents(a, 'run-1', 0, 10), /Corrupt/);
    await assert.rejects(left.appendEvent(a, event(3)), /Corrupt/);
    assert.equal(await readFile(file, 'utf8'), `${bytes}{`);
    const future = `${JSON.stringify({ ...event(1), version: 99 })}\n`;
    await writeFile(file, future);
    await assert.rejects(left.readEvents(a, 'run-1', 0, 10), /Corrupt/);
    assert.equal(await readFile(file, 'utf8'), future);
    const full = Array.from({ length: AGENT_EVENT_LIMIT }, (_, index) => `${JSON.stringify(event(index + 1))}\n`).join('');
    await writeFile(file, full);
    await assert.rejects(left.appendEvent(a, event(AGENT_EVENT_LIMIT + 1)), /limit/);
    assert.equal(await readFile(file, 'utf8'), full);
}));

test('path traversal, symlink escape and secret-shaped input never persist', async () => folders(async (a, b) => {
    const store = new AgentStore();
    await assert.rejects(store.createTask(a, { ...task(), id: '../escape' }), /identity/);
    await assert.rejects(store.createTask(a, { ...task(), instructions: 'api_key=supersecret' }), /credential/);
    await assert.rejects(store.createTask(a, { ...task(), instructions: 'Read /home/alice/.ssh/id_rsa' }), /private-path/);
    await store.createTask(a, task()); await store.createRun(a, run());
    await assert.rejects(store.appendEvent(a, event(1, 'access_token=private')), /credential/);
    await assert.rejects(store.updateRun(a, run(), { ...run(), changedFiles: ['../escape'] }), /project path/);
    await symlink(b, join(a, 'outside-link'));
    const active = { ...run(), status: 'running', startedAt: later, changedFiles: ['outside-link/file.ts'] };
    await assert.rejects(store.updateRun(a, run(), active), /symlink/);
    await assert.rejects(store.appendEvent(a, { ...event(1), kind: 'file', path: 'outside-link/file.ts' }), /symlink/);
    await assert.rejects(store.createRun(a, { ...run('run-2'), projectId: 'wrong-project' }), /does not match task/);
    const bytes = await readFile(join(a, '.dope/agent/tasks/task-1.json'), 'utf8');
    assert.equal(/supersecret|id_rsa|access_token/.test(bytes), false);
    await mkdir(join(b, 'target'));
    await symlink(join(b, 'target'), join(a, '.dope/agent/runs/escape'));
    await assert.rejects(store.readRun(a, 'escape'), /Unsafe agent directory/);
}));
