import * as React from 'react';
import type { ChatPlanningProposal, ChatRoadmapPreviewEntity } from '@dope/chat/lib/service';

export type ProposalChange = NonNullable<ChatPlanningProposal['preview']>['entities'][number];
type SourceChange = { before: string; after: string };
export type ProposedFieldSave = (entityId: string, field: 'title' | 'objective' | 'purpose' | 'expectedResult',
    value: string) => Promise<void>;
type ProposedFieldEditor = { editing: boolean; draft: string; error?: string };
type ProposedFieldEvent = { type: 'open'; value: string } | { type: 'cancel'; value: string } |
    { type: 'saved'; value: string } |
    { type: 'change'; value: string } | { type: 'failure'; error: string };

export function proposedFieldEditorNext(state: ProposedFieldEditor, event: ProposedFieldEvent): ProposedFieldEditor {
    if (event.type === 'open') return { editing: true, draft: event.value };
    if (event.type === 'cancel' || event.type === 'saved') return { editing: false, draft: event.value };
    if (event.type === 'change') return { ...state, draft: event.value, error: undefined };
    return { ...state, error: event.error };
}

export function proposedFieldKeyAction(key: string, multiline: boolean): 'cancel' | 'save' | undefined {
    return key === 'Escape' ? 'cancel' : key === 'Enter' && !multiline ? 'save' : undefined;
}

function ProposedField({ id, field, value, label, save, multiline }: { id: string;
    field: 'title' | 'objective' | 'purpose' | 'expectedResult'; value: string; label: string;
    save?: ProposedFieldSave; multiline?: boolean }): React.ReactElement {
    const [editor, setEditor] = React.useState<ProposedFieldEditor>({ editing: false, draft: value });
    const [busy, setBusy] = React.useState(false);
    const input = React.useRef<HTMLInputElement & HTMLTextAreaElement>(null);
    const pencil = React.useRef<HTMLButtonElement>(null);
    React.useEffect(() => { if (editor.editing) input.current?.focus(); }, [editor.editing]);
    React.useEffect(() => { if (!editor.editing) setEditor(current =>
        proposedFieldEditorNext(current, { type: 'saved', value })); }, [value, editor.editing]);
    const cancel = () => { setEditor(current => proposedFieldEditorNext(current, { type: 'cancel', value }));
        requestAnimationFrame(() => pencil.current?.focus()); };
    const confirm = async () => {
        if (!save || busy) return;
        if (editor.draft === value) { cancel(); return; }
        setBusy(true);
        setEditor(current => ({ ...current, error: undefined }));
        try { await save(id, field, editor.draft); setEditor(current =>
            proposedFieldEditorNext(current, { type: 'saved', value: current.draft }));
            requestAnimationFrame(() => pencil.current?.focus()); }
        catch (failure) { setEditor(current => proposedFieldEditorNext(current,
            { type: 'failure', error: String(failure) })); }
        finally { setBusy(false); }
    };
    return React.createElement('span', { className: 'dope-roadmap-proposal-field nodrag nopan nowheel',
        onClick: (event: React.MouseEvent) => event.stopPropagation() },
        editor.editing && save ? React.createElement(React.Fragment, null,
            multiline ? React.createElement('textarea', { ref: input, value: editor.draft, rows: 3,
                'aria-label': label, disabled: busy, onChange: event => setEditor(current =>
                    proposedFieldEditorNext(current, { type: 'change', value: event.target.value })),
                onKeyDown: event => { if (proposedFieldKeyAction(event.key, true) === 'cancel') {
                    event.preventDefault(); event.stopPropagation(); cancel(); } } }) :
                React.createElement('input', { ref: input, value: editor.draft, 'aria-label': label,
                    disabled: busy, onChange: event => setEditor(current =>
                        proposedFieldEditorNext(current, { type: 'change', value: event.target.value })),
                    onKeyDown: event => { const action = proposedFieldKeyAction(event.key, false);
                        if (action === 'cancel') {
                            event.preventDefault(); event.stopPropagation(); cancel(); }
                        else if (action === 'save') {
                            event.preventDefault(); event.stopPropagation(); void confirm(); } } }),
            React.createElement('button', { type: 'button', disabled: busy,
                onClick: () => void confirm(), 'aria-label': `Save ${label}` }, 'Save'),
            React.createElement('button', { type: 'button', disabled: busy, onClick: cancel }, 'Cancel'),
            editor.error && React.createElement('small', { role: 'alert' }, editor.error)) :
            React.createElement(React.Fragment, null, React.createElement('span', null, value),
                save && React.createElement('button', { ref: pencil, type: 'button', className: 'dope-roadmap-pencil',
                    'aria-label': `Edit proposed ${label}`, 'data-proposal-edit-entity': id,
                    onClick: event => { event.preventDefault(); setEditor(current =>
                        proposedFieldEditorNext(current, { type: 'open', value })); } }, '✎')));
}

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
export function ProposedChange({ change, source, sourceChanges, save }: { change: ProposalChange; source: boolean;
    sourceChanges?: SourceChange[]; save?: ProposedFieldSave }): React.ReactElement {
    const before = change.before, after = change.after, value = after ?? before;
    if (change.action === 'create' && after) return React.createElement('div', {
        className: 'dope-roadmap-correction-row dope-roadmap-proposal-created',
        'data-proposal-entity': change.id },
        selectControl(change.id, `Select proposed ${after.kind} ${after.title ?? ''}`),
        React.createElement('small', { className: 'dope-roadmap-authority' }, proposed(source)),
        React.createElement('strong', null, after.kind === 'criterion' ?
            React.createElement(ProposedField, { id: after.id, field: 'title', value: after.title ?? '',
                label: 'Criterion title', save }) : after.title ?? after.id),
        after.detail && React.createElement('p', null, after.kind === 'criterion' ?
            React.createElement(ProposedField, { id: after.id, field: 'expectedResult', value: after.detail,
                label: 'Criterion expected result', save, multiline: true }) : after.detail));
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
        change.action === 'edit' && after && after.kind !== 'correction' ?
            React.createElement('div', null,
                React.createElement(ProposedField, { id: after.id, field: 'title',
                    value: after.title ?? '', label: `${after.kind} title`, save }),
                React.createElement(ProposedField, { id: after.id, field: after.kind === 'phase' ? 'objective' :
                    after.kind === 'gate' ? 'purpose' : 'expectedResult', value: after.detail ?? '',
                    label: after.kind === 'phase' ? 'Phase objective' : after.kind === 'gate' ?
                        'Gate purpose' : 'Criterion expected result', save, multiline: true })) : null,
        ...(sourceChanges ?? []).map((line, index) => React.createElement('p', { key: `source-${index}` },
            `${line.before} → ${line.after}`)),
        value?.criteria?.length ? React.createElement('ul', null, ...value.criteria.map(criterion =>
            React.createElement('li', { key: criterion.id }, `${criterion.title} — ${criterion.expectedResult}`))) : null);
}

