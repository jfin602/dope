import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const widget = readFileSync(new URL('../../packages/theia-extension/src/browser/software-map-widget.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');

test('initialized controls are two compact rows with the real editor action', () => {
    assert.doesNotMatch(widget, /heading\.textContent = 'Software Map'/);
    assert.match(widget, /this\.title\.caption = 'sMap — Software Map'/);
    assert.match(widget, /this\.title\.label = 'SMAP CONTROLS'/);
    assert.doesNotMatch(widget, /this\.element\('h3', 'SMAP CONTROLS'\)/);
    assert.match(widget, /firstRow\.className = 'dope-smap-control-row'/);
    assert.match(widget, /firstRow\.append\(open, refresh\)/);
    assert.match(widget, /this\.button\('OPEN', \(\) => void this\.openPhysicalMap\(\)\)/);
    assert.match(widget, /this\.button\('REFRESH', \(\) => void model\.analyze\(\)\)/);
    assert.match(widget, /open\.setAttribute\('aria-label', 'Open Physical Map'\)/);
    assert.match(widget, /refresh\.setAttribute\('aria-label', 'Refresh Software Map'\)/);
    assert.match(widget, /this\.button\('EDIT ARCHITECTURE', \(\) => void this\.openReview\(\)\)/);
    assert.doesNotMatch(widget, /edit\.disabled = true/);
    assert.match(widget, /this\.controls\.append\(firstRow, edit\)/);
    assert.match(css, /\.dope-smap-control-row \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.dope-smap-compact-actions button \{[^}]*width: 100%/);
    assert.match(widget, /this\.button\('Analyze Project'/);
    assert.match(widget, /this\.element\('h3', 'Synthesis setup'\)/);
    assert.match(widget, /this\.button\('Accept Architecture'/);
    assert.match(css, /\.dope-smap-view \.dope-smap-compact-actions/);
});

test('published synthesis summary stays compact while diagnostics remain separate', () => {
    assert.match(widget, /`SYNTHESIS  G\$\{status\.publishedGeneration\} \| \$\{status\.analysis\.completeness\} \| \$\{model\.nodes\.length\} nodes \| \$\{model\.violations\.length\} violations`/);
    assert.match(widget, /this\.status\.classList\.toggle\('dope-smap-synthesis-status'/);
    assert.match(css, /\.dope-smap-synthesis-status \{[^}]*white-space: normal/);
    assert.match(widget, /this\.tree\.append\(this\.element\('p', 'Partial analysis: inspect diagnostics before relying on this graph\.'\)\)/);
    assert.match(widget, /diagnostics\.append\(this\.element\('h3', 'Diagnostics'\)\)/);
    assert.match(widget, /model\.error \? `Error: \$\{model\.error\}`/);
    assert.match(widget, /status\.state === 'failed' \? `Analysis failed/);
});

test('outline spends less width and colors only kind tokens with strong shared selection', () => {
    assert.match(css, /\.dope-smap-outline \{ padding-left: 0/);
    assert.match(css, /\.dope-smap-outline \.dope-smap-outline \{ padding-left: 7px/);
    assert.match(css, /\.dope-smap-outline-spacer \{ flex: 0 0 13px; width: 13px/);
    assert.match(css, /\.dope-smap-outline button \{[^}]*padding: 2px 1px/);
    for (const kind of ['system', 'subsystem', 'component', 'file', 'module', 'symbol', 'other']) {
        assert.match(css, new RegExp(`\\.dope-smap-kind-${kind}\\b`));
    }
    assert.match(widget, /kind\.className = `dope-smap-kind-\$\{node\.kind === 'code' \? node\.codeKind : node\.kind\}`/);
    assert.match(widget, /button\.replaceChildren\(kind, document\.createTextNode\(label\.slice\(kind\.textContent\.length\)\)\)/);
    assert.doesNotMatch(widget, /SmapPresentationState|nodeColorOverrides/);
    assert.match(css, /\.dope-smap-outline-label \{[^}]*white-space: normal; overflow-wrap: anywhere/);
    assert.match(css, /\.dope-smap-outline-label\[aria-current="true"\] \{[^}]*background:[^;]+;[^}]*border-left-color:[^;]+;[^}]*font-weight: 600/);
    assert.match(css, /\.dope-smap-outline-label\[aria-current="true"\] span \{ color: inherit/);
    assert.match(widget, /button\.setAttribute\('aria-current', String\(model\.selectedId === node\.id\)\)/);
    assert.match(widget, /revealOutlineAncestors\(nodes, model\.selectedId, this\.expanded\)/);
    assert.match(widget, /scrollIntoView\(\{ block: 'nearest' \}\)/);
    assert.match(widget, /this\.button\(label, \(\) => void model\.select\(node\.id\)\)/);
    assert.match(css, /button:focus-visible[^}]*outline: 2px solid/);
});
