import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PlanningBridgeApprovals } from '../../packages/theia-extension/lib/node/planning-bridge-approvals.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';
import type { BridgeOwnerSnapshot } from '../../packages/theia-extension/src/node/planning-bridge-approvals.ts';

const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const execute = promisify(execFile);
const basis = { architectureRevision: 1, architectureFingerprint: 'architecture', physicalInputFingerprint: 'physical', physicalGeneration: 1 };
async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'dope-bridge-'));
    await execute('git', ['init', '-q', root]);
    const markdown = '# Roadmap\n\n## Checkpoint\nOriginal objective\n';
    await writeFile(join(root, 'ROADMAP.md'), markdown);
    const hash = sha(markdown);
    const checkpoint = { id: 'checkpoint', kind: 'milestone' as const, title: 'Checkpoint', objective: 'Original objective',
        order: 1, dependencies: [], links: [{ owner: 'planning-map' as const, targetId: 'map',
            ownerProjectId: 'planning', ownerRevision: 1, basis }], status: 'not-implemented' as const,
        readOnly: false, source: { path: 'ROADMAP.md', sha256: hash, line: 3, text: '## Checkpoint' }, evidence: [] };
    const map = { schemaVersion: 1 as const, id: 'map', projectId: 'planning', title: 'Map', objective: 'Target',
        status: 'draft' as const, revision: 1, history: [], basis,
        transformations: [{ id: 'change', kind: 'modify' as const, currentIds: ['component'], futureNodes: [], dependsOn: [] }], workItems: [] };
    const source: BridgeOwnerSnapshot = { roadmap: { schemaVersion: 1, projectId: 'roadmap', projectRoot: root,
        revision: 1, checkpoints: [checkpoint], linkedDocument: { projectRoot: root, projectId: 'roadmap',
            path: 'ROADMAP.md', sourceHash: hash, sections: [{ sectionKey: 'checkpoint', checkpointId: 'checkpoint' }],
            lastSynced: { sourceHash: hash, roadmapRevision: 1 }, syncState: 'synced' } }, basis,
        planning: { projectId: 'planning', collectionRevision: 1, map } };
    const store = new PlanningBridgeApprovals(async () => source);
    return { root, source, store, markdown, dispose: () => rm(root, { recursive: true, force: true }) };
}

test('scope, target and stack are three explicit, independent revisioned gates; restart reads approved provenance', async () => {
    const f = await fixture();
    try {
        const scope = await f.store.preview(f.root, 'checkpoint', 'scope');
        await assert.rejects(f.store.approve(f.root, scope.token, false), /Explicit developer/);
        f.store.reject(scope.token);
        const rejected = await f.store.preview(f.root, 'checkpoint', 'scope');
        f.store.reject(rejected.token);
        await assert.rejects(f.store.approve(f.root, rejected.token, true), /preview approval/);
        await f.store.approve(f.root, (await f.store.preview(f.root, 'checkpoint', 'scope')).token, true);
        assert.equal(await f.store.approved(f.root, 'checkpoint', 'scope'), true);
        assert.equal(await f.store.approved(f.root, 'checkpoint', 'target'), false);
        const old = await f.store.preview(f.root, 'checkpoint', 'target');
        await f.store.approve(f.root, (await f.store.preview(f.root, 'checkpoint', 'target')).token, true);
        await assert.rejects(f.store.approve(f.root, old.token, true), /Stale Bridge revision/);
        assert.equal(await f.store.approved(f.root, 'checkpoint', 'target'), true);
        assert.equal(await f.store.approved(f.root, 'checkpoint', 'stack'), false);
        await mkdir(join(f.root, 'docs', 'tasks'), { recursive: true });
        await cp(join(process.cwd(), 'docs', 'tasks', 'c11-planning-bridge'),
            join(f.root, 'docs', 'tasks', 'c11-planning-bridge'), { recursive: true });
        const stack = (await discoverRoadmapTaskStacks(f.root)).find(item => item.path === 'docs/tasks/c11-planning-bridge');
        assert.ok(stack?.fingerprint && !stack.diagnostic);
        f.source.stack = { path: stack.path, fingerprint: stack.fingerprint };
        await f.store.approve(f.root, (await f.store.preview(f.root, 'checkpoint', 'stack')).token, true);
        assert.equal(await new PlanningBridgeApprovals(async () => f.source).approved(f.root, 'checkpoint', 'stack'), true);
        const file = join(f.root, 'docs/tasks/c11-planning-bridge/P1-workflow-lineage.txt');
        await writeFile(file, `${await readFile(file, 'utf8')}\nDrift`);
        assert.equal(await f.store.approved(f.root, 'checkpoint', 'stack'), false);
        assert.equal(await f.store.approved(f.root, 'checkpoint', 'scope'), true);
        assert.equal(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), f.markdown);
        await assert.rejects(readFile(join(f.root, '.dope/planning-maps.json')), /ENOENT/);
    } finally { await f.dispose(); }
});

