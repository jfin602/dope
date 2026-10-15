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
import type { ChatContextSelection } from '../../packages/chat/src/service.ts';
import type { ChatClient } from '../../packages/chat/src/service.ts';
import type { RoadmapIndex } from '../../packages/project-intelligence/src/node/roadmap-store.ts';
import type { RoadmapService } from '../../packages/theia-extension/src/roadmap-service.ts';
import type { PlanningMapController } from '../../packages/theia-extension/src/browser/planning-map-controller.ts';

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
    assert.match(widget, /Follow active planning selection/);
    assert.match(widget, /Pin selected checkpoint \/ Planning Map/);
    assert.match(widget, /planningContext: this\.controller\.planningMode/);
    assert.match(widget, /'work-item', 'roadmap-checkpoint', 'saved-chat'/);
    assert.match(widget, /state\.context\.length \|\| state\.activePlanning/);
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
