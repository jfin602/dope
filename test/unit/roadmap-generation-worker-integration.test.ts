import assert from 'node:assert/strict';
import { createServer, type ServerResponse } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { PiModelBridge } from '../../packages/theia-extension/lib/node/pi-model-bridge.js';
import { PiRuntimeFactory } from '../../packages/theia-extension/lib/node/pi-runtime-host.js';
import { piConversation } from '../../packages/theia-extension/lib/node/pi-conversation-runtime.js';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';

const known = (value: boolean) => ({ source: 'adapter-known', value });

async function fixture(holdPhase?: number, phaseCount = 2,
    unresolved: string[] = []) {
    const root = await mkdtemp(join(tmpdir(), 'dope-gen-worker-'));
    const pending = new Map<number, ServerResponse>();
    const requests: { phase: number; tools: string[]; continuation: boolean;
        accepted: boolean; replyPhase?: number }[] = [];
    const events: unknown[] = [];
    let waiting: (() => void) | undefined;
    const send = (response: ServerResponse, phase: number, continuation: boolean) => {
        const args = phase <= phaseCount ? { version: 1, phase, title: `Phase ${phase}`,
            objective: `Deliver feature ${phase}`, gates: [{ title: `Gate ${phase}`,
                purpose: `Verify feature ${phase}`, criteria: [{ title: `Criterion ${phase} A`, expectedResult: `Feature ${phase} works` },
                    { title: `Criterion ${phase} B`, expectedResult: `Feature ${phase} survives reload` }] }] } : { version: 1, unresolved };
        const choice = phase > phaseCount ? [
            { index: 0, delta: { role: 'assistant', content: 'Draft submitted for owner review.' }, finish_reason: null },
            { index: 0, delta: {}, finish_reason: 'stop' }
        ] : [
            { index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0,
                id: `phase-${phase}`, type: 'function', function: {
                    name: 'roadmap_phase', arguments: JSON.stringify(args) } }] }, finish_reason: null },
            { index: 0, delta: {}, finish_reason: 'tool_calls' }
        ];
        if (phase === phaseCount + 1) choice[0] = { index: 0,
            delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'finish', type: 'function',
                function: { name: 'roadmap_finish', arguments: JSON.stringify(args) } }] }, finish_reason: null };
        if (phase === phaseCount + 1) choice[1] = { index: 0, delta: {}, finish_reason: 'tool_calls' };
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        for (const [index, item] of choice.entries()) response.write(`data: ${JSON.stringify({
            id: `fixture-${phase}-${index}`, object: 'chat.completion.chunk', created: 1,
            model: 'exact-model', choices: [item] })}\n\n`);
        response.end('data: [DONE]\n\n');
    };
    const server = createServer((request, response) => {
        const chunks: Buffer[] = [];
        request.on('data', chunk => chunks.push(Buffer.from(chunk)));
        request.on('end', () => {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const messages = body.messages as { role: string; content?: string }[];
            const phase = messages.filter(item => item.role === 'tool').length + 1;
            const continuation = messages.at(-1)?.role === 'tool';
            if (!Number.isSafeInteger(phase) || phase < 1) { response.writeHead(400); response.end(); return; }
            const toolReply = continuation ? JSON.stringify(messages.at(-1)) : '';
            requests.push({ phase, continuation, accepted: toolReply.includes('accepted'),
                replyPhase: continuation ? Number(toolReply.match(/\\?"phase\\?":(\d+)/)?.[1]) : undefined,
                tools: (body.tools ?? []).map((tool: any) => tool.function.name) });
            if (phase === holdPhase) {
                pending.set(phase, response); waiting?.(); waiting = undefined;
                return;
            }
            send(response, phase, continuation);
        });
    });
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.off('error', reject); resolve();
        });
    }).catch(async error => { await rm(root, { recursive: true, force: true }); throw error; });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server address unavailable');
    const endpoint = `http://127.0.0.1:${address.port}/v1`;
    const connection = { version: 1, id: 'local', alias: 'Local', lifecycle: 'enabled',
        config: { type: 'local', runtime: 'lm-studio', endpoint } };
    const model = { version: 1, connectionId: 'local', providerModelKey: 'exact-model',
        label: 'Exact model', locality: 'local', enabled: true, state: 'ready',
        capabilities: { conversationalText: known(true), streaming: known(true),
            toolCalling: known(true), agentExecution: known(true) },
        limits: { maxOutputTokens: { source: 'adapter-known', value: 4096 } } };
    const inventory: any = { registry: { version: 1, revision: 1, connections: [connection], models: [model] },
        observations: [{ connectionId: 'local', health: 'ready' }],
        loadedLocalModels: [{ connectionId: 'local', providerModelKey: 'exact-model', contextWindowTokens: 32768 }] };
    const bridge = new PiModelBridge({ inventory: async () => inventory,
        refreshModels: async () => inventory, credential: async () => undefined });
    const factory = new PiRuntimeFactory();
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
        providerId: 'local', models: [{ id: 'exact-model', label: 'Exact model', usable: true,
            capabilities: { contextWindowTokens: 32768 } }] }] }),
    async *generate(selection: unknown, request: unknown) {
        yield* piConversation(selection as never, request as never, bridge, factory);
    } };
    const repository = new ChatRepository(), store = new RoadmapStore();
    const backend = new ChatBackend(repository, { notifyChatEvent(event) { events.push(event); } }, models as never,
        undefined, undefined, undefined, undefined, undefined, undefined, store);
    const { projectHandle } = await backend.attach(pathToFileURL(root).href), chatId = randomUUID();
    await backend.mutate({ projectHandle, expectedRevision: 0,
        operation: { type: 'create-chat', id: chatId, folderPath: '' } });
    const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
    if (!lease.acquired) throw new Error('Fixture lease unavailable');
    return { root, repository, store, backend, projectHandle, chatId, token: lease.token,
        requests, events, pending, release(phase: number) {
            const response = pending.get(phase);
            if (!response) throw new Error(`Phase ${phase} is not pending`);
            pending.delete(phase); send(response, phase, false);
        },
        async waitPending(phase: number) {
            if (!pending.has(phase)) await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('Fixture phase timeout')), 10_000);
                waiting = () => { clearTimeout(timer); resolve(); };
            });
        },
        async close() { backend.dispose(); for (const response of pending.values()) response.destroy();
            await new Promise<void>(resolve => server.close(() => resolve()));
            await rm(root, { recursive: true, force: true }); }
    };
}

