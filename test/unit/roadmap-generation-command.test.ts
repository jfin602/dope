import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { roadmapGenerationCommand } from '../../packages/theia-extension/lib/node/roadmap-generation-command.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { piConversation } from '../../packages/theia-extension/lib/node/pi-conversation-runtime.js';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import * as legacyParserModule from '../../packages/theia-extension/lib/node/roadmap-local-model.js';
import * as legacyStageModule from '../../packages/theia-extension/lib/node/roadmap-typed-stage.js';

test('retired full-plan parsers and converter are absent from runtime exports', () => {
    for (const name of ['parseRoadmapMarkers', 'parseTypedRoadmapDraft', 'generateTypedRoadmapDraft',
        'checkNaturalRoadmapPlan', 'extractNaturalRoadmapOutline', 'parseStrategicDraft'])
        assert.equal(name in legacyParserModule, false, name);
    assert.equal('stageTypedRoadmapDraft' in legacyStageModule, false);
});

const none = ['Create a roadmap', '/roadmap', '/roadmap generate', '"/gen-roadmap plan"',
    '`/gen-roadmap plan`', '> /gen-roadmap plan', 'Please /gen-roadmap plan',
    '/gen-roadmapx plan', '/GEN-ROADMAP plan', '/gen-roadmap-plan', '```\n/gen-roadmap plan\n```'];
test('only the exact leading trusted command requests generation', () => {
    for (const value of none) assert.deepEqual(roadmapGenerationCommand(value), { kind: 'none' }, value);
    for (const value of ['/gen-roadmap', ' /gen-roadmap ', '/gen-roadmap \n  '])
        assert.deepEqual(roadmapGenerationCommand(value), { kind: 'usage' }, value);
    assert.deepEqual(roadmapGenerationCommand('/gen-roadmap build a game'),
        { kind: 'ready', body: 'build a game', origin: 'trusted-user-chat' });
    assert.deepEqual(roadmapGenerationCommand(' \n/gen-roadmap\nBuild\nseveral phases  '),
        { kind: 'ready', body: 'Build\nseveral phases', origin: 'trusted-user-chat' });
});

