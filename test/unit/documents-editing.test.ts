import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BinaryBuffer } from '@theia/core/lib/common/buffer.js';
import { URI } from '@theia/core/lib/common/uri.js';
import { DocumentsEditing } from '../../packages/theia-extension/lib/browser/documents-editing.js';

const project = 'file:///project';
const otherProject = 'file:///other';

function fixture() {
    let current = project;
    let linked = false;
    let readonly = false;
    let failOpen = false;
    let disk = 'first\r\nline\r\n';
    let draft = disk;
    let savedBasis = disk;
    let dirty = false;
    let guard: (() => Promise<void>) | undefined;
    let dirtyChanged: (() => void) | undefined;
    let closed: (() => void) | undefined;
    let overwrite = false;
    let closeCount = 0;
    const opened: string[] = [];
    const notices: string[] = [];
    const files = {
        async resolve(uri: URI) {
            const path = uri.toString();
            const isFile = /\.md$/u.test(path);
            return { resource: uri, isFile, isDirectory: !isFile,
                isSymbolicLink: linked && path.endsWith('/docs'), isReadonly: readonly && isFile,
                size: disk.length };
        },
        async readFile() { return { value: BinaryBuffer.wrap(new TextEncoder().encode(disk)) }; },
        getReadOnlyMessage() { return undefined; },
        hasCapability() { return false; }
    };
    const editor = {
        editor: { isReadonly: false, document: { onModelWillSaveModel(listener: () => Promise<void>) {
            guard = listener;
            return { dispose() { if (guard === listener) guard = undefined; } };
        } } },
        saveable: {
            get dirty() { return dirty; },
            onDirtyChanged(listener: () => void) { dirtyChanged = listener; return { dispose() { dirtyChanged = undefined; } }; },
            async save() {
                await guard?.();
                if (disk !== savedBasis && !overwrite) return false;
                disk = draft;
                savedBasis = disk;
                dirty = false;
                dirtyChanged?.();
                return true;
            }
        },
        getResourceUri() { return new URI(`${project}/docs/a.md`); },
        close() { closeCount++; },
        onDispose(listener: () => void) { closed = listener; return { dispose() { closed = undefined; } }; }
    };
    const editors = { async open(uri: URI) {
        if (failOpen) throw new Error('Editor unavailable.');
        opened.push(uri.toString());
        return editor;
    } };
    const editing = new DocumentsEditing(files as never, editors as never, () => current,
        () => notices.push(editing.message ?? (editing.dirty ? 'dirty' : 'clean')));
    return { editing, editor, opened, notices,
        change(text: string) { draft = text; dirty = true; dirtyChanged?.(); },
        external(text: string) { disk = text; editing.externalChange(new URI(`${project}/docs/a.md`)); },
        setProject(value: string) { current = value; editing.invalidate(); },
        setLinked(value: boolean) { linked = value; },
        setReadOnly(value: boolean) { readonly = value; },
        setFailOpen(value: boolean) { failOpen = value; },
        allowOverwrite() { overwrite = true; },
        get disk() { return disk; },
        get closeCount() { return closeCount; },
        close() { closed?.(); }
    };
}

test('native editor keeps dirty text and line endings until its save succeeds', async () => {
    const app = fixture();
    assert.equal(await app.editing.open(project, 'docs/a.md'), true);
    assert.deepEqual(app.opened, [`${project}/docs/a.md`]);
    app.change('first\r\nchanged\r\n');
    assert.equal(app.editing.dirty, true);
    assert.equal(await app.editor.saveable.save(), true);
    assert.equal(app.disk, 'first\r\nchanged\r\n');
    assert.equal(app.editing.dirty, false);
});

test('external conflict stays dirty until the native overwrite choice succeeds', async () => {
    const app = fixture();
    await app.editing.open(project, 'docs/a.md');
    app.change('draft\n');
    app.external('external\n');
    assert.match(app.editing.message ?? '', /changed on disk/);
    assert.equal(await app.editor.saveable.save(), false);
    assert.equal(app.disk, 'external\n');
    assert.equal(app.editing.dirty, true);
    app.allowOverwrite();
    assert.equal(await app.editor.saveable.save(), true);
    assert.equal(app.disk, 'draft\n');
});

test('project switch invalidates prior editor saves and multiple roots never become a target', async () => {
    const app = fixture();
    await app.editing.open(project, 'docs/a.md');
    app.change('draft');
    app.setProject(otherProject);
    await assert.rejects(app.editor.saveable.save(), /Project changed/);
    assert.match(app.editing.message ?? '', /Project changed/);
    assert.equal(await app.editing.open(project, 'docs/a.md'), false);
    app.setProject(''); // The Documents widget represents multiple roots as no project.
    assert.equal(await app.editing.open(project, 'docs/a.md'), false);
    assert.equal(app.disk, 'first\r\nline\r\n');
});

test('linked, unsafe and read-only targets never open; a symlink swap denies save', async () => {
    const app = fixture();
    app.setLinked(true);
    assert.equal(await app.editing.open(project, 'docs/a.md'), false);
    assert.equal(app.opened.length, 0);
    app.setLinked(false);
    assert.equal(await app.editing.open(project, '../outside.md'), false);
    app.setReadOnly(true);
    assert.equal(await app.editing.open(project, 'docs/a.md'), false);
    app.setReadOnly(false);
    assert.equal(await app.editing.open(project, 'docs/a.md'), true);
    app.change('draft');
    app.setLinked(true);
    await assert.rejects(app.editor.saveable.save(), /linked/);
    assert.equal(app.disk, 'first\r\nline\r\n');
});

test('editor failure is visible and recoverable without losing the source', async () => {
    const app = fixture();
    app.setFailOpen(true);
    assert.equal(await app.editing.open(project, 'docs/a.md'), false);
    assert.match(app.editing.message ?? '', /Editor unavailable/);
    app.setFailOpen(false);
    assert.equal(await app.editing.open(project, 'docs/a.md'), true);
    app.close();
    assert.equal(app.editing.activePath, undefined);
});

test('an editor without the native save hook closes before an edit can start', async () => {
    const app = fixture();
    (app.editor.editor.document as { onModelWillSaveModel?: unknown }).onModelWillSaveModel = undefined;
    assert.equal(await app.editing.open(project, 'docs/a.md'), false);
    assert.equal(app.closeCount, 1);
    assert.match(app.editing.message ?? '', /save guard unavailable/);
});

test('candidate modes expose no generic editor action and the only save is Theia-owned', async () => {
    const widget = await readFile('packages/theia-extension/src/browser/documents-widget.ts', 'utf8');
    const bridge = await readFile('packages/theia-extension/src/browser/documents-editing.ts', 'utf8');
    const native = await readFile('node_modules/@theia/filesystem/lib/browser/file-resource.js', 'utf8');
    assert.match(widget, /if \(state\.mode !== 'explorer'\).*return/);
    assert.match(widget, /this\.presentation\.selection\.mode === 'explorer'/);
    assert.doesNotMatch(bridge, /writeFile|\.write\(|applyDocumentationProposal|publishPromptStack/);
    assert.match(native, /etag.*mtime/s);
    assert.match(native, /shouldOverwrite\(\)/);
});
