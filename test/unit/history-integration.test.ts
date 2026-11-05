import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { promisify } from 'node:util';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import type { AgentRun } from '../../packages/agent-core/src/contracts.js';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import type { HistoryEntry, HistoryNavigableOwnerRef } from '../../packages/contracts/src/history.js';
import type { HistorySnapshot } from '../../packages/contracts/src/history-service.js';
import { createProjectMind } from '../../packages/project-intelligence/lib/index.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import type { RoadmapGateIndex } from '../../packages/project-intelligence/src/node/roadmap-gate-domain.js';
import { HistoryBackend } from '../../packages/theia-extension/lib/node/history-backend.js';
import { navigateHistory } from '../../packages/theia-extension/lib/browser/history-navigation.js';
import { exportLegacySessions } from '../../scripts/export-legacy-development-sessions.mjs';

const git = promisify(execFile);
const at = '2026-10-12T12:00:00.000Z';
const basis = { architectureRevision: 1, architectureFingerprint: 'a', physicalInputFingerprint: 'b', physicalGeneration: 1 };

test('legacy v1 and v2 export remains an in-process opt-in read with unchanged bytes', async () => {
    for (const schemaVersion of [1, 2] as const) {
        const root = await mkdtemp(join(tmpdir(), 'dope-history-legacy-integration-'));
        try {
            await mkdir(join(root, '.dope'));
            const session = { schemaVersion, id: randomUUID(), project: { canonicalRoot: root, projectMindId: null },
                revision: 1, title: 'Earlier work', objective: 'Investigate', createdAt: at, updatedAt: at,
                status: 'active', notes: 'Keep this note', nextActions: [], closeout: null,
                ...(schemaVersion === 2 ? { links: [] } : {}) };
            const collection = { schemaVersion, project: session.project, revision: 1, sessions: [session] };
            const file = join(root, '.dope/development-sessions.json');
            const bytes = Buffer.from(`${JSON.stringify(collection, null, 2)}\n`);
            await writeFile(file, bytes);
            const result = JSON.parse(await exportLegacySessions(['--project', root, '--format', 'json']));
            assert.deepEqual(result.collection, collection);
            assert.deepEqual(await readFile(file), bytes);
        } finally { await rm(root, { recursive: true, force: true }); }
    }
});

