import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { RoadmapOwnerLinks } from '../../packages/project-intelligence/lib/node/roadmap-owner-links.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { projectRoadmap } from '../../packages/project-intelligence/lib/roadmap-projection.js';

const issueText = '# Known Issues\n\n## Open Issues\n\n### UBGG — 2026-10-02 — Original issue\n\n- **Status:** Open\n- Original body\n';
const now = '2026-10-12T12:00:00.000Z';
const fixture = async (run: (root: string, mind: ProjectMindStore, roadmap: RoadmapStore,
    actions: ProjectPlanningActions) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-pools-'));
    const mind = new ProjectMindStore(), roadmap = new RoadmapStore();
    try {
        await writeFile(join(root, 'known-issues.md'), issueText);
        await mind.mutate(root, 0, { type: 'create', artifact: { schemaVersion: 2, id: randomUUID(), type: 'idea',
            title: 'Original idea', body: 'Original body', status: 'captured', provenance: 'developer',
            createdAt: now, updatedAt: now, archivedAt: null, links: [] } });
        await roadmap.mutate(root, 0, { type: 'create', id: 'phase', kind: 'phase', title: 'Phase', objective: '', order: 0 });
        await run(root, mind, roadmap, new ProjectPlanningActions(roadmap));
    } finally { await rm(root, { recursive: true, force: true }); }
};

test('detached pools link, reject duplicates, unlink, and retain exact original bytes', async () => fixture(async (root, _mind, roadmap, actions) => {
    const { projectHandle, snapshot } = await actions.attach(root);
    const originals = [await readFile(join(root, '.dope/project-mind.json')), await readFile(join(root, 'known-issues.md'))];
    const owners = await new RoadmapOwnerLinks().list(root);
    const initial = projectRoadmap(snapshot, owners);
    assert.deepEqual(initial.pools.ideas.map(item => [item.title, item.status, item.provenance]), [['Original idea', 'captured', 'developer']]);
    assert.deepEqual(initial.pools.issues.map(item => [item.title, item.status, item.provenance]), [['Original issue', 'Open', 'known-issues.md']]);
    let current = snapshot;
    for (const owner of owners) {
        const link = owner.owner === 'issue' ? { owner: owner.owner, targetId: owner.targetId, sourceHash: owner.sourceHash } :
            { owner: owner.owner, targetId: owner.targetId, ownerRevision: owner.ownerRevision };
        const request = { projectHandle, ownerId: snapshot.projectId, expectedRevision: current.revision,
            actions: [{ type: 'link' as const, id: 'phase', link }] };
        const preview = await actions.preview(request);
        current = await actions.apply(request, preview.token);
        await assert.rejects(actions.preview({ ...request, expectedRevision: current.revision }), /Foreign or unresolved/);
    }
    assert.equal(projectRoadmap(current, owners).pools.ideas.length + projectRoadmap(current, owners).pools.issues.length, 0);
    assert.deepEqual([await readFile(join(root, '.dope/project-mind.json')), await readFile(join(root, 'known-issues.md'))], originals);
    const request = { projectHandle, ownerId: snapshot.projectId, expectedRevision: current.revision,
        actions: [{ type: 'unlink' as const, id: 'phase', link: current.checkpoints[0].links[0] }] };
    const preview = await actions.preview(request);
    assert.equal(preview.requiresApproval, true);
    await assert.rejects(actions.apply(request, preview.token), /approval required/);
    current = await actions.apply(request, preview.token, true);
    assert.equal(projectRoadmap(current, owners).pools.ideas.length, 1);
    assert.deepEqual([await readFile(join(root, '.dope/project-mind.json')), await readFile(join(root, 'known-issues.md'))], originals);
    assert.equal((await roadmap.read(root)).revision, current.revision);
}));

