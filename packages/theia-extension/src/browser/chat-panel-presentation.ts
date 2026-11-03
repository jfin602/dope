import { safeChatToolPath, type Chat, type ChatAssistantMessage } from '@dope/chat';

export function isDraftPlanningAction(type: string): boolean {
    return ['create-phase', 'create-checkpoint', 'edit-phase', 'edit-checkpoint', 'reorder-phase',
        'reorder-checkpoint', 'split-checkpoint', 'move-checkpoint', 'add-dependency',
        'remove-dependency', 'create-correction', 'attach-correction', 'draft-sequence',
        'implementation-plan', 'implementation-plan-revision'].includes(type);
}

/** A verified Roadmap decision is shown by its inline review card, not an activity row. */
export function isInlineRoadmapProposal(message: ChatAssistantMessage): boolean {
    return message.planningActivity?.kind === 'roadmap-gate-proposal' ||
        message.planningActivity?.kind === 'roadmap-gate-undo' ||
        message.planningActivity?.kind === 'roadmap-publication';
}

/** Only the backend's persisted activity marker can select compact machine presentation. */
export function planningActivityPresentation(message: ChatAssistantMessage): { label: string; status: string; alert: boolean } | undefined {
    const activity = message.planningActivity;
    if (!activity || !['roadmap-intent', 'roadmap-proposal', 'roadmap-sequence', 'roadmap-gate-proposal', 'roadmap-gate-undo', 'roadmap-publication', 'roadmap-gate-focus', 'roadmap-draft-proposal', 'roadmap-draft-sequence', 'implementation-plan', 'implementation-plan-revision', 'bridge-proposal', 'no-action'].includes(activity.kind))
        return undefined;
    if (activity.kind === 'no-action' && activity.status === 'no-action') return undefined;
    const label = activity.verifiedGuidance && noActionEnvelope(message) ? 'Verified Dope guidance' :
        activity.kind === 'no-action' ? 'No planning action' :
        activity.kind === 'implementation-plan' ? 'Implementation plan' :
        activity.kind === 'implementation-plan-revision' ? 'Plan revision' :
        activity.kind === 'bridge-proposal' ? 'Bridge suggestion' :
        activity.kind === 'roadmap-sequence' || activity.kind === 'roadmap-draft-sequence' ? 'Roadmap steps' :
        activity.kind === 'roadmap-gate-proposal' ? 'Roadmap change' :
        activity.kind === 'roadmap-gate-undo' ? 'Roadmap undo' :
        activity.kind === 'roadmap-publication' ? 'Roadmap Markdown' :
        activity.kind === 'roadmap-gate-focus' ? 'Roadmap selection' :
        activity.kind === 'roadmap-draft-proposal' ? 'Planning draft' :
        activity.kind === 'roadmap-proposal' ? 'Roadmap proposal' : 'Roadmap intent';
    const statuses: Record<typeof activity.status, string> = {
        pending: 'Pending · no write',
        suggested: 'Suggested · review in Planning Map',
        'no-action': 'No change',
        rejected: 'Rejected · no change',
        denied: 'Denied · no change',
        stale: 'Stale · no change',
        superseded: 'Superseded · no change',
        applied: 'Applied',
        failed: 'Failed',
        cancelled: 'Cancelled',
    };
    const gateDecision = activity.kind === 'roadmap-gate-proposal' || activity.kind === 'roadmap-gate-undo' ||
        activity.kind === 'roadmap-publication';
    return { label, status: gateDecision && activity.status === 'denied' ? 'Rejected · no change' :
        gateDecision && activity.status === 'rejected' ?
            activity.proposalId ? 'Failed · no change' : 'Denied · no change' : statuses[activity.status],
        alert: ['rejected', 'denied', 'stale', 'failed', 'cancelled'].includes(activity.status) };
}

