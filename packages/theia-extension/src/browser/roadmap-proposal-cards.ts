import * as React from 'react';
import type { ChatPlanningProposal, ChatRoadmapPreviewEntity } from '@dope/chat/lib/service';

export type ProposalChange = NonNullable<ChatPlanningProposal['preview']>['entities'][number];
type SourceChange = { before: string; after: string };

const proposed = (source: boolean): string =>
    `Proposed · Not applied${source ? ' · Linked Markdown source-owned' : ''}`;

function selectControl(id: string, label: string, subtree = false): React.ReactElement {
    return React.createElement('button', { type: 'button',
        className: 'dope-roadmap-proposal-select nodrag nopan',
        'data-proposal-select': id, 'data-proposal-subtree': subtree ? 'true' : undefined,
        'aria-pressed': false, 'aria-label': label,
        onClick: (event: React.MouseEvent) => event.stopPropagation() }, subtree ? 'Select with children' : 'Select');
}

/** Existing entities keep their precise diff; creation has no previous value to compare. */
export function ProposedChange({ change, source, sourceChanges }: { change: ProposalChange; source: boolean;
    sourceChanges?: SourceChange[] }): React.ReactElement {
    const before = change.before, after = change.after, value = after ?? before;
    if (change.action === 'create' && after) return React.createElement('div', {
        className: 'dope-roadmap-correction-row dope-roadmap-proposal-created',
        'data-proposal-entity': change.id },
        selectControl(change.id, `Select proposed ${after.kind} ${after.title ?? ''}`),
        React.createElement('small', { className: 'dope-roadmap-authority' }, proposed(source)),
        React.createElement('strong', null, after.title ?? after.id),
        after.detail && React.createElement('p', null, after.detail));
    const field = (label: string, oldValue: unknown, newValue: unknown) =>
        JSON.stringify(oldValue) === JSON.stringify(newValue) ? null : React.createElement('p', { key: label },
            `${label}: ${oldValue ?? 'none'} → ${newValue ?? 'none'}`);
    return React.createElement('div', { className: `dope-roadmap-proposal-change dope-roadmap-proposal-${change.action}`,
        'data-proposal-entity': change.id },
        selectControl(change.id, `Select proposed ${value?.kind ?? 'change'} ${value?.title ?? ''}`),
        React.createElement('small', null, proposed(source)),
        React.createElement('strong', null, `${change.action === 'delete' ? 'Remove ' : ''}${value?.kind ?? 'element'} · ${value?.title ?? change.id}`),
        change.action === 'edit' ? field('Title', before?.title, after?.title) : null,
        change.action === 'edit' ? field(value?.kind === 'gate' ? 'Purpose' :
            value?.kind === 'criterion' ? 'Expected result' : 'Objective', before?.detail, after?.detail) :
            value?.detail && React.createElement('p', null, value.detail),
        change.action === 'edit' ? field('Parent', before?.parentId, after?.parentId) : null,
        change.action === 'edit' ? field('Order', before?.order, after?.order) : null,
        change.action === 'edit' ? field('Dependencies', before?.dependencies?.join(', '),
            after?.dependencies?.join(', ')) : null,
        ...(sourceChanges ?? []).map((line, index) => React.createElement('p', { key: `source-${index}` },
            `${line.before} → ${line.after}`)),
        value?.criteria?.length ? React.createElement('ul', null, ...value.criteria.map(criterion =>
            React.createElement('li', { key: criterion.id }, `${criterion.title} — ${criterion.expectedResult}`))) : null);
}

export function ProposedCriterionRow({ criterion, source }: { criterion: ChatRoadmapPreviewEntity; source: boolean }): React.ReactElement {
    return React.createElement('details', { className: 'dope-roadmap-proposal-criterion',
        'data-proposal-entity': criterion.id },
        React.createElement('summary', null, criterion.title ?? criterion.id),
        selectControl(criterion.id, `Select proposed Criterion ${criterion.title ?? ''}`),
        React.createElement('small', null, proposed(source)),
        criterion.detail && React.createElement('p', null, criterion.detail));
}

