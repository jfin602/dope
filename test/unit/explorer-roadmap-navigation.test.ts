import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
const frontend = read('packages/theia-extension/src/browser/frontend-module.ts');
const navigation = read('packages/theia-extension/src/browser/roadmap-navigation-contribution.ts');
const explorer = read('packages/theia-extension/src/browser/explorer-search-widget.ts');
const search = read('packages/theia-extension/src/browser/search-navigation-contribution.ts');

test('N1/N5: Activity Bar delegates to the existing main Roadmap without a second canvas or Chat path', () => {
    assert.match(navigation, /rank: 200/);
    assert.match(navigation, /title\.label = 'Roadmap'/);
    assert.match(navigation, /title\.caption = 'Roadmap'/);
    assert.match(navigation, /executeCommand\('dope\.roadmap\.open'\)/);
    assert.match(frontend, /getOrCreateWidget<RoadmapCanvasWidget>\(ROADMAP_CANVAS_ID\)/);
    assert.match(frontend, /shell\.addWidget\(widget, \{ area: 'main' \}\)/);
    assert.doesNotMatch(navigation, /new RoadmapCanvasWidget|ChatPanel|\.dope\/|\.md'/);
});

test('accepted Chat draft navigation checks the owner before opening the single main editor', () => {
    assert.match(frontend, /index\.projectId !== projectId \|\| index\.revision !== 0/);
    assert.match(frontend, /drafts\.some\(item => item\.chatId === chatId && item\.draft\.revision === revision\)/);
    assert.match(frontend, /widget\.revealAcceptedChatDraft\(projectUri, projectId, chatId, revision\)/);
    assert.match(frontend, /executeCommand\('dope\.roadmap\.open'\)/);
});

test('N2: Explorer uses the native navigator and Theia fuzzy file service with workspace scoping', () => {
    assert.match(frontend, /createFileNavigatorContainer\(context\.container\)/);
    assert.match(frontend, /child\.rebind\(FileNavigatorWidget\)\.to\(ExplorerSearchWidget\)/);
    assert.match(explorer, /fileSearch\.find\(query, \{/);
    assert.match(explorer, /rootUris: roots, fuzzyMatch: true, useGitIgnore: true/);
    assert.match(explorer, /getExclusionGlobs\(\)/);
    assert.match(explorer, /model\.revealFile\(uri\)/);
    assert.match(explorer, /for \(let parent: TreeNode \| undefined = node; parent; parent = parent\.parent\)/);
    assert.match(explorer, /onWorkspaceChanged\(\(\) => this\.clearSearch\(\)\)/);
    assert.match(explorer, /request !== this\.request/);
    assert.match(explorer, /No matching files/);
});

test('N3/N4: full-text search stays native and reachable; controls are named', () => {
    assert.match(frontend, /rebind\(SearchInWorkspaceFrontendContribution\)\.to\(SearchNavigationContribution\)/);
    assert.match(search, /extends SearchInWorkspaceFrontendContribution/);
    assert.match(search, /defaultWidgetOptions\.area = 'bottom'/);
    assert.match(navigation, /getAreaFor\(search\) === 'left'/);
    assert.match(explorer, /executeCommand\('search-in-workspace\.open'\)/);
    assert.match(explorer, /'aria-label': 'Search files'/);
    assert.match(explorer, /'aria-label': 'Search in files'/);
    assert.match(explorer, /event\.key === 'Escape'/);
    assert.match(navigation, /tab\.setAttribute\('aria-label', 'Roadmap'\)/);
    assert.match(navigation, /event\.key === 'Enter' \|\| event\.key === ' '/);
});
