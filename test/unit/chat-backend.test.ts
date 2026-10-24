import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { planningOutcome } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import type { ChatEvent } from '../../packages/chat/lib/service.js';

const folder = () => mkdtemp(join(tmpdir(), 'dope-chat-backend-'));
const id = () => randomUUID();

test('dedicated Chat connections share project changes without crossing projects', async () => {
    const first = await folder(), second = await folder(), repository = new ChatRepository();
    const eventsA: ChatEvent[] = [], eventsB: ChatEvent[] = [], eventsOther: ChatEvent[] = [];
    const a = new ChatBackend(repository, { notifyChatEvent: event => eventsA.push(event) });
    const b = new ChatBackend(repository, { notifyChatEvent: event => eventsB.push(event) });
    const other = new ChatBackend(repository, { notifyChatEvent: event => eventsOther.push(event) });
    try {
        const attachedA = await a.attach(pathToFileURL(first).href);
        const attachedB = await b.attach(pathToFileURL(first).href);
        const attachedOther = await other.attach(pathToFileURL(second).href);
        assert.notEqual(attachedA.projectHandle, attachedB.projectHandle);
        const chatId = id();
        let state = await a.mutate({ projectHandle: attachedA.projectHandle, expectedRevision: 0,
            operation: { type: 'create-folder', path: 'Notes' } });
        state = await a.mutate({ projectHandle: attachedA.projectHandle, expectedRevision: state.revision,
            operation: { type: 'create-chat', id: chatId, folderPath: 'Notes' } });
        assert.equal((await b.list(attachedB.projectHandle))[0].id, chatId);
        assert.equal((await b.get(attachedB.projectHandle, chatId))?.folderPath, 'Notes');
        assert.deepEqual((await other.read(attachedOther.projectHandle)).chats, []);
        assert.deepEqual(eventsA.map(event => event.revision), [1, 2]);
        assert.deepEqual(eventsB.map(event => event.revision), [1, 2]);
        assert.ok(eventsB.every(event => event.projectHandle === attachedB.projectHandle));
        assert.deepEqual(eventsOther, []);
        await assert.rejects(a.attach(pathToFileURL(second).href), /different Chat project/);
        assert.throws(() => b.mutate({ projectHandle: attachedA.projectHandle, expectedRevision: 2,
            operation: { type: 'rename-chat', chatId, title: 'wrong project' } }), /handle/);
        await assert.rejects(b.mutate({ projectHandle: attachedB.projectHandle, expectedRevision: 1,
            operation: { type: 'rename-chat', chatId, title: 'stale' } }), /Stale Chat revision/);
        state = await b.mutate({ projectHandle: attachedB.projectHandle, expectedRevision: 2,
            operation: { type: 'rename-chat', chatId, title: 'Ready' } });
        assert.equal(state.chats[0].title, 'Ready');
        b.dispose();
        assert.throws(() => b.mutate({ projectHandle: attachedB.projectHandle, expectedRevision: 3,
            operation: { type: 'rename-chat', chatId, title: 'late' } }), /disposed Chat handle/);
        await a.mutate({ projectHandle: attachedA.projectHandle, expectedRevision: 3,
            operation: { type: 'move-chat', chatId, folderPath: '' } });
        assert.equal(eventsB.length, 3);
    } finally {
        a.dispose(); b.dispose(); other.dispose();
        await rm(first, { recursive: true, force: true }); await rm(second, { recursive: true, force: true });
    }
});

