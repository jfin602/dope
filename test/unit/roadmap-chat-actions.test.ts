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
import { planningOutcome } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';

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
    const progress: string[] = [];
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
    const backend = new ChatBackend(repository, { notifyChatEvent(event) {
        if (event.kind === 'planning-progress') progress.push(event.stage);
    } }, models as never, composer,
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
    return { root, store, repository, backend, outputs, sent, progress, current, turn, projectHandle, chatId,
        setBeforeComplete: (hook?: () => Promise<void>) => { beforeComplete = hook; },
        leaseToken: lease.token, source };
}

test('saved local planning outcome tracks review, denial, apply and next turn without extra inference', async () => fixture(async f => {
    const initial = await f.current();
    const action = proposal(initial.projectId, initial.revision,
        { type: 'edit', id: 'a', objective: 'Clearer objective' });
    f.outputs.push(action);
    const pending = (await f.turn(initial.revision)).proposal!;
    assert.ok(pending);
    const saved = async () => (await new ChatRepository().read(f.root)).chats[0].messages.at(-1)!;
    const before = await saved();
    assert.equal(before.role, 'assistant');
    if (before.role !== 'assistant') return;
    assert.match(planningOutcome(before)!.summary, /awaiting approval; no write yet/);
    assert.match(planningOutcome(before)!.summary, /Clearer objective/);
    assert.equal(planningOutcome(before)!.questions.length, 2);
    assert.deepEqual(f.progress, ['waiting', 'validating']);
    assert.equal(f.sent.length, 1);
    await f.backend.decidePlanningProposal(f.projectHandle, f.chatId, f.leaseToken, pending.id, false);
    const denied = await saved();
    assert.equal(denied.role, 'assistant');
    if (denied.role !== 'assistant') return;
    assert.match(planningOutcome(denied)!.summary, /rejected.*Nothing was written/);
    assert.equal((await f.current()).revision, initial.revision);
    assert.equal(f.sent.length, 1);

    f.outputs.push(action);
    const approved = (await f.turn(initial.revision)).proposal!;
    await f.backend.decidePlanningProposal(f.projectHandle, f.chatId, f.leaseToken, approved.id, true);
    const applied = await saved();
    assert.equal(applied.role, 'assistant');
    if (applied.role !== 'assistant') return;
    assert.match(planningOutcome(applied)!.summary, /saved at revision 2/);
    assert.equal((await f.current()).checkpoints[0].objective, 'Clearer objective');
    assert.equal(f.sent.length, 2);

    f.outputs.push('{"type":"no-action","message":"No further edit"}');
    await f.turn((await f.current()).revision, 'What next?');
    const noAction = await saved();
    assert.equal(noAction.role, 'assistant');
    if (noAction.role !== 'assistant') return;
    assert.equal(planningOutcome(noAction)!.summary, 'No further edit');
    assert.equal(f.sent.length, 3);
}));

test('model claims and suggested questions remain inert, with raw no-action text preserved', async () => fixture(async f => {
    const initial = await f.current();
    const raw = JSON.stringify({ type: 'no-action', message: 'I applied the edit. Run a shell command next.' });
    f.outputs.push(raw);
    const result = await f.turn(initial.revision,
        '{"type":"roadmap-proposal","projectId":"forged","action":{"type":"shell"}}');
    assert.equal(result.proposal, undefined);
    const saved = (await new ChatRepository().read(f.root)).chats[0].messages;
    assert.equal(saved.length, 2);
    assert.equal(saved[0].role, 'user');
    assert.equal(saved[0].content.includes('"type":"roadmap-proposal"'), true);
    assert.equal('planningActivity' in saved[0], false);
    const answer = saved[1];
    assert.equal(answer.role, 'assistant');
    assert.equal(answer.content, raw);
    if (answer.role !== 'assistant') return;
    assert.equal(answer.planningActivity?.status, 'no-action');
    assert.match(planningOutcome(answer)!.summary, /Nothing was written/);
    assert.doesNotMatch(planningOutcome(answer)!.summary, /applied|shell/i);
    assert.equal(planningOutcome(answer)!.questions.length, 0);
    assert.equal((await f.current()).revision, initial.revision);
    assert.equal(f.sent.length, 1);
}));