test('stale owner and foreign project cannot promote or erase original records', async () => fixture(async (root, mind, roadmap, actions) => {
    const { projectHandle, snapshot } = await actions.attach(root);
    const owner = (await new RoadmapOwnerLinks().list(root)).find(item => item.owner === 'project-mind');
    assert.ok(owner && owner.owner === 'project-mind');
    const link = { owner: owner.owner, targetId: owner.targetId, ownerRevision: owner.ownerRevision };
    const request = { projectHandle, ownerId: snapshot.projectId, expectedRevision: snapshot.revision,
        actions: [{ type: 'link' as const, id: 'phase', link }] };
    const preview = await actions.preview(request);
    await mind.mutate(root, owner.ownerRevision, { type: 'transition', artifactId: owner.targetId, status: 'parked' });
    await assert.rejects(actions.apply(request, preview.token), /Foreign or unresolved/);
    await assert.rejects(actions.preview({ ...request, ownerId: 'foreign' }), /Foreign/);
    assert.equal((await roadmap.read(root)).checkpoints[0].links.length, 0);
    const changed = projectRoadmap(snapshot, await new RoadmapOwnerLinks().list(root));
    assert.equal(changed.pools.ideas[0].status, 'parked');
}));

test('pool controls expose native keyboard actions, labels, filter, and recovery', () => {
    const widget = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/roadmap-canvas-widget.ts'), 'utf8');
    const css = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/dope.css'), 'utf8');
    assert.match(widget, /poolFilter\.type = 'search'/);
    assert.match(widget, /aria-label', 'Filter Ideas and Issues'/);
    assert.match(widget, /aria-label', `Promote or link \$\{record\.title\} to selected checkpoint`/);
    assert.match(widget, /aria-label', `Unlink \$\{record\?\.title/);
    assert.match(widget, /link\.type = 'button'/);
    assert.match(widget, /unlink\.type = 'button'/);
    assert.match(widget, /service\.preview\(request\)/);
    assert.match(widget, /service\.apply\(request, preview\.token/);
    assert.match(widget, /Refresh and retry/);
    assert.match(css, /\.dope-roadmap-pools :is\(input, button\):focus-visible/);
    assert.doesNotMatch(widget, /innerHTML|openChatPanel|ChatPanelWidget/);
});

test('project handles and owner pools remain scoped to their root', async () => {
    const first = await mkdtemp(join(tmpdir(), 'dope-pool-first-'));
    const second = await mkdtemp(join(tmpdir(), 'dope-pool-second-'));
    try {
        await writeFile(join(first, 'known-issues.md'), issueText);
        await writeFile(join(second, 'known-issues.md'), issueText.replace('UBGG', 'ABCD').replace('Original issue', 'Other project issue'));
        const store = new RoadmapStore();
        await store.mutate(first, 0, { type: 'create', id: 'first', kind: 'phase', title: 'First', objective: '', order: 0 });
        await store.mutate(second, 0, { type: 'create', id: 'second', kind: 'phase', title: 'Second', objective: '', order: 0 });
        const actions = new ProjectPlanningActions(store);
        const attached = await actions.attach(first);
        const foreign = (await new RoadmapOwnerLinks().list(second))[0];
        assert.ok(foreign && foreign.owner === 'issue');
        const request = { projectHandle: attached.projectHandle, ownerId: attached.snapshot.projectId,
            expectedRevision: attached.snapshot.revision,
            actions: [{ type: 'link' as const, id: 'first', link: { owner: 'issue' as const,
                targetId: foreign.targetId, sourceHash: foreign.sourceHash } }] };
        await assert.rejects(actions.preview(request), /Foreign or unresolved/);
        assert.deepEqual(projectRoadmap(attached.snapshot, await new RoadmapOwnerLinks().list(first)).pools.issues.map(item => item.title), ['Original issue']);
        assert.deepEqual(projectRoadmap(await store.read(second), await new RoadmapOwnerLinks().list(second)).pools.issues.map(item => item.title), ['Other project issue']);
    } finally { await rm(first, { recursive: true, force: true }); await rm(second, { recursive: true, force: true }); }
});