test('ownership gates turn writes and transient deltas; search reads saved Chat', async () => {
    const root = await folder(), repository = new ChatRepository(), events: ChatEvent[] = [];
    const service = new ChatBackend(repository, { notifyChatEvent: event => events.push(event) });
    try {
        const { projectHandle } = await service.attach(pathToFileURL(root).href);
        const chatId = id(), userId = id(), assistantId = id(), executionId = id();
        let state = await service.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        await assert.rejects(service.mutate({ projectHandle, expectedRevision: 1,
            operation: { type: 'append-user', chatId, message: { schemaVersion: 1, id: userId, role: 'user',
                createdAt: state.chats[0].createdAt, content: 'Find this saved conversation', contextRefs: [] } } }), /lease required/);
        const claim = await service.claim({ projectHandle, chatId, ownerId: 'panel-a' });
        assert.equal(claim.acquired, true);
        if (!claim.acquired) throw new Error('Expected ownership');
        const denied = await service.claim({ projectHandle, chatId, ownerId: 'panel-b' });
        assert.equal(denied.acquired, false);
        if (denied.acquired) throw new Error('Expected denied lease');
        assert.equal(denied.ownerId, 'panel-a');
        assert.ok(denied.retryAfterMs > 0 && denied.retryAfterMs <= 60_010);
        state = await service.mutate({ projectHandle, expectedRevision: state.revision, leaseToken: claim.token,
            operation: { type: 'append-user', chatId, message: { schemaVersion: 1, id: userId, role: 'user',
                createdAt: state.chats[0].createdAt, content: 'Find this saved conversation', contextRefs: [] } } });
        state = await service.mutate({ projectHandle, expectedRevision: state.revision, leaseToken: claim.token,
            operation: { type: 'begin-assistant', chatId, message: { schemaVersion: 1, id: assistantId,
                role: 'assistant', createdAt: state.chats[0].updatedAt, content: '', execution: {
                    schemaVersion: 1, id: executionId, status: 'pending', selectedModel: {
                        connectionId: 'local', modelId: 'model' }, startedAt: state.chats[0].updatedAt } } } });
        const provenance = { schemaVersion: 1 as const, connectionId: 'local', modelId: 'model',
            providerId: 'example', modelLabel: 'Model' };
        state = await service.mutate({ projectHandle, expectedRevision: state.revision, leaseToken: claim.token,
            operation: { type: 'start-assistant', chatId, messageId: assistantId, actualModel: provenance } });
        await assert.rejects(service.publishDelta({ projectHandle, chatId, messageId: assistantId,
            executionId, sequence: 0, delta: 'wrong', leaseToken: 'wrong' }), /lease required/);
        await service.publishDelta({ projectHandle, chatId, messageId: assistantId,
            executionId, sequence: 0, delta: 'streamed', leaseToken: claim.token });
        assert.equal(events.at(-1)?.kind, 'assistant-delta');
        assert.equal((await service.read(projectHandle)).chats[0].messages[1].content, '');
        state = await service.mutate({ projectHandle, expectedRevision: state.revision, leaseToken: claim.token,
            operation: { type: 'finish-assistant', chatId, messageId: assistantId, outcome: 'complete',
                content: 'Complete answer', actualModel: provenance } });
        assert.equal(state.chats[0].messages[1].content, 'Complete answer');
        assert.equal(state.chats[0].messages[1].role === 'assistant' ?
            planningOutcome(state.chats[0].messages[1]) : undefined, undefined);
        await assert.rejects(service.publishDelta({ projectHandle, chatId, messageId: assistantId,
            executionId, sequence: 1, delta: 'late', leaseToken: claim.token }), /not streaming/);
        assert.equal((await service.search({ projectHandle, query: 'saved', limit: 2 }))[0].chatId, chatId);
        await service.release(projectHandle, chatId, claim.token);
        assert.equal(events.at(-1)?.kind, 'lease-changed');
        await assert.rejects(service.publishDelta({ projectHandle, chatId, messageId: assistantId,
            executionId, sequence: 1, delta: 'late', leaseToken: claim.token }), /lease required/);
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('plan investigation rejects unmeasured local capacity before model inference', async () => {
    const root = await folder(), repository = new ChatRepository();
    let generated = false;
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'small', usable: true, capabilities: { conversationalText: true, streaming: true,
            contextWindowTokens: 1024 } }] }] }), async *generate() { generated = true; yield { type: 'complete', text: '{}' }; } };
    const greenfield = { ensureRestored: async () => {}, chatDraft: () => undefined,
        chatImplementationPlan: () => ({ handle: 'plan', planOnly: true }) };
    const grounder = { investigateIdea: async () => ({ blocks: [], diagnostics: [] }) };
    const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
        {} as never, undefined, grounder as never, undefined, greenfield as never);
    try {
        const { projectHandle } = await service.attach(pathToFileURL(root).href);
        const chatId = id();
        await service.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        await assert.rejects(service.previewContext({ projectHandle, chatId,
            selectedModel: { connectionId: 'local', modelId: 'small' }, content: 'Plan a change', context: [] }),
        /context is too small|capacity/);
        assert.equal(generated, false);
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('short idea previews a complete noncanonical plan on first local outcome, then requires approval', async () => {
    const root = await folder(), repository = new ChatRepository(), store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
    let plan = JSON.stringify({ type: 'implementation-plan', objective: 'Visual Git history',
        successCriteria: ['Checkout and commits work from the history view'], constraints: ['Explicit permissions'],
        assumptions: ['Diff editor integration needs confirmation'], steps: [
            { title: 'Inspect Git and diff seams', detail: 'Read the current history and diff owners',
                deliverables: ['Source map'], dependsOn: [], reuse: [] },
            { title: 'Build history view', detail: 'Show commits and reuse the diff editor',
                deliverables: ['History panel'], dependsOn: [1], reuse: [] },
            { title: 'Add guarded checkout', detail: 'Preview branch changes and require confirmation',
                deliverables: ['Checkout control'], dependsOn: [2], reuse: [] }],
        tests: ['Unit history navigation'], guiQualification: 'Exercise checkout and diff in browser',
        risks: ['Stale branch; refresh before checkout'], alternatives: ['Start with read-only history'], question: '' });
    let calls = 0, reportedModel = 'q4';
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'q4', label: 'Fixture', usable: true, capabilities: { conversationalText: true,
            streaming: true, contextWindowTokens: 8192 } }] },
        { id: 'hosted', ready: true, providerId: 'gemini', models: [{ id: 'remote', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 8192 } }] }] }),
        async *generate() { calls++; yield { type: 'delta' as const, text: plan.slice(0, 30) };
            yield { type: 'complete' as const, text: plan, actualModelId: reportedModel }; } };
    const composer = { compose: async () => ({ messages: [{ role: 'user' as const, content: 'Add history' }],
        refs: [], diagnostics: [], usedTokens: 20, budgetTokens: 1000 }) };
    const grounder = { investigateIdea: async () => ({ blocks: [], diagnostics: [] }) };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never,
        undefined, grounder as never, undefined, greenfield);
    try {
        const { handle } = await greenfield.beginImplementationPlan(root);
        const { projectHandle } = await backend.attach(pathToFileURL(root).href), chatId = id();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        greenfield.bindChat(root, handle, chatId);
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        if (!lease.acquired) throw new Error('Lease missing');
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'hosted', modelId: 'remote' }, hostedProjectDataAuthorized: true,
            content: 'Add history' }), /selected local model/);
        assert.equal(calls, 0);
        const before = await store.read(root);
        const turn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' }, content: 'Add visual Git history; keep permissions explicit' });
        assert.equal(calls, 1);
        assert.equal(turn.proposal?.action.type, 'implementation-plan');
        assert.equal(turn.proposal?.changedIds.length, 3);
        assert.equal(greenfield.readImplementationPlan(handle), undefined);
        assert.deepEqual(await store.read(root), before);
        const message = (await backend.get(projectHandle, chatId))!.messages.at(-1)!;
        assert.equal(message.role === 'assistant' && message.planningActivity?.status, 'pending');
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, turn.proposal!.id, true);
        const accepted = greenfield.readImplementationPlan(handle)!;
        assert.equal(accepted.steps.length, 3);
        assert.deepEqual(accepted.steps[2].dependencies, [accepted.steps[1].id]);
        assert.deepEqual(await store.read(root), before);
        plan = JSON.stringify({ type: 'implementation-plan-revision', baseRevision: 1,
            edits: [{ type: 'update', step: 2, detail: 'Reuse existing diff editor' }],
            constraintsAdd: [], decisionsAdd: [], question: '' });
        const revision = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' }, content: 'Reuse the existing editor' });
        assert.equal(revision.proposal?.action.type, 'implementation-plan-revision');
        assert.equal(greenfield.readImplementationPlan(handle)?.revision, 1);
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, revision.proposal!.id, false);
        assert.equal(greenfield.readImplementationPlan(handle)?.revision, 1);
        const approvedRevision = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' }, content: 'Reuse the existing editor' });
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, approvedRevision.proposal!.id, true);
        assert.equal(greenfield.readImplementationPlan(handle)?.revision, 2);
        assert.equal(greenfield.readImplementationPlan(handle)?.steps[1].id, accepted.steps[1].id);
        assert.deepEqual(await store.read(root), before);
        assert.equal(await backend.undoPlanningRevision(projectHandle, chatId, lease.token, 2), 3);
        assert.deepEqual(greenfield.readImplementationPlan(handle)?.steps, accepted.steps);
        await assert.rejects(backend.undoPlanningRevision(projectHandle, chatId, lease.token, 2), /Stale/);
        plan = JSON.stringify({ type: 'implementation-plan-revision', baseRevision: 3,
            edits: [{ type: 'update', step: 2, detail: 'Use the existing editor' }],
            constraintsAdd: [], decisionsAdd: [], question: '' });
        reportedModel = 'swapped';
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' }, content: 'Revise the plan' }), /model changed/);
        assert.equal(greenfield.readImplementationPlan(handle)?.revision, 3);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});
