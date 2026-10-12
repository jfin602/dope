import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import type { HistoryEntry, HistoryProject } from '../../packages/contracts/src/history';
import type { HistorySnapshot } from '../../packages/contracts/src/history-service';
import { navigateHistory } from '../../packages/theia-extension/lib/browser/history-navigation.js';
import { HistoryBackend } from '../../packages/theia-extension/lib/node/history-backend.js';
import { proposeHistoryContinuation } from '../../packages/contracts/lib/history.js';
import { ChatOpenOwners } from '../../packages/theia-extension/lib/browser/chat-panel-controller.js';
import { WorkOpenOwners } from '../../packages/theia-extension/lib/browser/shared-panel-state.js';

const project: HistoryProject = { projectRoot: '/tmp/project-a', projectId: 'project-a' };
const row = (owner: HistoryEntry['owner'], sourceId: string): HistoryEntry => ({ ...project,
    kind: 'event', source: owner.kind === 'chat' ? 'chat' : 'planning', sourceId, owner,
    title: sourceId, status: { kind: 'owner', label: 'ready' }, availability: 'available',
    occurredAt: '2026-10-12T00:00:00Z', observedAt: null });
const snapshot = (entries: HistoryEntry[], continueWith: HistorySnapshot['continueWith'] = { kind: 'none' }): HistorySnapshot =>
    ({ project, entries, continueWith, diagnostics: [], truncated: false });

test('exact Chat, Work, Planning and Mind owners; no stale, missing, foreign or unsupported substitution', async () => {
    const targets = [
        [{ kind: 'chat' as const, chatId: 'chat-1' }, 'chat-1'],
        [{ kind: 'agent-run' as const, runId: 'run-1' }, 'run-1'],
        [{ kind: 'work-item' as const, mapId: 'map-1', workItemId: 'work-1' }, 'work-1'],
        [{ kind: 'project-mind' as const, artifactId: 'idea-1' }, 'idea-1']
    ] as const;
    const input = snapshot(targets.map(([owner, id]) => row(owner, id)));
    const opened: object[] = [];
    const owners = { open: async (owner: object) => { opened.push(owner); return true; } };
    for (const [owner, id] of targets)
        assert.equal((await navigateHistory(input, owner, id, undefined, async () => input, async () => true, owners)).opened, true);
    assert.equal(opened.length, 4);
    const chat = targets[0][0];
    const git = { ...row({ kind: 'git-commit' as const, commitId: 'abcdef' }, 'commit'), source: 'git' as const,
        occurredAt: '2026-10-12T12:00:00Z' };
    assert.deepEqual(proposeHistoryContinuation(project, [git, row(chat, 'chat-1')]),
        { kind: 'recent-activity-suggestion', owner: chat, sourceId: 'chat-1', title: 'chat-1' });
    assert.equal((await navigateHistory(input, chat, 'missing', undefined, async () => input, async () => true, owners)).opened, false);
    assert.equal((await navigateHistory(input, chat, 'chat-1', undefined,
        async () => ({ ...input, project: { ...project, projectId: 'foreign' } }), async () => true, owners)).opened, false);
    assert.equal((await navigateHistory(input, targets[2][0], 'work-1', undefined,
        async () => snapshot([row(chat, 'chat-1')]), async () => true, owners)).opened, false);
    assert.equal((await navigateHistory(snapshot([{ ...row(chat, 'chat-1'), ownerRevision: 1 }]), chat,
        'chat-1', undefined, async () => snapshot([{ ...row(chat, 'chat-1'), ownerRevision: 2 }]),
        async () => true, owners)).opened, false);
    const mindRow = { ...row(targets[3][0], 'idea-1'), ownerProjectId: 'mind-project' };
    assert.equal((await navigateHistory(snapshot([mindRow]), targets[3][0], 'idea-1', undefined,
        async () => snapshot([{ ...mindRow, ownerProjectId: 'other-mind' }]), async () => true, owners)).opened, false);
    assert.equal((await navigateHistory(input, { kind: 'git-commit', commitId: 'a' }, 'commit', undefined,
        async () => input, async () => true, owners)).opened, false);
    assert.equal(opened.length, 4);
    const focused = snapshot([], { kind: 'verified-focus', owner: chat, observedAt: '2026-10-12T00:00:00Z' });
    assert.equal((await navigateHistory(focused, chat, undefined, '2026-10-12T00:00:00Z',
        async () => focused, async () => true, owners)).opened, true);
    assert.equal((await navigateHistory(focused, chat, undefined, '2026-10-12T00:00:00Z',
        async () => snapshot([]), async () => true, owners)).opened, false);
});