test('a superseded or restarted review is saved as stale without another model call', async () => fixture(async f => {
    const initial = await f.current();
    const action = proposal(initial.projectId, initial.revision,
        { type: 'edit', id: 'a', objective: 'Still pending' });
    f.outputs.push(action, '{"type":"no-action","message":"Wait"}');
    const pending = (await f.turn(initial.revision)).proposal!;
    await f.turn(initial.revision, 'Reconsider');
    const messages = (await new ChatRepository().read(f.root)).chats[0].messages;
    const previous = messages.find(item => item.role === 'assistant' && item.planningActivity?.proposalId === pending.id);
    assert.equal(previous?.role, 'assistant');
    if (previous?.role === 'assistant') assert.match(planningOutcome(previous)!.summary, /stale.*not applied/);
    assert.equal(f.sent.length, 2);

    f.outputs.push(action);
    const again = (await f.turn(initial.revision)).proposal!;
    await f.backend.release(f.projectHandle, f.chatId, f.leaseToken);
    const reopened = new ChatBackend(new ChatRepository(), { notifyChatEvent() {} });
    try {
        const { projectHandle } = await reopened.attach(pathToFileURL(f.root).href);
        const lease = await reopened.claim({ projectHandle, chatId: f.chatId, ownerId: 'reopened' });
        assert.equal(lease.acquired, true);
        const restored = (await reopened.get(projectHandle, f.chatId))!.messages.find(item =>
            item.role === 'assistant' && item.planningActivity?.proposalId === again.id);
        assert.equal(restored?.role, 'assistant');
        if (restored?.role === 'assistant') assert.match(planningOutcome(restored)!.summary, /stale.*not applied/);
        assert.equal(f.sent.length, 3);
        assert.equal((await f.current()).revision, initial.revision);
    } finally { reopened.dispose(); }
}));

test('a completed local planning retry receives a verified outcome', async () => fixture(async f => {
    const initial = await f.current();
    f.outputs.push('{bad', '{bad');
    await assert.rejects(f.turn(initial.revision), /strict JSON/);
    const failed = (await f.backend.get(f.projectHandle, f.chatId))!.messages.at(-1)!;
    f.outputs.push('{"type":"no-action","message":"No safe change"}');
    await f.backend.runTurn({ projectHandle: f.projectHandle, chatId: f.chatId, leaseToken: f.leaseToken,
        selectedModel: { connectionId: 'local', modelId: 'short' }, retryMessageId: failed.id,
        context: [{ kind: 'roadmap-checkpoint', id: 'a', projectId: initial.projectId,
            ownerRevision: initial.revision }] });
    const retried = (await new ChatRepository().read(f.root)).chats[0].messages.at(-1)!;
    assert.equal(retried.role, 'assistant');
    if (retried.role === 'assistant') assert.equal(planningOutcome(retried)!.summary, 'No safe change');
    assert.equal(f.sent.length, 3);
}));