test('changed owner fields, revisions, basis, source, foreign identity and restart tokens fail closed', async () => {
    const f = await fixture();
    const other = await fixture();
    try {
        const preview = await f.store.preview(f.root, 'checkpoint', 'target');
        await assert.rejects(f.store.approve(other.root, preview.token, true), /preview approval/);
        await assert.rejects(f.store.preview(other.root, 'checkpoint', 'scope'), /foreign Bridge owner identity/);
        await assert.rejects(new PlanningBridgeApprovals(async () => f.source).approve(f.root, preview.token, true), /preview approval/);
        f.source.planning!.map.transformations[0].currentIds = ['different'];
        await assert.rejects(f.store.approve(f.root, preview.token, true), /changed/);
        const approved = await f.store.preview(f.root, 'checkpoint', 'target');
        await f.store.approve(f.root, approved.token, true);
        f.source.planning!.map.revision++;
        assert.equal(await f.store.approved(f.root, 'checkpoint', 'target'), false);
        f.source.planning!.map.revision--;
        f.source.basis = { ...basis, physicalGeneration: 2 };
        assert.equal(await f.store.approved(f.root, 'checkpoint', 'target'), false);
        f.source.basis = basis;
        f.source.planning!.projectId = 'foreign';
        await assert.rejects(f.store.preview(f.root, 'checkpoint', 'target'), /foreign Planning/);
        f.source.planning!.projectId = 'planning';
        f.source.stack = { path: 'docs/tasks/../escape', fingerprint: 'a'.repeat(64) };
        await assert.rejects(f.store.preview(f.root, 'checkpoint', 'stack'), /Stack source is unavailable/);
        await writeFile(join(f.root, 'ROADMAP.md'), '# changed\n');
        assert.equal(await f.store.approved(f.root, 'checkpoint', 'target'), false);
        await assert.rejects(f.store.preview(f.root, 'checkpoint', 'scope'), /source changed/);
    } finally { await f.dispose(); await other.dispose(); }
});

test('invalid bytes and symlinked storage or Roadmap source are rejected without owner writes', async () => {
    const f = await fixture();
    try {
        await mkdir(join(f.root, '.dope'));
        const file = join(f.root, '.dope/planning-bridge-approvals.json');
        await writeFile(file, '{bad');
        await assert.rejects(f.store.preview(f.root, 'checkpoint', 'scope'), /Invalid Bridge approval bytes/);
        await rm(file);
        await symlink(join(f.root, 'ROADMAP.md'), file);
        await assert.rejects(f.store.preview(f.root, 'checkpoint', 'scope'), /Unsafe Bridge file/);
        await rm(file);
        await rm(join(f.root, 'ROADMAP.md'));
        await symlink(join(f.root, '.dope'), join(f.root, 'ROADMAP.md'));
        await assert.rejects(f.store.preview(f.root, 'checkpoint', 'scope'), /Unsafe linked Roadmap symlink/);
        assert.equal((await lstat(join(f.root, '.dope'))).isDirectory(), true);
    } finally { await f.dispose(); }
});

test('interrupted temporary write and dead process lock recover; live or malformed locks deny', async () => {
    const f = await fixture();
    try {
        await mkdir(join(f.root, '.dope'));
        const lock = join(f.root, '.dope/planning-bridge-approvals.lock');
        await writeFile(join(f.root, '.dope/planning-bridge-approvals.crashed.tmp'), '{partial');
        await writeFile(lock, '999999999\n');
        await f.store.approve(f.root, (await f.store.preview(f.root, 'checkpoint', 'scope')).token, true);
        assert.equal(await f.store.approved(f.root, 'checkpoint', 'scope'), true);
        await writeFile(lock, `${process.pid}\n`);
        await assert.rejects(f.store.approve(f.root, (await f.store.preview(f.root, 'checkpoint', 'target')).token, true), /Bridge locked/);
        await writeFile(lock, 'bad');
        await assert.rejects(f.store.approve(f.root, (await f.store.preview(f.root, 'checkpoint', 'target')).token, true), /Bridge locked/);
        await rm(lock);
        assert.equal(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), f.markdown);
    } finally { await f.dispose(); }
});