/** Readable projection of a backend-validated plan; the original machine envelope stays inspectable. */
export function implementationPlanAnswer(message: ChatAssistantMessage): string | undefined {
    if (message.execution.status === 'complete' && message.planningActivity?.kind === 'implementation-plan-revision' &&
        ['pending', 'applied', 'denied', 'stale'].includes(message.planningActivity.status)) {
        try {
            const revision = JSON.parse(message.content) as { edits: { type: string; step?: number;
                first?: number; second?: number; title?: string; detail?: string }[]; question?: string };
            if (!Array.isArray(revision.edits)) return undefined;
            return `**Suggested plan revision**\n${revision.edits.map(edit =>
                `- ${edit.type} ${edit.step ?? (edit.first ? `${edit.first} and ${edit.second}` : '')}: ${edit.title ?? ''} ${edit.detail ?? ''}`)
                .join('\n')}\n\nReview the diff before accepting this noncanonical draft revision.`;
        } catch { return undefined; }
    }
    if (message.execution.status !== 'complete' || message.planningActivity?.kind !== 'implementation-plan' ||
        !['pending', 'applied', 'denied', 'stale', 'rejected'].includes(message.planningActivity.status)) return undefined;
    try {
        const plan = JSON.parse(message.content) as { type: string; objective: string; successCriteria: string[];
            constraints: string[]; assumptions: string[]; steps: { title: string; detail: string;
                deliverables: string[]; dependsOn: number[]; reuse: { path: string; reason: string }[] }[];
            tests: string[]; guiQualification: string; risks: string[]; alternatives: string[]; question: string };
        if (plan.type !== 'implementation-plan' || !Array.isArray(plan.steps) || plan.steps.length < 2) return undefined;
        const list = (heading: string, items: string[]) => items.length ? `\n**${heading}**\n${items.map(item => `- ${item}`).join('\n')}` : '';
        const verified = new Set(message.planningActivity.refs.filter(ref => ref.kind === 'file' && ref.sourceHash && ref.includedBytes)
            .map(ref => ref.id));
        return `**Goal:** ${plan.objective}${list('Success criteria', plan.successCriteria)}` +
            list('Developer constraints', plan.constraints) + list('Assumptions and uncertainty', plan.assumptions) +
            `\n**Implementation steps**\n${plan.steps.map((step, index) =>
                `${index + 1}. **${step.title}** — ${step.detail}\n   Deliverables: ${step.deliverables.join('; ')}.` +
                (step.dependsOn.length ? ` Depends on: ${step.dependsOn.join(', ')}.` : '') +
                (step.reuse.length ? ` Reuse: ${step.reuse.map(item =>
                    `${item.path} (${verified.has(item.path) ? 'verified source' : 'unverified'}: ${item.reason})`).join('; ')}.` : '')).join('\n')}` +
            list('Tests', plan.tests) + `\n**GUI qualification:** ${plan.guiQualification}` +
            list('Risks', plan.risks) + list('Alternatives', plan.alternatives) +
            (plan.question ? `\n**Material question:** ${plan.question}` : '') +
            '\n\nThis plan is a proposal. Review it before accepting the noncanonical draft; no Roadmap or project files were changed.';
    } catch { return undefined; }
}

/** Trusted preview summary becomes short text rows; no model HTML enters the review controls. */
export function implementationPlanDiff(summary: string): string[] | undefined {
    try {
        const value = JSON.parse(summary) as { before?: { steps: { id: string; title: string; detail: string }[];
            decisions: { text: string; origin: string }[]; constraints: string[] };
            after: { steps: { id: string; title: string; detail: string }[];
            decisions: { text: string; origin: string }[]; constraints: string[] } };
        if (!value.after?.steps || !Array.isArray(value.after.steps)) return undefined;
        const before = value.before?.steps ?? [], after = value.after.steps;
        const old = new Map(before.map((step, index) => [step.id, { ...step, index }]));
        const next = new Map(after.map((step, index) => [step.id, { ...step, index }]));
        const rows = after.flatMap((step, index) => {
            const prior = old.get(step.id);
            if (!prior) return [`Added ${index + 1}. ${step.title}: ${step.detail}`];
            if (prior.title !== step.title || prior.detail !== step.detail)
                return [`Changed ${index + 1}. ${prior.title}: ${prior.detail} → ${step.title}: ${step.detail}`];
            return prior.index !== index ? [`Moved ${step.title} to ${index + 1}`] : [];
        });
        rows.push(...before.filter(step => !next.has(step.id)).map(step => `Removed ${step.title}`));
        rows.push(...(value.after.decisions ?? []).filter(decision =>
            !value.before?.decisions.some(oldDecision => oldDecision.text === decision.text &&
                oldDecision.origin === decision.origin)).map(decision =>
            `New suggestion: ${decision.text}`));
        rows.push(...(value.after.constraints ?? []).filter(constraint =>
            !value.before?.constraints?.includes(constraint)).map(constraint =>
            `New suggested constraint: ${constraint}`));
        rows.push(...(value.before?.decisions ?? []).filter(decision => decision.origin === 'developer')
            .map(decision => `Confirmed developer decision retained: ${decision.text}`));
        return rows;
    } catch { return undefined; }
}