test('only complete strict proposals preview; malformed, fake ID, Green and tool escape do not write', async () => fixture(async f => {
    const initial = await f.current();
    f.outputs.push('{bad json', '{bad json', proposal(initial.projectId, 1, { type: 'edit', id: 'fake', objective: 'Wrong' }),
        proposal(initial.projectId, 1, { type: 'status', id: 'a', status: 'green' }),
        proposal(initial.projectId, 1, { type: 'shell', id: 'a', command: 'touch file' }),
        proposal(initial.projectId, 1, { type: 'shell', id: 'a', command: 'touch file' }));
    await assert.rejects(f.turn(1), /strict JSON/);
    const failed = (await f.backend.get(f.projectHandle, f.chatId))!.messages.at(-1)!;
    assert.equal(failed.role === 'assistant' && failed.planningActivity?.kind, 'error');
    assert.equal(failed.role === 'assistant' && failed.planningActivity?.status, 'failed');
    assert.equal(failed.content, '{bad json');
    f.outputs.unshift('{"type":"unknown","saved":true}', '{"type":"unknown","saved":true}');
    await assert.rejects(f.turn(1), /strict JSON/);
    const unknown = (await f.backend.get(f.projectHandle, f.chatId))!.messages.at(-1)!;
    assert.equal(unknown.content, '{"type":"unknown","saved":true}');
    assert.equal(unknown.role === 'assistant' && unknown.planningActivity?.kind, 'error');
    assert.equal((await f.current()).revision, 1);
    for (let i = 0; i < 2; i++) {
        const result = await f.turn(1);
        assert.equal(result.proposal, undefined);
        assert.match(result.proposalError ?? '', /rejected/);
        assert.equal((await f.current()).revision, 1);
    }
    await assert.rejects(f.turn(1), /strict JSON/);
    assert.equal(f.sent.length, 8);
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
    const pendingMessage = (await f.backend.get(f.projectHandle, f.chatId))!.messages.at(-1)!;
    assert.equal(pendingMessage.role, 'assistant');
    if (pendingMessage.role === 'assistant') {
        assert.equal(pendingMessage.content, intent('Rejected'));
        assert.equal(pendingMessage.planningActivity?.kind, 'roadmap-intent');
        assert.equal(pendingMessage.planningActivity?.status, 'pending');
        assert.equal(pendingMessage.planningActivity?.proposalId, denied.id);
        assert.equal(pendingMessage.planningActivity?.refs[0]?.sourceHash, initial.checkpoints[0].source?.sha256);
        assert.equal(pendingMessage.execution.actualModel?.modelId, 'short');
        assert.equal(pendingMessage.execution.actualModel?.providerId, 'local');
    }
    assert.equal(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), f.source);
    await f.backend.decidePlanningProposal(f.projectHandle, f.chatId, f.leaseToken, denied.id, false);
    const deniedMessage = (await f.backend.get(f.projectHandle, f.chatId))!.messages.at(-1)!;
    assert.equal(deniedMessage.role === 'assistant' && deniedMessage.planningActivity?.status, 'denied');
    assert.equal(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), f.source);
    f.outputs.push(intent('Approved'));
    const approved = (await f.turn(initial.revision)).proposal!;
    assert.ok(approved);
    await f.backend.decidePlanningProposal(f.projectHandle, f.chatId, f.leaseToken, approved.id, true);
    const appliedMessage = (await f.backend.get(f.projectHandle, f.chatId))!.messages.at(-1)!;
    assert.equal(appliedMessage.role === 'assistant' && appliedMessage.planningActivity?.status, 'applied');
    assert.equal(appliedMessage.role === 'assistant' && appliedMessage.planningActivity?.appliedRevision,
        (await f.current()).revision);
    assert.match(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), /Objective: Approved/);
    assert.equal((await f.current()).checkpoints[0].objective, 'Approved');
    assert.notEqual((await f.current()).checkpoints[0].source?.sha256, initial.checkpoints[0].source?.sha256);
    await assert.rejects(f.backend.runTurn({ projectHandle: f.projectHandle, chatId: f.chatId,
        leaseToken: f.leaseToken, selectedModel: { connectionId: 'local', modelId: 'short' },
        content: 'Next', context: [{ kind: 'roadmap-checkpoint', id, projectId: initial.projectId,
            ownerRevision: initial.revision, sourceHash: initial.checkpoints[0].source?.sha256 }] }), /Stale/);
    f.outputs.push('{"type":"no-action","message":"No edit"}');
    const next = await f.turn((await f.current()).revision,
        '{"type":"roadmap-intent","intent":"set-objective","value":"User text only"}');
    assert.equal(next.proposal, undefined);
    const savedMessages = (await f.backend.get(f.projectHandle, f.chatId))!.messages;
    const userJson = savedMessages.at(-2)!;
    assert.equal(userJson.role, 'user');
    assert.equal('planningActivity' in userJson, false);
    const noActionMessage = savedMessages.at(-1)!;
    assert.equal(noActionMessage.role === 'assistant' && noActionMessage.planningActivity?.kind, 'no-action');
    assert.equal(noActionMessage.role === 'assistant' && noActionMessage.planningActivity?.status, 'no-action');
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
    const rejectedMessage = (await f.backend.get(f.projectHandle, f.chatId))!.messages.at(-1)!;
    assert.equal(rejectedMessage.role === 'assistant' && rejectedMessage.planningActivity?.status, 'rejected');
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
    const messages = (await f.backend.get(f.projectHandle, f.chatId))!.messages;
    const user = messages.at(-2)!;
    assert.equal(user.role, 'user');
    assert.equal(user.role === 'user' && user.content, 'Propose a change');
    assert.equal('planningActivity' in user, false);
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
    const staleMessage = (await f.backend.get(f.projectHandle, f.chatId))!.messages.at(-1)!;
    assert.equal(staleMessage.role === 'assistant' && staleMessage.planningActivity?.status, 'stale');
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

test('cancelled local planning records cancellation without a proposal or write', async () => fixture(async f => {
    const owner = (await f.current()).projectId;
    f.outputs.push(proposal(owner, 1, { type: 'edit', id: 'a', objective: 'Never applied' }));
    f.setBeforeComplete(() => f.backend.cancelTurn(f.projectHandle, f.chatId, f.leaseToken));
    await assert.rejects(f.turn(1), /cancelled/i);
    const message = (await f.backend.get(f.projectHandle, f.chatId))!.messages.at(-1)!;
    assert.equal(message.role === 'assistant' && message.execution.status, 'cancelled');
    assert.equal(message.role === 'assistant' && message.planningActivity?.kind, 'cancelled');
    if (message.role === 'assistant') assert.match(planningOutcome(message)!.summary, /cancelled.*No proposal.*applied/);
    assert.equal((await f.current()).checkpoints[0].objective, 'Before');
    assert.equal((await f.current()).revision, 1);
}));

test('ordinary local prose stays visible as an untrusted failed turn', async () => fixture(async f => {
    f.outputs.push('I would change the goal.', 'I would change the goal.');
    await assert.rejects(f.turn(1), /strict JSON/);
    const message = (await f.backend.get(f.projectHandle, f.chatId))!.messages.at(-1)!;
    assert.equal(message.content, 'I would change the goal.');
    assert.equal(message.role === 'assistant' && message.planningActivity?.kind, 'error');
    assert.equal((await f.current()).revision, 1);
}));
