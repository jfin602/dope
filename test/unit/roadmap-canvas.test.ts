import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RoadmapProjection } from '../../packages/project-intelligence/src/roadmap-projection.ts';
import { projectRoadmapDraft, projectGateDraftCards, gatePhaseCards, roadmapGateLabel, roadmapSelectableGate, roadmapCanvasOrder, roadmapNextId, roadmapCanvasConnectors, roadmapSpatialLayout } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';
import type { RoadmapGateIndex } from '../../packages/project-intelligence/src/node/roadmap-gate-domain.ts';
import { roadmapEdgeStatus, roadmapStatusMark, type RoadmapStatus } from '../../packages/theia-extension/src/browser/roadmap-status-style.ts';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
const node = (id: string, lane: 'path' | 'branch', order: number) => ({
    id, lane, order, kind: lane === 'path' ? 'phase' as const : 'correction' as const,
    title: id, status: 'unknown' as const, statusLabel: 'Unknown', evidence: [], readOnly: false,
});

test('schema-two phase cards nest Gates, count only accepted Gates and leave source identity untouched', () => {
    const phase = (id: string, order: number) => ({ id, projectId: 'project', title: `Phase ${order + 1} — ${'A long readable title '.repeat(5)}`,
        objective: 'Outcome', order, dependencies: [], implementationStatus: 'unknown' as const,
        qualificationStatus: 'unknown' as const, draftAcceptance: 'published' as const,
        gateSetCoverage: { status: 'unreviewed' as const } });
    const gate = (id: string, parentPhaseId: string, order: number, acceptance: 'accepted' | 'proposed') => ({
        id, projectId: 'project', parentPhaseId, designation: `G${order + 1}`, title: id, purpose: 'Verify', order,
        dependencies: [], criteria: [], implementationStatus: 'unknown' as const,
        qualificationStatus: 'unknown' as const, draftAcceptance: acceptance });
    const index: RoadmapGateIndex = { schemaVersion: 2, projectId: 'project', projectRoot: '/tmp/fixture', revision: 4,
        phases: [phase('phase-a', 0), phase('phase-b', 1)],
        gates: [{ ...gate('gate-a', 'phase-a', 0, 'accepted'), purpose: 'Prove exact source',
            criteria: [{ id: 'criterion-a', projectId: 'project', title: 'Result visible',
                expectedResult: 'Visible after reload', order: 0, evidence: [] }] },
            gate('gate-draft', 'phase-a', 1, 'proposed')],
        corrections: [{ id: 'fix-a', projectId: 'project', parent: { kind: 'gate', id: 'gate-a' },
            title: 'Repair result', objective: 'Restore visibility', order: 0,
            implementationStatus: 'unknown', qualificationStatus: 'unknown', draftAcceptance: 'accepted' }],
        linkedDocument: { projectId: 'project', projectRoot: '/tmp/fixture', path: 'ROADMAP.md',
            sourceHash: 'a'.repeat(64), syncState: 'synced', sections: [] } };
    const before = JSON.stringify(index);
    const cards = gatePhaseCards(index);
    assert.deepEqual(cards.nodes.map(item => item.id), ['phase-a', 'phase-b']);
    assert.deepEqual(cards.nodes.map(item => item.statusLabel), ['Planned', 'Unplanned']);
    assert.equal(cards.nodes[0].phaseCard?.required, 1);
    assert.equal(cards.nodes[0].phaseCard?.qualified, 0);
    assert.deepEqual(cards.nodes[0].phaseCard?.gates.map(item => [item.id, item.proposed]),
        [['gate-a', false], ['gate-draft', true]]);
    assert.equal(cards.nodes[0].phaseCard?.gates[0].purpose, 'Prove exact source');
    assert.equal(cards.nodes[0].phaseCard?.gates[0].criteria[0].expectedResult, 'Visible after reload');
    assert.deepEqual(cards.nodes[0].phaseCard?.corrections[0].parent, { kind: 'gate', id: 'gate-a' });
    assert.equal(roadmapSelectableGate(index, 'project', 4, 'phase-a', 'gate-a')?.id, 'gate-a');
    assert.equal(roadmapSelectableGate(index, 'project', 4, 'phase-a', 'gate-draft')?.draftAcceptance, 'proposed');
    assert.equal(roadmapSelectableGate(index, 'foreign', 4, 'phase-a', 'gate-a'), undefined);
    assert.equal(roadmapSelectableGate(index, 'project', 3, 'phase-a', 'gate-a'), undefined);
    assert.equal(roadmapSelectableGate(index, 'project', 4, 'phase-b', 'gate-a'), undefined);
    assert.equal(cards.nodes[1].phaseCard?.required, 0);
    assert.deepEqual(roadmapCanvasConnectors(cards).map(item => item.kind), ['progression']);
    const positions = roadmapSpatialLayout(cards);
    assert.ok(positions.get('phase-a')!.x < positions.get('phase-b')!.x);
    assert.equal(JSON.stringify(index), before);
    assert.equal(index.linkedDocument?.sourceHash, 'a'.repeat(64));
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(css, /\.dope-roadmap-phase-card \{ width: 500px/);
    assert.match(css, /\.dope-roadmap-phase-main > strong \{ font-size: 23px/);
    assert.match(css, /\.dope-roadmap-phase-children \{ display: grid; gap: 9px; width: 100%; \}/);
    assert.match(css, /\.dope-roadmap-gate-summary \{[^}]*min-height: 54px/);
    assert.equal(cards.nodes[0].phaseCard?.presentation, 'planned');
    assert.equal(cards.nodes[1].phaseCard?.presentation, 'unplanned');
    assert.ok(positions.get('phase-b')!.x - positions.get('phase-a')!.x >= 580);
});

test('schema-two Phase-only and explicit Gate proposals remain visible without promoting task bullets', () => {
    assert.equal(roadmapGateLabel({ designation: 'G1', title: 'G1 Build acceptance' }), 'G1 · Build acceptance');
    assert.equal(roadmapGateLabel({ designation: 'G1', title: 'Build acceptance' }), 'G1 · Build acceptance');
    const base: RoadmapProjection = { projectId: 'draft-owner', revision: 0, nodes: [], edges: [],
        pools: { ideas: [], issues: [], corrections: [] }, diagnostics: [] };
    const draft = { revision: 1, phases: [{ id: 'phase-1', title: 'Foundation', objective: 'Build a base',
        checkpoints: [{ id: 'task-1', title: 'Set up build', objective: 'Task only' }], gates: [] }] };
    const phaseOnly = projectGateDraftCards(base, undefined, draft);
    assert.deepEqual(phaseOnly.nodes.map(item => item.id), ['phase-1']);
    assert.equal(phaseOnly.nodes[0].draftState, 'proposed');
    assert.equal(phaseOnly.nodes[0].phaseCard?.required, 0);
    assert.deepEqual(phaseOnly.nodes[0].phaseCard?.gates, []);
    const explicit = projectGateDraftCards(base, undefined, { revision: 2, phases: [{ ...draft.phases[0],
        gates: [{ id: 'gate-1', parentPhaseId: 'phase-1', designation: 'G1', title: 'Build passes',
            purpose: 'Verify current source', criteria: [{ id: 'criterion-1', title: 'Build exits zero',
                expectedResult: 'No compile errors' }] }] }] });
    assert.equal(explicit.nodes[0].phaseCard?.gates[0].proposed, true);
    assert.equal(explicit.nodes[0].phaseCard?.gates[0].criteria[0].expectedResult, 'No compile errors');
    assert.equal(explicit.nodes[0].phaseCard?.required, 0);
    const accepted = projectGateDraftCards(base, { revision: 2, phases: [{ ...draft.phases[0],
        gates: [{ id: 'gate-1', parentPhaseId: 'phase-1', designation: 'G1', title: 'Build passes',
            purpose: 'Verify current source', criteria: [{ id: 'criterion-1', title: 'Build exits zero',
                expectedResult: 'No compile errors' }] }] }] });
    assert.equal(accepted.nodes[0].draftState, 'accepted');
    assert.equal(accepted.nodes[0].phaseCard?.gates[0].draftAcceptance, 'accepted');
    assert.equal(accepted.nodes[0].phaseCard?.gates[0].proposed, false);
    assert.deepEqual(base.nodes, []);
});

test('one keyboard order follows the checkpoint path and attached branches', () => {
    const projection: RoadmapProjection = { projectId: 'project', revision: 1,
        nodes: [node('p1', 'path', 1), node('p2', 'path', 2), node('c1', 'branch', 3)],
        edges: [{ id: 'branch', from: 'p1', to: 'c1', kind: 'branch', label: 'Correction branch' }],
        pools: { ideas: [], issues: [] }, diagnostics: [] };
    const ids = roadmapCanvasOrder(projection).map(item => item.id);
    assert.deepEqual(ids, ['p1', 'c1', 'p2']);
    assert.equal(roadmapNextId(ids, 'p1', 'ArrowDown'), 'c1');
    assert.equal(roadmapNextId(ids, 'c1', 'ArrowRight'), 'p2');
    assert.equal(roadmapNextId(ids, 'p2', 'ArrowUp'), 'c1');
    assert.equal(roadmapNextId(ids, 'p2', 'Home'), 'p1');
    assert.equal(roadmapNextId(ids, 'p1', 'End'), 'p2');
    assert.equal(roadmapNextId(ids, 'p1', 'Enter'), undefined);
});

test('strategic preview numbers ordered phases without changing identities or dependency data', () => {
    const base: RoadmapProjection = { projectId: 'project', revision: 0, nodes: [], edges: [],
        pools: { ideas: [], issues: [] }, diagnostics: [] };
    const first = { id: 'stable-a', title: 'Phase 9 — Foundation', objective: 'Set up',
        checkpoints: [{ id: 'child-a', title: 'Project setup', objective: 'Runnable app', dependencies: [] }] };
    const second = { id: 'stable-b', title: 'Combat', objective: 'Playable loop',
        checkpoints: [{ id: 'child-b', title: 'Combat loop', objective: 'Playable', dependencies: ['child-a'] }] };
    const proposed = projectRoadmapDraft(base, undefined, { revision: 1, phases: [first, second] });
    assert.deepEqual(proposed.nodes.filter(item => item.kind === 'phase').map(item => [item.id, item.title]),
        [['stable-a', 'Phase 1 — Foundation'], ['stable-b', 'Phase 2 — Combat']]);
    assert.equal(proposed.nodes.find(item => item.id === 'child-b')?.phaseAssociation?.phaseId, 'stable-b');
    assert.ok(proposed.edges.some(edge => edge.from === 'child-a' && edge.to === 'child-b' && edge.kind === 'dependency'));
    assert.ok(roadmapCanvasConnectors(proposed).some(edge => edge.from === 'stable-a' && edge.to === 'stable-b' &&
        edge.kind === 'progression'));
    const reordered = projectRoadmapDraft(base, undefined, { revision: 1, phases: [second, first] });
    assert.deepEqual(reordered.nodes.filter(item => item.kind === 'phase').map(item => [item.id, item.title]),
        [['stable-b', 'Phase 1 — Combat'], ['stable-a', 'Phase 2 — Foundation']]);
});

test('five-phase preview groups checkpoints and correction without changing stored dependencies', () => {
    const base: RoadmapProjection = { projectId: 'project', revision: 0, nodes: [], edges: [],
        pools: { ideas: [], issues: [] }, diagnostics: [] };
    const phases = Array.from({ length: 5 }, (_, index) => ({ id: `phase-${index + 1}`,
        title: `Phase ${index + 1} — Step ${index + 1}`, objective: '',
        checkpoints: [{ id: `checkpoint-${index + 1}`, title: `Checkpoint ${index + 1}`, objective: '',
            dependencies: index ? [`checkpoint-${index}`] : [] }] }));
    const correction = { id: 'correction', title: 'Review correction', objective: '', checkpoints: [],
        kind: 'correction' as const, parentId: 'phase-2' };
    const proposed = projectRoadmapDraft(base, undefined, { revision: 1, phases: [...phases, correction] });
    assert.deepEqual(proposed.nodes.filter(item => item.kind === 'phase').map(item => item.title),
        phases.map((_, index) => `Phase ${index + 1} — Step ${index + 1}`));
    const positions = roadmapSpatialLayout(proposed);
    for (const phase of phases) {
        assert.equal(positions.get(phase.id)?.x, positions.get(phase.checkpoints[0].id)?.x! - 28);
        assert.ok(positions.get(phase.checkpoints[0].id)!.y > positions.get(phase.id)!.y);
    }
    assert.ok(positions.get('correction')!.y < positions.get('phase-2')!.y);
    assert.equal(proposed.edges.filter(edge => edge.kind === 'dependency').length, 4);
    const reordered = projectRoadmapDraft(base, undefined, { revision: 1,
        phases: [phases[4], ...phases.slice(0, 4), correction] });
    assert.equal(reordered.nodes.find(item => item.id === 'phase-5')?.title, 'Phase 1 — Step 5');
    assert.equal(reordered.nodes.find(item => item.id === 'checkpoint-5')?.id, 'checkpoint-5');
});

test('one ordinary center tab, safe labels, recovery, semantic dark/light tokens and no Chat docking effects', () => {
    const module = read('packages/theia-extension/src/browser/frontend-module.ts');
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(module, /id: ROADMAP_CANVAS_ID, createWidget:/);
    assert.match(module, /getOrCreateWidget<RoadmapCanvasWidget>\(ROADMAP_CANVAS_ID\)/);
    assert.match(module, /shell\.addWidget\(widget, \{ area: 'main' \}\)/);
    assert.match(module, /dope\.roadmap\.open/);
    assert.doesNotMatch(widget, /openChatPanel|CHAT_PANEL_ID|ChatPanelWidget|shell\.addWidget/);
    assert.match(widget, /React\.createElement\('strong', null, item\.title\)/);
    assert.match(widget, /className: `dope-roadmap-node dope-roadmap-status-\$\{item\.status\}\$\{item\.draftState/);
    assert.match(widget, /roadmapStatusMark\[item\.status\]/);
    assert.match(widget, /item\.statusLabel\)/);
    assert.doesNotMatch(widget, /innerHTML|insertAdjacentHTML/);
    assert.match(widget, /aria-current/);
    assert.match(widget, /aria-live/);
    assert.match(widget, /Use Refresh to retry/);
    assert.match(widget, /this\.node\.append\(this\.toolbar, this\.stage\)/);
    assert.match(widget, /this\.sourceButton\.setAttribute\('aria-controls', 'dope-roadmap-source-panel'\)/);
    assert.match(widget, /this\.sourceButton\.dataset\.review = String\(needsReview\)/);
    assert.match(widget, /this\.importEntry\.hidden = !open/);
    assert.match(css, /\.dope-roadmap-stage-host > \[hidden\] \{ display: none !important; \}/);
    assert.match(css, /\.dope-roadmap-canvas.*var\(--theia-editor-background\)/);
    assert.match(css, /\.dope-roadmap-node\[aria-current="true"\].*var\(--dope-primary, var\(--dope-roadmap-focus, var\(--theia-focusBorder\)\)\)/);
    const rules = css.slice(css.indexOf('.dope-roadmap-canvas'), css.indexOf('.dope-history-panel'));
    assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b/);
    assert.match(rules, /max-width: 480px/);
});

test('accepted Chat draft reveal checks project, Chat and revision before fitting existing canvas', () => {
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    assert.match(widget, /async revealAcceptedChatDraft\(projectUri: string, projectId: string, chatId: string,/);
    assert.match(widget, /state\.chatId !== chatId \|\| state\.draft\.revision !== revision/);
    assert.match(widget, /this\.flow\.fitView\(\{ padding: 0\.12, maxZoom: 1 \}\)/);
    assert.doesNotMatch(widget.slice(widget.indexOf('async revealAcceptedChatDraft'), widget.indexOf('linkedSourceChanged')),
        /beginDraft|acceptStrategicDraft|applyPending|ROADMAP\.md/);
});

test('Prepare Work opens the registered center Planning Map with no Chat or agent launch', () => {
    const frontend = read('packages/theia-extension/src/browser/frontend-module.ts');
    const inspector = read('packages/theia-extension/src/browser/roadmap-inspector-widget.ts');
    assert.match(inspector, /dope-roadmap-prepare-work/);
    assert.match(inspector, /prepare\.disabled = !!this\.model\.prepareWorkBlockedReason/);
    assert.match(frontend, /getOrCreateWidget<PhysicalMapWidget>\(PHYSICAL_MAP_ID\)/);
    assert.match(frontend, /verifyPrepareWorkNavigation\(selection, map, planning\)/);
    assert.match(frontend, /if \(selection\.mapId\) planning\.select\(selection\.mapId\)/);
    assert.match(frontend, /else if \(existingMapId\) planning\.select\(existingMapId\)/);
    assert.match(frontend, /planning\.setPrepareWorkContext\(\{ \.\.\.selection, planningProjectId \}\)/);
    assert.match(frontend, /planning\.setMode\(true\)/);
    assert.doesNotMatch(inspector, /openChatPanel|launchWork|AgentRuntimeService/);
});

test('Phase Focus uses the selected phase projection and existing checked source navigation', () => {
    const canvas = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const inspector = read('packages/theia-extension/src/browser/roadmap-inspector-model.ts');
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(canvas, /selectPhaseFocus\(index, this\.taskStacks, this\.phaseId,/);
    assert.match(canvas, /this\.service\.phaseFocusEvidence\(uri, index\.projectId, phaseId\)/);
    assert.match(canvas, /selected\?\.kind !== 'phase'/);
    assert.match(canvas, /this\.stage\.append\(this\.path, this\.status, this\.strategicBar, this\.importEntry, this\.inspection, this\.phaseFocus/);
    assert.match(canvas, /for \(const stack of phase\.stacks\)/);
    assert.match(canvas, /for \(const prompt of stack\.prompts\)/);
    assert.match(canvas, /this\.inspector\.openPrompt\(node\)/);
    assert.match(inspector, /this\.service\.resolvePromptSource\(uri, source\.path, source\.fingerprint\)/);
    assert.match(canvas, /Prompt source unavailable: \$\{inspector\.error\}/);
    assert.doesNotMatch(canvas, /openChatPanel|CHAT_PANEL_ID|ChatPanelWidget|shell\.addWidget|runPrompt/);
    assert.match(canvas, /this\.phaseFocus\.onkeydown = event => \{/);
    assert.match(canvas, /this\.setPhaseOpen\(false\)/);
    assert.match(css, /\.dope-roadmap-phase-focus \{ position: absolute; top: 8px; right: 8px/);
    assert.match(css, /\.dope-roadmap-phase-focus\[data-state="minimized"\]/);
    assert.match(css, /\.dope-roadmap-phase-focus.*var\(--theia-editorWidget-background/);
    assert.match(css, /@media \(max-width: 720px\).*\.dope-roadmap-phase-focus/);
});

test('Details command and selection use one mounted inspector model in the canvas with safe overlay states', () => {
    const module = read('packages/theia-extension/src/browser/frontend-module.ts');
    const canvas = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const inspector = read('packages/theia-extension/src/browser/roadmap-inspector-widget.ts');
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(canvas, /this\.inspectionEditor = new RoadmapInspectorWidget\(inspector\)/);
    assert.match(canvas, /this\.stage\.append\(this\.path, this\.status, this\.strategicBar, this\.importEntry, this\.inspection/);
    assert.match(canvas, /this\.setInspectionView\('compact'\);\s*this\.setInspectionOpen\(true\)/);
    assert.match(canvas, /this\.inspectionEditor\.node\.hidden = !!item/);
    assert.match(canvas, /this\.details\.onclick = \(\) => this\.openDetails\(\)/);
    assert.match(module, /id: 'dope\.roadmap\.inspector'.*Show Roadmap Details/);
    assert.match(module, /widget\.openDetails\(\)/);
    assert.doesNotMatch(module, /RoadmapInspectorView/);
    assert.match(module, /new RoadmapInspectorWidget\(context\.container\.get\(RoadmapInspectorModel\), false\)/);
    assert.doesNotMatch(inspector, /AbstractViewContribution/);
    assert.match(inspector, /this\.editable && !item\.readOnly && this\.model\.draft/);
    assert.match(canvas, /this\.inspection\.onkeydown = event => \{ if \(event\.key === 'Escape'\)/);
    assert.match(canvas, /this\.inspectionReturnFocus/);
    assert.match(canvas, /this\.inspectionFocus/);
    assert.match(canvas, /this\.inspectionExpand\.focus\(\)/);
    assert.match(canvas, /else this\.path\.focus\(\)/);
    assert.match(canvas, /this\.inspection\.hidden = !open/);
    assert.match(canvas, /this\.inspection\.dataset\.state = view/);
    assert.match(canvas, /this\.inspector\.dirty \|\| this\.inspector\.requiresApproval/);
    assert.match(canvas, /this\.stage\.clientWidth < 1240/);
    assert.match(canvas, /this\.setSourceOpen\(false\)/);
    assert.match(css, /\.dope-roadmap-inspection\[data-state="compact"\]/);
    assert.match(css, /\.dope-roadmap-inspection\[data-state="minimized"\]/);
    assert.doesNotMatch(canvas, /openChatPanel|CHAT_PANEL_ID|ChatPanelWidget/);
});

test('all six status marks and semantic colors remain distinct from selection and keyboard focus', () => {
    const css = read('packages/theia-extension/src/browser/dope.css');
    const states: RoadmapStatus[] = ['green', 'active', 'not-green', 'waived', 'not-implemented', 'unknown'];
    assert.equal(new Set(states.map(status => roadmapStatusMark[status])).size, states.length);
    for (const status of states) {
        assert.match(css, new RegExp(`\\.dope-roadmap-status-${status} \\{ --roadmap-status-color: var\\(--dope-roadmap-${status},`));
        assert.match(css, new RegExp(`\\.dope-roadmap-edge-${status} \\.react-flow__edge-path`));
    }
    for (const status of states.filter(value => value !== 'green')) {
        assert.doesNotMatch(css.match(new RegExp(`\\.dope-roadmap-status-${status} \\{[^}]+`))?.[0] ?? '', /--dope-roadmap-green/);
    }
    assert.match(css, /\.dope-roadmap-node\[aria-current="true"\]/);
    assert.match(css, /\.dope-roadmap-canvas button:focus-visible/);
    assert.match(css, /\.dope-roadmap-status-mark/);
    assert.match(read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts'), /'aria-hidden': true.*roadmapStatusMark\[item\.status\]/);
});

test('the whole Roadmap card keeps its status tint through hover, selection and focus', () => {
    const css = read('packages/theia-extension/src/browser/dope.css');
    const rule = (selector: string) => css.match(new RegExp(`${selector} \\{([^}]+)\\}`))?.[1] ?? '';
    const card = rule('\\.dope-roadmap-node');
    const hover = rule('\\.dope-roadmap-node:hover');
    const selected = rule('\\.dope-roadmap-node\\[aria-current="true"\\]');
    assert.match(card, /color: var\(--theia-editor-foreground\)/);
    assert.match(card, /background: color-mix\(in srgb, var\(--roadmap-status-color, var\(--theia-descriptionForeground\)\)/);
    assert.match(card, /var\(--roadmap-status-fill, 13%\)/);
    assert.match(card, /var\(--theia-editorWidget-background, var\(--theia-editor-background\)\)/);
    assert.match(card, /border: 2px solid color-mix\(in srgb, var\(--roadmap-status-color/);
    assert.match(card, /var\(--theia-widget-border, var\(--theia-descriptionForeground\)\)/);
    assert.match(card, /border-left-width: 5px/);
    assert.match(hover, /background: color-mix\(in srgb, var\(--roadmap-status-color/);
    assert.match(hover, /var\(--roadmap-status-hover-fill, 19%\)/);
    assert.doesNotMatch(selected, /background:|border-left:/);
    assert.match(selected, /box-shadow: 0 0 0 2px var\(--dope-primary, var\(--dope-roadmap-focus, var\(--theia-focusBorder\)\)\)/);
    assert.match(css, /\.dope-roadmap-canvas button:focus-visible \{ outline: 2px solid var\(--dope-roadmap-focus, var\(--theia-focusBorder\)\)/);
    assert.doesNotMatch(rule('\\.dope-roadmap-node:disabled'), /opacity:|background:/);
    for (const status of ['green', 'active', 'not-green', 'waived', 'not-implemented', 'unknown']) {
        assert.match(rule(`\\.dope-roadmap-status-${status}`), /--roadmap-status-color: var\(--dope-roadmap-/);
    }
    assert.match(rule('\\.dope-roadmap-status-not-implemented'), /--roadmap-status-fill: 9%/);
    assert.match(rule('\\.dope-roadmap-status-unknown'), /--roadmap-status-fill: 6%/);
    assert.doesNotMatch(card + hover, /#[0-9a-fA-F]{3,8}\b/);
});

test('only actual Green to Green dependencies or branches look completed', () => {
    const states: RoadmapStatus[] = ['green', 'active', 'not-green', 'waived', 'not-implemented', 'unknown'];
    for (const from of states) for (const to of states) {
        assert.equal(roadmapEdgeStatus(from, to) === 'green', from === 'green' && to === 'green');
    }
    assert.equal(roadmapEdgeStatus(undefined, 'green'), 'unknown');
    assert.equal(roadmapEdgeStatus('green', undefined), 'unknown');
    assert.equal(roadmapEdgeStatus('green', 'waived'), 'waived');
    assert.equal(roadmapEdgeStatus('not-green', 'green'), 'not-green');
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    assert.match(widget, /roadmapEdgeStatus\(statuses\.get\(item\.from\), statuses\.get\(item\.to\)\)/);
    assert.match(widget, /item\.kind === 'dependency' \? ` dope-roadmap-edge-\$\{status\}` : ''/);
    assert.match(widget, /roadmapCanvasConnectors\(visible\)/);
    assert.match(widget, /ariaLabel: `\$\{item\.label\};/);
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(css, /\.dope-roadmap-edge-branch \.react-flow__edge-path \{ stroke-dasharray: 6 4; \}/);
    assert.match(css, /\.dope-roadmap-edge-active \.react-flow__edge-path \{[^}]*stroke-dasharray:/);
});

test('relationship motion is brief, selection-only and static under reduced motion', () => {
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(css, /\.dope-roadmap-edge-related \.react-flow__edge-path \{[^}]*animation: dope-roadmap-relationship-focus 420ms ease-out 1/);
    assert.match(css, /\.dope-roadmap-stage:not\(\.dope-roadmap-arranging\) \.react-flow__node \{ transition: transform 180ms ease-out/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.dope-roadmap-edge-related \.react-flow__edge-path \{ animation: none; \}/);
    assert.doesNotMatch(css, /\.dope-roadmap-edge-active \.react-flow__edge-path \{[^}]*animation:/);
    assert.doesNotMatch(css, /animation-iteration-count:\s*infinite/);
});

test('Roadmap status ink uses theme-scoped contrast corrections', () => {
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(css, /body\.theia-light:not\(\.dope-dark\) \{[\s\S]*?--dope-roadmap-active:/);
    assert.match(css, /body\.theia-light:not\(\.dope-dark\) \{[\s\S]*?--dope-roadmap-unknown:/);
    assert.match(css, /body\.theia-light:not\(\.dope-dark\) \{[\s\S]*?--dope-roadmap-focus:/);
    assert.match(css, /--dope-roadmap-not-implemented: color-mix\(in srgb, var\(--theia-foreground\) 80%/);
});

test('closing details restores focus captured before the panel becomes hidden', () => {
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    assert.match(widget, /const hadFocus = this\.inspection\.contains\(document\.activeElement\);[\s\S]*?this\.inspection\.hidden = !open;[\s\S]*?else if \(hadFocus\)/);
});