export function ProposedCriterionRow({ criterion, source, save }: { criterion: ChatRoadmapPreviewEntity;
    source: boolean; save?: ProposedFieldSave }): React.ReactElement {
    return React.createElement('details', { className: 'dope-roadmap-proposal-criterion',
        'data-proposal-entity': criterion.id },
        React.createElement('summary', null, criterion.title ?? criterion.id),
        selectControl(criterion.id, `Select proposed Criterion ${criterion.title ?? ''}`),
        React.createElement('small', null, proposed(source)),
        React.createElement(ProposedField, { id: criterion.id, field: 'title', value: criterion.title ?? '',
            label: 'Criterion title', save }),
        criterion.detail && React.createElement('p', null,
            React.createElement(ProposedField, { id: criterion.id, field: 'expectedResult',
                value: criterion.detail, label: 'Criterion expected result', save, multiline: true })));
}

export function ProposedGateCard({ change, children, source, save }: { change: ProposalChange;
    children: ProposalChange[]; source: boolean; save?: ProposedFieldSave }): React.ReactElement {
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
            React.createElement(ProposedField, { id: gate.id, field: 'title', value: gate.title ?? '',
                label: 'Gate title', save }),
            gate.detail && React.createElement('p', null,
                React.createElement(ProposedField, { id: gate.id, field: 'purpose', value: gate.detail,
                    label: 'Gate purpose', save, multiline: true })),
            React.createElement('strong', null, 'Criteria'),
            criteria.size ? [...criteria.values()].map(criterion => React.createElement(ProposedCriterionRow,
                { key: criterion.id, criterion, source, save })) :
                React.createElement('p', { className: 'dope-roadmap-detail' }, 'Awaiting Criteria'),
            ...children.filter(child => child.after?.kind !== 'criterion' || child.action !== 'create')
                .map(child => React.createElement(ProposedChange, { key: child.id, change: child, source, save }))));
}

export function ProposedPhaseNode({ data }: { data: { change: ProposalChange; children: ProposalChange[];
    source: boolean; sourceChanges?: SourceChange[]; save?: ProposedFieldSave } }): React.ReactElement {
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
            selectControl(phase.id, `Select only proposed Phase ${phase.title ?? ''}`),
            selectControl(phase.id, `Select proposed Phase ${phase.title ?? ''} and its children`, true),
            React.createElement('small', { className: 'dope-roadmap-authority' }, proposed(data.source)),
            React.createElement('small', { className: 'dope-roadmap-phase-label' }, label ? `PHASE ${label}` : 'PHASE'),
            React.createElement('strong', null,
                React.createElement(ProposedField, { id: phase.id, field: 'title', value: phase.title ?? '',
                    label: 'Phase title', save: data.save })),
            React.createElement('span', { className: 'dope-roadmap-status' },
                gates.length ? 'Gates proposed · not accepted' : 'Awaiting Gates')),
        phase.detail && React.createElement('p', { className: 'dope-roadmap-proposal-objective' },
            React.createElement(ProposedField, { id: phase.id, field: 'objective', value: phase.detail,
                label: 'Phase objective', save: data.save, multiline: true })),
        React.createElement('span', { className: 'dope-roadmap-phase-divider', 'aria-hidden': true }),
        React.createElement('span', { className: 'dope-roadmap-phase-count' },
            gates.length ? `${gates.length} proposed Gate${gates.length === 1 ? '' : 's'} · 0 accepted` :
                'No accepted Gates · Awaiting Gates'),
        React.createElement('div', { className: 'dope-roadmap-phase-children nowheel' },
            ...gates.map(gate => React.createElement(ProposedGateCard, { key: gate.id, change: gate,
                children: data.children.filter(child => child.after?.parentId === gate.id), source: data.source,
                save: data.save })),
            ...data.children.filter(child => (child.action !== 'create' || child.after?.kind !== 'gate') &&
                !nested.has(child.id)).map(child =>
                child.action === 'create' && child.after?.kind === 'criterion' ?
                    React.createElement(ProposedCriterionRow, { key: child.id, criterion: child.after,
                        source: data.source, save: data.save }) :
                    React.createElement(ProposedChange, { key: child.id, change: child, source: data.source,
                        save: data.save }))));
}