test('integrated History reads exact owners without mutation and restores focus only in its project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-history-integration-'));
    const other = await mkdtemp(join(tmpdir(), 'dope-history-integration-other-'));
    const first = new HistoryBackend();
    try {
        await git('git', ['init', '-q', root]);
        await writeFile(join(root, 'source.ts'), 'export const value = 1;\n');
        const planning = new PlanningStore();
        const created = await planning.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Goal', basis });
        const projectId = created.projectId;
        const chatId = randomUUID();
        await new ChatRepository().mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '', title: 'Investigation' });
        const index = JSON.parse(await readFile(join(root, '.dope/chats/index.json'), 'utf8'));
        const chatPath = join(root, '.dope/chats/folders', index.entries[0].file);
        const chat = JSON.parse(await readFile(chatPath, 'utf8'));
        chat.createdAt = '2026-10-12T11:00:00.000Z';
        chat.updatedAt = '2026-10-12T13:00:00.000Z';
        chat.lastInteractedAt = at;
        chat.messages = [{ schemaVersion: 1, id: randomUUID(), role: 'assistant', createdAt: at,
            content: '', execution: { schemaVersion: 1, id: randomUUID(), status: 'pending',
                selectedModel: { connectionId: 'local', modelId: 'model' }, startedAt: at } }];
        await writeFile(chatPath, JSON.stringify(chat, null, 2));
        const mindId = randomUUID();
        await writeFile(join(root, '.dope/project-mind.json'), JSON.stringify(createProjectMind(randomUUID(), {
            schemaVersion: 2, type: 'note', id: mindId, title: 'Keep evidence', body: 'Private rationale',
            status: 'active', provenance: 'developer', createdAt: at, updatedAt: at, archivedAt: null, links: []
        })));
        const agents = new AgentStore();
        await agents.createTask(root, { version: 1, id: 'task-1', projectId, createdAt: at, objective: 'Fix parser',
            instructions: 'Private task', projectRoot: '.', modelPolicy: { kind: 'follow-coding-agent' }, controls: {},
            authority: { profile: 'phase-8b-project' }, completion: { validation: [], requireValidationPass: false },
            origin: { kind: 'direct' } });
        const pending: AgentRun = { version: 1, id: 'run-1', taskId: 'task-1', projectId, status: 'pending',
            grantId: 'grant-1', grantRevision: 0, requestedPolicy: { kind: 'follow-coding-agent' },
            projectRoot: '.' as const, createdAt: at, changedFiles: [], validationResults: [] };
        await agents.createRun(root, pending);
        const running: AgentRun = { ...pending, status: 'running', startedAt: at };
        await agents.updateRun(root, pending, running);
        await agents.updateRun(root, running, { ...running, status: 'completed', endedAt: at,
            validationResults: [{ version: 1, kind: 'test', label: 'unit', status: 'passed', owner: 'dope',
                command: 'node --test', candidateFingerprint: 'a'.repeat(64), workspaceId: 'workspace-1',
                durationMs: 1, exitCode: 0, stdout: '', stderr: '', stdoutTruncated: false,
                stderrTruncated: false }] });
        const ownerFiles = [chatPath, join(root, '.dope/chats/index.json'), join(root, '.dope/planning-maps.json'),
            join(root, '.dope/project-mind.json'), join(root, '.dope/agent/tasks/task-1.json'),
            join(root, '.dope/agent/runs/run-1/run.json')];
        const before = await Promise.all(ownerFiles.map(file => readFile(file)));
        const handle = (await first.attach(pathToFileURL(root).href)).projectHandle;
        const snapshot: HistorySnapshot = await first.read(handle);
        assert.equal(snapshot.project.projectId, projectId);
        assert.ok(snapshot.entries.some((entry: HistoryEntry) => entry.owner.kind === 'chat' && entry.occurredAt === at),
            JSON.stringify({ entries: snapshot.entries.filter(entry => entry.source === 'chat'), diagnostics: snapshot.diagnostics }));
        assert.ok(snapshot.entries.some(entry => entry.owner.kind === 'planning-map'));
        assert.ok(snapshot.entries.some(entry => entry.owner.kind === 'project-mind'));
        assert.ok(snapshot.entries.some(entry => entry.owner.kind === 'agent-task'));
        const run = snapshot.entries.find(entry => entry.owner.kind === 'agent-run');
        assert.deepEqual(run?.status, { kind: 'agent-run', state: 'completed', validation: 'passed',
            review: 'none', promotion: 'not-applied' });
        assert.ok(snapshot.entries.some(entry => entry.owner.kind === 'git-dirty' && entry.kind === 'snapshot'));
        assert.equal(JSON.stringify(snapshot).includes('Private rationale'), false);
        assert.equal(JSON.stringify(snapshot).includes('Private task'), false);
        assert.deepEqual(await Promise.all(ownerFiles.map(file => readFile(file))), before);

        await first.recordFocus(handle, { kind: 'chat', chatId });
        first.dispose();
        const restarted = new HistoryBackend();
        try {
            const again = (await restarted.attach(pathToFileURL(root).href)).projectHandle;
            const resumed: HistorySnapshot = await restarted.read(again);
            assert.equal(resumed.continueWith.kind, 'verified-focus');
            const opened: string[] = [];
            const navigation = await navigateHistory(resumed, { kind: 'chat', chatId }, undefined,
                resumed.continueWith.kind === 'verified-focus' ? resumed.continueWith.observedAt : undefined,
                () => restarted.read(again), async () => true,
                { open: async (owner: HistoryNavigableOwnerRef) => { opened.push(JSON.stringify(owner)); return true; } });
            assert.equal(navigation.opened, true);
            assert.deepEqual(opened, [JSON.stringify({ kind: 'chat', chatId })]);
            const otherHandle = (await restarted.attach(pathToFileURL(other).href)).projectHandle;
            await assert.rejects(restarted.read(again), /Invalid History project handle/);
            assert.equal((await restarted.read(otherHandle)).continueWith.kind, 'none');
            assert.deepEqual(await Promise.all(ownerFiles.map(file => readFile(file))), before);
        } finally { restarted.dispose(); }
    } finally { first.dispose(); await rm(root, { recursive: true, force: true }); await rm(other, { recursive: true, force: true }); }
});