/** A saved backend activity marker, completed turn, and intact strict payload are all required. */
function noActionEnvelope(message: ChatAssistantMessage): string | undefined {
    if (message.execution.status !== 'complete' || message.planningActivity?.kind !== 'no-action' ||
        message.planningActivity.status !== 'no-action') return undefined;
    try {
        const raw: unknown = JSON.parse(message.content);
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
        const value = raw as Record<string, unknown>;
        if (Object.keys(value).sort().join(',') !== 'message,type' || value.type !== 'no-action' ||
            typeof value.message !== 'string' || !value.message.trim() || value.message.length > 4000) return undefined;
        return value.message.trim();
    } catch { return undefined; }
}

function validatedNoActionMessage(message: ChatAssistantMessage): string | undefined {
        const reply = noActionEnvelope(message);
        if (!reply) return undefined;
        // The backend validates the no-action shape, not the truth of model prose.
        // Keep contradictory write claims in the inspectable raw JSON, never as the main reply.
        if (/\b(?:I|we)\s+(?:have\s+)?(?:applied|committed|saved|wrote|updated|changed|deleted|created)\b/i.test(reply) ||
            /\b(?:was|were|has been|have been)\s+(?:applied|committed|saved|written|updated|changed|deleted|created)\b/i.test(reply))
            return undefined;
        return reply;
}

/** The proposal's model-written summary is display text only; the saved activity owns its status. */
function gateProposalSummary(message: ChatAssistantMessage): string | undefined {
    if (message.planningActivity?.kind !== 'roadmap-gate-proposal' || !message.planningActivity.proposalId)
        return undefined;
    try {
        const value: unknown = JSON.parse(message.content);
        if (!value || typeof value !== 'object' || Array.isArray(value) ||
            (value as Record<string, unknown>).type !== 'roadmap-gate-proposal') return undefined;
        const summary = (value as Record<string, unknown>).summary;
        return typeof summary === 'string' && !!summary.trim() && summary.length <= 200 &&
            !/[\x00-\x1f\x7f]/.test(summary) ? summary.trim() : undefined;
    } catch { return undefined; }
}

