import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import { DeveloperSessionBackend } from '../../packages/theia-extension/lib/node/developer-session-backend.js';
import { DeveloperSessionStore } from '../../packages/theia-extension/lib/node/developer-session-store.js';
import { DeveloperSessionCandidates } from '../../packages/theia-extension/lib/node/developer-session-candidates.js';
import { DeveloperSessionController } from '../../packages/theia-extension/lib/browser/developer-session-controller.js';

const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
    physicalInputFingerprint: 'source', physicalGeneration: 1 };
const now = '2026-10-11T12:00:00.000Z';
const uri = (root: string) => pathToFileURL(root).href;

test('one-kind browse returns exact owner IDs without Chat recovery, transcripts, run diffs or owner writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-session-candidates-'));
    const other = await mkdtemp(join(tmpdir(), 'dope-session-candidates-other-'));
    const service = new DeveloperSessionBackend(new DeveloperSessionStore());
    const foreign = new DeveloperSessionBackend(new DeveloperSessionStore());
    try {
        const chatId = randomUUID(), ideaId = randomUUID();
        const chats = new ChatRepository(), planning = new PlanningStore();
        const agents = new AgentStore(), mind = new ProjectMindStore();
        await chats.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '', title: 'Existing Chat' });
        const manifestFile = join(root, '.dope/chats/index.json');
        const entry = JSON.parse(await readFile(manifestFile, 'utf8')).entries[0];
        const chatFile = join(root, '.dope/chats/folders', entry.file);
        const legacy = JSON.parse(await readFile(chatFile, 'utf8'));
        delete legacy.color;
        legacy.messages = [{ schemaVersion: 1, id: randomUUID(), role: 'user', createdAt: legacy.createdAt,
            content: 'PRIVATE TRANSCRIPT', contextRefs: [] }];
        await writeFile(chatFile, `${JSON.stringify(legacy)}\n`);
        await planning.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Build', basis });
        await planning.mutate(root, 1, { type: 'put-transformation', mapId: 'plan', transformation: {
            id: 'change', kind: 'add', currentIds: [], dependsOn: [],
            futureNodes: [{ id: 'core', kind: 'system', name: 'Core', purpose: 'Build', roots: [] }] } });
        await planning.mutate(root, 2, { type: 'put-work-item', mapId: 'plan', workItem: {
            id: 'work', title: 'Work', objective: 'Build', transformationIds: ['change'], dependsOn: [],
            requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [],
            workingSet: [], status: 'proposed' } });
        const task = { version: 1 as const, id: 'task-one', createdAt: now, objective: 'Task objective',
            instructions: 'PRIVATE TASK INSTRUCTIONS', projectRoot: '.' as const,
            modelPolicy: { kind: 'follow-coding-agent' as const }, controls: {},
            authority: { profile: 'phase-8b-project' as const },
            completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' as const } };
        await agents.createTask(root, task);
        const stack = await importPhaseStack('p9', [{ filename: 'P1-implement.txt', text:
            'TASK: Phase 9 / P1 — Implement\n- Recommended configuration: `GPT-6 Sol Medium`.\n' +
            '- Browser required: no.\nThe assigned project version is `0.9.1`.\n' },
        { filename: 'P2-closeout.txt', text:
            'TASK: Phase 9 / P2 — Closeout\n- Recommended configuration: `GPT-6 Sol Medium`.\n' +
            '- Browser required: no.\nThe assigned project version is `0.9.2`.\n' }]);
        await agents.createSequence(root, { version: 1, id: 'sequence-one', createdAt: now,
            updatedAt: now, status: 'ready', currentEntryNumber: 1, stack, checkpoints: [],
            basis: { head: 'a'.repeat(40), packageVersion: '0.9.0', worktreeFingerprint: 'e'.repeat(64) } });
        await agents.createRun(root, { version: 1, id: 'run-one', taskId: task.id, status: 'pending',
            grantId: 'grant', grantRevision: 0, requestedPolicy: task.modelPolicy, projectRoot: '.',
            createdAt: now, changedFiles: [], validationResults: [] });
        await mind.mutate(root, 0, { type: 'create', artifact: { schemaVersion: 2, id: ideaId,
            type: 'idea', title: 'Existing idea', body: 'PRIVATE MIND BODY', createdAt: now,
            updatedAt: now, provenance: 'developer', archivedAt: null, links: [], status: 'captured' } });
        const ownerFiles = [manifestFile, chatFile, join(root, '.dope/planning-maps.json'),
            join(root, '.dope/agent/tasks/task-one.json'), join(root, '.dope/agent/runs/run-one/run.json'),
            join(root, '.dope/agent/sequences/sequence-one.json'),
            join(root, '.dope/project-mind.json')];
        const original = await Promise.all(ownerFiles.map(file => readFile(file)));
        const handle = (await service.attach(uri(root))).projectHandle;
        const otherHandle = (await foreign.attach(uri(other))).projectHandle;
        const expected = [
            ['chat', { kind: 'chat', chatId }],
            ['planning-map', { kind: 'planning-map', mapId: 'plan' }],
            ['work-item', { kind: 'work-item', mapId: 'plan', workItemId: 'work' }],
            ['agent-task', { kind: 'agent-task', taskId: 'task-one' }],
            ['agent-sequence', { kind: 'agent-sequence', sequenceId: 'sequence-one' }],
            ['project-mind', { kind: 'project-mind', artifactType: 'idea', artifactId: ideaId }],
        ] as const;
        for (const [kind, ref] of expected) {
            const result = await service.candidates(handle, kind);
            assert.equal(result.availability, 'ready');
            assert.deepEqual(result.candidates.map(candidate => candidate.ref), [ref]);
            assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
        }
        const run = await service.candidates(handle, 'agent-run');
        assert.equal(run.availability, 'unavailable');
        assert.match(run.diagnostic, /exact task and run IDs/);
        assert.deepEqual(run.candidates, []);
        assert.deepEqual((await foreign.candidates(otherHandle, 'chat')).candidates, []);
        assert.deepEqual((await foreign.candidates(otherHandle, 'project-mind')).candidates, []);
        await assert.rejects(readFile(join(other, '.dope/project-mind.json')), /ENOENT/);
        await assert.rejects(service.candidates(otherHandle, 'chat'), /handle/);
        await assert.rejects(foreign.candidates(handle, 'chat'), /handle/);
        assert.deepEqual(await Promise.all(ownerFiles.map(file => readFile(file))), original);
    } finally {
        service.dispose(); foreign.dispose();
        await rm(root, { recursive: true, force: true });
        await rm(other, { recursive: true, force: true });
    }
});

