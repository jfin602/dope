import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';

const proposal = (projectId: string, ownerRevision: number, action: unknown) => JSON.stringify({
    type: 'roadmap-proposal', projectId, ownerRevision, action });

async function fixture(run: (f: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
    const f = await setup();
    try { await run(f); } finally { f.backend.dispose(); await rm(f.root, { recursive: true, force: true }); }
}
async function setup() {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-chat-action-'));
    const store = new RoadmapStore();
    await store.mutate(root, 0, { type: 'create', id: 'a', kind: 'milestone', title: 'A', objective: 'Before', order: 0 });
    const repository = new ChatRepository();
    const composer = new ChatContextComposer({} as never, {} as never, {} as never, repository, store);
    const outputs: string[] = [];
    const sent: string[] = [];
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'short', label: 'Short', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 4096 } }] }] }),
        async *generate(_selection: unknown, request: { messages: { content: string }[] }) {
            sent.push(request.messages.at(-1)?.content ?? '');
            const text = outputs.shift() ?? 'No action';
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
        context: [{ kind: 'roadmap-checkpoint', id: 'a', projectId: (await current()).projectId,
            ownerRevision: revision }] });
    return { root, store, repository, backend, outputs, sent, current, turn, projectHandle, chatId, leaseToken: lease.token };
}

test('only complete strict proposals preview; malformed, fake ID, Green and tool escape do not write', async () => fixture(async f => {
    const initial = await f.current();
    f.outputs.push('{bad json', proposal(initial.projectId, 1, { type: 'edit', id: 'fake', objective: 'Wrong' }),
        proposal(initial.projectId, 1, { type: 'status', id: 'a', status: 'green' }),
        proposal(initial.projectId, 1, { type: 'shell', id: 'a', command: 'touch file' }));
    for (let i = 0; i < 4; i++) {
        const result = await f.turn(1);
        assert.equal(result.proposal, undefined);
        assert.match(result.proposalError ?? '', /rejected/);
        assert.equal((await f.current()).revision, 1);
    }
    assert.equal(f.sent.length, 4);
}));

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
    f.outputs.push('No proposal');
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
