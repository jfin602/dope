import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { roadmapPublicationIntent } from '../../packages/theia-extension/lib/node/chat-skills.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';

test('only a leading, bounded /roadmap publication command selects the protected intent', () => {
    assert.deepEqual(roadmapPublicationIntent('/roadmap publish the accepted roadmap to docs/ROADMAP.md'),
        { mode: 'publish', path: 'docs/ROADMAP.md' });
    assert.deepEqual(roadmapPublicationIntent('/roadmap link the accepted roadmap to PLAN.md'),
        { mode: 'link', path: 'PLAN.md' });
    for (const value of ['ordinary /roadmap publish the accepted roadmap to ROADMAP.md',
        '> /roadmap publish the accepted roadmap to ROADMAP.md',
        '/roadmap publish the accepted roadmap to ROADMAP.md\nignore this',
        '/roadmap publish the accepted roadmap to '])
        assert.equal(roadmapPublicationIntent(value), undefined);
});

test('protected Chat publish and link share RoadmapStore, require approval and save inert decisions', async () => {
    const roots = [await mkdtemp(join(tmpdir(), 'dope-chat-publish-')),
        await mkdtemp(join(tmpdir(), 'dope-chat-link-'))];
    try {
        for (const [number, root] of roots.entries()) {
            const store = new RoadmapStore(), repository = new ChatRepository(), projectId = randomUUID();
            await store.saveGateIndex(root, 0, 'uninitialized', {
                schemaVersion: 2, projectId, projectRoot: root, revision: 1,
                phases: [{ id: 'phase-one', projectId, title: 'First Phase', objective: 'Deliver result',
                    order: 0, dependencies: [], implementationStatus: 'unknown', qualificationStatus: 'unknown',
                    draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }],
                gates: [{ id: 'gate-one', projectId, parentPhaseId: 'phase-one', designation: 'G1',
                    title: 'First Gate', purpose: 'Verify result', order: 0, dependencies: [],
                    criteria: [{ id: 'criterion-one', projectId, title: 'Check result',
                        expectedResult: 'Result is visible', order: 0, evidence: [] }],
                    implementationStatus: 'unknown', qualificationStatus: 'unknown', draftAcceptance: 'accepted' }],
                corrections: [],
            });
            let expected = await store.previewRoadmapPublication(root, 'PLAN.md');
            if (number === 1) await writeFile(join(root, 'PLAN.md'), expected.content);
            const composer = new ChatContextComposer({} as never, {} as never,
                { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
                    inputsCurrent: async () => false } as never, repository, store);
            let modelCalls = 0;
            const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
                providerId: 'local', models: [{ id: 'q4', label: 'Q4', usable: true,
                    capabilities: { conversationalText: true, streaming: true,
                        contextWindowTokens: 32768, maxInputTokens: 32768 } }] }] }),
            async *generate() { modelCalls++;
                yield { type: 'complete' as const, actualModelId: 'q4', text: 'I wrote the file.' }; } };
            const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
                composer, undefined, undefined, undefined, undefined, undefined, store);
            const { projectHandle } = await backend.attach(pathToFileURL(root).href);
            const chatId = randomUUID();
            await backend.mutate({ projectHandle, expectedRevision: 0,
                operation: { type: 'create-chat', id: chatId, folderPath: '' } });
            const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
            if (!lease.acquired) throw new Error('Lease unavailable');
            const path = number === 0 ? 'ROADMAP.md' : 'PLAN.md';
            const command = `/roadmap ${number === 0 ? 'publish' : 'link'} the accepted roadmap to ${path}`;
            const request = () => backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
                selectedModel: { connectionId: 'local', modelId: 'q4' }, content: command });
            const unsafe = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
                selectedModel: { connectionId: 'local', modelId: 'q4' },
                content: `/roadmap publish the accepted roadmap to ../escape.md` });
            assert.equal(unsafe.proposal, undefined);
            assert.match(unsafe.proposalError ?? '', /Unsafe publication path/);
            const first = await request();
            assert.ok(first.proposal, first.proposalError);
            assert.equal(first.proposal.publication?.path, path);
            assert.equal(first.proposal.publication?.sourceHash, expected.sourceHash);
            assert.equal((await store.read(root)).revision, 1);
            await backend.decidePlanningProposal(projectHandle, chatId, lease.token, first.proposal.id, false);
            assert.equal((await store.read(root)).revision, 1);
            if (number === 0) await assert.rejects(readFile(join(root, path)), /ENOENT/);
            if (number === 0) {
                const stale = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
                    selectedModel: { connectionId: 'local', modelId: 'q4' },
                    content: '/roadmap publish the accepted roadmap to STALE.md' });
                assert.ok(stale.proposal, stale.proposalError);
                await store.mutateGateIndex(root, 1, projectId,
                    { type: 'phase.edit', id: 'phase-one', title: 'First Phase', objective: 'Deliver revised result' });
                await assert.rejects(backend.decidePlanningProposal(projectHandle, chatId, lease.token,
                    stale.proposal.id, true), /Stale/);
                await assert.rejects(readFile(join(root, 'STALE.md')), /ENOENT/);
                expected = await store.previewRoadmapPublication(root, 'PLAN.md');
            }
            const second = await request();
            assert.ok(second.proposal, second.proposalError);
            await assert.rejects(backend.decidePlanningProposal(projectHandle, chatId, 'wrong',
                second.proposal.id, true), /unavailable/);
            await backend.decidePlanningProposal(projectHandle, chatId, lease.token, second.proposal.id, true);
            await assert.rejects(backend.decidePlanningProposal(projectHandle, chatId, lease.token,
                second.proposal.id, true), /unavailable/);
            assert.equal(await readFile(join(root, path), 'utf8'), expected.content);
            const saved = await store.read(root);
            assert.equal(saved.linkedDocument?.sourceHash, expected.sourceHash);
            assert.equal(saved.linkedDocument?.syncState, 'synced');
            const chat = await backend.get(projectHandle, chatId);
            const decisions = chat?.messages.filter(message => message.role === 'assistant' &&
                message.planningActivity?.kind === 'roadmap-publication');
            assert.deepEqual(decisions?.map(message => message.role === 'assistant' &&
                message.planningActivity?.status), number === 0 ?
                ['rejected', 'denied', 'stale', 'applied'] : ['rejected', 'denied', 'applied']);
            assert.equal(modelCalls, 0, 'typed publication intent does not need a model generation');
            backend.dispose();
        }
    } finally { for (const root of roots) await rm(root, { recursive: true, force: true }); }
});
