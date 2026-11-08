import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { DocumentsWorkspaceState } from '../../packages/theia-extension/lib/browser/documents-workspace-state.js';

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
    assert.doesNotMatch(widget, /FileService|writeFile|applyDocumentationProposal|publishPromptStack/);
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
