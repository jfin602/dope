import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { outlineLabel, revealOutlineAncestors } = require('../../packages/theia-extension/lib/browser/software-map-outline.js');
const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
const nodes = [
    { id: 'a', kind: 'system', name: 'System A' },
    { id: 'a1', kind: 'subsystem', name: 'Subsystem A1', parentId: 'a' },
    { id: 'b', kind: 'system', name: 'System B' },
    { id: 'b1', kind: 'subsystem', name: 'Subsystem B1', parentId: 'b' },
    { id: 'c', kind: 'component', name: 'Component C', parentId: 'b1' },
    { id: 'file', kind: 'code', codeKind: 'file', name: 'file.ts', path: 'src/very/long/file.ts', parentId: 'c' },
];

test('outline labels use proven type first and retain full file path', () => {
    assert.deepEqual(nodes.map(outlineLabel), [
        'system - System A', 'subsystem - Subsystem A1', 'system - System B',
        'subsystem - Subsystem B1', 'component - Component C', 'file - src/very/long/file.ts',
    ]);
    assert.equal(outlineLabel({ kind: 'code', codeKind: 'symbol', name: 'list', path: 'src/list.ts' }), 'symbol - list');
});

test('fresh outline starts closed and reveal opens only missing ancestors', () => {
    const expanded = new Set<string>();
    assert.equal(expanded.size, 0);
    expanded.add('a');
    expanded.add('a1');
    assert.equal(revealOutlineAncestors(nodes, 'file', expanded), true);
    assert.deepEqual([...expanded].sort(), ['a', 'a1', 'b', 'b1', 'c']);
    assert.equal(revealOutlineAncestors(nodes, 'missing', expanded), false);
    assert.deepEqual([...expanded].sort(), ['a', 'a1', 'b', 'b1', 'c']);
});

test('widget keeps expansion local and selection shared with separate accessible controls', () => {
    const widget = read('packages/theia-extension/src/browser/software-map-widget.ts');
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(widget, /private readonly expanded = new Set<string>\(\)/);
    assert.match(widget, /this\.expanded\.clear\(\)/);
    assert.match(widget, /this\.unassignedOpen = false/);
    assert.match(widget, /unassignedSection\.open = this\.unassignedOpen/);
    assert.doesNotMatch(widget, /(?:private|public|protected)\s+(?:readonly\s+)?selectedId/);
    assert.doesNotMatch(read('packages/software-map/src/contracts.ts'), /expanded|unassignedOpen/);
    assert.match(widget, /revealOutlineAncestors\(nodes, model\.selectedId, this\.expanded\)/);
    assert.match(widget, /this\.button\(label, \(\) => void model\.select\(node\.id\)\)/);
    assert.match(widget, /button\.dataset\.nodeId = node\.id/);
    assert.match(widget, /disclosure\.setAttribute\('aria-expanded'/);
    assert.match(widget, /button\.setAttribute\('aria-current'/);
    assert.match(widget, /scrollIntoView\(\{ block: 'nearest' \}\)/);
    assert.match(widget, /this\.button\('Open Physical Map'/);
    assert.match(widget, /this\.button\('Refresh Software Map'/);
    assert.match(widget, /dope-smap-compact-actions/);
    assert.match(widget, /this\.button\('Analyze Project'/);
    assert.match(widget, /this\.renderEvidence\(/);
    assert.match(widget, /this\.renderViolationDetail\(/);
    assert.match(css, /\.dope-smap-outline \.dope-smap-outline-label\s*\{[^}]*white-space: normal; overflow-wrap: anywhere;/);
    assert.doesNotMatch(css, /\.dope-smap-outline[^}]*text-overflow:\s*ellipsis/);
    assert.match(css, /\.dope-smap-outline-label\[aria-current="true"\][\s\S]*?font-weight: 600/);
});
