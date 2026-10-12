import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { HistoryBackend } from '../../packages/theia-extension/lib/node/history-backend.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { panelFocusTarget, planningFocusTarget, editorFocusTarget } from
    '../../packages/theia-extension/lib/browser/history-focus-target.js';

const source = (path: string) => readFileSync(new URL(`../../packages/theia-extension/src/${path}`, import.meta.url), 'utf8');

test('real owner focus is one bounded project-scoped record; History and incidental refresh never record it', async () => {
    const a = await mkdtemp(join(tmpdir(), 'dope-focus-a-'));
    const b = await mkdtemp(join(tmpdir(), 'dope-focus-b-'));
    const backend = new HistoryBackend();
    try {
        for (const root of [a, b]) await mkdir(join(root, '.dope'));
        const planning = join(a, '.dope/planning-maps.json');
        await writeFile(planning, JSON.stringify({ schemaVersion: 1, projectId: 'project-a', revision: 1,
            maps: [{ schemaVersion: 1, id: 'map-a', projectId: 'project-a', title: 'Plan', objective: 'Goal',
                status: 'draft', revision: 0, history: [{ revision: 0, action: 'create', at: '2026-10-12T10:00:00Z' }],
                basis: { architectureRevision: 1, architectureFingerprint: 'a', physicalInputFingerprint: 'b', physicalGeneration: 1 },
                transformations: [], workItems: [] }] }));
        const ownerBefore = await readFile(planning);
        const first = (await backend.attach(pathToFileURL(a).href)).projectHandle;
        await backend.recordFocus(first, { kind: 'planning-map', mapId: 'map-a' });
        const file = join(a, '.dope/history-focus.json');
        const persisted = JSON.parse(await readFile(file, 'utf8'));
        assert.deepEqual(Object.keys(persisted).sort(),
            ['basis', 'observedAt', 'owner', 'projectId', 'projectRoot', 'schemaVersion']);
        assert.deepEqual(persisted.owner, { kind: 'planning-map', mapId: 'map-a' });
        assert.equal(persisted.basis, 'map:0:2026-10-12T10:00:00Z');
        assert.deepEqual((await backend.read(first)).continueWith,
            { kind: 'verified-focus', owner: persisted.owner, observedAt: persisted.observedAt });
        assert.deepEqual(await readFile(planning), ownerBefore);
        const afterRead = await readFile(file);
        await backend.read(first);
        assert.deepEqual(await readFile(file), afterRead);
        const edited = JSON.parse(ownerBefore.toString());
        edited.maps[0].revision = 1;
        edited.maps[0].history.push({ revision: 1, action: 'edit', at: '2026-10-12T10:01:00Z' });
        await writeFile(planning, JSON.stringify(edited));
        assert.notEqual((await backend.read(first)).continueWith.kind, 'verified-focus');

        const second = (await backend.attach(pathToFileURL(b).href)).projectHandle;
        await assert.rejects(backend.recordFocus(first, { kind: 'planning-map', mapId: 'map-a' }), /Invalid History project handle/);
        assert.equal((await backend.read(second)).continueWith.kind, 'none');
        assert.deepEqual(await readFile(file), afterRead);
    } finally { backend.dispose(); await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); }
});

test('missing, corrupt, foreign or replaced targets are never rebound after restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-focus-restart-'));
    const backend = new HistoryBackend();
    try {
        await mkdir(join(root, '.dope'));
        const file = join(root, 'hello.ts');
        await writeFile(file, 'export const hello = true;');
        const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        await backend.recordFocus(handle, { kind: 'editor', projectRelativePath: 'hello.ts' });
        const recordPath = join(root, '.dope/history-focus.json');
        const record = await readFile(recordPath, 'utf8');
        backend.dispose();
        const restarted = new HistoryBackend();
        try {
            const next = (await restarted.attach(pathToFileURL(root).href)).projectHandle;
            assert.equal((await restarted.read(next)).continueWith.kind, 'verified-focus');
            await rename(file, join(root, 'moved.ts'));
            assert.notEqual((await restarted.read(next)).continueWith.kind, 'verified-focus');
            await writeFile(file, 'different file');
            assert.notEqual((await restarted.read(next)).continueWith.kind, 'verified-focus');
            await writeFile(recordPath, record.replace(root, `${root}-moved`));
            assert.notEqual((await restarted.read(next)).continueWith.kind, 'verified-focus');
            await writeFile(recordPath, '{bad json');
            assert.notEqual((await restarted.read(next)).continueWith.kind, 'verified-focus');
            await assert.rejects(restarted.recordFocus(next, { kind: 'editor', projectRelativePath: '../escape' }),
                /Unsupported History focus target/);
        } finally { restarted.dispose(); }
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('late root attachment cannot replace a newer project or publish old focus', async () => {
    const a = await mkdtemp(join(tmpdir(), 'dope-focus-late-a-'));
    const b = await mkdtemp(join(tmpdir(), 'dope-focus-late-b-'));
    let started!: () => void;
    let release!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    class DelayedPlanning extends PlanningStore {
        override async read(root: string) {
            if (root === a) { started(); await gate; }
            return super.read(root);
        }
    }
    const backend = new HistoryBackend(new DelayedPlanning());
    try {
        const late = backend.attach(pathToFileURL(a).href);
        await entered;
        const current = (await backend.attach(pathToFileURL(b).href)).projectHandle;
        release();
        await assert.rejects(late, /superseded/);
        assert.equal((await backend.read(current)).project.projectRoot, b);
        assert.equal((await backend.read(current)).continueWith.kind, 'none');
    } finally { release(); backend.dispose(); await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); }
});

