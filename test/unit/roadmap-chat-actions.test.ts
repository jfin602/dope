import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';

const proposal = (projectId: string, ownerRevision: number, action: unknown) => JSON.stringify({
    type: 'roadmap-proposal', projectId, ownerRevision, action });

async function fixture(run: (f: Awaited<ReturnType<typeof setup>>) => Promise<void>, linked = false,
    sourceOverride?: string) {
    const f = await setup(linked, sourceOverride);
    try { await run(f); } finally { f.backend.dispose(); await rm(f.root, { recursive: true, force: true }); }
}
async function setup(linked = false, sourceOverride?: string) {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-chat-action-'));
    const store = new RoadmapStore();
    const source = sourceOverride ?? '# Roadmap\n\n## Product Phase 1 — A\nStatus: **NOT GREEN**\nObjective: Before\nOrder: 1\nProse: prior\n';
    if (linked) {
        await writeFile(join(root, 'ROADMAP.md'), source);
        await store.acceptImport(root, 0, await previewRoadmapImport(root, 'ROADMAP.md'));
    } else await store.mutate(root, 0, { type: 'create', id: 'a', kind: 'milestone', title: 'A', objective: 'Before', order: 0 });
    const repository = new ChatRepository();
    const composer = new ChatContextComposer({} as never, {} as never, {} as never, repository, store);
    const outputs: string[] = [];
    const sent: string[] = [];
    let beforeComplete: (() => Promise<void>) | undefined;
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'short', label: 'Short', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 4096 } }] }] }),
        async *generate(_selection: unknown, request: { messages: { content: string }[] }) {
            sent.push(request.messages.at(-1)?.content ?? '');
            const text = outputs.shift() ?? 'No action';
            await beforeComplete?.();
            yield { type: 'delta' as const, text: text.slice(0, 8) };
            yield { type: 'complete' as const, text };
        } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer,
        undefined, undefined, new ProjectPlanningActions(store));
    const { projectHandle } = await backend.attach(pathToFileURL(root).href);
    const chatId = randomUUID();
    let state = await backend.mutate({ projectHandle, expectedRevision: 0,
        operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Planning' } });
    const settings = structuredClone(state.chats[0].settings);
    settings.context = { maxInputTokens: 3072, reservedOutputTokens: 512, history: 'none',
        savedChatSearch: false, allowedSources: ['roadmap-checkpoint'] };
    state = await backend.mutate({ projectHandle, expectedRevision: state.revision,
        operation: { type: 'set-settings', chatId, settings } });
    const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
    if (!lease.acquired) throw new Error('Chat lease missing');
    const current = () => store.read(root);
    const turn = async (revision: number, content = 'Propose a change') => backend.runTurn({ projectHandle,
        chatId, leaseToken: lease.token, selectedModel: { connectionId: 'local', modelId: 'short' }, content,
        context: [{ kind: 'roadmap-checkpoint', id: (await current()).checkpoints[0].id,
            projectId: (await current()).projectId, ownerRevision: revision,
            ...(linked ? { sourceHash: (await current()).checkpoints[0].source!.sha256 } : {}) }] });
    return { root, store, repository, backend, outputs, sent, current, turn, projectHandle, chatId,
        setBeforeComplete: (hook?: () => Promise<void>) => { beforeComplete = hook; },
        leaseToken: lease.token, source };
}

test('only complete strict proposals preview; malformed, fake ID, Green and tool escape do not write', async () => fixture(async f => {
    const initial = await f.current();
    f.outputs.push('{bad json', '{bad json', proposal(initial.projectId, 1, { type: 'edit', id: 'fake', objective: 'Wrong' }),
        proposal(initial.projectId, 1, { type: 'status', id: 'a', status: 'green' }),
        proposal(initial.projectId, 1, { type: 'shell', id: 'a', command: 'touch file' }),
        proposal(initial.projectId, 1, { type: 'shell', id: 'a', command: 'touch file' }));
    await assert.rejects(f.turn(1), /strict JSON/);
    for (let i = 0; i < 2; i++) {
        const result = await f.turn(1);
        assert.equal(result.proposal, undefined);
        assert.match(result.proposalError ?? '', /rejected/);
        assert.equal((await f.current()).revision, 1);
    }
    await assert.rejects(f.turn(1), /strict JSON/);
    assert.equal(f.sent.length, 6);
}));

test('linked intent binds checked document edit; mismatch, denial and stale source do not write', async () => fixture(async f => {
    const initial = await f.current();
    const id = initial.checkpoints[0].id;
    const intent = (value: string) => JSON.stringify({ type: 'roadmap-intent', intent: 'set-objective', value });
    f.outputs.push(proposal(initial.projectId, initial.revision, { type: 'edit', id, objective: 'Wrong' }),
        proposal(initial.projectId, initial.revision, { type: 'edit', id, objective: 'Wrong' }));
    await assert.rejects(f.turn(initial.revision), /strict JSON/);
    f.outputs.push(intent('Rejected'));
    const denied = (await f.turn(initial.revision)).proposal!;
    assert.ok(denied);
    assert.match(denied.summary, /documentDiff/);
    assert.equal(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), f.source);
    await f.backend.decidePlanningProposal(f.projectHandle, f.chatId, f.leaseToken, denied.id, false);
    assert.equal(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), f.source);
    f.outputs.push(intent('Approved'));
    const approved = (await f.turn(initial.revision)).proposal!;
    assert.ok(approved);
    await f.backend.decidePlanningProposal(f.projectHandle, f.chatId, f.leaseToken, approved.id, true);
    assert.match(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), /Objective: Approved/);
    assert.equal((await f.current()).checkpoints[0].objective, 'Approved');
    assert.notEqual((await f.current()).checkpoints[0].source?.sha256, initial.checkpoints[0].source?.sha256);
    await assert.rejects(f.backend.runTurn({ projectHandle: f.projectHandle, chatId: f.chatId,
        leaseToken: f.leaseToken, selectedModel: { connectionId: 'local', modelId: 'short' },
        content: 'Next', context: [{ kind: 'roadmap-checkpoint', id, projectId: initial.projectId,
            ownerRevision: initial.revision, sourceHash: initial.checkpoints[0].source?.sha256 }] }), /Stale/);
    f.outputs.push('{"type":"no-action","message":"No edit"}');
    const next = await f.turn((await f.current()).revision);
    assert.equal(next.proposal, undefined);
    assert.match(f.sent.at(-1) ?? '', /Approved/);
    assert.match(f.sent.at(-1) ?? '', new RegExp((await f.current()).checkpoints[0].source!.sha256));
    assert.equal((await f.current()).checkpoints[0].id, id);
}, true));

