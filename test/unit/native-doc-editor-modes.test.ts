import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { nativeDocumentFormat, nativeDocumentModes } from '../../packages/theia-extension/lib/browser/native-doc-editor-modes.js';
import { renderUntrustedMessageHtml } from '../../packages/theia-extension/lib/browser/untrusted-message-markdown.js';

const widget = readFileSync('packages/theia-extension/src/browser/native-doc-editor-widget.ts', 'utf8');
const frontend = readFileSync('packages/theia-extension/src/browser/frontend-module.ts', 'utf8');
const css = readFileSync('packages/theia-extension/src/browser/dope.css', 'utf8');

test('only real .md and .txt file resources receive modes', () => {
    assert.equal(nativeDocumentFormat('file', '/project/README.md'), 'md');
    assert.equal(nativeDocumentFormat('file', '/project/notes.TXT'), 'txt');
    for (const [scheme, path] of [['file', '/project/main.ts'], ['file', '/project/README.md.old'],
        ['untitled', '/project/README.md'], ['diff', '/project/README.md'], ['proposal', '/project/README.md']]) {
        assert.equal(nativeDocumentFormat(scheme, path), undefined);
    }
    assert.deepEqual(nativeDocumentModes('md', false), ['source', 'formatted']);
    assert.deepEqual(nativeDocumentModes('txt', false), ['source']);
    assert.deepEqual(nativeDocumentModes('md', true), ['source', 'diff', 'formatted']);
    assert.deepEqual(nativeDocumentModes('txt', true), ['source', 'diff']);
});

test('formatted view reads the live editor model through the existing safe renderer and does not write it', () => {
    assert.match(widget, /this\.editor\.document\.getText\(\)/);
    assert.match(widget, /renderDocumentPreview\('md', text\)/);
    assert.doesNotMatch(widget, /querySelectorAll\('a\[href\]'\).*removeAttribute\('href'\)/);
    assert.match(widget, /this\.formatted\.tabIndex = 0/);
    assert.doesNotMatch(widget, /\b(?:writeFile|save|setText|applyEdit)\s*\(/);
    const html = renderUntrustedMessageHtml('# Title\n\n![remote](https://example.test/image.png)\n\n<script>alert(1)</script>');
    assert.match(html, /<h1>Title<\/h1>/);
    assert.doesNotMatch(html, /<(?:img|script)\b/i);
    assert.match(html, /Image omitted/);
});

test('factory preserves Monaco editor identity and footer reserves scroll space', () => {
    assert.match(frontend, /rebind\(EditorWidgetFactory\)\.to\(NativeDocumentEditorWidgetFactory\)/);
    assert.match(frontend, /rebind\(EditorPreviewWidgetFactory\)\.to\(NativeDocumentPreviewWidgetFactory\)/);
    assert.match(widget, /class NativeDocumentPreviewWidgetFactory extends EditorPreviewWidgetFactory/);
    assert.match(widget, /class NativeDocumentEditorWidget extends EditorPreviewWidget/);
    assert.match(widget, /if \(!format\) return super\.constructEditor\(uri\)/);
    assert.match(widget, /new NativeDocumentEditorWidget\(await this\.editorProvider\(uri\)/);
    assert.match(widget, /super\(editor, selection\)/);
    assert.match(widget, /this\.editor\.setSize\(\{ width, height: Math\.max\(0, height - FOOTER_HEIGHT\) \}\)/);
    assert.match(css, /\.dope-native-document-formatted\[hidden\] \{ display: none; \}/);
    assert.match(css, /inset: 0 0 38px/);
    assert.match(css, /--theia-editor-background/);
});

test('actual Explorer editor host loads the preview factory before Dope replaces it', () => {
    const host = readFileSync('apps/browser/src-gen/frontend/index.js', 'utf8');
    const preview = host.indexOf("@theia/editor-preview/lib/browser/editor-preview-frontend-module");
    const dope = host.indexOf("@dope/theia-extension/lib/browser/frontend-module");
    assert.ok(preview >= 0 && dope > preview, 'Dope must load after editor-preview');
    assert.doesNotMatch(frontend, /dope\.documents\.open|DOCUMENTS_WIDGET_ID/);
});

test('Docs card navigation reaches proposal tabs while retired Documents UI is absent', () => {
    const chat = readFileSync('packages/theia-extension/src/browser/chat-panel-widget.ts', 'utf8');
    const proposal = readFileSync('packages/theia-extension/src/browser/native-doc-editor-proposal.ts', 'utf8');
    assert.match(chat, /this\.button\('Open All Files'/);
    assert.match(chat, /openFiles\(\[target\.path\]\)/);
    assert.match(frontend, /checkedDocumentationHandoff\(owner, uri, proposalId, digest/);
    assert.match(frontend, /const tab = await tabs\.open\(candidate, path\)/);
    assert.match(frontend, /activateWidget\(firstId\)/);
    assert.doesNotMatch(chat, /DocumentsWidget|viewedDocuments/);
    assert.doesNotMatch(frontend, /DocumentsWidget|DOCUMENTS_WIDGET_ID/);
    assert.match(proposal, /this\.title\.iconClass = codicon\('diff'\)/);
    assert.doesNotMatch(proposal, /this\.title\.label = .*\(Proposal\)/);
    assert.match(proposal, /this\.title\.caption = `\$\{snapshot\.identity\.path\.split\('\/'\)\.join\(' › '\)\}/);
    assert.doesNotMatch(proposal, /this\.title\.caption = `Proposal:/);
});