test('fresh generation command and empty body fail before inference or Roadmap write', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gen-command-'));
    const repository = new ChatRepository();
    let inference = 0;
    const models = { list: async () => ({ connections: [] }),
        async *generate() { inference++; yield { type: 'complete', text: 'unexpected' }; } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'test-panel' });
        if (!lease.acquired) throw new Error('Chat lease unavailable');
        const before = JSON.stringify(await repository.read(root));
        const request = { projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' } };
        await assert.rejects(backend.runTurn({ ...request, content: '/gen-roadmap \n ' }), /Usage: \/gen-roadmap/);
        await assert.rejects(backend.runTurn({ ...request, content: '/gen-roadmap Build five phases' }),
            /unavailable until the new controller is ready/);
        await assert.rejects(backend.runTurn({ ...request, content: '/roadmap generate' }),
            /Legacy Roadmap generation is unavailable/);
        await assert.rejects(backend.runTurn({ ...request, content: 'Yes, create the Roadmap.' }),
            /Legacy Roadmap generation is unavailable/);
        assert.equal(inference, 0);
        assert.equal(JSON.stringify(await repository.read(root)), before);
        await assert.rejects(readFile(join(root, '.dope', 'roadmap.json')), { code: 'ENOENT' });
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), { code: 'ENOENT' });
        await assert.rejects(backend.decideRoadmapOffer(projectHandle, chatId, lease.token,
            'old-offer', 'old-token', true), /retired/);
        assert.equal(inference, 0);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('Chat command brokers serial typed Pi Phases into one saved review proposal without canonical writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gen-controller-entry-'));
    const repository = new ChatRepository(), store = new RoadmapStore();
    let inference = 0;
    const events: unknown[] = [];
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
        providerId: 'local', models: [{ id: 'q4', label: 'Q4', usable: true,
            capabilities: { contextWindowTokens: 8192 } }] }] }),
    async *generate(selection: unknown, request: { projectTools: { roadmapGeneration: boolean } }) {
        assert.equal(request.projectTools.roadmapGeneration, true);
        yield* piConversation(selection as never, request as never, {
            bind: async (_selected: unknown, _host: unknown, _root: unknown, options: { chatTools: boolean;
                roadmapGeneration: boolean }) => {
                assert.equal(options.chatTools, true);
                assert.equal(options.roadmapGeneration, true);
                return { modelId: 'q4', contextWindowTokens: 8192, maxOutputTokens: 4096,
                    reasoningEnabled: false };
            }
        } as never, {
            create: () => ({ start: async () => undefined,
                async *streamTurn(messages: { content: string }[], _max: number, _signal: unknown,
                    onTool: (call: { id: number; name: string; arguments: unknown }) =>
                        Promise<{ status: string; output: string }>) {
                    inference++;
                    const input = JSON.parse(messages.at(-1)!.content.split('\n\n').at(-1)!) as {
                        phase: number; stagedPhaseSummaries: string[] };
                    assert.equal(input.phase, inference);
                    assert.equal(input.stagedPhaseSummaries.length, inference - 1);
                    const name = input.phase <= 3 ? 'roadmap_phase' : 'roadmap_finish';
                    const args = input.phase <= 3 ? { version: 1, phase: input.phase,
                        title: `Phase ${input.phase}`, objective: `Deliver tower defense feature ${input.phase}`,
                        gates: [{ title: `Gate ${input.phase}`, purpose: 'Verify the game feature',
                            criteria: [{ title: 'Observable game behavior',
                                expectedResult: `Feature ${input.phase} is visible` }] }] } :
                        { version: 1, unresolved: [] };
                    const reply = await onTool({ id: inference, name, arguments: args });
                    assert.equal(reply.status, 'completed');
                    assert.equal(JSON.parse(reply.output).accepted, true);
                    yield { type: 'complete', text: '', modelId: 'q4', finishReason: 'stop',
                        usage: { inputTokens: 20, outputTokens: 20, totalTokens: 40,
                            tokenMeasurement: 'provider-reported' } };
                } }), release: () => undefined
        } as never);
    } };
    const backend = new ChatBackend(repository, { notifyChatEvent(event) { events.push(event); } }, models as never,
        undefined, undefined, undefined, undefined, undefined, undefined, store);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href), chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        if (!lease.acquired) throw new Error('Lease unavailable');
        const beforeRoadmap = JSON.stringify(await store.read(root));
        const result = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: '/gen-roadmap Build a TypeScript/PixiJS tower-defense game with fixed enemy paths, towers, waves, currency, and persistent base health.' });
        assert.equal(inference, 4);
        assert.ok(result.proposal);
        assert.equal(result.proposal.counts?.phases, 3);
        assert.equal(result.proposal.counts?.gates, 3);
        assert.equal(result.proposal.counts?.criteria, 3);
        assert.equal(result.proposal.operations?.length, 6);
        assert.equal(events.filter((event: any) => event.kind === 'roadmap-stage' && event.snapshot).length, 4);
        assert.equal(new Set(events.filter((event: any) => event.kind === 'roadmap-stage' && event.snapshot)
            .map((event: any) => event.snapshot.proposalId)).size, 1);
        const saved = (await repository.read(root)).chats.find(item => item.id === chatId)!;
        assert.equal(saved.messages.length, 2);
        assert.equal(saved.messages[1].role, 'assistant');
        assert.equal(saved.messages[1].role === 'assistant' && saved.messages[1].planningActivity?.status, 'pending');
        assert.deepEqual(saved.messages[1].role === 'assistant' &&
            saved.messages[1].execution.toolEvents?.map(event => event.name),
        ['roadmap_phase', 'roadmap_phase', 'roadmap_phase', 'roadmap_finish']);
        assert.equal(JSON.stringify(await store.read(root)), beforeRoadmap);
        await assert.rejects(readFile(join(root, '.dope', 'roadmap.json')), { code: 'ENOENT' });
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), { code: 'ENOENT' });
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: randomUUID(),
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: '/gen-roadmap Build phases' }), /unavailable until the new controller/);
        await assert.rejects(backend.runTurn({ projectHandle, chatId: randomUUID(), leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: '/gen-roadmap Build phases' }), /unavailable until the new controller/);
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'hosted', modelId: 'q4' },
            content: '/gen-roadmap Build phases' }), /Review or dismiss the existing Roadmap proposal/);
        assert.equal(inference, 4);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('a saved failed generation command cannot be replayed into a controller', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gen-replay-'));
    const repository = new ChatRepository();
    let inference = 0;
    const models = { list: async () => ({ connections: [] }),
        async *generate() { inference++; yield { type: 'complete', text: 'unexpected' }; } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const chatId = randomUUID(), messageId = randomUUID();
        let state = await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'test-panel' });
        if (!lease.acquired) throw new Error('Chat lease unavailable');
        state = await backend.mutate({ projectHandle, expectedRevision: state.revision, leaseToken: lease.token,
            operation: { type: 'append-user', chatId, message: { schemaVersion: 1, id: randomUUID(),
                role: 'user', createdAt: new Date().toISOString(), content: '/gen-roadmap old attempt', contextRefs: [] } } });
        state = await backend.mutate({ projectHandle, expectedRevision: state.revision, leaseToken: lease.token,
            operation: { type: 'begin-assistant', chatId, message: { schemaVersion: 1, id: messageId,
                role: 'assistant', createdAt: new Date().toISOString(), content: '', execution: {
                    schemaVersion: 1, id: randomUUID(), status: 'pending',
                    selectedModel: { connectionId: 'local', modelId: 'q4' }, startedAt: new Date().toISOString() } } } });
        await backend.mutate({ projectHandle, expectedRevision: state.revision, leaseToken: lease.token,
            operation: { type: 'finish-assistant', chatId, messageId, outcome: 'failed', content: '',
                failure: 'Interrupted' } });
        const before = JSON.stringify(await repository.read(root));
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            retryMessageId: messageId }), /cannot be replayed/);
        assert.equal(inference, 0);
        assert.equal(JSON.stringify(await repository.read(root)), before);
        await assert.rejects(readFile(join(root, '.dope', 'roadmap.json')), { code: 'ENOENT' });
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('rejected native operation stops generation and saves a failed noncanonical turn', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gen-denied-'));
    const repository = new ChatRepository(), store = new RoadmapStore();
    let calls = 0;
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
        providerId: 'local', models: [{ id: 'q4', label: 'Q4', usable: true,
            capabilities: { contextWindowTokens: 8192 } }] }] }),
    async *generate(_selection: unknown, request: { projectTools: {
        execute(name: string, args: unknown): Promise<string> } }) {
        calls++;
        const denied = JSON.parse(await request.projectTools.execute('roadmap_finish',
            { version: 1, unresolved: [] }));
        assert.match(denied.error, /DENIED/);
        yield { type: 'complete', text: '', actualModelId: 'q4', finishReason: 'stop',
            usage: { tokenMeasurement: 'provider-reported', totalTokens: 10 } };
    } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
        undefined, undefined, undefined, undefined, undefined, undefined, store);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href), chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        if (!lease.acquired) throw new Error('Lease unavailable');
        const before = JSON.stringify(await store.read(root));
        const result = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: '/gen-roadmap Build a game' });
        assert.match(result.proposalError ?? '', /Phase retry limit reached/);
        assert.equal(result.proposal, undefined);
        assert.equal(calls, 2);
        const saved = (await repository.read(root)).chats.find(chat => chat.id === chatId)!;
        assert.equal(saved.messages[1].role === 'assistant' && saved.messages[1].execution.status, 'failed');
        assert.deepEqual(saved.messages[1].role === 'assistant' &&
            saved.messages[1].execution.toolEvents?.map(event => [event.name, event.status]),
        [['roadmap_finish', 'denied'], ['roadmap_finish', 'denied']]);
        assert.equal(JSON.stringify(await store.read(root)), before);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('a new explicit command resumes only freshly revalidated partial Phases', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gen-resume-'));
    const repository = new ChatRepository(), store = new RoadmapStore();
    let calls = 0;
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
        providerId: 'local', models: [{ id: 'q4', label: 'Q4', usable: true,
            capabilities: { contextWindowTokens: 8192 } }] }] }),
    async *generate(_selection: unknown, request: { messages: { content: string }[];
        projectTools: { execute(name: string, args: unknown): Promise<string> } }) {
        calls++;
        const input = JSON.parse(request.messages.at(-1)!.content.split('\n\n').at(-1)!) as {
            phase: number; stagedPhaseSummaries: string[] };
        if (calls === 1 || calls === 4) {
            assert.equal(input.phase, calls === 1 ? 1 : 2);
            const response = await request.projectTools.execute('roadmap_phase', {
                version: 1, phase: input.phase, title: `Phase ${input.phase}`,
                objective: `Objective ${input.phase}`, gates: [{ title: `Gate ${input.phase}`,
                    purpose: 'Purpose', criteria: [{ title: 'Observable', expectedResult: 'Observed' }] }] });
            assert.equal(JSON.parse(response).accepted, true);
        } else if (calls === 5) {
            assert.equal(input.phase, 3);
            assert.equal(input.stagedPhaseSummaries.length, 2);
            await request.projectTools.execute('roadmap_finish', { version: 1, unresolved: [] });
        }
        yield { type: 'complete', text: '', actualModelId: 'q4', finishReason: 'stop',
            usage: { tokenMeasurement: 'provider-reported', totalTokens: 10 } };
    } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
        undefined, undefined, undefined, undefined, undefined, undefined, store);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href), chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        if (!lease.acquired) throw new Error('Lease unavailable');
        const request = { projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: '/gen-roadmap Build two Phases' };
        const first = await backend.runTurn(request);
        assert.match(first.proposalError ?? '', /retry limit/i);
        assert.equal(calls, 3);
        const second = await backend.runTurn(request);
        assert.equal(calls, 5);
        assert.equal(second.proposal?.counts?.phases, 2);
        assert.equal(second.proposal?.counts?.gates, 2);
        assert.equal((await store.read(root)).phases.length, 0);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});