/** Explain only the backend-verified activity; raw model text is never an authority signal. */
export function planningOutcome(message: ChatAssistantMessage): { summary: string; questions: string[] } | undefined {
    const activity = message.planningActivity;
    if (!activity) return undefined;
    if (activity.kind === 'no-action' && activity.status === 'no-action' && !noActionEnvelope(message))
        return undefined;
    if (activity.kind === 'implementation-plan' || activity.kind === 'implementation-plan-revision') return { summary:
        activity.status === 'pending' ? 'The plan is ready for review. The accepted draft and canonical Roadmap are unchanged.' :
        activity.status === 'applied' ? 'The reviewed plan was saved in the noncanonical draft.' :
        'The plan was not applied.', questions: [] };
    if (activity.kind === 'roadmap-gate-proposal') return {
        summary: gateProposalSummary(message) ?? (activity.status === 'applied' ? 'Roadmap change applied.' :
            activity.status === 'pending' ? 'Roadmap change ready for review.' :
            'Roadmap change was not applied.'),
        questions: [],
    };
    if (activity.kind === 'roadmap-publication') return {
        summary: activity.status === 'applied' ? 'The reviewed Roadmap Markdown operation is confirmed.' :
            activity.status === 'pending' ? 'Review the verified Markdown preview before approval.' :
            'The Roadmap Markdown operation was not confirmed.', questions: [],
    };
    if (activity.kind === 'bridge-proposal' && activity.status === 'suggested') {
        try {
            const raw = JSON.parse(message.content) as { mapId: string; mapRevision: number;
                suggestion: { kind: 'target' | 'work-item'; objective?: string;
                    command?: { kind: string; id?: string } }; questions: string[] };
            const detail = raw.suggestion.kind === 'target' ?
                `target ${raw.suggestion.command?.kind ?? 'change'}${raw.suggestion.command?.id ? ` to ${raw.suggestion.command.id}` : ''}` :
                `WorkItem “${raw.suggestion.objective?.slice(0, 120) ?? 'suggestion'}”`;
            return { summary: `Suggested ${detail} for Planning Map ${raw.mapId} revision ${raw.mapRevision}. ` +
                'Review the full suggestion in this Chat, then preview and approve any change through Planning Map. Nothing was written.',
                questions: raw.questions };
        } catch { return { summary: 'Bridge suggestion is unavailable for review. Nothing was written.', questions: [] }; }
    }
    const ref = activity.refs.find(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap');
    const target = ref ? ref.kind === 'roadmap' ? ref.label : `checkpoint ${ref.label}` :
        activity.kind.startsWith('roadmap-draft') ? 'Roadmap draft' : 'Roadmap';
    let change = `change ${target}`;
    // This detail is only displayed alongside a backend-verified preview or confirmed apply.
    if (activity.status === 'pending' || activity.status === 'applied') {
        try {
            const raw: unknown = JSON.parse(message.content);
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                const value = raw as Record<string, unknown>;
                const action = value.action && typeof value.action === 'object' && !Array.isArray(value.action) ?
                    value.action as Record<string, unknown> : undefined;
                if ((activity.kind === 'roadmap-sequence' || activity.kind === 'roadmap-draft-sequence') &&
                    Array.isArray(value.actions))
                    change = `review ${value.actions.length} Roadmap steps near ${target}`;
                const objective = activity.kind === 'roadmap-intent' ? value.value : action?.objective;
                const normalized = typeof objective === 'string' ? objective.replace(/\s+/g, ' ') : undefined;
                const short = normalized?.slice(0, 120);
                if (activity.kind === 'roadmap-draft-proposal' && action?.type === 'create-phase')
                    change = 'create a phase in Roadmap draft';
                else if (activity.kind === 'roadmap-draft-proposal' && action?.type === 'create-checkpoint')
                    change = 'create a checkpoint in Roadmap draft';
                else if (activity.kind === 'roadmap-draft-proposal' && typeof action?.type === 'string' &&
                    ['split-checkpoint', 'move-checkpoint', 'add-dependency', 'remove-dependency',
                        'create-correction', 'attach-correction'].includes(action.type))
                    change = `${action.type.replace(/-/g, ' ')} in the Roadmap draft`;
                else if (short) change = `set the objective of ${target} to “${short}${(normalized?.length ?? 0) > 120 ? '…' : ''}”`;
                else if (action && typeof action.type === 'string' &&
                    ['create', 'edit', 'reorder', 'create-phase', 'create-checkpoint', 'edit-phase',
                        'edit-checkpoint', 'reorder-phase', 'reorder-checkpoint', 'split-checkpoint',
                        'move-checkpoint', 'add-dependency', 'remove-dependency',
                        'create-correction', 'attach-correction'].includes(action.type))
                    change = action.type === 'create' ? `create a Roadmap item near ${target}` :
                        action.type === 'edit' || action.type === 'reorder' ? `${action.type} ${target}` :
                            `${action.type.replace(/-/g, ' ')} in ${target}`;
            }
        } catch { /* A damaged saved payload never grants authority or breaks the transcript. */ }
    }
    const revision = activity.appliedRevision;
    if (activity.status === 'applied' && revision !== undefined) return activity.kind === 'roadmap-gate-undo' ? {
        summary: `The reviewed Roadmap change was undone at revision ${revision}.`, questions: []
    } : activity.kind.startsWith('roadmap-draft') ? {
        summary: `The approved proposal to ${change} was saved in the accepted draft at revision ${revision}. It is not yet canonical.`,
        questions: ['Does the draft match your intent?', 'Would you like to preview the linked Markdown before publishing?'],
    } : {
        summary: `The approved proposal to ${change} was saved at revision ${revision}.`,
        questions: ['Does the saved result match your current objective?', 'Would you like to review the linked source or next checkpoint?'],
    };
    if (activity.status === 'pending') return {
        summary: `A proposal to ${change} was previewed and is awaiting approval; ${activity.kind.startsWith('roadmap-draft') ? 'the accepted draft and canonical Roadmap are unchanged' : 'no write yet'}.`,
        questions: ['Does the proposed change match your intent?', 'Should you review the affected source before deciding?'],
    };
    if (activity.kind === 'roadmap-gate-focus' && activity.status === 'no-action') return {
        summary: 'Selected the requested Roadmap item. The Roadmap was not changed.', questions: []
    };
    if (activity.status === 'no-action') return {
        summary: (noActionEnvelope(message) ? activity.verifiedGuidance?.text : undefined) ??
            validatedNoActionMessage(message) ??
            `The local planning turn proposed no change to ${target}. Nothing was written.`,
        questions: [],
    };
    if (activity.status === 'denied') return {
        summary: `You rejected the proposed change to ${target}. Nothing was written by that proposal.`,
        questions: ['What would you change about the proposal?'],
    };
    if (activity.status === 'stale') return {
        summary: `The proposal for ${target} became stale and was not applied.`,
        questions: ['Would you like to compare it with the current Roadmap before trying again?'],
    };
    if (activity.status === 'rejected') return {
        summary: `The proposed change to ${target} did not pass planning validation and was not applied.`,
        questions: ['Would reviewing the eligible field or current source help refine the request?'],
    };
    if (activity.status === 'cancelled') return {
        summary: `The local planning turn was cancelled. No proposal from this turn was applied.`,
        questions: ['Would you like to review the current checkpoint before retrying?'],
    };
    return {
        summary: `The local planning turn failed before an approved change could be applied.`,
        questions: ['Would you like to check the error and current source before retrying?'],
    };
}

