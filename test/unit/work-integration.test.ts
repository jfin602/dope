import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import { WorkSelectionController, workTitle } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import { readSharedPanelLayout, SharedPanelState, WorkOpenOwners } from
    '../../packages/theia-extension/lib/browser/shared-panel-state.js';
import { chatLauncherIds, chatPanelOptions, openChatPanel, panelModule, workLauncherIds } from
    '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';

const at = '2026-10-08T12:00:00Z';
const project = 'file:///project';
const head = 'a'.repeat(40);

test('Work navigation restores independent Chat and completed stack without mutation; reopened transcript starts at the beginning', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-work-integration-'));
    try {
        const store = new AgentStore();
        const task = { version: 1, id: 'task-1', createdAt: at, objective: 'Original implementation',
            instructions: 'Implement one change', projectRoot: '.', modelPolicy: { kind: 'follow-coding-agent' },
            controls: {}, authority: { profile: 'phase-8b-project' },
            completion: { validation: [{ kind: 'test', label: 'npm test', command: 'npm test' }],
                requireValidationPass: true }, origin: { kind: 'direct' } };
        const run = { version: 1, id: 'run-1', taskId: task.id, status: 'pending', grantId: 'grant-1',
            grantRevision: 0, requestedPolicy: task.modelPolicy, projectRoot: '.', createdAt: at,
            changedFiles: [], validationResults: [] };
        await store.createTask(root, task as any);
        const pendingRun = await store.createRun(root, run as any);
        await store.updateRun(root, pendingRun, { ...pendingRun, status: 'running', startedAt: at });
        await store.createRun(root, { ...run, id: 'legacy-run' } as any);
        const prompt = (number: number) => ({ filename: `P${number}-${number === 2 ? 'closeout' : 'step'}.txt`, text:
            `TASK: Correction 8 / P${number} — ${number === 2 ? 'Closeout' : 'Step'} ${number}\n- Recommended configuration: \`GPT-6 Sol Medium\`.\n` +
            `- Browser required: ${number === 2 ? 'yes' : 'no'}.\n- Required unchanged project version: \`0.8.20\`.\n` });
        const stack = await importPhaseStack('c8-work-integration', [prompt(1), prompt(2)]);
        const sequence = { version: 1, id: 'sequence-1', createdAt: at, updatedAt: at, status: 'completed',
            currentEntryNumber: 3, stack, checkpoints: [{ entryNumber: 1, sha: head },
                { entryNumber: 2, sha: 'b'.repeat(40), preGateBasis: { head, packageVersion: '0.8.20',
                    worktreeFingerprint: 'e'.repeat(64) } }],
            basis: { head, packageVersion: '0.8.20', worktreeFingerprint: 'e'.repeat(64) } };
        await store.createSequence(root, sequence as any);
        await store.appendTranscript(root, run.id, { kind: 'message', at, text: 'Beginning of work' });
        await store.appendTranscript(root, run.id, { kind: 'command-start', at, commandId: 'command-1',
            command: 'npm test', cwd: '.' });
        for (let index = 0; index < 105; index++)
            await store.appendTranscript(root, run.id, { kind: 'message', at, text: `Progress ${index}` });
        await store.appendTranscript(root, run.id, { kind: 'command-finish', at, commandId: 'command-1',
            status: 'completed', exitCode: 0, stdout: 'passed' });
        const reopened = new AgentStore();
        const cursors: number[] = [], scans: string[] = [];
        let mutations = 0;
        const runtime = {
            async attach() { return { projectHandle: root }; },
            async listTaskStacks(_handle: string, tasksRoot: string) {
                scans.push(tasksRoot);
                return [{ folderName: stack.folderName, sequenceId: sequence.id, valid: true,
                    sequenceStatus: 'completed', mode: 'correction', phase: 8 }];
            },
            listSequences: () => reopened.listSequences(root), listTasks: () => reopened.listTasks(root),
            listRuns: () => reopened.listRuns(root),
            readTask: (_handle: string, id: string) => reopened.readTask(root, id),
            readRun: (_handle: string, id: string) => reopened.readRun(root, id),
            readTranscript: (_handle: string, id: string, cursor: number, limit: number) => {
                cursors.push(cursor); return reopened.readTranscript(root, id, cursor, limit);
            },
            async sequenceEvidence() { return { head, packageVersion: '0.8.20', clean: true,
                worktreeFingerprint: 'e'.repeat(64) }; },
            async codingAgentReady() { return false; },
            async openTaskStack() { mutations++; throw new Error('Existing stack must not reopen'); },
            async start() { mutations++; }, async startSequence() { mutations++; },
            async checkpointSequence() { mutations++; }, async cancel() { mutations++; }
        } as unknown as AgentRuntimeService;
        const owners = new WorkOpenOwners();
        assert.equal(chatPanelOptions('work').module, 'work');
        assert.equal(chatPanelOptions('chat').module, 'chat');
        assert.equal(panelModule({ instanceId: '11111111-1111-4111-8111-111111111111' },
            { panelMode: 'work' }), 'work');
        assert.equal(panelModule({ instanceId: chatLauncherIds.left.split(':')[1] },
            { panelMode: 'work' }), 'chat');
        assert.equal(panelModule({ instanceId: workLauncherIds.left.split(':')[1] },
            { panelMode: 'chat' }), 'work');
        let focused = 0;
        const first = new SharedPanelState(owners, 'panel-a', () => focused++, () => {});
        first.attach(project);
        assert.equal(first.selectWork({ kind: 'run', id: run.id }), true);
        const saved = first.layout('saved-chat');
        first.setMode('chat'); first.setMode('work');
        assert.equal(first.layout('saved-chat').chatId, 'saved-chat');
        const second = new SharedPanelState(owners, 'panel-b', () => {}, () => {});
        second.attach(project);
        assert.equal(second.selectWork({ kind: 'run', id: run.id }), false);
        assert.equal(focused, 1);
        assert.equal(second.selectWork({ kind: 'sequence', id: sequence.id }), true);
        first.dispose(); second.dispose();
        const restored = new SharedPanelState(owners, 'panel-a', () => {}, () => {});
        restored.restore(readSharedPanelLayout(saved)!); restored.attach(project);
        assert.deepEqual(restored.work, { kind: 'run', id: run.id });
        assert.equal(restored.layout('saved-chat').chatId, 'saved-chat');
        const controller = new WorkSelectionController(runtime, () => {});
        await controller.attach(project);
        await controller.select(restored.work);
        assert.deepEqual(scans, ['docs/tasks/']);
        assert.deepEqual(cursors, [0, 100]);
        assert.equal(controller.transcript.length, 107);
        assert.equal(controller.transcript[0].kind, 'message');
        assert.equal((controller.transcript[0] as any).text, 'Beginning of work');
        const command = controller.transcript[1] as any;
        assert.equal(command.commandId, 'command-1');
        assert.equal(command.status, 'completed');
        assert.equal(command.stdout, 'passed');
        assert.deepEqual(controller.selectedRun?.validationResults, []);
        assert.equal(controller.selectedTask?.completion.validation[0]?.command, 'npm test');
        assert.equal(workTitle(restored.work!, controller.selectedRun, controller.selectedTask), 'Original implementation');
        await controller.select({ kind: 'run', id: 'legacy-run' });
        assert.equal(controller.transcriptState, 'not-recorded');
        await controller.select({ kind: 'sequence', id: sequence.id });
        assert.equal(controller.phase.selected?.status, 'completed');
        assert.equal(workTitle({ kind: 'sequence', id: sequence.id }, undefined, undefined, controller.phase.selected), 'Closeout 2');
        assert.equal(workTitle({ kind: 'run', id: run.id }, run as any, task as any), 'Original implementation');
        assert.deepEqual(await reopened.readSequence(root, sequence.id), sequence);
        assert.equal((await reopened.readRun(root, run.id))?.status, 'running');
        assert.equal(mutations, 0);
        restored.dispose();

        const areas: string[] = [];
        const shell = { async addWidget(_widget: object, options: { area: string }) { areas.push(options.area); },
            async activateWidget() {} };
        await openChatPanel('center', async options => ({ id: options.instanceId }), shell);
        await openChatPanel('bottom', async options => ({ id: options.instanceId }), shell);
        assert.deepEqual(areas, ['main', 'bottom']);
        assert.notEqual(chatLauncherIds.left, workLauncherIds.left);
        assert.notEqual(chatLauncherIds.right, workLauncherIds.right);
        const commands = await readFile(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
        assert.match(commands, /id: 'dope\.agentRun\.open' \}, \{ execute: \(\) => openWork\('center'\) \}/);
        assert.match(commands, /id: 'dope\.phaseStack\.open' \}, \{ execute: \(\) => openWork\('center', true\) \}/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('project switch cannot let an old Prompt Stack scan suppress the new project', async () => {
    let release!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const scanning = new Promise<void>(resolve => { started = resolve; });
    const scans: string[] = [];
    const runtime = {
        async attach(project: string) { return { projectHandle: project }; },
        async listTaskStacks(handle: string, tasksRoot: string) {
            scans.push(`${handle}:${tasksRoot}`);
            if (handle === 'old') { started(); await waiting; }
            return [];
        },
        async listSequences() { return []; }, async listTasks() { return []; }, async listRuns() { return []; },
        async sequenceEvidence() { return { head, packageVersion: '0.8.20', worktreeFingerprint: 'basis' }; },
        async codingAgentReady() { return false; }
    } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {});
    const old = controller.attach('old');
    await scanning;
    await controller.attach('new');
    release(); await old;
    assert.deepEqual(scans, ['old:docs/tasks/', 'new:docs/tasks/']);
    assert.equal(controller.project, 'new');
    assert.equal(controller.phase.handle, 'new');
    assert.equal(controller.phase.busy, false);
});