test('bounded choices and unavailable owner leave exact-ID attach available', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-session-candidate-bounds-'));
    try {
        const tasks = Array.from({ length: 55 }, (_, i) => ({ id: `task-${i}`, objective: `Task ${i}`,
            origin: { kind: 'direct' } }));
        const adapter = new DeveloperSessionCandidates({ peekCandidateIds: async () => ({ ids: [], truncated: false }) } as any,
            { read: async () => ({ projectId: 'p', maps: [] }) } as any,
            { listTasks: async () => tasks, listSequences: async () => { throw Error('bad owner'); } } as any,
            { read: async () => undefined } as any);
        const limited = await adapter.list(root, 'agent-task');
        assert.equal(limited.candidates.length, 50);
        assert.equal(limited.truncated, true);
        assert.equal((await adapter.list(root, 'agent-sequence')).availability, 'unavailable');
        assert.deepEqual((await adapter.list(root, 'project-mind')).candidates, []);
        const sessionId = randomUUID();
        const project = { canonicalRoot: root, projectMindId: null };
        const session = { schemaVersion: 2, id: sessionId, project, revision: 0, title: 'Session',
            objective: '', createdAt: now, updatedAt: now, status: 'active', notes: '', nextActions: [],
            closeout: null, links: [] };
        let attachedRef: unknown;
        let offered: any;
        const connection: any = { attach: async () => ({ projectHandle: 'handle', project,
            snapshot: { schemaVersion: 2, project, revision: 0, sessions: [session] } }),
            candidates: async (_: string, kind: string) => offered ?? ({ kind, availability: 'unavailable',
                candidates: [], truncated: false, diagnostic: 'Unavailable' }),
            attachLink: async (request: any) => { attachedRef = request.ref; return {
                snapshot: { schemaVersion: 2, project, revision: 0, sessions: [session] }, session }; },
            dispose() {} };
        const controller = new DeveloperSessionController(() => connection,
            { roots: Promise.resolve([{ resource: { toString: () => uri(root) } }]),
                onWorkspaceChanged: () => ({ dispose() {} }) } as any, () => {});
        await controller.attach(); controller.select(sessionId);
        assert.equal(await controller.browseCandidates(), false);
        assert.equal(controller.candidates?.availability, 'unavailable');
        controller.setLinkDraft('chatId', randomUUID());
        assert.equal(controller.selectedLinkDraft?.chatId.length, 36);
        assert.equal(await controller.attachLink(), true);
        assert.deepEqual(attachedRef, { kind: 'chat', chatId: controller.selectedLinkDraft?.chatId });
        controller.setLinkDraft('kind', 'work-item');
        offered = { kind: 'work-item', availability: 'ready', candidates: [{
            ref: { kind: 'work-item', mapId: 'plan', workItemId: 'work' }, label: 'Plan / Work' }],
            truncated: false, diagnostic: '' };
        assert.equal(await controller.browseCandidates(), true);
        assert.equal(controller.chooseCandidate(0), true);
        assert.equal(controller.selectedLinkDraft?.mapId, 'plan');
        assert.equal(controller.selectedLinkDraft?.workItemId, 'work');
        assert.equal(controller.chooseCandidate(1), false);
        controller.dispose();
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('late browse result cannot populate another selected Session', async () => {
    const project = { canonicalRoot: '/project', projectMindId: null };
    const record = (id: string) => ({ schemaVersion: 2, id, project, revision: 0, title: id,
        objective: '', createdAt: now, updatedAt: now, status: 'active', notes: '', nextActions: [],
        closeout: null, links: [] });
    const first = randomUUID(), second = randomUUID();
    let deliver!: (value: any) => void;
    const delayed = new Promise<any>(resolve => { deliver = resolve; });
    const connection: any = { attach: async () => ({ projectHandle: 'handle', project,
        snapshot: { schemaVersion: 2, project, revision: 0, sessions: [record(first), record(second)] } }),
        candidates: async () => delayed, dispose() {} };
    const controller = new DeveloperSessionController(() => connection,
        { roots: Promise.resolve([{ resource: { toString: () => 'file:///project' } }]),
            onWorkspaceChanged: () => ({ dispose() {} }) } as any, () => {});
    await controller.attach(); controller.select(first);
    const pending = controller.browseCandidates();
    controller.select(second);
    deliver({ kind: 'chat', availability: 'ready', candidates: [{
        ref: { kind: 'chat', chatId: randomUUID() }, label: 'Old Chat' }], truncated: false, diagnostic: '' });
    assert.equal(await pending, false);
    assert.equal(controller.candidates, undefined);
    assert.equal(controller.candidatesLoading, false);
    controller.dispose();
});
