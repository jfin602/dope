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
