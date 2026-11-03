import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatOpenOwners, ChatPanelController } from '../../packages/theia-extension/lib/browser/chat-panel-controller.js';
import { ChatPlanningSelection } from '../../packages/theia-extension/lib/browser/chat-planning-selection.js';
import { RoadmapInspectorModel } from '../../packages/theia-extension/lib/browser/roadmap-inspector-model.js';
import type { ChatConnection } from '../../packages/theia-extension/src/browser/chat-panel-controller.js';
import type { ChatContextSelection, ChatRoadmapStageSnapshot } from '../../packages/chat/src/service.ts';
import type { ChatPlanningProposal } from '../../packages/chat/src/service.ts';
import type { ChatClient } from '../../packages/chat/src/service.ts';
import type { RoadmapIndex } from '../../packages/project-intelligence/src/node/roadmap-store.ts';
import type { RoadmapService } from '../../packages/theia-extension/src/roadmap-service.ts';
import type { PlanningMapController } from '../../packages/theia-extension/src/browser/planning-map-controller.ts';

test('manual live Roadmap View re-reads the current leased stage and refuses stale ownership', async () => {
    const controller = new ChatPanelController(() => { throw new Error('no connection'); }, () => {});
    const snapshot = { proposalId: 'proposal', chatId: 'chat', turnId: 'turn', projectId: 'project',
        ownerId: 'project', revision: 0, sourceHash: null, sequence: 1,
        expiresAt: Date.now() + 60_000, operationIds: ['one'], entityIds: ['phase'],
        counts: { phases: 1, gates: 0, criteria: 0 }, incompletePhaseIds: ['phase'], complete: false,
        preview: { source: 'validated-roadmap', steps: [], entities: [], totalChanged: 1,
            additionalChanges: 0, parentTitles: {} } } as ChatRoadmapStageSnapshot;
    let backend = { ...snapshot, sequence: 2 };
    const connection = { readNativeRoadmapStage: async () => backend } as unknown as ChatConnection;
    Object.assign(controller, { workspace: 'file:///project', chatId: 'chat', running: true,
        roadmapStage: snapshot, lease: { workspace: 'file:///project', chatId: 'chat',
            handle: 'handle', token: 'lease', connection } });
    assert.equal((await controller.readCurrentRoadmapStage()).sequence, 2);
    backend = { ...backend, projectId: 'foreign' };
    await assert.rejects(controller.readCurrentRoadmapStage(), /stale|changed project/i);
    backend = { ...backend, projectId: 'project' };
    controller.running = false;
    await assert.rejects(controller.readCurrentRoadmapStage(), /no longer active/i);
    controller.dispose();
});

test('Roadmap preview control shows provisional revision-zero proposals only in the current leased Chat', () => {
    const controller = new ChatPanelController(() => { throw new Error('no connection'); },
        () => {}, new ChatOpenOwners(), 'preview');
    const proposal: ChatPlanningProposal = { id: 'proposal', chatId: 'chat', messageId: 'message',
        ownerId: 'project', revision: 5, changedIds: ['gate'], action: { type: 'gate.edit', id: 'gate' },
        summary: '', preview: { source: 'validated-roadmap', steps: [], entities: [], totalChanged: 0,
            additionalChanges: 0, parentTitles: {} } };
    Object.assign(controller, { workspace: 'file:///project', chatId: 'chat', planningProposal: proposal,
        lease: { workspace: 'file:///project', chatId: 'chat', handle: 'handle', token: 'token', connection: {} } });
    assert.equal(controller.canViewPlanningProposal('proposal'), true);
    assert.equal(controller.canViewPlanningProposal('another'), false);
    controller.pending = true;
    assert.equal(controller.canViewPlanningProposal('proposal'), false);
    controller.pending = false;
    controller.workspace = 'file:///other';
    assert.equal(controller.canViewPlanningProposal('proposal'), false);
    controller.workspace = 'file:///project';
    controller.planningProposal = { ...proposal, revision: 0 };
    assert.equal(controller.canViewPlanningProposal('proposal'), true);
    // A revision-zero preview is a review affordance, not a canonical acceptance.
    controller.planningProposal = undefined;
    assert.equal(controller.canViewPlanningProposal('proposal'), false);
    controller.planningProposal = { ...proposal, revision: 0 };
    assert.equal(controller.canViewPlanningProposal('proposal'), true);
    controller.planningProposal = { ...proposal, revision: 0, id: 'replacement' };
    assert.equal(controller.canViewPlanningProposal('proposal'), false);
    controller.planningProposal = { ...proposal, preview: undefined };
    assert.equal(controller.canViewPlanningProposal('proposal'), false);
    Object.assign(controller, { lease: undefined });
    controller.dispose();
});