export const CHAT_PANEL_ID = 'dope-chat-panel';
export const chatAreas = { left: 'left', right: 'right', center: 'main', bottom: 'bottom' } as const;
export type ChatArea = keyof typeof chatAreas;
export interface ChatPanelOptions { instanceId: string; module?: 'chat' | 'work' }
export function resolveChatModel<T extends { selection: { connectionId: string; modelId: string } }>(
    usable: readonly T[], override?: T['selection'], defaultModel?: T['selection']): T['selection'] | undefined {
    const requested = override ?? defaultModel;
    return requested ? usable.find(entry => entry.selection.connectionId === requested.connectionId &&
        entry.selection.modelId === requested.modelId)?.selection : undefined;
}
export const chatLauncherOptions = {
    left: { instanceId: '00000000-0000-4000-8000-000000000001' },
    right: { instanceId: '00000000-0000-4000-8000-000000000002' },
} as const;
export const chatLauncherIds = {
    left: `${CHAT_PANEL_ID}:${chatLauncherOptions.left.instanceId}`,
    right: `${CHAT_PANEL_ID}:${chatLauncherOptions.right.instanceId}`,
} as const;
export const workLauncherOptions = {
    left: { instanceId: '00000000-0000-4000-8000-000000000003', module: 'work' },
    right: { instanceId: '00000000-0000-4000-8000-000000000004', module: 'work' },
} as const;
export const workLauncherIds = {
    left: `${CHAT_PANEL_ID}:${workLauncherOptions.left.instanceId}`,
    right: `${CHAT_PANEL_ID}:${workLauncherOptions.right.instanceId}`,
} as const;
/** Old combined-panel widgets have no module option; their saved mode selects the restored module. */
export function panelModule(options: ChatPanelOptions, saved?: { panelMode: 'chat' | 'work' }): 'chat' | 'work' {
    if (options.instanceId === workLauncherOptions.left.instanceId ||
        options.instanceId === workLauncherOptions.right.instanceId) return 'work';
    if (options.instanceId === chatLauncherOptions.left.instanceId ||
        options.instanceId === chatLauncherOptions.right.instanceId) return 'chat';
    return options.module ?? saved?.panelMode ?? 'chat';
}
export function shouldSendChatInput(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'isComposing' | 'keyCode'>): boolean {
    return event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229;
}
export function resizeChatInput(input: HTMLTextAreaElement): void {
    input.style.height = '4.5em';
}
/** Presentation-only follow state; a new Chat starts at the latest turn. */
export class ChatScrollFollow {
    private chatId?: string;
    following = true;
    latestBelow = false;
    select(chatId?: string): void {
        if (this.chatId === chatId) return;
        this.chatId = chatId;
        this.following = true;
        this.latestBelow = false;
    }
    scrolled(top: number, height: number, viewport: number): void {
        this.following = height - top - viewport < 64;
        this.latestBelow = !this.following;
    }
    restore(previousTop: number, height: number, viewport: number): number {
        const top = this.following ? height : previousTop;
        this.latestBelow = !this.following && height - top - viewport >= 64;
        return top;
    }
    jump(): void { this.following = true; this.latestBelow = false; }
}
/** Pointer drag state is independent of the DOM rerenders caused by streamed tokens. */
export class ChatTranscriptDrag {
    private startY = 0;
    private startX = 0;
    private startTop = 0;
    dragging = false;
    start(y: number, top: number, x = 0): void { this.startY = y; this.startX = x; this.startTop = top; this.dragging = false; }
    move(y: number, x = 0, touch = false): number | undefined {
        if (touch && !this.dragging && Math.abs(x - this.startX) > Math.abs(y - this.startY)) return undefined;
        if (!this.dragging && Math.abs(y - this.startY) < 5) return undefined;
        this.dragging = true;
        return this.startTop + this.startY - y;
    }
    end(): boolean { const dragged = this.dragging; this.dragging = false; return dragged; }
}
export function canDragChatTranscript(target: Element, spacePan = false): boolean {
    if (target.closest('button, [role="button"], input, textarea, select, [contenteditable]')) return false;
    return spacePan || !target.closest('.dope-chat-message-content, a, summary, pre, code');
}

