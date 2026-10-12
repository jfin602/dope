import assert from 'node:assert/strict';
import test from 'node:test';
import { navigateSessionArtifact } from '../../packages/theia-extension/lib/browser/developer-session-navigation.js';
import { ChatOpenOwners } from '../../packages/theia-extension/lib/browser/chat-panel-controller.js';
import { WorkOpenOwners } from '../../packages/theia-extension/lib/browser/shared-panel-state.js';
import { WorkSelectionController } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';

const workspace = 'file:///project-a';
const chatId = 'd1a2b3c4-1111-4111-8111-111111111111';
const chat = { kind: 'chat', chatId } as const;
const run = { kind: 'agent-run', taskId: 'task-1', runId: 'run-1' } as const;
const task = { kind: 'agent-task', taskId: 'task-1' } as const;
const sequence = { kind: 'agent-sequence', sequenceId: 'sequence-1' } as const;
const project = { canonicalRoot: '/project-a', projectMindId: null };

function fixture(ref: any = chat) {
    const session = { id: 'session-1', project, revision: 3, links: [ref] } as any;
    const collection = { project, revision: 7, sessions: [session] } as any;
    const resolution = { sessionId: session.id, sessionRevision: 3, collectionRevision: 7,
        artifacts: [{ ref, availability: 'resolved', diagnostic: 'Exact owner metadata' }] } as any;
    return { workspace, session, collection, resolution, current: () => true };
}

test('Chat and Work links focus their existing single owner by exact project and identity', async () => {
    const chats = new ChatOpenOwners(), work = new WorkOpenOwners();
    const calls: string[] = [];
    chats.reserve(workspace, chatId, 'chat-panel', () => calls.push('focus-chat'));
    work.reserve(workspace, { kind: 'run', id: run.runId }, 'work-panel',
        () => calls.push('focus-run'), () => {});
    const owners = {
        focusChat: (root: string, id: string) => chats.focus(root, id),
        focusWork: (root: string, selection: any) => work.focus(root, selection),
        openChat: async () => { calls.push('open-chat'); return true; },
        openWork: async () => { calls.push('open-work'); return true; },
    };
    assert.equal((await navigateSessionArtifact(fixture(chat), chat, owners)).opened, true);
    assert.equal((await navigateSessionArtifact(fixture(run), run, owners)).opened, true);
    assert.deepEqual(calls, ['focus-chat', 'focus-run']);
    assert.equal(chats.focus('file:///project-b', chatId), false);
    assert.equal(work.focus(workspace, { kind: 'run', id: 'run-2' }), false);
});

test('new selection routes exact Task, Run and Sequence to normal idle owner panels', async () => {
    const selections: unknown[] = [];
    const owners = {
        focusChat: () => false, focusWork: () => false,
        openChat: async (_root: string, id: string) => { selections.push(['chat', id]); return true; },
        openWork: async (_root: string, selection: unknown) => { selections.push(selection); return true; },
    };
    for (const ref of [chat, task, run, sequence])
        assert.equal((await navigateSessionArtifact(fixture(ref), ref, owners)).opened, true);
    assert.deepEqual(selections, [['chat', chatId], { kind: 'task', id: 'task-1' },
        { kind: 'run', id: 'run-1' }, { kind: 'sequence', id: 'sequence-1' }]);
});

test('foreign project, missing or mismatched exact target, and unsupported deep link deny focus', async () => {
    let focus = 0;
    const owners = { focusChat: () => { focus++; return true; }, focusWork: () => { focus++; return true; },
        openChat: async () => { focus++; return true; }, openWork: async () => { focus++; return true; } };
    const foreign = fixture(); foreign.session = { ...foreign.session,
        project: { ...project, canonicalRoot: '/project-b' } };
    assert.equal((await navigateSessionArtifact(foreign, chat, owners)).opened, false);
    const missing = fixture(); missing.resolution.artifacts[0].availability = 'missing';
    assert.match((await navigateSessionArtifact(missing, chat, owners)).message, /missing/);
    const mismatched = fixture(run); mismatched.resolution.artifacts[0].ref = { ...run, runId: 'run-2' };
    assert.equal((await navigateSessionArtifact(mismatched, run, owners)).opened, false);
    const unsupported = { kind: 'planning-map', mapId: 'map-1' } as const;
    assert.match((await navigateSessionArtifact(fixture(unsupported), unsupported, owners)).message, /not available/);
    assert.equal(focus, 0);
});

test('project switch during navigation cannot report a successful open', async () => {
    let current = true;
    const context = { ...fixture(), current: () => current };
    const result = await navigateSessionArtifact(context, chat, {
        focusChat: () => false, focusWork: () => false,
        openChat: async () => { current = false; return true; }, openWork: async () => true,
    });
    assert.equal(result.opened, false);
    assert.match(result.message, /Project or Session changed/);
});

test('an occupied owner panel produces an explicit fallback without replacing its selection', async () => {
    const result = await navigateSessionArtifact(fixture(chat), chat, {
        focusChat: () => false, focusWork: () => false,
        openChat: async () => false, openWork: async () => false,
    });
    assert.equal(result.opened, false);
    assert.match(result.message, /No available owner panel/);
});

test('Session Work selection reads an exact task without agent execution or model readiness', async () => {
    let target = 0, effects = 0;
    const controller = new WorkSelectionController({
        readTask: async () => ({ id: 'task-1', origin: { kind: 'work-item' },
            modelPolicy: { kind: 'follow-coding-agent' } }),
        start: async () => { effects++; }, openTaskStack: async () => { effects++; },
        reviewRun: async () => { effects++; },
    } as any, () => {}, async () => { target++; return { reason: 'ready' }; });
    controller.handle = 'handle-a';
    await controller.select({ kind: 'task', id: 'task-1' }, true);
    assert.equal(controller.selectedTask?.id, 'task-1');
    assert.equal(target, 0);
    assert.equal(effects, 0);
    controller.phase.handle = 'handle-a';
    controller.phase.sequences = [{ id: 'sequence-1' } as any];
    await controller.select({ kind: 'sequence', id: 'sequence-1' }, true);
    assert.equal(controller.phase.selected?.id, 'sequence-1');
    assert.equal(effects, 0);
});