test('frontend samples only active editor, Chat, Work or Planning and debounces project changes', () => {
    const observer = source('browser/history-focus-contribution.ts');
    assert.match(observer, /onDidChangeActiveWidget/);
    assert.match(observer, /addEventListener\('focusin'/);
    assert.match(observer, /widget instanceof ChatPanelWidget/);
    assert.match(observer, /widget instanceof PhysicalMapWidget/);
    assert.match(observer, /widget instanceof EditorWidget/);
    assert.match(observer, /generation !== this\.generation/);
    assert.match(observer, /clearTimeout\(this\.pending\)/);
    assert.match(observer, /}, 250\)/);
    assert.doesNotMatch(observer, /HistoryWidget|startTask|startRun|model|fetch\(/);
    const backend = source('node/history-backend.ts');
    assert.doesNotMatch(backend, /\.mutate\(|\.save\(|\.start\(|\.createTask\(|fetch\(/);
    assert.equal((readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
        .match(/test\/unit\/history-focus\.test\.ts/g) ?? []).length, 1);
});

test('only exact selected owner targets in the current root become meaningful focus', () => {
    const a = 'file:///tmp/focus-a', b = 'file:///tmp/focus-b';
    assert.deepEqual(panelFocusTarget({ module: 'chat', projectUri: a, panelWorkspace: a,
        chatWorkspace: a, chatId: 'chat-a' }), { kind: 'chat', chatId: 'chat-a' });
    assert.equal(panelFocusTarget({ module: 'chat', projectUri: b, panelWorkspace: a,
        chatWorkspace: a, chatId: 'chat-a' }), undefined);
    assert.equal(panelFocusTarget({ module: 'chat', projectUri: a, panelWorkspace: a,
        chatWorkspace: a }), undefined);
    for (const [kind, expected] of [['task', 'agent-task'], ['run', 'agent-run'],
        ['sequence', 'agent-sequence']] as const) {
        assert.equal(panelFocusTarget({ module: 'work', projectUri: a, panelWorkspace: a,
            workProject: a, work: { kind, id: 'work-a' } })?.kind, expected);
    }
    assert.equal(panelFocusTarget({ module: 'work', projectUri: a, panelWorkspace: a,
        workProject: b, work: { kind: 'task', id: 'foreign' } }), undefined);
    assert.deepEqual(planningFocusTarget({ planningMode: true, projectMatches: true,
        mapWorkspace: a, focusWorkspace: a, selectedMapId: 'map-a' }),
    { kind: 'planning-map', mapId: 'map-a' });
    assert.deepEqual(planningFocusTarget({ planningMode: true, projectMatches: true,
        mapWorkspace: a, focusWorkspace: a, selectedMapId: 'map-a', selectedWorkItemId: 'item-a' }),
    { kind: 'work-item', mapId: 'map-a', workItemId: 'item-a' });
    assert.equal(planningFocusTarget({ planningMode: false, projectMatches: true,
        mapWorkspace: a, focusWorkspace: a, selectedMapId: 'map-a' }), undefined);
    assert.equal(planningFocusTarget({ planningMode: true, projectMatches: true,
        mapWorkspace: a, focusWorkspace: b, selectedMapId: 'map-a' }), undefined);
    assert.deepEqual(editorFocusTarget(a, `${a}/src/index.ts`),
        { kind: 'editor', projectRelativePath: 'src/index.ts' });
    assert.equal(editorFocusTarget(a, `${b}/src/index.ts`), undefined);
    assert.equal(editorFocusTarget(a, 'https://example.com/index.ts'), undefined);
});
