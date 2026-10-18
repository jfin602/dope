import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { buildPlan } from '../../scripts/codex-phase-core.mjs';
import { composePhaseStackDraft } from '../../packages/agent-core/lib/phase-stack-composer.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';
import { captureSequenceEvidence } from '../../packages/agent-core/lib/node/sequence-reconciliation.js';
import { PlanningBridgeApprovals } from '../../packages/theia-extension/lib/node/planning-bridge-approvals.js';
import { PlanningStackPublication } from '../../packages/theia-extension/lib/node/planning-stack-publication.js';
import type { BridgeOwnerSnapshot } from '../../packages/theia-extension/src/node/planning-bridge-approvals.ts';

const execute = promisify(execFile);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const basis = { architectureRevision: 1, architectureFingerprint: 'architecture', physicalInputFingerprint: 'physical', physicalGeneration: 1 };
async function fixture() {
    const temporary = await mkdtemp(join(tmpdir(), 'dope-publish-'));
    const root = join(temporary, 'project');
    // A local clone supplies an existing HEAD; the fixture creates no commit.
    await execute('git', ['clone', '-q', '--local', '--no-hardlinks', '--no-checkout', process.cwd(), root]);
    await mkdir(join(root, 'docs/tasks'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{"version":"0.11.8"}\n');
    const markdown = '# Roadmap\n\n## Checkpoint\nOriginal objective\n';
    await writeFile(join(root, 'ROADMAP.md'), markdown);
    const source: BridgeOwnerSnapshot = { roadmap: { schemaVersion: 1, projectId: 'roadmap', projectRoot: root,
        revision: 1, checkpoints: [{ id: 'checkpoint', kind: 'milestone', title: 'Checkpoint', objective: 'Original objective',
            order: 1, dependencies: [], links: [{ owner: 'planning-map', targetId: 'map', ownerProjectId: 'planning',
                ownerRevision: 1, basis }], status: 'not-implemented', readOnly: false,
            source: { path: 'ROADMAP.md', sha256: hash(markdown), line: 3, text: '## Checkpoint' }, evidence: [] }],
        linkedDocument: { projectRoot: root, projectId: 'roadmap', path: 'ROADMAP.md', sourceHash: hash(markdown),
            sections: [{ sectionKey: 'checkpoint', checkpointId: 'checkpoint' }],
            lastSynced: { sourceHash: hash(markdown), roadmapRevision: 1 }, syncState: 'synced' } }, basis,
        planning: { projectId: 'planning', collectionRevision: 1, map: { schemaVersion: 1, id: 'map', projectId: 'planning',
            title: 'Map', objective: 'Target', status: 'draft', revision: 1, history: [], basis,
            transformations: [{ id: 'change', kind: 'modify', currentIds: ['component'], futureNodes: [], dependsOn: [] }],
            workItems: [{ id: 'work', title: 'Implement change', objective: 'Implement change',
                transformationIds: ['change'], dependsOn: [], requirements: ['Keep authority'], constraints: ['No Run'],
                acceptanceCriteria: ['Review result'], validationTargets: ['Focused test'], workingSet: ['packages/app/src'], status: 'ready' }] } } };
    const approvals = new PlanningBridgeApprovals(async () => source);
    await approvals.approve(root, (await approvals.preview(root, 'checkpoint', 'scope')).token, true);
    await approvals.approve(root, (await approvals.preview(root, 'checkpoint', 'target')).token, true);
    const draft = await composePhaseStackDraft({ folderName: 'c11-generated', version: '0.11.8', sourceVersion: '0.11.8',
        work: [{ workItem: { id: 'work', title: 'Implement change', objective: 'Implement change', dependsOn: [],
            requirements: ['Keep authority'], constraints: ['No Run'], acceptanceCriteria: ['Review result'],
            validationTargets: ['Focused test'], workingSet: ['packages/app/src'], status: 'ready' },
            tier: 'T2', model: 'GPT-6 Sol High', estimatedMinutes: 7, integrationChecks: ['Check affected system'] }],
        closeout: { title: 'Manual closeout', objective: 'Inspect live behavior', manualReason: 'GUI evidence',
            acceptanceCriteria: ['Observe owner review'], model: 'GPT-6 Sol High', browserRequired: true } });
    const service = new PlanningStackPublication(async () => source);
    return { root, source, draft, service, dispose: () => rm(temporary, { recursive: true, force: true }) };
}

test('preview and explicit publication preserve runner/importer grammar and do not start Work', async () => {
    const f = await fixture();
    try {
        const preview = await f.service.preview(f.root, 'checkpoint', f.draft);
        assert.equal(preview.destinationStatus, 'absent');
        assert.equal(preview.files.length, 3);
        assert.match(preview.files[0].diff, /^\+TASK:/u);
        assert.deepEqual(preview.gates, ['P1: agent-task', 'P2: manual-gate (browser)']);
        await assert.rejects(f.service.publish(f.root, preview.token, false), /Explicit developer/);
        const accepted = await f.service.preview(f.root, 'checkpoint', f.draft);
        const result = await f.service.publish(f.root, accepted.token, true);
        assert.equal(result.status, 'published');
        const sources = await Promise.all(f.draft.files.map(async file =>
            ({ filename: file.filename, text: await readFile(join(f.root, file.path), 'utf8') })));
        assert.equal((await importPhaseStack(f.draft.folderName, sources, f.draft.sourcePath)).fingerprint, preview.stackFingerprint);
        assert.equal(buildPlan(sources, f.draft.folderName).prompts.length, 2);
        const found = (await discoverRoadmapTaskStacks(f.root)).find(item => item.folderName === f.draft.folderName);
        assert.equal(found?.fingerprint, preview.stackFingerprint);
        assert.equal(found?.executable, false);
        await assert.rejects(f.service.publish(f.root, accepted.token, true), /Explicit developer/);
        await assert.rejects(f.service.preview(f.root, 'checkpoint', f.draft), /already exists/);
    } finally { await f.dispose(); }
});

test('cancel, source changes, Git movement and WorkItem edits require a new preview', async () => {
    const f = await fixture();
    try {
        const cancelled = await f.service.preview(f.root, 'checkpoint', f.draft);
        f.service.cancel(cancelled.token);
        await assert.rejects(f.service.publish(f.root, cancelled.token, true), /Explicit developer/);
        const edited = await f.service.preview(f.root, 'checkpoint', f.draft);
        f.source.planning!.map.workItems[0].title = 'Edited';
        await assert.rejects(f.service.publish(f.root, edited.token, true), /changed/);
        f.source.planning!.map.workItems[0].title = 'Implement change';
        const moved = await f.service.preview(f.root, 'checkpoint', f.draft);
        await writeFile(join(f.root, 'other.txt'), 'Git source edit');
        await assert.rejects(f.service.publish(f.root, moved.token, true), /Git or owner source changed/);
        const sourceEdit = await f.service.preview(f.root, 'checkpoint', f.draft);
        await writeFile(join(f.root, 'ROADMAP.md'), 'changed');
        await assert.rejects(f.service.publish(f.root, sourceEdit.token, true), /approvals required|source changed/);
    } finally { await f.dispose(); }
});

test('existing destination and symlink collision reject without changing user bytes', async () => {
    const f = await fixture();
    try {
        const destination = join(f.root, 'docs/tasks/c11-generated');
        await mkdir(destination);
        await writeFile(join(destination, 'user.txt'), 'retain');
        await assert.rejects(f.service.preview(f.root, 'checkpoint', f.draft), /collision/);
        assert.equal(await readFile(join(destination, 'user.txt'), 'utf8'), 'retain');
        await rm(destination, { recursive: true });
        await symlink(join(f.root, 'ROADMAP.md'), destination);
        await assert.rejects(f.service.preview(f.root, 'checkpoint', f.draft), /collision/);
        await rm(destination);
        await symlink(join(f.root, 'ROADMAP.md'), join(f.root, 'docs/tasks/c11-generated'));
        assert.equal(await readFile(join(f.root, 'ROADMAP.md'), 'utf8').then(value => value.startsWith('# Roadmap')), true);
    } finally { await f.dispose(); }
});

test('interrupted journal requires inspection and blocks replay without deleting matching bytes', async () => {
    const f = await fixture();
    try {
        const preview = await f.service.preview(f.root, 'checkpoint', f.draft);
        const metadata = join(f.root, '.dope/planning-bridge-publications');
        await mkdir(metadata);
        await writeFile(join(metadata, 'c11-generated.json'), JSON.stringify({ schemaVersion: 1, revision: 1,
            projectId: 'roadmap', checkpointId: 'checkpoint', folderName: 'c11-generated', draftHash: preview.draftHash,
            sourceHash: preview.sourceHash, ownerHash: preview.ownerHash, gitHead: preview.gitHead,
            packageVersion: preview.packageVersion,
            stackFingerprint: preview.stackFingerprint,
            status: 'publishing', files: preview.files.map(file => ({ path: file.path, hash: file.hash })) }));
        await mkdir(join(f.root, 'docs/tasks/c11-generated'));
        await writeFile(join(f.root, preview.files[0].path), f.draft.files[0].text);
        const inspection = await f.service.inspect(f.root, f.draft.folderName);
        assert.deepEqual(inspection.files.map(file => file.status), ['matching', 'missing', 'missing']);
        await assert.rejects(f.service.confirmRecovered(f.root, f.draft.folderName, false), /Explicit developer/);
        await assert.rejects(f.service.confirmRecovered(f.root, f.draft.folderName, true), /Partial or changed/);
        await assert.rejects(f.service.publish(f.root, preview.token, true), /already exists/);
        await assert.rejects(f.service.preview(f.root, 'checkpoint', f.draft), /already exists/);
        assert.equal(await readFile(join(f.root, preview.files[0].path), 'utf8'), f.draft.files[0].text);
        await writeFile(join(f.root, preview.files[1].path), f.draft.files[1].text);
        await writeFile(join(f.root, preview.files[2].path), f.draft.manifest);
        assert.equal((await f.service.confirmRecovered(f.root, f.draft.folderName, true)).status, 'published');
        await assert.rejects(f.service.confirmRecovered(f.root, f.draft.folderName, true), /Partial or changed/);
    } finally { await f.dispose(); }
});

test('Git HEAD movement, foreign project, traversal, malformed grammar and symlinked task root deny', async () => {
    const f = await fixture(), foreign = await fixture();
    try {
        let moved = false;
        const service = new PlanningStackPublication(async () => f.source, async root => {
            const actual = await captureSequenceEvidence(root);
            return moved ? { ...actual, head: 'a'.repeat(40) } : actual;
        });
        const preview = await service.preview(f.root, 'checkpoint', f.draft);
        moved = true;
        await assert.rejects(service.publish(f.root, preview.token, true), /Git or owner source changed/);
        await assert.rejects(f.service.preview(foreign.root, 'checkpoint', f.draft), /Current Roadmap|foreign|Foreign/u);
        await assert.rejects(f.service.preview(f.root, 'checkpoint',
            { ...f.draft, folderName: '../escape' }), /Unsafe|Invalid/u);
        await assert.rejects(f.service.preview(f.root, 'checkpoint',
            { ...f.draft, files: [{ ...f.draft.files[0], text: 'bad' }, f.draft.files[1]] }), /TASK|Expected/u);
        await rm(join(f.root, 'docs/tasks'), { recursive: true });
        await symlink(join(f.root, '.dope'), join(f.root, 'docs/tasks'));
        await assert.rejects(f.service.preview(f.root, 'checkpoint', f.draft), /Tasks folder/u);
    } finally { await f.dispose(); await foreign.dispose(); }
});
