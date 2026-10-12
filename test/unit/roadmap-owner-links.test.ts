import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { RoadmapOwnerLinks } from '../../packages/project-intelligence/lib/node/roadmap-owner-links.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';

const issueText = '# Known Issues\n\n## Open Issues\n\n### UBGG — 2026-10-02 — First issue\n\n- **Status:** Open\n- Detail one\n\n## Resolved Issues\n';
const now = '2026-10-12T12:00:00.000Z';
const idea = (id = randomUUID()) => ({ schemaVersion: 2 as const, id, type: 'idea' as const,
    title: 'Original idea', body: 'Owner body', status: 'captured' as const, provenance: 'developer' as const,
    createdAt: now, updatedAt: now, archivedAt: null, links: [] });
const fixture = async (run: (root: string, mind: ProjectMindStore, roadmap: RoadmapStore,
    actions: ProjectPlanningActions) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-owner-links-'));
    const mind = new ProjectMindStore(), roadmap = new RoadmapStore();
    const actions = new ProjectPlanningActions(roadmap);
    try {
        await writeFile(join(root, 'known-issues.md'), issueText);
        await mind.mutate(root, 0, { type: 'create', artifact: idea() });
        await roadmap.mutate(root, 0, { type: 'create', id: 'phase', kind: 'phase', title: 'Phase', objective: '', order: 0 });
        await run(root, mind, roadmap, actions);
    } finally { await rm(root, { recursive: true, force: true }); }
};

test('detached original owners promote by link only, duplicate refs fail, and unlink restores detached records', async () => fixture(async (root, _mind, roadmap, actions) => {
    const { projectHandle, snapshot } = await actions.attach(root);
    const detached = await actions.readDetached(projectHandle, snapshot.projectId);
    assert.deepEqual(detached.map(item => item.owner), ['project-mind', 'issue']);
    const originalMind = await readFile(join(root, '.dope/project-mind.json'));
    const originalIssues = await readFile(join(root, 'known-issues.md'));
    const links = detached.map(item => item.owner === 'project-mind'
        ? { owner: item.owner, targetId: item.targetId, ownerRevision: item.ownerRevision }
        : { owner: item.owner, targetId: item.targetId, sourceHash: item.sourceHash });
    const request = { projectHandle, ownerId: snapshot.projectId, expectedRevision: snapshot.revision,
        actions: links.map(link => ({ type: 'link' as const, id: 'phase', link })) };
    const preview = await actions.preview(request);
    assert.deepEqual((await actions.readDetached(projectHandle, snapshot.projectId)).map(item => item.targetId), detached.map(item => item.targetId));
    const applied = await actions.apply(request, preview.token);
    assert.deepEqual(applied.checkpoints[0].links, links);
    assert.deepEqual(await actions.readDetached(projectHandle, snapshot.projectId), []);
    assert.deepEqual(await readFile(join(root, '.dope/project-mind.json')), originalMind);
    assert.deepEqual(await readFile(join(root, 'known-issues.md')), originalIssues);
    assert.equal((await actions.readOwner(projectHandle, snapshot.projectId, links[0]))?.title, 'Original idea');
    assert.equal((await actions.readOwner(projectHandle, snapshot.projectId, links[1]))?.readOnly, true);
    await assert.rejects(actions.preview({ ...request, expectedRevision: applied.revision,
        actions: [{ type: 'link', id: 'phase', link: links[0] }] }), /Foreign or unresolved/);
    const remove = { ...request, expectedRevision: applied.revision, actions: [{ type: 'unlink' as const, id: 'phase', link: links[0] }] };
    const removal = await actions.preview(remove);
    await actions.apply(remove, removal.token, true);
    assert.deepEqual((await actions.readDetached(projectHandle, snapshot.projectId)).map(item => item.targetId), [links[0].targetId]);
    assert.equal((await roadmap.read(root)).checkpoints[0].links.length, 1);
}));

