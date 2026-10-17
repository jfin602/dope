import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { HistoryBackend } from '../../packages/theia-extension/lib/node/history-backend.js';
import { historyFocusDescription, historyReadableTime } from
    '../../packages/theia-extension/lib/browser/history-presentation.js';

const source = (path: string) => readFileSync(new URL(`../../packages/theia-extension/src/${path}`, import.meta.url), 'utf8');

test('History uses one right activity-bar widget, a palette command, and safe inert panel content', () => {
    const module = source('browser/frontend-module.ts');
    const widget = source('browser/history-widget.ts');
    const css = source('browser/dope.css');
    assert.match(module, /class RightHistoryLauncher extends AbstractViewContribution<HistoryWidget>/);
    assert.match(module, /widgetId: HISTORY_WIDGET_ID, widgetName: 'History', defaultWidgetOptions: \{ area: 'right', rank: 252 \}/);
    assert.match(module, /bindViewContribution\(bind, RightHistoryLauncher\)/);
    assert.match(module, /bind\(FrontendApplicationContribution\)\.toService\(RightHistoryLauncher\)/);
    assert.equal((module.match(/id: HISTORY_WIDGET_ID, createWidget:/g) ?? []).length, 1);
    assert.match(module, /dope\.history\.open/);
    assert.match(module, /this\.openView\(\{ activate: true \}\)/);
    assert.doesNotMatch(module, /SessionsLauncher|dope\.sessions\.open/);
    assert.match(widget, /name\.textContent = entry\.title/);
    assert.match(widget, /meta\.textContent =/);
    assert.doesNotMatch(widget, /innerHTML|outerHTML|insertAdjacentHTML/);
    assert.match(widget, /Preview selected evidence/);
    assert.match(widget, /aria-live/);
    assert.match(widget, /Event · time unknown/);
    assert.match(widget, /Current snapshot · observed/);
    assert.match(widget, /for \(const entry of snapshot\.entries\)/);
    assert.doesNotMatch(widget, /snapshot\.entries\.filter\(entry => entry\.source/);
    assert.match(css, /--dope-primary, var\(--theia-focusBorder\)/);
    assert.match(css, /button:focus-visible/);
    const backend = source('node/backend-module.ts');
    assert.equal((backend.match(/new RpcConnectionHandler\(historyServicePath/g) ?? []).length, 1);
    assert.equal((backend.match(/new RpcConnectionHandler\(historyFocusServicePath/g) ?? []).length, 1);
    assert.match(backend, /client\.onDidCloseConnection\(\(\) => backend\.dispose\(\)\)/);
    const contracts = readFileSync(new URL('../../packages/contracts/src/history-service.ts', import.meta.url), 'utf8');
    assert.match(contracts, /historyServicePath = '\/services\/dope\/history'/);
    assert.match(contracts, /historyFocusServicePath = '\/services\/dope\/history-focus'/);
    assert.match(module, /context\.container, historyFocusServicePath\)\)\.inSingletonScope\(\)/);
    const productScript = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
    assert.equal((productScript.match(/test\/unit\/history-panel\.test\.ts/g) ?? []).length, 1);
});

test('History RPC is per-connection, root/handle checked, bounded and read-only', async () => {
    const a = await mkdtemp(join(tmpdir(), 'dope-history-panel-a-'));
    const b = await mkdtemp(join(tmpdir(), 'dope-history-panel-b-'));
    const backend = new HistoryBackend();
    try {
        await mkdir(join(a, '.dope'));
        const file = join(a, '.dope/planning-maps.json');
        const at = '2026-10-12T10:00:00.000Z';
        const maps = Array.from({ length: 51 }, (_, i) => ({ schemaVersion: 1, id: `map${i}`, projectId: 'project-a',
            title: i === 0 ? '<img src=x onerror=alert(1)>' : `Map ${i}`, objective: 'Goal', status: 'draft', revision: 0,
            history: [{ revision: 0, action: 'create', at }], basis: { architectureRevision: 1,
                architectureFingerprint: 'a', physicalInputFingerprint: 'b', physicalGeneration: 1 },
            transformations: [], workItems: [] }));
        await writeFile(file, JSON.stringify({ schemaVersion: 1, projectId: 'project-a', revision: 1, maps }));
        const before = await readFile(file);
        const { projectHandle: first } = await backend.attach(pathToFileURL(a).href);
        const snapshot = await backend.read(first);
        assert.equal(snapshot.project.projectRoot, a);
        assert.equal(snapshot.project.projectId, 'project-a');
        assert.equal(snapshot.entries.length, 50);
        assert.equal(snapshot.truncated, true);
        assert.equal(snapshot.entries[0].kind, 'event');
        assert.equal(snapshot.entries.some(entry => entry.title === '<img src=x onerror=alert(1)>'), true);
        assert.equal(snapshot.continueWith.kind, 'recent-activity-suggestion');
        assert.deepEqual(await readFile(file), before);
        await assert.rejects(backend.read('wrong'), /Invalid History project handle/);
        const { projectHandle: second } = await backend.attach(pathToFileURL(b).href);
        await assert.rejects(backend.read(first), /Invalid History project handle/);
        const other = await backend.read(second);
        assert.equal(other.project.projectRoot, b);
        assert.equal(other.entries.length, 0);
        assert.deepEqual(other.continueWith, { kind: 'none' });
        backend.dispose();
        await assert.rejects(backend.read(second), /Invalid History project handle/);
        const backendSource = source('node/history-backend.ts');
        assert.doesNotMatch(backendSource, /\.mutate\(|\.save\(|\.start\(|\.createTask\(|\.readTranscript\(|fetch\(/);
    } finally { backend.dispose(); await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); }
});

test('Continue labels exact files and verified owners, while unavailable focus stays explanatory', () => {
    const at = '2026-10-12T10:00:00.000Z';
    const editor = historyFocusDescription({ kind: 'verified-focus',
        owner: { kind: 'editor', projectRelativePath: 'src/status.ts' }, observedAt: at }, []);
    assert.equal(editor.destination, 'src/status.ts');
    assert.match(editor.message, /Continue opens this exact file/);
    assert.notEqual(historyReadableTime(at), at);
    const project = { projectId: 'p', projectRoot: '/tmp/p' };
    const chatEntry = { ...project, source: 'chat' as const, sourceId: 'chat-1',
        owner: { kind: 'chat' as const, chatId: 'chat-1' }, title: 'Fix parser',
        kind: 'event' as const, occurredAt: at, observedAt: null, availability: 'available' as const,
        status: { kind: 'owner' as const, label: 'Chat' } };
    assert.equal(historyFocusDescription({ kind: 'verified-focus', owner: chatEntry.owner,
        observedAt: at }, [chatEntry]).destination, 'Fix parser');
    const workEntry = { ...chatEntry, source: 'agent' as const, sourceId: 'task-1',
        owner: { kind: 'agent-task' as const, taskId: 'task-1' }, title: 'Build parser' };
    assert.equal(historyFocusDescription({ kind: 'verified-focus', owner: workEntry.owner,
        observedAt: at }, [workEntry]).destination, 'Build parser');
    assert.match(historyFocusDescription({ kind: 'none' }, []).message, /Open a file/);
    const missing = historyFocusDescription({ kind: 'unavailable-focus', reason: 'missing',
        owner: { kind: 'editor', projectRelativePath: 'src/status.ts' }, observedAt: at }, []);
    assert.match(missing.message, /no longer available at src\/status.ts/);
    assert.equal(historyFocusDescription({ kind: 'unavailable-focus', reason: 'stale',
        owner: { kind: 'chat', chatId: 'chat-1' } }, []).heading, 'Previously focused Chat changed');
    assert.equal(historyFocusDescription({ kind: 'unavailable-focus', reason: 'unverified' }, []).destination, undefined);
});
