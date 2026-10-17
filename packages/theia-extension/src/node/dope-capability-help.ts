/** Verified UI guidance for Chat grounding. This data grants no action or tool authority. */
export const DOPE_CAPABILITY_HELP_VERSION = '0.11.8-m1' as const;

export type DopeHelpId = 'roadmap-change-file' | 'roadmap-refresh' | 'roadmap-status' |
    'roadmap-objective' | 'planning-map-link' | 'chat-follow' | 'chat-pin' | 'ai-center' | 'work' | 'history';
export type DopeHelpRequirement = 'project' | 'roadmap-write' | 'planning-selection';

export interface DopeHelpEntry {
    readonly id: DopeHelpId;
    readonly goal: string;
    readonly uiPath: string;
    readonly requires: readonly DopeHelpRequirement[];
    readonly limitation: string;
    readonly recovery: string;
}

/** Labels and paths are checked against their browser registrations in dope-capability-help.test.ts. */
export const DOPE_CAPABILITY_HELP: readonly DopeHelpEntry[] = [
    {
        id: 'roadmap-change-file', goal: 'Replace the active linked Roadmap Markdown file',
        uiPath: 'Roadmap > Roadmap Markdown and setup > Change linked file',
        requires: ['project', 'roadmap-write'],
        limitation: 'Chat cannot change the link. The project owner must preview and explicitly confirm a valid replacement; the old Markdown file remains on disk.',
        recovery: 'If preview is blocked by source changes, pending sync or permissions, keep the current link, review the source state and Refresh Roadmap before retrying.'
    },
    {
        id: 'roadmap-refresh', goal: 'Recheck Roadmap and linked Markdown source state',
        uiPath: 'Roadmap > Refresh Roadmap > Roadmap Markdown and setup',
        requires: ['project'],
        limitation: 'Refresh reports source-changed, conflict, relink-needed and pending-sync states; it does not approve or apply source changes.',
        recovery: 'Open Roadmap Markdown and setup to review the linked path and source status; resolve the reported conflict or pending sync before retrying.'
    },
    {
        id: 'roadmap-status', goal: 'Inspect current Roadmap source status',
        uiPath: 'Roadmap > Roadmap Markdown and setup', requires: ['project'],
        limitation: 'The recorded sync state is a current snapshot, not proof that a later external file change has been checked.',
        recovery: 'Use Refresh Roadmap to check the source again.'
    },
    {
        id: 'roadmap-objective', goal: 'Edit a checkpoint Objective in Roadmap',
        uiPath: 'Roadmap > select checkpoint > Objective', requires: ['project'],
        limitation: 'An Objective edit requires a supported editable source and an explicit preview or approval. Chat cannot apply it from a help request.',
        recovery: 'If the Objective is read-only or the source is stale, review Roadmap Markdown and setup and Refresh Roadmap.'
    },
    {
        id: 'planning-map-link', goal: 'Find the owner of a Planning Map link',
        uiPath: 'Planning Map', requires: ['project'],
        limitation: 'Chat has no verified direct workflow for changing a Planning Map link.',
        recovery: 'Open the relevant Planning Map and inspect its current relationship and owner before editing. Roadmap Change linked file replaces the Roadmap Markdown source, not a Planning Map link.'
    },
    {
        id: 'chat-follow', goal: 'Follow the active planning selection in the saved Chat',
        uiPath: 'Chat > context menu > Follow active planning selection',
        requires: ['project'],
        limitation: 'Following changes Chat context selection, not the Roadmap or permission to edit it.',
        recovery: 'Open one project and select a checkpoint or Planning Map, then check the Chat context label.'
    },
    {
        id: 'chat-pin', goal: 'Keep the selected checkpoint or Planning Map in Chat context',
        uiPath: 'Chat > context menu > Pin selected checkpoint / Planning Map',
        requires: ['project', 'planning-selection'],
        limitation: 'Pin is unavailable without a current planning selection and does not grant Chat write authority.',
        recovery: 'Select a current checkpoint or Planning Map, then reopen the Chat context menu; use Follow active planning selection if the pin is stale.'
    },
    {
        id: 'ai-center', goal: 'Inspect or configure AI connections and roles',
        uiPath: 'AI Center (left sidebar bottom menu) > Open AI Center',
        requires: [],
        limitation: 'Opening AI Center does not select a model for this Chat, consent to hosted use or grant provider permissions.',
        recovery: 'If a connection needs attention, open AI Center and review its status before choosing a model explicitly.'
    },
    {
        id: 'work', goal: 'Open saved Work',
        uiPath: 'Dope: Open Work',
        requires: ['project'],
        limitation: 'Work has separate execution and approval authority; ordinary Chat cannot invoke Work or inherit its permissions.',
        recovery: 'Open one project folder, then use Dope: Open Work to inspect available Work and its review state.'
    },
    {
        id: 'history', goal: 'Find and reopen a saved project activity target',
        uiPath: 'Dope: Open History',
        requires: ['project'],
        limitation: 'History is a read-only projection; an exact target may be stale or unavailable.',
        recovery: 'Use Refresh History and retry; if the target remains unavailable, open its owner directly.'
    }
] as const;