test('a linked source changed during inference rejects the in-flight intent', async () => fixture(async f => {
    const initial = await f.current();
    f.outputs.push('{"type":"roadmap-intent","intent":"set-objective","value":"Model edit"}');
    f.setBeforeComplete(async () => { await writeFile(join(f.root, 'ROADMAP.md'), f.source.replace('Before', 'External edit')); });
    const result = await f.turn(initial.revision);
    assert.equal(result.proposal, undefined);
    assert.match(result.proposalError ?? '', /Stale|source|hash/i);
    assert.match(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), /External edit/);
    assert.equal((await f.current()).revision, initial.revision);
}, true));

test('narrative linked section without Objective is visibly ineligible and cannot produce an edit', async () => fixture(async f => {
    const initial = await f.current();
    const intent = '{"type":"roadmap-intent","intent":"set-objective","value":"Not mapped"}';
    f.outputs.push(intent, intent);
    await assert.rejects(f.turn(initial.revision), /strict JSON/);
    assert.match(f.sent.at(-1) ?? '', /"editable":false/);
    assert.equal((await f.current()).revision, initial.revision);
    assert.equal(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), f.source);
    f.outputs.push('{"type":"no-action","message":"Objective is read-only"}');
    assert.equal((await f.turn(initial.revision)).proposal, undefined);
}, true, '# Roadmap\n\n## Product Phase 1 — A\nStatus: **NOT GREEN**\nNarrative goal without a mapped label.\n'));