export function ProposedGateCard({ change, children, source }: { change: ProposalChange;
    children: ProposalChange[]; source: boolean }): React.ReactElement {
    const gate = change.after!;
    const criterionChanges = children.filter(child => child.after?.kind === 'criterion');
    const criteria = new Map<string, ChatRoadmapPreviewEntity>((gate.criteria ?? []).map(item => [item.id, {
        kind: 'criterion' as const, id: item.id, title: item.title, detail: item.expectedResult }]));
    for (const child of criterionChanges) if (child.action === 'create' && child.after)
        criteria.set(child.id, child.after);
    return React.createElement('details', { className: 'dope-roadmap-gate-row dope-roadmap-proposal-new-gate nodrag nopan',
        'data-proposal-gate-id': gate.id, open: true,
        onClick: (event: React.MouseEvent) => event.stopPropagation() },
        React.createElement('summary', { className: 'dope-roadmap-gate-summary',
            'aria-label': `${proposed(source)} Gate ${gate.designation ?? ''}: ${gate.title ?? gate.id}; not qualified` },
            React.createElement('span', { className: 'dope-roadmap-gate-icon', 'aria-hidden': true }, '◇'),
            React.createElement('span', { className: 'dope-roadmap-gate-title' },
                `${gate.designation ? `${gate.designation} · ` : ''}${gate.title ?? gate.id}`),
            React.createElement('span', { className: 'dope-roadmap-gate-qualifier' }, 'Proposed · Not applied'),
            React.createElement('span', { className: 'dope-roadmap-gate-chevron', 'aria-hidden': true }, '⌄')),
        React.createElement('div', { className: 'dope-roadmap-gate-foldout', 'data-proposal-entity': gate.id },
            selectControl(gate.id, `Select proposed Gate ${gate.title ?? ''}`),
            React.createElement('small', { className: 'dope-roadmap-authority' }, proposed(source)),
            gate.detail && React.createElement('p', null, gate.detail),
            React.createElement('strong', null, 'Criteria'),
            criteria.size ? [...criteria.values()].map(criterion => React.createElement(ProposedCriterionRow,
                { key: criterion.id, criterion, source })) :
                React.createElement('p', { className: 'dope-roadmap-detail' }, 'Awaiting Criteria'),
            ...children.filter(child => child.after?.kind !== 'criterion' || child.action !== 'create')
                .map(child => React.createElement(ProposedChange, { key: child.id, change: child, source }))));
}

export function ProposedPhaseNode({ data }: { data: { change: ProposalChange; children: ProposalChange[];
    source: boolean; sourceChanges?: SourceChange[] } }): React.ReactElement {
    const phase = data.change.after!;
    const gates = data.children.filter(child => child.action === 'create' && child.after?.kind === 'gate');
    const nested = new Set(gates.flatMap(gate => data.children.filter(child =>
        child.after?.parentId === gate.id).map(child => child.id)));
    const phaseNumber = /^Phase\s+(\d+)\b/i.exec(phase.title ?? '');
    const label = phaseNumber ? Number(phaseNumber[1]) : phase.order === undefined ? undefined : phase.order + 1;
    return React.createElement('section', { className: 'dope-roadmap-node dope-roadmap-phase-card dope-roadmap-proposal-phase',
        'data-phase-id': phase.id, 'data-proposal-entity': phase.id,
        'aria-label': `Proposed Phase${label ? ` ${label}` : ''}: ${phase.title ?? phase.id}; ${gates.length ? 'Gates not accepted' : 'Awaiting Gates'}` },
        React.createElement('div', { className: 'dope-roadmap-phase-main' },
            selectControl(phase.id, `Select proposed Phase ${phase.title ?? ''} and its children`, true),
            React.createElement('small', { className: 'dope-roadmap-authority' }, proposed(data.source)),
            React.createElement('small', { className: 'dope-roadmap-phase-label' }, label ? `PHASE ${label}` : 'PHASE'),
            React.createElement('strong', null, phase.title ?? phase.id),
            React.createElement('span', { className: 'dope-roadmap-status' },
                gates.length ? 'Gates proposed · not accepted' : 'Awaiting Gates')),
        phase.detail && React.createElement('p', { className: 'dope-roadmap-proposal-objective' }, phase.detail),
        React.createElement('span', { className: 'dope-roadmap-phase-divider', 'aria-hidden': true }),
        React.createElement('span', { className: 'dope-roadmap-phase-count' },
            gates.length ? `${gates.length} proposed Gate${gates.length === 1 ? '' : 's'} · 0 accepted` :
                'No accepted Gates · Awaiting Gates'),
        React.createElement('div', { className: 'dope-roadmap-phase-children nowheel' },
            ...gates.map(gate => React.createElement(ProposedGateCard, { key: gate.id, change: gate,
                children: data.children.filter(child => child.after?.parentId === gate.id), source: data.source })),
            ...data.children.filter(child => (child.action !== 'create' || child.after?.kind !== 'gate') &&
                !nested.has(child.id)).map(child =>
                child.action === 'create' && child.after?.kind === 'criterion' ?
                    React.createElement(ProposedCriterionRow, { key: child.id, criterion: child.after, source: data.source }) :
                    React.createElement(ProposedChange, { key: child.id, change: child, source: data.source }))));
}
