import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';
import { DeveloperSessionBackend } from '../../packages/theia-extension/lib/node/developer-session-backend.js';
import { DeveloperSessionStore } from '../../packages/theia-extension/lib/node/developer-session-store.js';
import { trustedPlanningBasis } from '../../packages/theia-extension/lib/node/developer-session-resolver.js';

const uri = (root: string) => pathToFileURL(root).href;
const now = '2026-10-11T12:00:00.000Z';

test('one persisted cross-store fixture preserves owner truth and prepares a real replay', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-session-cross-store-'));
    const other = await mkdtemp(join(tmpdir(), 'dope-session-cross-store-other-'));
    let physicalInput = 'source';
    const index = basisIndex(() => physicalInput);
    const sessions = new DeveloperSessionBackend(new DeveloperSessionStore(), index as any);
    const foreign = new DeveloperSessionBackend(new DeveloperSessionStore());
    const agents = new AgentStore();
    const planning = new PlanningStore();
    const runtime = new AgentRuntimeBackend(agents, { notifyAgentStateChanged() {} }, undefined, planning);
    try {
        const architecture = `${JSON.stringify({ schemaVersion: 1, systems: [{ id: 'app', name: 'App',
            purpose: 'Fixture', subsystems: [{ id: 'core', name: 'Core', purpose: 'Fixture', roots: ['src'] }] }] })}\n`;
        const fingerprint = createHash('sha256').update(architecture).digest('hex');
        await mkdir(join(root, '.dope'), { recursive: true });
        await writeFile(join(root, '.dope/architecture.json'), architecture);
        await writeFile(join(root, '.dope/smap.json'), JSON.stringify({ schemaVersion: 1, architectureFingerprint: fingerprint }));
        const basis = { architectureRevision: 0, architectureFingerprint: fingerprint,
            physicalInputFingerprint: 'source', physicalGeneration: 1 };
        assert.deepEqual(await trustedPlanningBasis(root, index as any), basis);
        let collection = await planning.mutate(root, 0, { type: 'create', id: 'plan', title: 'Replay plan', objective: 'Build', basis });
        collection = await planning.mutate(root, collection.revision, { type: 'put-transformation', mapId: 'plan', transformation: {
            id: 'change', kind: 'add', currentIds: [], dependsOn: [],
            futureNodes: [{ id: 'core', kind: 'system', name: 'Core', purpose: 'Build', roots: ['src'] }] } });
        const work = { id: 'work', title: 'Eligible work', objective: 'Implement bounded change',
            transformationIds: ['change'], dependsOn: [], requirements: [], constraints: [],
            acceptanceCriteria: ['Focused validation passes'], validationTargets: ['true'], workingSet: ['src'],
            status: 'proposed' as const, assignment: 'SHARED' as const,
            delegablePaths: ['src/agent'], humanReservedPaths: ['src/human'] };
        collection = await planning.mutate(root, collection.revision, { type: 'put-work-item', mapId: 'plan', workItem: work });
        collection = await planning.mutate(root, collection.revision, { type: 'put-work-item', mapId: 'plan', workItem: { ...work, status: 'ready' } });
        collection = await planning.mutate(root, collection.revision, { type: 'transition', mapId: 'plan', status: 'active' });
        const launch = { requestKey: 'p9b-replay', expectedProjectRevision: collection.revision,
            expectedMapRevision: collection.maps[0].revision, planningMapId: 'plan', workItemId: 'work',
            delegablePaths: ['src/agent'], modelPolicy: { kind: 'follow-coding-agent' as const }, controls: {},
            completion: { validation: [{ kind: 'test' as const, label: 'focused', command: 'true' }], requireValidationPass: true },
            validationApproved: true };
        const chatId = randomUUID();
        await new ChatRepository().mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '', title: 'Shared Chat' });
        const decisionId = randomUUID();
        await new ProjectMindStore().mutate(root, 0, { type: 'create', artifact: { schemaVersion: 2, id: decisionId,
            type: 'decision', title: 'Decision', createdAt: now, updatedAt: now, provenance: 'developer',
            archivedAt: null, links: [], status: 'proposed', decision: 'Proceed', context: '', rationale: '',
            consequences: '', alternatives: '', revisitConditions: '' } });
        const stack = await importPhaseStack('p9', [{ filename: 'P1-implement.txt', text: 'TASK: Phase 9 / P1 — Implement\n' +
            '- Recommended configuration: `GPT-6 Sol Medium`.\n- Browser required: no.\n' +
            'The assigned project version is `0.9.1`.\n' },
        { filename: 'P2-closeout.txt', text: 'TASK: Phase 9 / P2 — Closeout\n' +
            '- Recommended configuration: `GPT-6 Sol Medium`.\n- Browser required: no.\n' +
            'The assigned project version is `0.9.2`.\n' }]);
        const legacyId = randomUUID();
        const project = { canonicalRoot: root, projectMindId: null };
        const legacy = { schemaVersion: 1, project, revision: 1, sessions: [{ schemaVersion: 1, id: legacyId,
            project, revision: 1, title: 'Legacy', objective: '', createdAt: now, updatedAt: now,
            status: 'active', notes: '', nextActions: [], closeout: null }] };
        const sessionFile = join(root, '.dope/development-sessions.json');
        await writeFile(sessionFile, `${JSON.stringify(legacy)}\n`);
        const legacyBytes = await readFile(sessionFile);
        const attached = await sessions.attach(uri(root));
        const handle = attached.projectHandle;
        assert.equal(attached.snapshot.schemaVersion, 2);
        assert.deepEqual(attached.snapshot.sessions[0].links, []);
        assert.deepEqual(await readFile(sessionFile), legacyBytes);
        const second = await sessions.mutate({ projectHandle: handle, expectedCollectionRevision: 1,
            expectedSessionRevision: null, operation: { type: 'create', title: 'Second', objective: '' } });
        assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).schemaVersion, 2);
        const foreignHandle = (await foreign.attach(uri(other))).projectHandle;
        await assert.rejects(foreign.resolve({ projectHandle: handle, sessionId: legacyId }), /handle/);
        await assert.rejects(sessions.resolve({ projectHandle: foreignHandle, sessionId: legacyId }), /handle/);
        const agentHandle = (await runtime.attach(uri(root))).projectHandle;
        await agents.createSequence(root, { version: 1, id: 'sequence-one', createdAt: now, updatedAt: now,
            status: 'ready', currentEntryNumber: 1, stack, checkpoints: [],
            basis: { head: 'a'.repeat(40), packageVersion: '0.9.0', worktreeFingerprint: 'e'.repeat(64) } });
        const task = await runtime.launchWorkItem(agentHandle, launch);
        assert.equal((await runtime.launchWorkItem(agentHandle, launch)).id, task.id);
        assert.equal(task.origin.kind, 'work-item');
        assert.equal(task.reviewPolicy?.kind, 'required');
        assert.deepEqual(await agents.listRuns(root), []); // launch creates a task only
        const run = await agents.createRun(root, { version: 1, id: 'run-one', taskId: task.id,
            projectId: task.projectId, status: 'pending', grantId: 'fixture-grant', grantRevision: 0,
            requestedPolicy: task.modelPolicy, projectRoot: '.', createdAt: task.createdAt,
            changedFiles: [], validationResults: [] });
        const linkedRefs = [
            { kind: 'chat' as const, chatId }, { kind: 'planning-map' as const, mapId: 'plan' },
            { kind: 'work-item' as const, mapId: 'plan', workItemId: 'work' },
            { kind: 'agent-task' as const, taskId: task.id },
            { kind: 'agent-run' as const, taskId: task.id, runId: run.id },
            { kind: 'agent-sequence' as const, sequenceId: 'sequence-one' },
            { kind: 'project-mind' as const, artifactType: 'decision' as const, artifactId: decisionId },
        ];
        let snapshot = await sessions.read(handle);
        for (const ref of linkedRefs) {
            const session = snapshot.sessions.find(item => item.id === legacyId)!;
            try {
                snapshot = (await sessions.attachLink({ projectHandle: handle, sessionId: legacyId,
                    expectedCollectionRevision: snapshot.revision, expectedSessionRevision: session.revision, ref })).snapshot;
            } catch (error) { throw new Error(`Attach ${ref.kind}: ${String(error)}`); }
        }
        const secondSession = snapshot.sessions.find(item => item.id === second.session.id)!;
        snapshot = (await sessions.attachLink({ projectHandle: handle, sessionId: secondSession.id,
            expectedCollectionRevision: snapshot.revision, expectedSessionRevision: secondSession.revision,
            ref: linkedRefs[0] })).snapshot;
        const oldRevision = snapshot.revision;
        await assert.rejects(sessions.attachLink({ projectHandle: handle, sessionId: secondSession.id,
            expectedCollectionRevision: oldRevision - 1, expectedSessionRevision: 2,
            ref: linkedRefs[1] }), /Stale/);
        const chatManifestPath = join(root, '.dope/chats/index.json');
        const chatEntry = JSON.parse(await readFile(chatManifestPath, 'utf8')).entries[0];
        const ownerFiles = [chatManifestPath, join(root, '.dope/chats/folders', chatEntry.file),
            join(root, '.dope/planning-maps.json'),
            join(root, `.dope/agent/tasks/${task.id}.json`), join(root, '.dope/agent/runs/run-one/run.json'),
            join(root, '.dope/agent/sequences/sequence-one.json'), join(root, '.dope/project-mind.json')];
        const before = await Promise.all(ownerFiles.map(file => readFile(file)));
        const resolved = await sessions.resolve({ projectHandle: handle, sessionId: legacyId });
        assert.deepEqual(resolved.artifacts.map(item => item.availability), Array(7).fill('resolved'));
        assert.equal(resolved.artifacts[4].validationStatus, 'unavailable');
        assert.equal(resolved.artifacts[4].promotionStatus, 'not-applied');
        assert.equal(resolved.artifacts[2].status, 'ready');
        assert.equal(resolved.artifacts[3].taskOrigin, 'work-item');
        assert.equal(resolved.artifacts[3].objective, work.objective);
        assert.equal(resolved.artifacts[5].source, 'agent-sequence');
        assert.deepEqual(await Promise.all(ownerFiles.map(file => readFile(file))), before);
        const detached = await sessions.detachLink({ projectHandle: handle, sessionId: secondSession.id,
            expectedCollectionRevision: snapshot.revision, expectedSessionRevision: snapshot.sessions.find(item => item.id === secondSession.id)!.revision,
            ref: linkedRefs[0] });
        assert.deepEqual(detached.session.links, []);
        assert.equal((await sessions.get(handle, legacyId))?.links.length, 7);
        assert.deepEqual(await Promise.all(ownerFiles.map(file => readFile(file))), before);

        // Synthetic persisted owner evidence checks projection only; P7 must obtain an actual authorized run.
        const fp = 'b'.repeat(64);
        const validation = { version: 1 as const, kind: 'test' as const, label: 'focused', command: 'true',
            owner: 'dope' as const, candidateFingerprint: fp, workspaceId: 'fixture-workspace',
            durationMs: 1, exitCode: 0, stdout: '', stderr: '', stdoutTruncated: false,
            stderrTruncated: false, status: 'passed' as const };
        const started = await agents.updateRun(root, run, { ...run, status: 'running', startedAt: run.createdAt });
        const held = await agents.updateRun(root, started, { ...started, status: 'blocked',
            changedFiles: ['src/agent/review.txt'], validationResults: [validation],
            candidateDelta: { version: 1, effects: [{ kind: 'create', path: 'src/agent/review.txt',
                after: createHash('sha256').update('candidate\n').digest('hex') }] },
            candidateFingerprint: fp, candidateReview: { state: 'ready', revision: 0, candidateFingerprint: fp,
                diff: '+candidate', diffTruncated: false, changedPaths: ['src/agent/review.txt'], validation: [validation] } });
        assert.equal(held.candidateReview?.state, 'ready');
        const reviewed = await sessions.resolve({ projectHandle: handle, sessionId: legacyId });
        assert.equal(reviewed.artifacts[4].status, 'blocked');
        assert.equal(reviewed.artifacts[4].validationStatus, 'passed');
        assert.equal(reviewed.artifacts[4].promotionStatus, 'not-applied');
        assert.equal(reviewed.artifacts[4].reviewDecision, undefined);
        assert.equal((await planning.read(root)).maps[0].workItems[0].status, 'ready');
        const accepted = await agents.updateRun(root, held, { ...held, status: 'completed', endedAt: held.startedAt,
            reviewDecision: { kind: 'accept', revision: 1, at: held.startedAt!, candidateFingerprint: fp },
            authorityDecision: { allowed: true, blocked: [] }, appliedFiles: ['src/agent/review.txt'] });
        assert.equal(accepted.reviewDecision?.kind, 'accept');
        const ownerBeforeProjection = await Promise.all(ownerFiles.map(file => readFile(file)));
        const projected = await sessions.resolve({ projectHandle: handle, sessionId: legacyId });
        assert.equal(projected.artifacts[4].validationStatus, 'passed');
        assert.equal(projected.artifacts[4].reviewDecision, 'accept');
        assert.equal(projected.artifacts[4].promotionStatus, 'applied');
        assert.equal(projected.artifacts[5].status, 'ready');
        assert.equal(projected.artifacts[6].status, 'proposed');
        assert.deepEqual(await Promise.all(ownerFiles.map(file => readFile(file))), ownerBeforeProjection);
        assert.equal((await planning.read(root)).maps[0].workItems[0].status, 'ready');

        sessions.dispose();
        const restarted = new DeveloperSessionBackend(new DeveloperSessionStore(), index as any);
        try {
            const reopened = await restarted.attach(uri(root));
            assert.equal(reopened.snapshot.revision, detached.snapshot.revision);
            assert.equal(reopened.snapshot.sessions.length, 2);
            assert.equal((await restarted.resolve({ projectHandle: reopened.projectHandle, sessionId: legacyId })).artifacts[4].validationStatus, 'passed');
            physicalInput = 'changed-source';
            const stale = await restarted.resolve({ projectHandle: reopened.projectHandle, sessionId: legacyId });
            assert.equal(stale.artifacts[1].availability, 'stale');
            assert.equal(stale.artifacts[2].availability, 'stale');
            physicalInput = 'source';
            const chatManifest = ownerFiles[0];
            const manifest = JSON.parse(await readFile(chatManifest, 'utf8'));
            manifest.entries = [];
            manifest.revision++;
            await writeFile(chatManifest, `${JSON.stringify(manifest)}\n`);
            assert.equal((await restarted.resolve({ projectHandle: reopened.projectHandle, sessionId: legacyId })).artifacts[0].availability, 'missing');
            const mindFile = join(root, '.dope/project-mind.json');
            await writeFile(mindFile, '{bad json');
            assert.equal((await restarted.resolve({ projectHandle: reopened.projectHandle, sessionId: legacyId })).artifacts[6].availability, 'unavailable');
            assert.equal((await restarted.get(reopened.projectHandle, legacyId))?.links.length, 7);
        } finally { restarted.dispose(); }
        assert.deepEqual((await foreign.read(foreignHandle)).sessions, []);
    } finally {
        sessions.dispose(); foreign.dispose(); await runtime.dispose();
        await rm(root, { recursive: true, force: true });
        await rm(other, { recursive: true, force: true });
    }
});

function basisIndex(input: () => string) {
    return { status: () => ({ state: 'ready', generation: 1, inputFingerprint: input() }),
        snapshot: () => ({ metadata: { generation: 1, inputFingerprint: input() } }),
        inputsCurrent: async () => true };
}
