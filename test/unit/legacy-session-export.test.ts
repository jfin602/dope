import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/export-legacy-development-sessions.mjs', import.meta.url));
const now = '2026-10-10T12:00:00.000Z';
const ownerNames = ['chats.json', 'planning-maps.json', 'agent.json', 'project-mind.json'];

async function fixture(version: 1 | 2, projectMindId: string | null = null) {
    const root = await mkdtemp(join(tmpdir(), 'dope-legacy-export-'));
    const directory = join(root, '.dope');
    await mkdir(directory);
    const project = { canonicalRoot: root, projectMindId };
    const session = { schemaVersion: version, id: randomUUID(), project, revision: 2,
        title: 'Developer title', objective: 'Investigate why', createdAt: now, updatedAt: now,
        status: 'closed', notes: 'Original notes\nkeep these', nextActions: ['Review decision'],
        closeout: { achieved: 'Fixed parser', unresolved: 'One unknown', deferred: 'Follow up', closedAt: now },
        ...(version === 2 ? { links: [
            { kind: 'chat', chatId: randomUUID() }, { kind: 'planning-map', mapId: 'map-one' },
            { kind: 'work-item', mapId: 'map-one', workItemId: 'item-one' },
            { kind: 'agent-task', taskId: 'task-one' }, { kind: 'agent-run', taskId: 'task-one', runId: 'run-one' },
            { kind: 'agent-sequence', sequenceId: 'sequence-one' },
            { kind: 'project-mind', artifactId: randomUUID(), artifactType: 'decision' },
        ] } : {}) };
    const collection = { schemaVersion: version, project, revision: 3, sessions: [session] };
    const file = join(directory, 'development-sessions.json');
    const original = Buffer.from(`${JSON.stringify(collection, null, 2)}\n`);
    await writeFile(file, original);
    for (const name of ownerNames) await writeFile(join(directory, name),
        name === 'project-mind.json' && projectMindId ? JSON.stringify({ projectId: projectMindId }) : `${name} sentinel`);
    return { root, directory, file, original, collection, clean: () => rm(root, { recursive: true, force: true }) };
}
function run(root: string, format = 'json', extra: string[] = []) {
    return spawnSync(process.execPath, [script, '--project', root, '--format', format, ...extra], { encoding: 'utf8' });
}
async function snapshot(directory: string) {
    const names = (await readdir(directory)).sort();
    const values = await Promise.all(names.map(async name => {
        const path = join(directory, name);
        const info = await lstat(path);
        return [name, info.isFile() ? createHash('sha256').update(await readFile(path)).digest('hex') : 'nonfile'];
    }));
    return Object.fromEntries(values);
}

for (const version of [1, 2] as const) test(`valid v${version} exports exact author fields and preserves all source/owner bytes`, async () => {
    const f = await fixture(version);
    try {
        const before = await snapshot(f.directory);
        const json = run(f.root, 'json', ['--file', f.file]);
        assert.equal(json.status, 0, json.stderr);
        const output = JSON.parse(json.stdout);
        assert.deepEqual(output.collection, f.collection);
        assert.equal(output.sourceSha256, createHash('sha256').update(f.original).digest('hex'));
        assert.equal(output.collection.sessions[0].notes, 'Original notes\nkeep these');
        if (version === 2) assert.equal(output.collection.sessions[0].links.length, 7);
        const plain = run(f.root, 'text');
        assert.equal(plain.status, 0, plain.stderr);
        for (const value of ['Developer title', 'Investigate why', 'Original notes', 'Review decision',
            'Fixed parser', 'One unknown', 'Follow up', ...(version === 2 ? ['planning-map', 'agent-run'] : [])])
            assert.ok(plain.stdout.includes(value), value);
        assert.deepEqual(await readFile(f.file), f.original);
        assert.deepEqual(await snapshot(f.directory), before);
    } finally { await f.clean(); }
});

test('missing explicit target, traversal and foreign file target fail without reads or writes', async () => {
    const f = await fixture(2);
    try {
        const before = await snapshot(f.directory);
        for (const args of [[], ['--project', f.root], ['--project', join(f.root, '..', 'other'), '--format', 'json'],
            ['--project', `${f.root}/../${f.root.split('/').at(-1)}`, '--format', 'json'],
            ['--project', f.root, '--format', 'json', '--file', join(f.directory, 'other.json')]]) {
            const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
            assert.notEqual(result.status, 0);
            assert.equal(result.stdout, '');
        }
        assert.deepEqual(await snapshot(f.directory), before);
    } finally { await f.clean(); }
});

