import assert from 'node:assert/strict';
import test from 'node:test';
import { localPlanningJson, roadmapLocalBudget, verifyRoadmapLocalInput } from '../../packages/theia-extension/lib/node/roadmap-local-model.js';

const noAction = '{"type":"no-action","message":"More project context is required"}';
const complete = (text: string) => ({ type: 'complete' as const, text });

test('measured 4096 narrow stress reserves serialized input, system and output', () => {
    const budget = roadmapLocalBudget(4096, 1024);
    assert.equal(budget.total, 4096);
    assert.equal(budget.output, 1024);
    assert.equal(budget.inputBytes + budget.output + 512 + 256, 4096);
    assert.ok(budget.composerInputTokens * 3 <= budget.inputBytes);
    assert.ok(budget.maxOutputBytes > 512);
    verifyRoadmapLocalInput([{ role: 'system', content: 'Return JSON' },
        { role: 'user', content: 'Context'.repeat(100) }], budget);
    assert.throws(() => verifyRoadmapLocalInput([{ role: 'user', content: 'x'.repeat(3000) }], budget), /exceeds/);
    assert.throws(() => roadmapLocalBudget(undefined, 512), /measured/);
});

test('16K, 32K and 64K use measured capacity and independent model/developer limits', () => {
    for (const total of [16384, 32768, 65536]) {
        const budget = roadmapLocalBudget(total, 2048);
        assert.equal(budget.total, total);
        assert.equal(budget.output, 2048);
        assert.equal(budget.inputBytes, total - 2048 - 512 - 256);
        assert.ok(budget.maxOutputBytes > budget.output);
        verifyRoadmapLocalInput([{ role: 'user', content: 'x'.repeat(9000) }], budget);
    }
    const limited = roadmapLocalBudget(65536, 2048, { maxInputTokens: 7000, maxOutputTokens: 768 });
    assert.equal(limited.inputBytes, 7000);
    assert.equal(limited.output, 768);
    assert.throws(() => verifyRoadmapLocalInput([{ role: 'user', content: 'x'.repeat(7000) }], limited), /exceeds/);
    assert.throws(() => roadmapLocalBudget(16384, 0), /limit/);
});

test('bounded JSON bytes are independent of output token reservation', async () => {
    const value = JSON.stringify({ type: 'roadmap-intent', intent: 'set-objective', value: 'x'.repeat(700) });
    const bytes = roadmapLocalBudget(16384, 1024).maxOutputBytes;
    assert.ok(Buffer.byteLength(value, 'utf8') > 512);
    assert.equal((await localPlanningJson(async function* () { yield complete(value); },
        new AbortController().signal, bytes, 'linked')).text, value);
    await assert.rejects(localPlanningJson(async function* () { yield complete(value); },
        new AbortController().signal, 512, 'linked'), /strict JSON/);
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

test('a copied no-action placeholder is retried once and never published as an answer', async () => {
    const placeholder = '{"type":"no-action","message":"source-backed answer"}';
    let calls = 0;
    const generate = async function* () { calls++; yield complete(calls === 1 ? placeholder : noAction); };
    assert.equal((await localPlanningJson(generate, new AbortController().signal, 4096, 'linked')).text, noAction);
    assert.equal(calls, 2);
    calls = 0;
    await assert.rejects(localPlanningJson(async function* () { calls++; yield complete(placeholder); },
        new AbortController().signal, 4096, 'linked'), /strict JSON/);
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

test('linked intent contract rejects missing action type, wrong operation, extra keys and unknown intent before completion', async () => {
    const valid = '{"type":"roadmap-intent","intent":"set-objective","value":"Checked goal"}';
    for (const malformed of [
        '{"type":"roadmap-proposal","projectId":"p","ownerRevision":1,"action":{"id":"a","objective":"x"}}',
        '{"type":"roadmap-proposal","projectId":"p","ownerRevision":1,"action":{"type":"edit","id":"a","objective":"x"}}',
        '{"type":"roadmap-intent","intent":"set-status","value":"green"}',
        '{"type":"roadmap-intent","intent":"set-objective","value":"x","actions":[]}'
    ]) {
        let calls = 0;
        await assert.rejects(localPlanningJson(async function* () { calls++; yield complete(malformed); },
            new AbortController().signal, 512, 'linked'), /strict JSON/);
        assert.equal(calls, 2);
    }
    assert.equal((await localPlanningJson(async function* () { yield complete(valid); },
        new AbortController().signal, 512, 'linked')).text, valid);
});

test('strict local completion accepts only known, bounded envelopes', async () => {
    const signal = new AbortController().signal;
    const draft = JSON.stringify({ type: 'roadmap-draft-proposal', projectId: 'p', draftRevision: 0,
        action: { type: 'create-phase', title: 'First phase' } });
    const unlinked = JSON.stringify({ type: 'roadmap-proposal', projectId: 'p', ownerRevision: 1,
        action: { type: 'edit', id: 'a', objective: 'Goal' } });
    for (const [value, mode] of [[draft, 'draft'], [unlinked, 'unlinked'], [noAction, 'linked']] as const)
        assert.equal((await localPlanningJson(async function* () { yield complete(value); },
            signal, 4096, mode)).text, value);
    for (const value of [
        '{"type":"other","message":"looks structured"}',
        '{"type":"no-action","message":{"text":"nested"}}',
        '{"type":"no-action","message":"  "}',
        '{"type":"no-action","message":"okay","saved":true}',
        '{"type":"roadmap-proposal","projectId":"p","ownerRevision":1,"action":{"type":"shell","command":"pwd"}}',
        '{"type":"no-action","message":"' + 'x'.repeat(1001) + '"}',
        '{"type":"no-action","message":"unfinished"'
    ]) await assert.rejects(localPlanningJson(async function* () { yield complete(value); },
        signal, 4096, 'unlinked'), /strict JSON/);
    await assert.rejects(localPlanningJson(async function* () { yield complete(noAction); },
        signal, 8, 'unlinked'), /strict JSON/);
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