test('developer rejects or approves one completed proposal; stale manual race rejects and next turn refreshes', async () => fixture(async f => {
    const owner = (await f.current()).projectId;
    f.outputs.push(proposal(owner, 1, { type: 'edit', id: 'a', objective: 'Rejected' }));
    const rejected = (await f.turn(1)).proposal;
    assert.ok(rejected);
    assert.equal((await f.current()).revision, 1);
    await f.backend.decidePlanningProposal(f.projectHandle, f.chatId, f.leaseToken, rejected.id, false);
    assert.equal((await f.current()).checkpoints[0].objective, 'Before');
    await assert.rejects(f.backend.decidePlanningProposal(f.projectHandle, f.chatId, f.leaseToken, rejected.id, true), /unavailable/);

    f.outputs.push(proposal(owner, 1, { type: 'edit', id: 'a', objective: 'Model stale' }));
    const stale = (await f.turn(1)).proposal;
    assert.ok(stale);
    await f.store.mutate(f.root, 1, { type: 'update', id: 'a', title: 'A', objective: 'Human edit',
        order: 0, dependencies: [], links: [] }, owner);
    await assert.rejects(f.backend.decidePlanningProposal(f.projectHandle, f.chatId, f.leaseToken, stale.id, true), /Stale/);
    assert.equal((await f.current()).checkpoints[0].objective, 'Human edit');
    await assert.rejects(f.turn(1), /Stale or foreign Roadmap context/);

    f.outputs.push(proposal(owner, 2, { type: 'edit', id: 'a', objective: 'Approved' }));
    const approved = (await f.turn(2)).proposal;
    assert.ok(approved);
    assert.match(f.sent.at(-1) ?? '', /Human edit/);
    const changed = await f.backend.decidePlanningProposal(f.projectHandle, f.chatId, f.leaseToken, approved.id, true);
    assert.deepEqual(changed?.changedIds, ['a']);
    assert.equal(changed?.revision, 3);
    assert.equal((await f.current()).checkpoints[0].objective, 'Approved');
    f.outputs.push('{"type":"no-action","message":"No proposal"}');
    await f.turn(3);
    assert.match(f.sent.at(-1) ?? '', /Approved/);
}));

test('failed stream never yields an actionable proposal', async () => fixture(async f => {
    const owner = (await f.current()).projectId;
    const text = proposal(owner, 1, { type: 'edit', id: 'a', objective: 'No completion' });
    // A completed response is required; a transport that only streams a delta fails the turn.
    const broken = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'short', label: 'Short', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 4096 } }] }] }),
        async *generate() { yield { type: 'delta' as const, text }; } };
    const backend = new ChatBackend(f.repository, { notifyChatEvent() {} }, broken as never,
        new ChatContextComposer({} as never, {} as never, {} as never, f.repository, f.store),
        undefined, undefined, new ProjectPlanningActions(f.store));
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(f.root).href);
        const lease = await backend.claim({ projectHandle, chatId: f.chatId, ownerId: 'other' });
        assert.equal(lease.acquired, false);
        await f.backend.release(f.projectHandle, f.chatId, f.leaseToken);
        const owned = await backend.claim({ projectHandle, chatId: f.chatId, ownerId: 'other' });
        assert.equal(owned.acquired, true);
        if (!owned.acquired) return;
        await assert.rejects(backend.runTurn({ projectHandle, chatId: f.chatId, leaseToken: owned.token,
            selectedModel: { connectionId: 'local', modelId: 'short' }, content: 'Change',
            context: [{ kind: 'roadmap-checkpoint', id: 'a', projectId: owner, ownerRevision: 1 }] }),
        /without completion/);
        assert.equal((await f.current()).revision, 1);
        await assert.rejects(backend.decidePlanningProposal(projectHandle, f.chatId, owned.token, 'fake', true), /unavailable/);
    } finally { backend.dispose(); }
}));