test('corrupt, unsupported, duplicate and oversized input fail closed with byte preservation', async () => {
    const f = await fixture(2);
    try {
        for (const bytes of [Buffer.from('{'), Buffer.from([0x7b, 0xff, 0x7d]),
            Buffer.from(JSON.stringify({ ...f.collection, schemaVersion: 3 })),
            Buffer.from(JSON.stringify({ ...f.collection, sessions: [f.collection.sessions[0], f.collection.sessions[0]] })),
            Buffer.from(JSON.stringify({ ...f.collection, sessions: [{ ...f.collection.sessions[0], schemaVersion: 1 }] })),
            Buffer.from(JSON.stringify({ ...f.collection, sessions: [{ ...f.collection.sessions[0],
                links: [{ kind: 'planning-map', mapId: '../escape' }] }] })),
            Buffer.from(JSON.stringify({ ...f.collection, sessions: Array(10001).fill(f.collection.sessions[0]) })),
            Buffer.alloc(16 * 1024 * 1024 + 1, 120)]) {
            await writeFile(f.file, bytes);
            const before = await snapshot(f.directory);
            const result = run(f.root);
            assert.notEqual(result.status, 0);
            assert.equal(result.stdout, '');
            assert.deepEqual(await readFile(f.file), bytes);
            assert.deepEqual(await snapshot(f.directory), before);
        }
    } finally { await f.clean(); }
});

test('symlinked project, .dope directory and Session file are rejected', async () => {
    const f = await fixture(2);
    const second = await mkdtemp(join(tmpdir(), 'dope-legacy-links-'));
    try {
        await symlink(f.root, join(second, 'project'));
        assert.notEqual(run(join(second, 'project')).status, 0);
        const fileBytes = await readFile(f.file);
        await rm(f.file);
        await symlink(join(second, 'target'), f.file);
        await writeFile(join(second, 'target'), fileBytes);
        assert.notEqual(run(f.root).status, 0);
        await rm(f.file);
        await rm(f.directory, { recursive: true });
        await symlink(second, f.directory);
        assert.notEqual(run(f.root).status, 0);
        assert.deepEqual(await readFile(join(second, 'target')), fileBytes);
    } finally { await f.clean(); await rm(second, { recursive: true, force: true }); }
});

test('copied or moved project identity and Project Mind mismatch fail without rebinding', async () => {
    const f = await fixture(2, 'project-one');
    const copyRoot = await mkdtemp(join(tmpdir(), 'dope-legacy-copy-'));
    try {
        await cp(f.directory, join(copyRoot, '.dope'), { recursive: true });
        const before = await snapshot(join(copyRoot, '.dope'));
        const copied = run(copyRoot);
        assert.notEqual(copied.status, 0);
        assert.match(copied.stderr, /identity mismatch/);
        assert.deepEqual(await snapshot(join(copyRoot, '.dope')), before);
        await writeFile(join(f.directory, 'project-mind.json'), JSON.stringify({ projectId: 'project-two' }));
        const original = await snapshot(f.directory);
        const mismatched = run(f.root);
        assert.notEqual(mismatched.status, 0);
        assert.match(mismatched.stderr, /Project Mind identity mismatch/);
        assert.deepEqual(await snapshot(f.directory), original);
    } finally { await f.clean(); await rm(copyRoot, { recursive: true, force: true }); }
});

test('standalone CLI imports no Session runtime and executes with package libraries unavailable', async () => {
    const source = await readFile(script, 'utf8');
    assert.doesNotMatch(source, /@dope\/|packages\/|developer-session-store|developer-session-backend/);
    const f = await fixture(1);
    const isolated = await mkdtemp(join(tmpdir(), 'dope-legacy-standalone-'));
    try {
        const isolatedScript = join(isolated, 'export.mjs');
        await writeFile(isolatedScript, source);
        const result = spawnSync(process.execPath, ['--no-addons', isolatedScript, '--project', f.root, '--format', 'json'],
            { cwd: f.root, env: { PATH: '/nonexistent' }, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(JSON.parse(result.stdout).collection, f.collection);
    } finally { await f.clean(); await rm(isolated, { recursive: true, force: true }); }
});