const command = '/gen-roadmap Build a TypeScript/PixiJS tower-defense game with fixed enemy paths, towers, waves, currency, and persistent base health.';
const run = (f: Awaited<ReturnType<typeof fixture>>) => f.backend.runTurn({
    projectHandle: f.projectHandle, chatId: f.chatId, leaseToken: f.token,
    selectedModel: { connectionId: 'local', modelId: 'exact-model' }, content: command });

test('one real Pi worker execution waits for checked Phase receipts, then finishes one proposal', async () => {
    const f = await fixture(undefined, 2, ['Remaining tower features require owner review']);
    try {
        const before = JSON.stringify(await f.store.read(f.root));
        const result = await run(f);
        assert.equal(result.proposalError, undefined);
        assert.deepEqual([result.proposal?.counts?.phases, result.proposal?.counts?.gates,
            result.proposal?.counts?.criteria], [2, 2, 4]);
        assert.deepEqual(f.requests.map(item => item.phase), [1, 2, 3, 4]);
        assert.ok(f.requests.every(item => item.tools.includes('roadmap_phase') &&
            item.tools.includes('roadmap_finish')));
        assert.equal(f.requests[1].accepted, true);
        assert.equal(f.requests[1].replyPhase, 1);
        assert.equal(f.requests[2].replyPhase, 2);
        const entities = result.proposal?.preview?.entities ?? [];
        const phases = entities.filter(item => item.after?.kind === 'phase');
        const gates = entities.filter(item => item.after?.kind === 'gate');
        const criteria = entities.filter(item => item.after?.kind === 'criterion');
        assert.deepEqual([phases.length, gates.length, criteria.length], [2, 2, 4]);
        assert.ok(gates.every(item => phases.some(phase => phase.id === item.after?.parentId)));
        assert.ok(criteria.every(item => gates.some(gate => gate.id === item.after?.parentId)));
        const chat = (await f.repository.read(f.root)).chats.find(item => item.id === f.chatId)!;
        assert.equal(chat.messages[1].role === 'assistant' && chat.messages[1].planningActivity?.status, 'pending');
        assert.deepEqual(chat.messages[1].role === 'assistant' &&
            chat.messages[1].execution.toolEvents?.map(item => item.status),
            ['completed', 'completed', 'completed']);
        assert.equal(JSON.stringify(await f.store.read(f.root)), before);
        await assert.rejects(readFile(join(f.root, '.dope/roadmap.json')), { code: 'ENOENT' });
        await assert.rejects(readFile(join(f.root, 'ROADMAP.md')), { code: 'ENOENT' });
    } finally { await f.close(); }
});

test('source change before a second worker tool rejects the stale callback', async () => {
    const f = await fixture(2, 2);
    try {
        const turn = run(f);
        await f.waitPending(2);
        const initial = await f.store.read(f.root);
        await f.store.saveGateIndex(f.root, initial.revision, initial.projectId,
            { ...initial, revision: initial.revision + 1 });
        const changed = JSON.stringify(await f.store.read(f.root));
        f.release(2);
        const result = await turn;
        assert.match(result.proposalError ?? '', /stale|incomplete|finish/i);
        assert.equal(JSON.stringify(await f.store.read(f.root)), changed);
        await assert.rejects(readFile(join(f.root, '.dope/roadmap.json')), { code: 'ENOENT' });
    } finally { await f.close(); }
});

test('cancelled worker turn retains no applicable proposal', async () => {
    const f = await fixture(2, 2);
    try {
        const turn = run(f);
        await f.waitPending(2);
        await f.backend.cancelTurn(f.projectHandle, f.chatId, f.token);
        const result = await turn;
        assert.match(result.proposalError ?? '', /cancel/i);
        await assert.rejects(readFile(join(f.root, '.dope/roadmap.json')), { code: 'ENOENT' });
    } finally { await f.close(); }
});