test('changed owners, foreign IDs, unsupported Markdown and wrong handles fail closed', async () => fixture(async (root, mind, roadmap, actions) => {
    const { projectHandle, snapshot } = await actions.attach(root);
    const records = await actions.readDetached(projectHandle, snapshot.projectId);
    const mindLink = { owner: 'project-mind' as const, targetId: records[0].targetId, ownerRevision: 1 };
    const issue = records[1];
    assert.equal(issue.owner, 'issue');
    if (issue.owner !== 'issue') throw new Error('Expected issue');
    const issueLink = { owner: 'issue' as const, targetId: issue.targetId, sourceHash: issue.sourceHash };
    const request = (link: typeof mindLink | typeof issueLink, expectedRevision = 1) => ({ projectHandle,
        ownerId: snapshot.projectId, expectedRevision, actions: [{ type: 'link' as const, id: 'phase', link }] });
    await assert.rejects(actions.preview(request({ ...mindLink, targetId: randomUUID() })), /Foreign or unresolved/);
    await assert.rejects(actions.preview(request({ ...issueLink, targetId: 'K7MX' })), /Foreign or unresolved/);
    await assert.rejects(actions.preview({ ...request(mindLink), projectHandle: 'foreign' }), /Foreign/);
    const mindPreview = await actions.preview(request(mindLink));
    await mind.mutate(root, 1, { type: 'transition', artifactId: mindLink.targetId, status: 'parked' });
    await assert.rejects(actions.apply(request(mindLink), mindPreview.token), /Foreign or unresolved/);
    await assert.rejects(actions.preview(request(mindLink)), /Foreign or unresolved/);
    assert.equal(await actions.readOwner(projectHandle, snapshot.projectId, mindLink), undefined);
    const proposal = await actions.preview(request(issueLink));
    await writeFile(join(root, 'known-issues.md'), issueText.replace('Detail one', 'Detail changed'));
    await assert.rejects(actions.apply(request(issueLink), proposal.token), /Foreign or unresolved/);
    assert.equal(await actions.readOwner(projectHandle, snapshot.projectId, issueLink), undefined);
    await writeFile(join(root, 'known-issues.md'), '# Unknown Markdown\n### UBGG — unsupported\n');
    assert.deepEqual((await new RoadmapOwnerLinks().list(root)).filter(item => item.owner === 'issue'), []);
    await assert.rejects(actions.preview(request(issueLink)), /Foreign or unresolved/);
    assert.equal((await roadmap.read(root)).revision, 1);
}));

test('duplicate issue headings are refused without writing either owner', async () => fixture(async (root, _mind, _roadmap, actions) => {
    const { projectHandle, snapshot } = await actions.attach(root);
    await writeFile(join(root, 'known-issues.md'), issueText.replace('## Resolved Issues',
        '### UBGG — 2026-10-03 — Duplicate\n- **Status:** Open\n\n## Resolved Issues'));
    await assert.rejects(actions.readDetached(projectHandle, snapshot.projectId), /duplicate issue heading/);
}));

test('Question and Decision references resolve from Project Mind but stay outside detached Idea pool', async () => fixture(async (root, mind, _roadmap, actions) => {
    const before = await mind.read(root);
    assert.ok(before);
    const base = { ...idea(), id: randomUUID(), title: 'Question', type: 'question' as const,
        status: 'open' as const };
    const question = await mind.mutate(root, before.revision, { type: 'create', artifact: base }, before.projectId);
    const decision = { schemaVersion: 2 as const, id: randomUUID(), title: 'Decision', type: 'decision' as const,
        provenance: 'developer' as const, createdAt: now, updatedAt: now, archivedAt: null, links: [],
        status: 'proposed' as const, decision: 'Choice', context: 'Context', rationale: 'Reason',
        consequences: '', alternatives: '', revisitConditions: '' };
    const current = await mind.mutate(root, question.revision, { type: 'create', artifact: decision }, question.projectId);
    const { projectHandle, snapshot } = await actions.attach(root);
    assert.equal((await actions.readDetached(projectHandle, snapshot.projectId)).length, 2);
    for (const artifact of [base, decision]) {
        const link = { owner: 'project-mind' as const, targetId: artifact.id, ownerRevision: current.revision };
        const request = { projectHandle, ownerId: snapshot.projectId,
            expectedRevision: (await _roadmap.read(root)).revision,
            actions: [{ type: 'link' as const, id: 'phase', link }] };
        await actions.apply(request, (await actions.preview(request)).token);
        assert.equal((await actions.readOwner(projectHandle, snapshot.projectId, link))?.title, artifact.title);
    }
    assert.equal((await actions.readDetached(projectHandle, snapshot.projectId)).length, 2);
}));