test('replayed receipt and review project once after restart; run completion never implies Gate Green', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-history-receipt-'));
    try {
        const planning = new PlanningStore();
        const identity = await planning.mutate(root, 0,
            { type: 'create', id: 'plan', title: 'Plan', objective: 'Goal', basis });
        const roadmap = new RoadmapStore();
        const roadmapProjectId = 'roadmap-owner';
        let index = await roadmap.saveGateIndex(root, 0, 'uninitialized', {
            schemaVersion: 2, projectId: roadmapProjectId, projectRoot: root,
            revision: 1, phases: [], gates: [], corrections: [] });
        index = await roadmap.mutateGateIndex(root, index.revision, roadmapProjectId,
            { type: 'phase.create', id: 'phase', title: 'Phase', objective: 'Deliver' });
        index = await roadmap.mutateGateIndex(root, index.revision, roadmapProjectId,
            { type: 'gate.create', id: 'gate', parentPhaseId: 'phase', designation: 'G1',
                title: 'Gate', purpose: 'Check', criteria: [{ id: 'criterion', title: 'Check', expectedResult: 'Pass' }] });
        const agents = new AgentStore();
        await agents.createTask(root, { version: 1, id: 'task', projectId: identity.projectId, createdAt: at,
            objective: 'Private objective', instructions: 'secret token', projectRoot: '.',
            modelPolicy: { kind: 'follow-coding-agent' }, controls: {}, authority: { profile: 'phase-8b-project' },
            completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' } });
        const run: AgentRun = { version: 1, id: 'run', taskId: 'task', projectId: identity.projectId,
            status: 'pending', grantId: 'grant', grantRevision: 0,
            requestedPolicy: { kind: 'follow-coding-agent' }, projectRoot: '.', createdAt: at,
            changedFiles: [], validationResults: [] };
        await agents.createRun(root, run);
        const running = await agents.updateRun(root, run, { ...run, status: 'running', startedAt: at });
        const completed = await agents.updateRun(root, running, { ...running, status: 'completed', endedAt: at });
        await agents.appendEvent(root, { version: 1, runId: 'run', sequence: 1, at, kind: 'status',
            status: 'completed', summary: 'secret tool output' });
        const source = { projectId: roadmapProjectId, revision: index.revision, sha256: 'a'.repeat(64) };
        const receipt = { eventId: 'receipt', origin: 'reviewed-observation' as const,
            ownerId: roadmapProjectId, phaseId: 'phase', gateId: 'gate', workItemId: 'work',
            testedHead: 'b'.repeat(40), method: 'manual', checkId: 'manual', artifactSha256: 'c'.repeat(64),
            artifactLocation: 'private/artifact.txt', assertionSha256: 'd'.repeat(64), scope: 'check',
            recordedAt: at, reviewerId: 'owner', reviewedAt: at };
        index = await roadmap.mutateGateIndex(root, index.revision, roadmapProjectId,
            { type: 'evidence.propose', gateId: 'gate', criterionId: 'criterion', id: 'receipt',
                result: 'fail', kind: 'observation', summary: 'private source body', verifiedBy: 'owner',
                observedAt: at, source, receipt });
        const read = async () => {
            const backend = new HistoryBackend();
            try { return await backend.read((await backend.attach(pathToFileURL(root).href)).projectHandle); }
            finally { backend.dispose(); }
        };
        const proposed = await read();
        assert.equal(proposed.entries.filter(entry => entry.sourceId.startsWith('receipt:')).length, 1);
        assert.equal(proposed.entries.find(entry => entry.sourceId.startsWith('receipt:'))?.ownerProjectId,
            roadmapProjectId);
        assert.equal(proposed.entries.some(entry => entry.sourceId.startsWith('gate-qualification:')), false);
        assert.equal(proposed.entries.find(entry => entry.sourceId === 'run:run')?.status.kind, 'agent-run');
        assert.equal(JSON.stringify(proposed).includes('secret tool output'), false);
        assert.equal(JSON.stringify(proposed).includes('private source body'), false);
        assert.equal(JSON.stringify(proposed).includes('private/artifact.txt'), false);
        index = await roadmap.mutateGateIndex(root, index.revision, roadmapProjectId,
            { type: 'evidence.approve', gateId: 'gate', criterionId: 'criterion', id: 'receipt',
                reviewerId: 'owner', reviewedAt: at, currentSource: source });
        const restarted = await read();
        assert.equal(restarted.entries.filter(entry => entry.sourceId.startsWith('receipt:')).length, 2);
        assert.equal(new Set(restarted.entries.map(entry => entry.sourceId)).size, restarted.entries.length);
        assert.equal(restarted.entries.find(entry => entry.sourceId.startsWith('gate-qualification:'))?.title,
            'Gate qualification: not-green');
        assert.deepEqual((await read()).entries, restarted.entries);
        await assert.rejects(roadmap.mutateGateIndex(root, index.revision, roadmapProjectId,
            { type: 'evidence.approve', gateId: 'gate', criterionId: 'criterion', id: 'receipt',
                reviewerId: 'owner', reviewedAt: at, currentSource: source }), /not awaiting review/);
        index = await roadmap.mutateGateIndex(root, index.revision, roadmapProjectId,
            { type: 'gate.blockers', id: 'gate', reasons: [] });
        assert.deepEqual((await read()).entries, restarted.entries);
        assert.equal((await agents.readRun(root, 'run'))?.status, completed.status);
        assert.equal((await roadmap.read<RoadmapGateIndex>(root)).gates[0].qualificationStatus, 'not-green');
    } finally { await rm(root, { recursive: true, force: true }); }
});
