import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { roadmapGenerationCommand } from '../../packages/theia-extension/lib/node/roadmap-generation-command.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
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

test('authorized command reaches the new controller but no inference or canonical write before P3', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gen-controller-entry-'));
    const repository = new ChatRepository(), store = new RoadmapStore();
    let inference = 0;
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
        providerId: 'local', models: [{ id: 'q4', usable: true,
            capabilities: { contextWindowTokens: 8192 } }] }] }),
    async *generate() { inference++; yield { type: 'complete', text: 'unexpected' }; } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
        undefined, undefined, undefined, undefined, undefined, undefined, store);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href), chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        if (!lease.acquired) throw new Error('Lease unavailable');
        const beforeChat = JSON.stringify(await repository.read(root));
        const beforeRoadmap = JSON.stringify(await store.read(root));
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: '/gen-roadmap Build\nthree phases' }), /native phase staging is ready \(incomplete\)/);
        assert.equal(inference, 0);
        assert.equal(JSON.stringify(await repository.read(root)), beforeChat);
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
            content: '/gen-roadmap Build phases' }), /Selected local model is unavailable/);
        assert.equal(inference, 0);
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
