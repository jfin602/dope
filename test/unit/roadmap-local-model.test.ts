import assert from 'node:assert/strict';
import test from 'node:test';
import { localPlanningJson, roadmapLocalBudget, verifyRoadmapLocalInput } from '../../packages/theia-extension/lib/node/roadmap-local-model.js';

const noAction = '{"type":"no-action","message":"More project context is required"}';
const complete = (text: string) => ({ type: 'complete' as const, text });

test('measured 4096 profile reserves input, system and output; oversized context is denied', () => {
    const budget = roadmapLocalBudget(4096, 1024);
    assert.equal(budget.total, 4096);
    assert.equal(budget.output, 512);
    assert.equal(budget.inputBytes + budget.output + 512 + 256, 4096);
    assert.ok(budget.composerInputTokens * 3 <= budget.inputBytes);
    verifyRoadmapLocalInput([{ role: 'system', content: 'Return JSON' },
        { role: 'user', content: 'Context'.repeat(100) }], budget);
    assert.throws(() => verifyRoadmapLocalInput([{ role: 'user', content: 'x'.repeat(3000) }], budget), /exceeds/);
    assert.throws(() => roadmapLocalBudget(undefined, 512), /measured/);
});

test('non-tools JSON fallback repairs once and never accepts a second malformed response', async () => {
    const controller = new AbortController();
    let calls = 0;
    const generate = async function* () { calls++; yield complete(calls === 1 ? 'not JSON' : noAction); };
    assert.equal((await localPlanningJson(generate, controller.signal)).text, noAction);
    assert.equal(calls, 2);
    calls = 0;
    await assert.rejects(localPlanningJson(async function* () { calls++; yield complete('{bad'); }, controller.signal), /two attempts/);
    assert.equal(calls, 2);
});

test('abort stops retries; strict fallback rejects tool and multiple-action envelopes', async () => {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(localPlanningJson(async function* () {
        calls++;
        controller.abort();
        yield complete(noAction);
    }, controller.signal), /cancelled/);
    assert.equal(calls, 1);
    await assert.rejects(localPlanningJson(async function* () {
        yield complete('{"type":"roadmap-proposal","projectId":"p","ownerRevision":1,"action":[{"type":"shell"}]}');
    }, new AbortController().signal), /strict JSON/);
    await assert.rejects(localPlanningJson(async function* () {
        yield complete('x'.repeat(513));
    }, new AbortController().signal), /strict JSON/);
});

import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';

async function withChat(run: (backend: ChatBackend, projectHandle: string, chatId: string, token: string) => Promise<void>,
    models: unknown, routing?: unknown) {
    const root = await mkdtemp(join(tmpdir(), 'dope-short-chat-'));
    const backend = new ChatBackend(new ChatRepository(), { notifyChatEvent() {} }, models as never,
        { compose: async () => ({ messages: [{ role: 'user', content: 'Plan' }], refs: [], diagnostics: [],
            usedTokens: 1, budgetTokens: 1 }) } as never, routing as never);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Short planning' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        if (!lease.acquired) throw new Error('Missing lease');
        await run(backend, projectHandle, chatId, lease.token);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
}

test('local Roadmap turn fails before transport when loaded capacity is unknown', async () => {
    let calls = 0;
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'unknown', label: 'Unknown', usable: true,
            capabilities: { conversationalText: true, streaming: true } }] }] }),
        async *generate() { calls++; yield complete(noAction); } };
    await withChat(async (backend, projectHandle, chatId, token) => {
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: token,
            selectedModel: { connectionId: 'local', modelId: 'unknown' }, content: 'Plan',
            context: [{ kind: 'roadmap-checkpoint', id: 'a', projectId: 'p', ownerRevision: 1 }] }), /measured/);
    }, models);
    assert.equal(calls, 0);
});

test('Follow Roadmap planning denies implicit hosted fallback before transport', async () => {
    const calls: Array<{ locality: string; authorized: boolean }> = [];
    const routing = { resolve: async (_role: string, hard: { locality: string }, authorized: boolean) => {
        calls.push({ locality: hard.locality, authorized });
        return { inventory: { models: [] }, resolution: { selectedTarget: undefined } };
    } };
    const models = { list: async () => ({ connections: [] }), async *generate() {
        throw new Error('Hosted transport must not run');
    } };
    await withChat(async (backend, projectHandle, chatId, token) => {
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: token,
            content: 'Plan', context: [{ kind: 'roadmap-checkpoint', id: 'a', projectId: 'p', ownerRevision: 1 }],
            hostedProjectDataAuthorized: true }), /no eligible model/);
    }, models, routing);
    assert.deepEqual(calls, [{ locality: 'local-only', authorized: false }]);
});

test('an exact hosted Roadmap turn requires explicit project-data consent', async () => {
    let calls = 0;
    const models = { list: async () => ({ connections: [{ id: 'hosted', ready: true, providerId: 'gemini',
        models: [{ id: 'm', label: 'Hosted', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 8192 } }] }] }),
        async *generate() { calls++; yield complete(noAction); } };
    await withChat(async (backend, projectHandle, chatId, token) => {
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: token,
            selectedModel: { connectionId: 'hosted', modelId: 'm' }, content: 'Plan',
            context: [{ kind: 'roadmap-checkpoint', id: 'a', projectId: 'p', ownerRevision: 1 }] }), /confirmation/);
    }, models);
    assert.equal(calls, 0);
});