export interface DopeHelpAvailability {
    readonly projectOpen: boolean;
    readonly canWriteRoadmap: boolean;
    readonly hasPlanningSelection: boolean;
    /** Current build/registration availability; omit for the verified built-in surface set. */
    readonly features?: ReadonlySet<DopeHelpId>;
}

export interface DopeHelpProjection extends DopeHelpEntry {
    readonly available: boolean;
    readonly unavailableReason?: string;
}

export function projectDopeCapabilityHelp(state: DopeHelpAvailability): readonly DopeHelpProjection[] {
    return DOPE_CAPABILITY_HELP.map(entry => {
        const unavailableReason = state.features && !state.features.has(entry.id) ? 'This UI feature is unavailable in the current build.' :
            entry.requires.includes('project') && !state.projectOpen ? 'Open one project folder first.' :
            entry.requires.includes('roadmap-write') && !state.canWriteRoadmap ? 'Roadmap changes require project owner permission.' :
            entry.requires.includes('planning-selection') && !state.hasPlanningSelection ? 'Select a current checkpoint or Planning Map first.' :
            undefined;
        return { ...entry, available: !unavailableReason, ...(unavailableReason ? { unavailableReason } : {}) };
    });
}

/** Match only explicit Dope UI tasks; ordinary Roadmap planning stays on its existing path. */
export function selectDopeCapabilityHelp(question: string): DopeHelpId | undefined {
    if (/\bplanning\s+map\b/i.test(question) && /\b(?:link|relink|reference)\b/i.test(question) &&
        /\b(?:how|change|edit|replace|switch|update)\b/i.test(question)) return 'planning-map-link';
    if (/\b(?:checkpoint|roadmap|this)\b/i.test(question) && /\bobjective\b/i.test(question) &&
        /\b(?:how|where)\b/i.test(question) && /\b(?:edit|change|update)\b/i.test(question))
        return 'roadmap-objective';
    if (/\b(?:roadmap|markdown|linked\s+(?:file|document|source))\b/i.test(question)) {
        const otherPlanningTarget = /\b(?:objective|checkpoint|title|status|issues?|planning\s+maps?|dependenc(?:y|ies))\b/i.test(question);
        const sourceBinding = /\b(?:roadmap|markdown)\s+(?:file|document|source|link)\b/i.test(question) ||
            /\b(?:linked|selected)\s+(?:(?:the|a|my)\s+)?(?:(?:wrong|different)\s+)?(?:roadmap|markdown|file|document|source)\b/i.test(question);
        const sourceChange = /\b(?:unlink|relink|replace|switch)\b/i.test(question) ||
            sourceBinding && /\b(?:change|wrong|different)\b/i.test(question);
        if (!otherPlanningTarget && sourceChange &&
            (sourceBinding || /\b(?:unlink|relink|replace|switch)\s+(?:(?:to|from)\s+)?(?:(?:the|a|my)\s+)?(?:(?:wrong|different|linked)\s+)?(?:roadmap|markdown)\b/i.test(question)))
            return 'roadmap-change-file';
        if (/\b(?:refresh|sync|conflict|source.changed|relink.needed)\b/i.test(question)) return 'roadmap-refresh';
        if (/\b(?:status|state)\b/i.test(question) && /\b(?:what(?:'s| is)|show|tell me)\b/i.test(question))
            return 'roadmap-status';
    }
    if (/\b(?:chat|context)\b/i.test(question) && /\b(?:follow|pin)\b/i.test(question))
        return /\bpin\b/i.test(question) ? 'chat-pin' : 'chat-follow';
    if (/\bai\s*center\b/i.test(question)) return 'ai-center';
    if (/\b(?:open|find|resume)\s+(?:my\s+|the\s+)?(?:saved\s+)?work\b/i.test(question)) return 'work';
    if (/\b(?:open|find|refresh)\s+(?:my\s+|the\s+)?history\b/i.test(question)) return 'history';
    return undefined;
}
