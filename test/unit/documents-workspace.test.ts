import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { DocumentsWorkspaceState } from '../../packages/theia-extension/lib/browser/documents-workspace-state.js';
import { ProjectDocumentsTree, DOCUMENTS_FOLDER_LIMIT } from '../../packages/theia-extension/lib/browser/project-documents-tree.js';
import { URI } from '@theia/core/lib/common/uri.js';
import { FileStat } from '@theia/filesystem/lib/common/files.js';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');

test('Documents registers one optional main widget and a discoverable command', () => {
    const frontend = read('packages/theia-extension/src/browser/frontend-module.ts');
    const widget = read('packages/theia-extension/src/browser/documents-widget.ts');
    assert.match(frontend, /id: DOCUMENTS_WIDGET_ID, createWidget: \(\) =>\s*new DocumentsWidget/);
    assert.match(frontend, /id: 'dope\.documents\.open', label: 'Dope: Open Documents'/);
    assert.match(frontend, /getOrCreateWidget<DocumentsWidget>\(DOCUMENTS_WIDGET_ID\)/);
    assert.match(frontend, /shell\.addWidget\(widget, \{ area: 'main' \}\)/);
    assert.match(widget, /onWorkspaceChanged\(\(\) => \{ void this\.refreshProject\(\); \}\)/);
    assert.match(widget, /role', 'tree'/);
    assert.doesNotMatch(widget, /writeFile|applyDocumentationProposal|publishPromptStack/);
});

test('project switch discards path and candidate presentation identity', () => {
    const state = new DocumentsWorkspaceState();
    state.setProject('file:///first');
    state.selectExplorer('docs/guide.md');
    assert.equal(state.selection.selectedPath, 'docs/guide.md');
    assert.equal(state.selectCandidate('docs-proposal', 'file:///first', 'candidate-1', 'docs/guide.md'), true);
    state.setProject('file:///second');
    assert.deepEqual(state.selection, { mode: 'explorer', projectUri: 'file:///second', status: 'empty' });
    assert.equal(state.selectCandidate('prompt-stack', 'file:///first', 'candidate-1'), false);
    assert.equal(state.selection.candidateId, undefined);
    state.selectExplorer();
    assert.equal(state.selection.mode, 'explorer');
});

test('recreated presentation starts empty and cannot restore old candidate', () => {
    const first = new DocumentsWorkspaceState();
    first.setProject('file:///first');
    assert.equal(first.selectCandidate('prompt-stack', 'file:///first', 'candidate-1'), true);
    const reopened = new DocumentsWorkspaceState();
    reopened.setProject('file:///first');
    assert.equal(reopened.selection.candidateId, undefined);
    assert.equal(reopened.selectCandidate('docs-proposal', 'file:///other', 'candidate-1'), false);
    assert.equal(reopened.selectCandidate('docs-proposal', 'file:///first', ''), false);
});

const root = new URI('file:///projects/one');
const dir = (path: string, children: FileStat[] = []): FileStat => ({
    resource: root.resolve(path), isDirectory: true, isFile: false, isSymbolicLink: false,
    isReadonly: false, children
});
const file = (path: string, linked = false): FileStat => ({
    resource: root.resolve(path), isDirectory: false, isFile: true, isSymbolicLink: linked, isReadonly: false
});
const lister = (stats: Record<string, FileStat>) => ({
    async resolve(uri: URI): Promise<FileStat> {
        const value = stats[uri.toString()];
        if (!value) throw new Error('permission denied');
        return value;
    }
});

test('nested listing is lazy, ordered, extension-filtered and project relative', async () => {
    const top = dir('', [file('README.md'), dir('docs'), file('notes.TXT'), file('app.ts'),
        file('.hidden.md'), file('linked.md', true), dir('node_modules')]);
    const nested = dir('docs', [file('docs/z.txt'), file('docs/a.md'), file('docs/data.json')]);
    const calls: string[] = [];
    const source = lister({ [root.toString()]: top, [root.resolve('docs').toString()]: nested });
    const tree = new ProjectDocumentsTree({ resolve: async uri => { calls.push(uri.toString()); return source.resolve(uri); } }, root);
    const first = await tree.list();
    assert.deepEqual(first.entries.map(entry => entry.path), ['docs', 'notes.TXT', 'README.md']);
    assert.equal(first.excluded, 4);
    assert.deepEqual(calls, [root.toString()]);
    const second = await tree.list('docs');
    assert.deepEqual(second.entries.map(entry => entry.path), ['docs/a.md', 'docs/z.txt']);
    assert.equal(second.excluded, 1);
});

test('linked roots, linked folders, outside-root children and unsafe paths fail closed', async () => {
    const linkedRoot = { ...dir(''), isSymbolicLink: true };
    await assert.rejects(new ProjectDocumentsTree(lister({ [root.toString()]: linkedRoot }), root).list(), /linked/);
    const linkedFolder = { ...dir('docs'), isSymbolicLink: true };
    const stats = { [root.toString()]: dir('', [dir('docs'), file('../outside.md')]),
        [root.resolve('docs').toString()]: linkedFolder };
    const tree = new ProjectDocumentsTree(lister(stats), root);
    assert.deepEqual((await tree.list()).entries.map(entry => entry.path), ['docs']);
    await assert.rejects(tree.list('docs'), /linked/);
    await assert.rejects(tree.list('../outside'), /Unsafe/);
    await assert.rejects(tree.list('/absolute'), /Unsafe/);
    assert.throws(() => new ProjectDocumentsTree(lister({}), new URI('https://example.test/')), /local/);
});

test('access errors are surfaced and each directory display is bounded', async () => {
    await assert.rejects(new ProjectDocumentsTree(lister({}), root).list(), /permission denied/);
    const children = Array.from({ length: DOCUMENTS_FOLDER_LIMIT + 5 }, (_, i) => file(`doc-${i}.md`));
    const listing = await new ProjectDocumentsTree(lister({ [root.toString()]: dir('', children) }), root).list();
    assert.equal(listing.entries.length, DOCUMENTS_FOLDER_LIMIT);
    assert.equal(listing.truncated, true);
});

test('workspace change invalidates pending tree reads and keeps multiple roots out of scope', () => {
    const widget = read('packages/theia-extension/src/browser/documents-widget.ts');
    assert.match(widget, /request = \+\+this\.request/);
    assert.match(widget, /request !== this\.request/);
    assert.match(widget, /roots\.length > 1/);
    assert.doesNotMatch(widget, /discoverDocumentation|readFile|model\.complete|chatService/);
});