test('History routing has no AgentRun execution, adoption, owner-store mutation or duplicate writer path', () => {
    const source = readFileSync(new URL('../../packages/theia-extension/src/browser/history-owner-navigation.ts', import.meta.url), 'utf8');
    assert.match(source, /chats\.focus\(workspace, owner\.chatId\)/);
    assert.match(source, /work\.focus\(workspace, selection\)/);
    assert.match(source, /planning\.navigationMap\(owner\.mapId\)/);
    assert.match(source, /widget\.navigateArtifact\(owner\.artifactId, workspace, entry\.ownerProjectId\)/);
    assert.doesNotMatch(source, /\.start\(|\.resume\(|\.mutate\(|\.adopt\(|\.rebase\(|\.launchWorkItem\(/);
});

test('late switch and cancellation cannot open an owner', async () => {
    const chat = { kind: 'chat' as const, chatId: 'chat-1' };
    const input = snapshot([row(chat, 'chat-1')]);
    let active = true, opened = 0;
    const result = await navigateHistory(input, chat, 'chat-1', undefined,
        async () => { active = false; return input; }, async () => active,
        { open: async () => { opened++; return true; } });
    assert.equal(result.opened, false);
    assert.equal(opened, 0);
});

test('already-open Chat and Work reservations focus their sole existing owner', async () => {
    const chats = new ChatOpenOwners(), work = new WorkOpenOwners();
    const selection = { kind: 'run' as const, id: 'run-1' };
    let chatFocus = 0, workFocus = 0, duplicated = 0;
    chats.reserve('file:///project', 'chat-1', 'chat-panel', () => chatFocus++);
    work.reserve('file:///project', selection, 'work-panel', () => workFocus++, () => {});
    const owners = { open: async (owner: HistoryEntry['owner']) => {
        if (owner.kind === 'chat' && chats.focus('file:///project', owner.chatId) ||
            owner.kind === 'agent-run' && work.focus('file:///project', selection)) return true;
        duplicated++;
        return false;
    } };
    for (const [owner, id] of [
        [{ kind: 'chat' as const, chatId: 'chat-1' }, 'chat-1'],
        [{ kind: 'agent-run' as const, runId: 'run-1' }, 'run-1']
    ] as const) {
        const input = snapshot([row(owner, id)]);
        assert.equal((await navigateHistory(input, owner, id, undefined, async () => input, async () => true, owners)).opened, true);
    }
    assert.deepEqual([chatFocus, workFocus, duplicated], [1, 1, 0]);
});

test('editor path validation rejects traversal, symlinks, foreign handles and changed project without source mutation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-history-nav-'));
    const outside = await mkdtemp(join(tmpdir(), 'dope-history-outside-'));
    const backend = new HistoryBackend();
    try {
        await mkdir(join(root, '.dope'));
        await writeFile(join(root, '.dope/planning-maps.json'), JSON.stringify({ schemaVersion: 1, projectId: 'project-a', revision: 1, maps: [] }));
        await mkdir(join(root, 'src'));
        await writeFile(join(root, 'src/file.ts'), 'unchanged');
        await writeFile(join(outside, 'secret.ts'), 'secret');
        await symlink(join(outside, 'secret.ts'), join(root, 'src/link.ts'));
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        assert.equal(await backend.resolveEditor(projectHandle, 'src/file.ts'), pathToFileURL(join(root, 'src/file.ts')).href);
        for (const path of ['../secret.ts', '/tmp/file.ts', 'src/../file.ts', 'src/link.ts', 'src\\file.ts'])
            await assert.rejects(backend.resolveEditor(projectHandle, path));
        await assert.rejects(backend.resolveEditor('foreign', 'src/file.ts'));
        await writeFile(join(root, '.dope/planning-maps.json'), JSON.stringify({ schemaVersion: 1, projectId: 'project-b', revision: 1, maps: [] }));
        await assert.rejects(backend.resolveEditor(projectHandle, 'src/file.ts'), /project changed/);
        assert.equal(await readFile(join(root, 'src/file.ts'), 'utf8'), 'unchanged');
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});
