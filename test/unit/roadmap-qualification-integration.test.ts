import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';
import { projectRoadmapTasks } from '../../packages/project-intelligence/lib/roadmap-task-projection.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { resolveRoadmapPromptSource } from '../../packages/theia-extension/src/node/roadmap-prompt-open.ts';

const source = '# Roadmap\n\n## Product Phase 10 — Planning\nStatus: **NOT GREEN**\nObjective: Before\nUnmapped note stays.\n\n## Product Phase 11 — Narrative\nStatus: **NOT GREEN**\nNarrative without a mapped objective.\n';
const intent = (value: string) => JSON.stringify({ type: 'roadmap-intent', intent: 'set-objective', value });

test('linked model intent crosses approval, source recovery and greenfield without gaining execution authority', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-roadmap-qualification-'));
    const root = join(parent, 'existing'), freshRoot = join(parent, 'greenfield');
    const original = join(root, 'ROADMAP.md'), moved = join(root, 'MOVED.md');
    let backend: ChatBackend | undefined;
    try {
        await mkdir(root);
        await mkdir(freshRoot);
        await mkdir(join(root, '.git/objects'), { recursive: true });
        await mkdir(join(root, '.git/refs/heads'), { recursive: true });
        await writeFile(join(root, '.git/HEAD'), 'ref: refs/heads/main\n');
        await writeFile(join(root, '.git/config'), '[core]\n\trepositoryformatversion = 0\n\tbare = false\n');
        await writeFile(original, source);
        const store = new RoadmapStore();
        const imported = await store.acceptImport(root, 0, await previewRoadmapImport(root, 'ROADMAP.md'));
        const editable = imported.checkpoints.find(item => item.title.includes('Planning'))!;
        const unsupported = imported.checkpoints.find(item => item.title.includes('Narrative'))!;
        assert.equal(editable.status, 'not-green');
        assert.equal(unsupported.status, 'not-green');

        const repository = new ChatRepository();
        const outputs: string[] = [];
        const requests: unknown[] = [];
        const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
            models: [{ id: 'measured', label: 'Measured local', usable: true,
                capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 16384 } }] }] }),
        async *generate(selection: unknown, request: unknown) {
            requests.push({ selection, request });
            yield { type: 'complete' as const, text: outputs.shift() ?? '{"type":"no-action","message":"No edit"}' };
        } };
        backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
            new ChatContextComposer({} as never, {} as never, {} as never, repository, store),
            undefined, undefined, new ProjectPlanningActions(store));
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const chatId = randomUUID();
        let chat = await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Roadmap' } });
        const settings = structuredClone(chat.chats[0].settings);
        settings.context = { maxInputTokens: 8192, reservedOutputTokens: 512, history: 'none',
            savedChatSearch: false, allowedSources: ['roadmap-checkpoint'] };
        chat = await backend.mutate({ projectHandle, expectedRevision: chat.revision,
            operation: { type: 'set-settings', chatId, settings } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'saved-panel' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) throw new Error('Chat lease missing');
        const context = async (id = editable.id) => {
            const index = await store.read(root);
            const item = index.checkpoints.find(checkpoint => checkpoint.id === id)!;
            return [{ kind: 'roadmap-checkpoint' as const, id, projectId: index.projectId,
                ownerRevision: index.revision, sourceHash: item.source!.sha256 }];
        };
        const turn = async (refs?: Awaited<ReturnType<typeof context>>) => backend!.runTurn({ projectHandle, chatId,
            leaseToken: lease.token, selectedModel: { connectionId: 'local', modelId: 'measured' },
            content: 'Propose one objective edit', context: refs ?? await context() });

        outputs.push('{bad json', '{bad json');
        await assert.rejects(turn(), /strict JSON/);
        outputs.push(JSON.stringify({ type: 'roadmap-intent', intent: 'set-objective', value: 'Bad',
            actions: [{ type: 'shell', command: 'touch forbidden' }] }),
        JSON.stringify({ type: 'roadmap-intent', intent: 'set-objective', value: 'Bad',
            actions: [{ type: 'agent-task' }] }));
        await assert.rejects(turn(), /strict JSON/);
        outputs.push(intent('Unsupported'), intent('Unsupported'));
        await assert.rejects(turn(await context(unsupported.id)), /strict JSON/);
        assert.equal(await readFile(original, 'utf8'), source);

        outputs.push(intent('Denied'));
        const denied = (await turn()).proposal!;
        assert.match(denied.summary, /documentDiff/);
        assert.equal((await store.read(root)).revision, imported.revision);
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, denied.id, false);
        assert.equal(await readFile(original, 'utf8'), source);
        outputs.push(intent('Approved'));
        const approved = (await turn()).proposal!;
        const prior = await context();
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, approved.id, true);
        assert.match(await readFile(original, 'utf8'), /Objective: Approved\nUnmapped note stays\./);
        assert.equal((await store.read(root)).checkpoints.find(item => item.id === editable.id)?.objective, 'Approved');
        await assert.rejects(turn(prior), /Stale/);
        await assert.rejects(turn([{ ...(await context())[0], projectId: 'foreign' }]), /Stale or foreign/);
        outputs.push('{"type":"no-action","message":"Current source"}');
        await turn();
        assert.match(JSON.stringify(requests.at(-1)), /Approved/);
        assert.match(JSON.stringify(requests.at(-1)), new RegExp((await context())[0].sourceHash));

        outputs.push(intent('Too late'));
        const stale = (await turn()).proposal!;
        await writeFile(original, (await readFile(original, 'utf8')).replace('Objective: Approved', 'Objective: External'));
        await assert.rejects(backend.decidePlanningProposal(projectHandle, chatId, lease.token, stale.id, true), /Stale/);
        const external = await store.previewDocumentSync(root);
        assert.equal(external.state, 'source-changed');
        await store.applyDocumentSync(root, external);
        assert.equal((await store.read(root)).checkpoints.find(item => item.id === editable.id)?.objective, 'External');
        await rename(original, moved);
        assert.equal((await store.previewDocumentSync(root)).state, 'relink-needed');
        const relink = await store.previewRelink(root, 'MOVED.md');
        assert.equal(relink.state, 'ready');
        await store.applyRelink(root, relink, false);
        assert.equal((await store.read(root)).linkedDocument?.path, 'ROADMAP.md');
        await store.applyRelink(root, relink, true);
        assert.equal((await store.read(root)).linkedDocument?.path, 'MOVED.md');
        assert.equal((await store.previewDocumentSync(root)).state, 'unchanged');

        const actions = new ProjectPlanningActions(store);
        const { projectHandle: actionHandle, snapshot } = await actions.attach(root);
        const request = { projectHandle: actionHandle, ownerId: snapshot.projectId,
            expectedRevision: snapshot.revision, sourceHashes: { [editable.id]: snapshot.checkpoints[0].source!.sha256 },
            actions: [{ type: 'document-edit' as const, id: editable.id, objective: 'Interrupted' }] };
        const preview = await actions.preview(request);
        const internals = store as unknown as { replace: (root: string, next: unknown) => Promise<void> };
        const replace = internals.replace.bind(store);
        let writes = 0;
        internals.replace = async (path, next) => {
            await replace(path, next);
            if (++writes === 1) throw new Error('injected crash after pending index write');
        };
        await assert.rejects(actions.apply(request, preview.token, true), /injected crash/);
        assert.equal((await new RoadmapStore().read(root)).linkedDocument?.syncState, 'pending-sync');
        assert.match(await readFile(moved, 'utf8'), /Objective: External/);
        const contradicting = (await readFile(moved, 'utf8')).replace('Objective: External', 'Objective: Contradicting');
        await writeFile(moved, contradicting);
        const restarted = new RoadmapStore();
        assert.equal((await restarted.previewDocumentSync(root)).state, 'conflict');
        const recovery = await restarted.previewPendingRecovery(root);
        assert.equal(recovery.state, 'ready');
        const pendingRevision = (await restarted.read(root)).revision;
        assert.equal((await restarted.applyPendingRecovery(root, recovery, false)).revision, pendingRevision);
        const recovered = await restarted.applyPendingRecovery(root, recovery, true);
        assert.equal(recovered.checkpoints.find(item => item.id === editable.id)?.objective, 'Contradicting');
        assert.equal(recovered.checkpoints.find(item => item.id === editable.id)?.status, 'not-green');
        assert.equal(await readFile(moved, 'utf8'), contradicting);
        assert.equal((await new RoadmapStore().previewDocumentSync(root)).state, 'unchanged');

        const taskDir = join(root, 'docs/tasks/c10-repair');
        await mkdir(taskDir, { recursive: true });
        await writeFile(join(taskDir, 'P1-review.txt'), 'TASK: Correction 10 / P1 — Review\n- Recommended configuration: `GPT-6 Sol High`.\n- Browser required: no.\n- Required unchanged project version: `0.10.16`.\n');
        await writeFile(join(taskDir, 'P2-closeout.txt'), 'TASK: Correction 10 / P2 — Closeout\n- Recommended configuration: `GPT-6 Sol High`.\n- Browser required: yes.\n- Required unchanged project version: `0.10.16`.\n');
        const stack = (await discoverRoadmapTaskStacks(root)).find(item => item.folderName === 'c10-repair')!;
        const prompt = projectRoadmapTasks(recovered, [stack]).nodes.find(item => item.kind === 'prompt')!;
        assert.equal(prompt.status, 'unknown');
        assert.equal(await resolveRoadmapPromptSource(root, prompt.taskSource!.path!, prompt.taskSource!.fingerprint),
            pathToFileURL(join(taskDir, 'P1-review.txt')).href);
        assert.equal(requests.every(call => {
            const value = call as { selection: { connectionId: string; modelId: string };
                request: Record<string, unknown> };
            return value.selection.connectionId === 'local' && value.selection.modelId === 'measured' &&
                !['tools', 'toolChoice', 'functions', 'agentTask', 'executionGrant'].some(key => key in value.request);
        }), true);
        await assert.rejects(lstat(join(root, '.dope/agent')), /ENOENT/);
        assert.equal((await new ChatRepository().read(root)).chats[0].id, chatId);

        const greenfieldStore = new RoadmapStore();
        const greenfield = new RoadmapGreenfield(greenfieldStore);
        const { handle } = await greenfield.begin(freshRoot);
        const phase = greenfield.edit(handle, 0, { type: 'create-phase', title: 'Build', objective: 'Developer plan' });
        greenfield.edit(handle, 1, { type: 'create-checkpoint', phaseId: phase.phases[0].id, title: 'First' });
        const draft = greenfield.preview(handle, 'ROADMAP.md');
        await assert.rejects(greenfield.accept(handle, draft, false), /approval/);
        await assert.rejects(readFile(join(freshRoot, 'ROADMAP.md')), /ENOENT/);
        const created = await greenfield.accept(handle, draft, true);
        assert.equal(created.linkedDocument?.syncState, 'synced');
        assert.equal(await readFile(join(freshRoot, 'ROADMAP.md'), 'utf8'), draft.markdown);
        assert.equal((await new RoadmapStore().read(freshRoot)).revision, created.revision);
        assert.equal((await restarted.read(root)).revision, recovered.revision);
    } finally {
        backend?.dispose();
        await rm(parent, { recursive: true, force: true });
    }
});