/** Copy the same conversational projection shown in Chat, never its inspectable machine payload. */
export function chatResponseCopyText(message: ChatAssistantMessage, streamingContent?: string): string {
    if (streamingContent !== undefined) return '';
    if (message.execution && message.execution.status !== 'complete') return '';
    if (message.planningActivity?.kind === 'no-action' && message.planningActivity.status === 'no-action')
        return planningOutcome(message)?.summary ?? (/^\s*\{/u.test(message.content) ? '' : message.content);
    if (isInlineRoadmapProposal(message)) return planningOutcome(message)?.summary ?? '';
    const activity = planningActivityPresentation(message);
    if (activity) {
        const outcome = planningOutcome(message);
        const answer = implementationPlanAnswer(message);
        return [`${activity.label} · ${activity.status}`, outcome?.summary,
            outcome?.questions.join(' '), answer].filter(Boolean).join('\n\n');
    }
    if (message.planningActivity?.status === 'failed' || message.planningActivity?.status === 'cancelled') {
        const outcome = planningOutcome(message);
        return [outcome?.summary, outcome?.questions.join(' ')].filter(Boolean).join('\n\n');
    }
    return message.content;
}

/** A read-only, ID-bound export of captured activity. Stored tool events contain metadata only. */
export function chatDiagnosticCopyText(chat: Pick<Chat, 'id' | 'messages'>,
    scope: { messageId: string } | { transcript: true },
    stream?: { chatId: string; messageId: string; executionId: string; content?: string;
        events: import('@dope/chat').ChatActivityEvent[] }):
    string | undefined {
    const activityFor = (message: ChatAssistantMessage) => {
        const saved = message.activity;
        if (stream?.chatId === chat.id && stream.messageId === message.id &&
            stream.executionId === message.execution.id)
            return { events: stream.events, truncated: stream.events.some(event => event.kind === 'truncated') };
        if (saved && saved.chatId === chat.id && saved.messageId === message.id &&
            saved.executionId === message.execution.id) return saved;
        return undefined;
    };
    const assistants = chat.messages.filter((message): message is ChatAssistantMessage => message.role === 'assistant');
    const selected = 'messageId' in scope ? assistants.filter(message => message.id === scope.messageId) : assistants;
    const visibleTimeline = (message: ChatAssistantMessage) => activityTimeline(activityFor(message)?.events ?? [], message,
        message.execution.status === 'complete' || stream?.chatId === chat.id && stream.messageId === message.id &&
        stream.executionId === message.execution.id && !!stream.content);
    if (!selected.some(message => visibleTimeline(message).length)) return undefined;
    const assistantText = (message: ChatAssistantMessage): string => {
        const activity = activityFor(message);
        const lines = [`Assistant [message ${message.id}; execution ${message.execution.id}; ${message.execution.status}]:`];
        let lastTextKind: 'thinking' | 'provisional' | undefined;
        let labelledKind: 'thinking' | 'provisional' | undefined;
        let textChunks: string[] = [];
        const flushText = () => {
            if (!lastTextKind) return;
            lines.push(`${labelledKind === lastTextKind ? '' :
                `[${lastTextKind === 'thinking' ? 'Reasoning' : 'Provisional output'}]\n`}${textChunks.join('')}`);
            labelledKind = lastTextKind;
            lastTextKind = undefined; textChunks = [];
        };
        for (const part of visibleTimeline(message)) {
            if (part.kind === 'tool') { flushText(); lines.push(chatToolCallLabel(part)); }
            else {
                if (lastTextKind !== part.kind) flushText();
                lastTextKind = part.kind;
                textChunks.push(part.text);
            }
        }
        flushText();
        if (activity?.events.some(event => event.kind === 'truncated') || activity?.truncated)
            lines.push('[Activity capture stopped before completion]');
        if (activity && 'issue' in activity && activity.issue === 'persistence-failed')
            lines.push('[Activity persistence failed; the recovered record may be incomplete]');
        if (activity && 'issue' in activity && activity.issue === 'interrupted')
            lines.push('[Generation interrupted; recent activity may not have reached storage]');
        if (activity && 'issue' in activity && activity.issue === 'provider-truncated')
            lines.push('[Provider stopped at its output limit; reasoning may be incomplete]');
        const final = chatResponseCopyText(message);
        lines.push(final ? `Final response:\n${final}` : 'No final response');
        return lines.reduce((copy, line) => copy ?
            `${copy}${copy.endsWith('\n') || line.startsWith('\n') ? '' : '\n'}${line}` : line, '');
    };
    if ('messageId' in scope) return selected[0] ? assistantText(selected[0]) : undefined;
    return chat.messages.map(message => message.role === 'user' ? `You:\n${message.content}` :
        assistantText(message)).join('\n\n');
}

/** A display projection of diagnostics, never conversational answer text. */
export function chatActivityPresentation(message: ChatAssistantMessage,
    stream?: { messageId: string; executionId: string; content?: string;
        events: import('@dope/chat').ChatActivityEvent[] }):
    ChatActivityDisplay | undefined {
    const matchingStream = stream?.messageId === message.id && stream.executionId === message.execution.id ? stream : undefined;
    const events = matchingStream ?
        matchingStream.events : message.activity?.events ?? [];
    if (!events.length && message.execution.status === 'complete') return undefined;
    const display = presentChatActivity(events, !!message.activity?.truncated, message,
        message.execution.status === 'complete' || !!matchingStream?.content,
        message.activity?.issue);
    return message.execution.status === 'complete' && !display.parts.length && !display.truncated ? undefined : display;
}

export function chatStreamingActivityPresentation(events: import('@dope/chat').ChatActivityEvent[], finalStarted = false):
    ChatActivityDisplay | undefined {
    if (!events.length) return undefined;
    const display = presentChatActivity(events, false, undefined, finalStarted);
    return display.parts.length || display.truncated ? display : undefined;
}

export type ChatActivityPart = { kind: 'thinking' | 'provisional'; text: string } |
    { kind: 'tool'; name: string; status: 'running' | 'completed' | 'failed' | 'denied' | ''; path?: string };
export interface ChatActivityDisplay {
    label: string;
    text: string;
    parts: ChatActivityPart[];
    unavailable: boolean;
    truncated: boolean;
    issue?: 'resource-limit' | 'persistence-failed' | 'interrupted' | 'provider-truncated';
}

/** Preserve the event order; a completion updates its call at the original position. */
function activityTimeline(events: readonly import('@dope/chat').ChatActivityEvent[],
    message?: ChatAssistantMessage, omitProvisional = false): ChatActivityPart[] {
    const parts: ChatActivityPart[] = [];
    const toolPattern = /^(read_file|list_files|search_paths|search_text|run_command|dope_read|dope_list|dope_search_paths|dope_search_text|dope_command|roadmap_read|roadmap_stage|roadmap_cancel): (running|completed|failed|denied)(?: · (.+))?$/u;
    for (const event of events) {
        if (event.kind === 'thinking' || event.kind === 'provisional' && !omitProvisional) {
            const last = parts.at(-1);
            if (last?.kind === event.kind && last.text.length + event.text.length <= 8192)
                last.text += event.text;
            else parts.push({ kind: event.kind, text: event.text });
        } else if (event.kind === 'tool') {
            const match = toolPattern.exec(event.text);
            if (!match || match[3] &&
                (!['read_file', 'list_files', 'dope_read', 'dope_list'].includes(match[1]) ||
                    safeChatToolPath(match[3]) !== match[3])) {
                parts.push({ kind: 'tool', name: 'details redacted', status: '' });
                continue;
            }
            const name = match[1];
            const status = match[2] as 'running' | 'completed' | 'failed' | 'denied';
            const path = match[3];
            const pending = status === 'running' ? undefined : [...parts].reverse().find(part =>
                part.kind === 'tool' && part.name === name && part.path === path && part.status === 'running');
            if (pending?.kind === 'tool') pending.status = status;
            else parts.push({ kind: 'tool', name, status, ...(path ? { path } : {}) });
        }
    }
    // Older saved calls have no path in their activity marker. Attribute refs
    // only when every completed call of that type has a matching stored ref.
    for (const [names, kind] of [
        [['read_file', 'dope_read'], 'file'], [['list_files', 'dope_list'], 'directory'],
    ] as const) {
        const calls = parts.filter((part): part is Extract<ChatActivityPart, { kind: 'tool' }> =>
            part.kind === 'tool' && names.some(name => name === part.name) &&
            part.status === 'completed' && !part.path);
        const completed = message?.execution.toolEvents?.filter(event =>
            names.some(name => name === event.name) && event.status === 'completed') ?? [];
        const refs = message?.execution.sourceRefs?.filter(ref => ref.origin === 'tool' && ref.kind === kind) ?? [];
        if (calls.length && calls.length === completed.length && calls.length === refs.length)
            calls.forEach((call, index) => { call.path = safeChatToolPath(refs[index].id); });
    }
    return parts;
}

export function chatToolCallLabel(part: Extract<ChatActivityPart, { kind: 'tool' }>): string {
    if (part.name === 'details redacted') return 'details redacted';
    return [part.name, part.path, part.status].filter(Boolean).join(' · ');
}

function presentChatActivity(events: import('@dope/chat').ChatActivityEvent[], savedTruncated: boolean,
    message?: ChatAssistantMessage, omitProvisional = false,
    issue?: import('@dope/chat').ChatExecutionActivity['issue']): ChatActivityDisplay {
    const timeline = activityTimeline(events, message, omitProvisional);
    const text = timeline.filter((part): part is Extract<ChatActivityPart, { kind: 'thinking' | 'provisional' }> =>
        part.kind !== 'tool').map(part => part.text).join('');
    const truncated = events.some(event => event.kind === 'truncated') || savedTruncated;
    return { label: timeline.some(part => part.kind === 'thinking') ? 'Reasoning / Activity' :
        timeline.some(part => part.kind === 'provisional') ? 'Provisional output' : 'Tool activity',
        text, parts: timeline, unavailable: !timeline.some(part => part.kind === 'thinking'), truncated,
        ...(issue ? { issue } : {}) };
}

export function chatTranscriptCopyText(chat: Pick<Chat, 'messages'>,
    stream?: { messageId?: string; content: string }, transientUser?: { content: string }): string {
    const turns = chat.messages.flatMap(message => {
        const content = message.role === 'user' ? message.content : chatResponseCopyText(message,
            stream !== undefined && stream.messageId === message.id &&
            message.execution?.status !== 'complete' ? stream.content : undefined);
        if (message.role === 'user') return content ? [`You:\n${content}`] : [];
        const calls = message.execution?.toolEvents?.map(call => `${call.name} · ${call.status}`) ?? [];
        return content || calls.length ? [`Assistant:\n${[
            ...(calls.length ? [`Tool calls:\n${calls.map((call, index) => `${index + 1}. ${call}`).join('\n')}`] : []),
            content].filter(Boolean).join('\n\n')}`] : [];
    });
    if (transientUser?.content) turns.push(`You:\n${transientUser.content}`);
    return turns.join('\n\n');
}
export function animateChatToLatest(element: HTMLElement, reducedMotion: boolean,
    schedule: typeof requestAnimationFrame = requestAnimationFrame, duration = 200): () => void {
    const target = () => Math.max(0, element.scrollHeight - element.clientHeight);
    if (reducedMotion || duration <= 0) { element.scrollTop = target(); return () => {}; }
    let cancelled = false;
    let started: number | undefined;
    const from = element.scrollTop;
    const frame = (now: number) => {
        if (cancelled) return;
        started ??= now;
        const fraction = Math.min(1, (now - started) / duration);
        element.scrollTop = from + (target() - from) * (1 - (1 - fraction) ** 3);
        if (fraction < 1) schedule(frame);
        else element.scrollTop = target();
    };
    schedule(frame);
    return () => { cancelled = true; };
}
export function safeChatLink(href: string, base: string): boolean {
    try { return ['http:', 'https:', 'mailto:'].includes(new URL(href, base).protocol); }
    catch { return false; }
}
export function chatPanelOptions(module: 'chat' | 'work' = 'chat'): ChatPanelOptions {
    return { instanceId: crypto.randomUUID(), module };
}
export function chatPanelWidgetId(options: ChatPanelOptions): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options?.instanceId))
        throw new Error('Invalid ChatPanel instance');
    return `${CHAT_PANEL_ID}:${options.instanceId}`;
}
export interface ChatPanelShell<W extends { id: string }> {
    addWidget(widget: W, options: { area: typeof chatAreas[ChatArea] }): Promise<void>;
    activateWidget(id: string): Promise<unknown>;
}
export async function openChatPanel<W extends { id: string }>(area: ChatArea,
    create: (options: ChatPanelOptions) => Promise<W>, shell: ChatPanelShell<W>, module: 'chat' | 'work' = 'chat'): Promise<W> {
    const widget = await create(chatPanelOptions(module));
    await shell.addWidget(widget, { area: chatAreas[area] });
    await shell.activateWidget(widget.id);
    return widget;
}