test('empty schema-2 Roadmap does not become implicit Chat context', () => {
    const workspace = 'file:///tmp/empty-roadmap-chat';
    const index = { schemaVersion: 2 as const, projectId: 'uninitialized', projectRoot: '/tmp/empty-roadmap-chat',
        revision: 0, phases: [], gates: [] };
    let onRoadmapChange: (() => void) | undefined;
    const inspector = { projectUri: workspace, gateIndex: index, selectedId: undefined,
        onChange: (listener: () => void) => { onRoadmapChange = listener; return { dispose() {} }; } } as unknown as RoadmapInspectorModel;
    const planning = { onChange: () => ({ dispose() {} }) } as unknown as PlanningMapController;
    const selection = new ChatPlanningSelection(inspector, planning, {} as RoadmapService);
    assert.equal(selection.current(workspace), undefined);
    onRoadmapChange?.();
    assert.equal(selection.current(workspace), undefined);
});

test('one saved Chat follows current checkpoint, pins exact owner, restores and keeps its lease', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-panel-'));
    const workspace = pathToFileURL(root).href;
    const index: RoadmapIndex = { schemaVersion: 1, projectId: 'project', projectRoot: root, revision: 1,
        checkpoints: [{ id: 'p1', kind: 'phase', title: 'P1', objective: 'First', order: 1,
            dependencies: [], links: [], status: 'unknown', readOnly: false, evidence: [] },
        { id: 'p2', kind: 'phase', title: 'P2', objective: 'Second', order: 2,
            dependencies: [], links: [], status: 'unknown', readOnly: false, evidence: [] }] };
    const roadmap = { read: async () => index } as RoadmapService;
    const inspector = new RoadmapInspectorModel(roadmap);
    inspector.setSnapshot(workspace, index); inspector.select('p1');
    const planning = { projectWorkspace: workspace, collection: { projectId: 'planning', maps: [] },
        onChange: () => ({ dispose() {} }) } as unknown as PlanningMapController;
    const selection = new ChatPlanningSelection(inspector, planning, roadmap);
    const repository = new ChatRepository(), owners = new ChatOpenOwners();
    const calls: ChatContextSelection[][] = [];
    let progressChecked = false;
    let updates = 0;
    const connect = (): ChatConnection => {
        const backend = new ChatBackend(repository, { notifyChatEvent() {} });
        let client: ChatClient | undefined;
        return Object.assign(backend, { setClient(next: ChatClient | undefined) { client = next; },
            runTurn: async (request: { projectHandle: string; chatId: string; context?: ChatContextSelection[] }) => {
            calls.push(request.context ?? []);
            if (calls.length === 1) {
                const event = { projectHandle: request.projectHandle, kind: 'planning-progress' as const,
                    chatId: request.chatId, messageId: 'turn-1', stage: 'waiting' as const };
                const before = updates;
                client?.notifyChatEvent(event);
                assert.equal(first.planningProgress?.stage, 'waiting');
                assert.equal(updates, before + 1);
                client?.notifyChatEvent(event);
                assert.equal(updates, before + 1);
                client?.notifyChatEvent({ ...event, stage: 'validating' });
                assert.equal(first.planningProgress?.stage, 'validating');
                assert.equal(updates, before + 2);
                const snapshot = { proposalId: 'proposal', chatId: request.chatId, turnId: 'turn-1',
                    projectId: 'project', ownerId: 'project', revision: 1, sourceHash: null,
                    sequence: 1, expiresAt: Date.now() + 60_000, operationIds: ['one'],
                    entityIds: ['phase'], counts: { phases: 1, gates: 0, criteria: 0 },
                    incompletePhaseIds: ['phase'], complete: false,
                    preview: { source: 'validated-roadmap', steps: [], entities: [],
                        totalChanged: 1, additionalChanges: 0, parentTitles: {} } } as ChatRoadmapStageSnapshot;
                const staged = { projectHandle: request.projectHandle, kind: 'roadmap-stage' as const,
                    chatId: request.chatId, messageId: 'turn-1', snapshot };
                client?.notifyChatEvent(staged);
                assert.equal(first.roadmapStage?.sequence, 1);
                client?.notifyChatEvent({ ...staged, snapshot: { ...snapshot, sequence: 0 } });
                assert.equal(first.roadmapStage?.sequence, 1);
                client?.notifyChatEvent({ ...staged, messageId: 'old-turn', snapshot: null,
                    reason: 'cancelled' });
                assert.equal(first.roadmapStage?.sequence, 1);
                client?.notifyChatEvent({ ...staged, snapshot: null, reason: 'cancelled' });
                client?.notifyChatEvent({ ...staged, snapshot: { ...snapshot, sequence: 2 } });
                assert.equal(first.roadmapStage, null);
                assert.equal(updates, before + 2);
                progressChecked = true;
            }
            return { refs: [], diagnostics: [], usedTokens: 0, budgetTokens: 4096 };
        } });
    };
    const first = new ChatPanelController(connect, () => { updates++; }, owners, 'left', () => {}, selection);
    try {
        await first.attach(workspace);
        assert.equal(await first.newChat(''), true);
        const chatId = first.chatId!;
        first.draft = 'First turn';
        assert.equal(await first.runTurn(), true);
        assert.equal(progressChecked, true);
        assert.equal(first.planningProgress, undefined);
        assert.equal(calls.at(-1)?.[0].id, 'p1');
        first.addContext({ kind: 'file', id: 'planning-brief.md' });
        first.draft = 'Context-heavy turn';
        assert.equal(await first.runTurn(), true);
        assert.deepEqual(calls.at(-1)?.map(item => item.kind), ['roadmap-checkpoint', 'file']);
        inspector.select('p2'); index.revision = 2; inspector.setSnapshot(workspace, index);
        first.draft = 'Next turn';
        assert.equal(await first.runTurn(), true);
        assert.deepEqual(calls.at(-1)?.[0], { kind: 'roadmap-checkpoint', id: 'p2', projectId: 'project', ownerRevision: 2 });
        assert.equal(first.pinPlanning(), true);
        const pin = first.pinnedPlanning!;
        inspector.select('p1');
        first.draft = 'Pinned turn';
        assert.equal(await first.runTurn(), true);
        assert.equal(calls.at(-1)?.[0].id, 'p2');
        const competitor = new ChatPanelController(connect, () => {}, owners, 'right');
        await competitor.attach(workspace);
        assert.equal(await competitor.select(chatId), false);
        first.dispose();
        await new Promise(resolve => setTimeout(resolve, 20));
        const reopened = new ChatPanelController(connect, () => {}, owners, 'center', () => {}, selection);
        reopened.restorePlanning('pin', pin, workspace);
        await reopened.attach(workspace);
        assert.equal(await reopened.select(chatId, true), true);
        assert.equal(reopened.chatId, chatId);
        assert.equal(reopened.pinnedPlanning?.id, 'p2');
        index.revision = 3;
        reopened.draft = 'Must stay in draft';
        assert.equal(await reopened.runTurn(), false);
        assert.match(reopened.error, /stale/i);
        assert.equal(reopened.draft, 'Must stay in draft');
        assert.equal(calls.length, 4);
        reopened.followPlanning();
        inspector.setSnapshot(workspace, index);
        reopened.draft = 'Fresh';
        assert.equal(await reopened.runTurn(), true);
        assert.equal(calls.at(-1)?.[0].id, 'p1');
        reopened.dispose(); competitor.dispose();
        const saved = await repository.read(root);
        assert.equal(saved.chats.length, 1);
        assert.equal(saved.chats[0].id, chatId);
    } finally { first.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('selection resolver rejects missing and foreign owner state; map views never launch Chat', async () => {
    const root = 'file:///tmp/roadmap-panel';
    const index: RoadmapIndex = { schemaVersion: 1, projectId: 'project', projectRoot: '/tmp/roadmap-panel', revision: 1,
        checkpoints: [{ id: 'p1', kind: 'phase', title: 'P1', objective: '', order: 1,
            dependencies: [], links: [], status: 'unknown', readOnly: false, evidence: [] }] };
    const roadmap = { read: async () => index } as RoadmapService;
    const inspector = new RoadmapInspectorModel(roadmap);
    inspector.setSnapshot(root, index); inspector.select('p1');
    const planning = { projectWorkspace: root, collection: { projectId: 'planning', maps: [] },
        onChange: () => ({ dispose() {} }) } as unknown as PlanningMapController;
    const selection = new ChatPlanningSelection(inspector, planning, roadmap);
    assert.equal(selection.current(root)?.id, 'p1');
    const pin = selection.current(root)!;
    index.checkpoints = [];
    await assert.rejects(selection.resolve(root, pin, true), /missing/i);
    index.projectId = 'foreign';
    await assert.rejects(selection.resolve(root, pin, true), /another project/i);
    const canvas = await readFile(new URL('../../packages/theia-extension/src/browser/roadmap-canvas-widget.ts', import.meta.url), 'utf8');
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(canvas, /openChatPanel|ChatPanelWidget|activateWidget/);
    assert.match(widget, /Follow planning selection/);
    assert.match(widget, /Pin planning selection/);
    assert.doesNotMatch(widget, /Following active selection:|Roadmap Chat editing is not yet qualified/);
    assert.match(widget, /planningContext: this\.controller\.planningMode/);
    assert.match(widget, /Current planning selection/);
    assert.match(widget, /this\.planningSelection!\.resolve\(workspace, planning, true\)/);
});

test('Bridge request remains bound to the selected Prepare Work checkpoint and map revision', () => {
    const workspace = 'file:///tmp/bridge-panel';
    const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
        physicalInputFingerprint: 'source', physicalGeneration: 1 };
    const index: RoadmapIndex = { schemaVersion: 1, projectId: 'project', projectRoot: '/tmp/bridge-panel', revision: 4,
        checkpoints: [{ id: 'checkpoint', kind: 'milestone', title: 'Checkpoint', objective: 'Implement it', order: 0,
            dependencies: [], links: [{ owner: 'planning-map', targetId: 'map', ownerProjectId: 'planning-project',
                ownerRevision: 3, basis }],
            status: 'active', readOnly: false, evidence: [] }] };
    const inspector = new RoadmapInspectorModel({ read: async () => index } as RoadmapService);
    inspector.setSnapshot(workspace, index); inspector.select('checkpoint');
    const planning = { projectWorkspace: workspace, selected: { id: 'map', projectId: 'planning-project', revision: 3 },
        collection: { projectId: 'planning-project' }, prepareWorkContext: { workspace, projectId: 'project',
            planningProjectId: 'planning-project',
            checkpointId: 'checkpoint', title: 'Checkpoint', objective: 'Implement it', requirements: [],
            impactReferences: [], mapId: 'map', mapRevision: 3 },
        onChange: () => ({ dispose() {} }) } as unknown as PlanningMapController;
    const selection = new ChatPlanningSelection(inspector, planning, {} as RoadmapService);
    assert.deepEqual(selection.bridge(workspace, ['system']), { projectId: 'project', checkpointId: 'checkpoint',
        roadmapRevision: 4, mapId: 'map', mapRevision: 3, branchIds: ['system'] });
    index.checkpoints[0].links[0].basis = undefined;
    assert.throws(() => selection.bridge(workspace, ['system']), /current linked Planning Map/);
    index.checkpoints[0].links[0].basis = basis;
    planning.selected!.revision = 4;
    assert.throws(() => selection.bridge(workspace, ['system']), /current linked Planning Map/);
});

test('Planning Map Follow refreshes the same map and Pin rejects a changed map revision', async () => {
    const root = 'file:///tmp/planning-panel';
    const inspector = new RoadmapInspectorModel({ read: async () => { throw new Error('Roadmap should not open'); } } as RoadmapService);
    let revision = 2;
    const planning = { projectWorkspace: root, selectedMapId: 'map-a', selected: { id: 'map-a', revision: 2 },
        collection: { projectId: 'planning-project', maps: [{ id: 'map-a', revision: 2 }] },
        onChange: () => ({ dispose() {} }), navigationMap: async () => ({ id: 'map-a', revision }) } as unknown as PlanningMapController;
    const selection = new ChatPlanningSelection(inspector, planning, {} as RoadmapService);
    const pin = selection.current(root)!;
    assert.equal(pin.kind, 'planning-map');
    revision = 3;
    assert.equal((await selection.resolve(root, pin, false)).ownerRevision, 3);
    await assert.rejects(selection.resolve(root, pin, true), /stale/i);
    await assert.rejects(selection.resolve('file:///tmp/other', pin, false), /another project/i);
});
