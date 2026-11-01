import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, relative } from 'node:path';
import { availableChatContextTokens, type Chat, type ChatContextRef } from '@dope/chat';
import type { ChatContextDiagnostic, ChatContextSelection } from '@dope/chat/lib/service';
import { roadmapElementContext } from './roadmap-element-context';
import type { ConversationMessage, ConversationModelCapabilities } from '@dope/contracts/lib/model-runtime';
import { projectPath, queryStaticFlow } from '@dope/software-map';
import { readArchitecture } from '@dope/code-analysis/lib/node/architecture-file';
import { readInitialization } from '@dope/code-analysis/lib/node/smap-initialization-file';
import { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';
import { ProjectMindStore } from '@dope/project-intelligence/lib/node/project-mind-store';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import { ChatRepository } from '@dope/chat/lib/node';
import { RoadmapStore, type RoadmapCheckpoint, type RoadmapLink } from '@dope/project-intelligence/lib/node/roadmap-store';
import { readRoadmapDocumentCapabilities } from '@dope/project-intelligence/lib/node/roadmap-document-patch';
import { evaluateGateQualification, evaluatePhaseQualification,
    type RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { GroundingResult } from './chat-project-grounder';
import { DOPE_CAPABILITY_HELP_VERSION, projectDopeCapabilityHelp, selectDopeCapabilityHelp, type DopeHelpId } from './dope-capability-help';

export const GROUNDED_CHAT_INSTRUCTION = "Ground claims about existing project files, packages, architecture and canonical state in current supplied evidence; never imply an unobserved file was inspected. No file evidence in this turn means files were not inspected or included, NOT that the attached project is empty. Describe an empty directory only from a current listing; limit the claim to the listed scope. Separate verified facts, developer goals and provisional recommendations. Treat requested mechanics as goals until evidence shows they exist. Suggest prospective designs without code. For a direct factual or conversation-recall question, answer the requested fact directly; do not add an unsolicited design, implementation plan, or claimed project inspection. When the user asks for a practical approach, give one recommendation, a short ordered approach and an initial deliverable. Around 100–170 words is a soft preference for advice requests, never a cap. Give more detail when the request or safety requires it; avoid repeating systems and steps. When planning a software project, recommend a feasible starting approach, a short implementation order and a first milestone or vertical slice suited to the idea. Ask at most one consequential question when useful for the next decision. Mention unavailable evidence only when relevant; do not require repository inspection, Architecture or Physical Map for brainstorming. Use natural conversation without required headings; give a formal plan only when explicitly requested.";
export const PI_CHAT_INSTRUCTION = 'The current project is the workspace root shown below. Source files have not been automatically read or attached. To answer questions about actual files, use the available Pi read_file, list_files, or search tools and ground claims in their results. A path in the user request identifies a file to inspect; it is not file content. Never claim a file was attached unless the user explicitly attached it. Project tools are read-only unless separately authorized.';
const ROADMAP_ACTION_INSTRUCTION = 'Use the supplied checkpoint capabilities to determine whether its Objective is editable; a request to read does not make a linked checkpoint unlinked or read-only. For a factual or decision question without an edit request, choose type no-action and put the concrete answer in its message field. Answer from the supplied evidence, including owner and document revisions when present, and distinguish those counters. If a fact is absent, say so without inventing it; do not replace available facts with a generic missing-evidence or edit-capability reason. Never copy an instruction phrase as the answer. For a linked Markdown checkpoint, only if capabilities.objective.editable is true and the user requests an Objective change, propose {"type":"roadmap-intent","intent":"set-objective","value":"one line"}. Otherwise choose type no-action with a concrete source-backed reason in its message field. For an unlinked checkpoint, a validated roadmap-proposal action may be used. All proposals require developer approval. Never claim an edit was applied.';
const GATE_ACTION_INSTRUCTION = 'Use only the current schema-2 Roadmap context. For a question, unsupported action, ambiguous target, qualification without reviewed proof, or missing source, return strict JSON {"type":"no-action","message":"concise useful answer or one clarification"}. For a request to select/focus an existing Phase or Gate return {"type":"roadmap-gate-focus","id":"exact existing ID"}; selection writes no Roadmap data. For an edit return strict JSON {"type":"roadmap-gate-proposal","projectId":"exact supplied ID","ownerRevision":1,"actions":[...]}. For an explicit request to undo the last accepted Chat edit return {"type":"roadmap-gate-undo"}; it still needs review and may be stale. Use the supplied numeric revision and exact existing IDs. One to three atomic actions only; report if the request needs more. New entities use unique temporary IDs new:1, new:2, etc.; later actions in this batch may reference them. The id fields for a new Gate and its criteria are temporary IDs, never the display names or designations. For example, creating Gate G1 Readiness with one criterion uses {"type":"gate.create","id":"new:1","parentPhaseId":"exact existing phase ID","designation":"G1","title":"Readiness","purpose":"testable purpose","criteria":[{"id":"new:2","title":"Demo works","expectedResult":"observable result"}]}. Do not copy the example title or purpose unless requested. Every Gate designation must match G followed by a positive integer (G1, G2, ...); choose an unused number from siblingGates designations, never a word or hyphenated label. Supported action types and fields: phase.create(id,title,objective), phase.edit(id,title,objective), phase.delete(id), phase.reorder(ids complete ordered phase ID list), phase.dependencies(id,dependencies complete ID list), gate.create(id,parentPhaseId,designation,title,purpose,criteria array of {id,title,expectedResult}), gate.edit(id,title,purpose), gate.delete(id), gate.reparent(id,parentPhaseId,order zero-based), gate.reorder(parentPhaseId,ids complete ordered sibling list), gate.dependencies(id,dependencies complete ID list), criterion.add(gateId,id,title,expectedResult), criterion.edit(gateId,id,title,expectedResult), criterion.remove(gateId,id), criterion.reorder(gateId,ids complete ordered list), correction.attach(id,parent {kind,id},title,objective,optional criterionId), correction.edit(id,title,objective), correction.reparent(id,parent {kind,id},optional criterionId), correction.delete(id). Edits require all listed fields; copy unchanged values from current context. Each action object must use the key "type", never "kind". For an existing Gate title edit, the action is {"type":"gate.edit","id":"exact gate ID","title":"new title","purpose":"copy existing purpose"}. The proposal envelope must contain only type, projectId, ownerRevision, and actions; do not include a patch, Markdown, explanation, or any extra field. Dope creates the reviewed source patch from the typed action. A Gate is a testable requirement, not a task. Source-owned linked Markdown definitions use a separate reviewed patch; only one existing Phase, Gate, or Criterion field edit can be proposed there. A linked structural change such as deleting a Gate and Criterion cannot be applied by Chat. The Roadmap Linked Markdown review can accept supported source field changes after Refresh, but structural deletion currently causes a sync conflict; do not suggest that Accept source changes can apply it. For an unsupported linked structural request, return {"type":"no-action","message":"Chat cannot apply that structural change to this linked Roadmap. No files were edited. Open Roadmap Linked Markdown review to inspect the source and sync status. Its current source-change acceptance supports mapped field edits, not this deletion; a separate reviewed structural source and Roadmap reconciliation is needed."}. Do not draft a Markdown patch or suggest that approving Chat can apply a linked structural change. Never output a status, evidence approval, waiver approval, Work run, tool grant, or claim Green. Do not claim any proposal was applied. Return one JSON object without fences.';
const GATE_READ_INSTRUCTION = 'Use current verified Roadmap facts to answer naturally. Selected Roadmap context is read-only for this Chat turn. For an edit request, explain that /roadmap opens a reviewed proposal and that no change was made. Do not emit a proposal, action grammar, or JSON. Do not claim qualification Green without reviewed evidence.';

export interface ComposedChatContext { messages: ConversationMessage[]; refs: ChatContextRef[];
    diagnostics: ChatContextDiagnostic[]; usedTokens: number; budgetTokens: number;
    verifiedGuidance?: { capabilityId: string; version: string; text: string } }

/** One project-scoped translation boundary. Model requests never read project state directly. */
export class ChatContextComposer {
    constructor(private readonly mind: ProjectMindStore, private readonly planning: PlanningStore,
        private readonly index: SoftwareMapIndex, private readonly chats: ChatRepository,
        private readonly roadmap?: RoadmapStore,
        private readonly planningLinkCurrent?: (root: string, link: RoadmapLink) => Promise<boolean>) {}

    /** Only backend-recorded applied actions are decisions; model prose is never promoted. */
    private decisionContext(chat: Chat): string | undefined {
        const applied = chat.messages.filter(message => message.role === 'assistant' && message.execution.status === 'complete' &&
            message.planningActivity?.status === 'applied').slice(-4);
        const decisions = applied.map(message => {
            if (message.role !== 'assistant') return undefined;
            try {
                const value: unknown = JSON.parse(message.content);
                if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
                const action = value as Record<string, unknown>;
                if (!['roadmap-intent', 'roadmap-proposal', 'roadmap-sequence', 'roadmap-gate-proposal',
                    'roadmap-draft-proposal', 'roadmap-draft-sequence'].includes(message.planningActivity!.kind)) return undefined;
                return { appliedRevision: message.planningActivity!.appliedRevision,
                    action: JSON.stringify(action).slice(0, 600) };
            } catch { return undefined; }
        }).filter(item => item !== undefined);
        const question = [...chat.messages].reverse().find(message => message.role === 'assistant' &&
            message.execution.status === 'complete' &&
            message.planningActivity?.status === 'no-action' && message.content.includes('?'));
        if (!decisions.length && !question) return undefined;
        return JSON.stringify({ confirmedAppliedEdits: decisions,
            ...(question ? { openQuestionFromAssistant: question.content.slice(0, 240) } : {}) });
    }

    private async helpContext(root: string, id: DopeHelpId, selections: ChatContextSelection[], strictJson: boolean):
        Promise<{ instruction: string; guidance: ComposedChatContext['verifiedGuidance'] }> {
        let linkState = '';
        let projectOpen = true;
        let unlinkedImport = false;
        let hasLinkedFile = false;
        let syncState: string | undefined;
        let pendingSync = false;
        let roadmapSummary = '';
        if (id.startsWith('roadmap-')) {
            if (!this.roadmap) projectOpen = false;
            else {
                const index = await this.roadmap.read(root) as import('@dope/project-intelligence/lib/node/roadmap-store').RoadmapIndex | RoadmapGateIndex;
                if (index.projectRoot !== root || index.linkedDocument &&
                    (index.linkedDocument.projectRoot !== root || index.linkedDocument.projectId !== index.projectId))
                    throw new Error('Stale or foreign Roadmap help context');
                const linked = index.linkedDocument;
                hasLinkedFile = !!linked;
                unlinkedImport = !linked && index.revision === 0;
                syncState = linked?.syncState;
                pendingSync = !!linked?.pending;
                if (linked && syncState === 'synced') {
                    try {
                        const file = await this.file(root, linked.path, 2 * 1024 * 1024);
                        if (createHash('sha256').update(await readFile(file)).digest('hex') !== linked.sourceHash)
                            syncState = 'source-changed';
                    } catch { syncState = 'unavailable'; }
                }
                if (index.schemaVersion === 2) {
                    const gateIndex = index as unknown as RoadmapGateIndex;
                    roadmapSummary = `Roadmap owner revision ${gateIndex.revision}; ${gateIndex.phases.length} Phase(s), ` +
                        `${gateIndex.gates.length} Gate(s), ${gateIndex.gates.reduce((n, gate) => n + gate.criteria.length, 0)} criteria.`;
                } else {
                    const active = index.checkpoints.filter(item => item.status === 'active');
                    roadmapSummary = `Roadmap owner revision ${index.revision}; ${index.checkpoints.length} checkpoint(s), ` +
                        `${active.length} active${active.length ? ` (${active.slice(0, 3).map(item => item.title.slice(0, 100)).join(', ')}` +
                        `${active.length > 3 ? ', …' : ''})` : ''}.`;
                }
                linkState = linked ? `Current project records linked Roadmap Markdown ${linked.path.length <= 120 ? linked.path : '(path omitted)'} (${syncState}); Refresh Roadmap to verify the live source.` :
                    `Current project has no linked Roadmap Markdown file (${index.revision ? 'existing Roadmap' : 'empty Roadmap'}).`;
            }
        }
        const entry = projectDopeCapabilityHelp({ projectOpen, canWriteRoadmap: projectOpen,
            hasPlanningSelection: selections.some(item => item.kind === 'roadmap-checkpoint' || item.kind === 'roadmap' ||
                item.kind === 'planning-map') })
            .find(item => item.id === id)!;
        const route = id === 'roadmap-change-file' && unlinkedImport ?
            'Roadmap > Roadmap Markdown and setup > Import Roadmap' : entry.uiPath;
        const blocked = id === 'roadmap-change-file' &&
            (!hasLinkedFile && !unlinkedImport || pendingSync ||
                syncState === 'conflict' || syncState === 'pending-sync' ||
                syncState === 'relink-needed' || syncState === 'source-changed' ||
                syncState === 'missing' || syncState === 'unavailable');
        const recovery = id === 'roadmap-change-file' && !hasLinkedFile ?
            (unlinkedImport ? 'Choose a project Markdown Roadmap, review its import preview and approve it manually.' :
                'No linked file can be changed from this existing unlinked Roadmap; keep the current Roadmap and report the missing workflow if replacement is needed.') :
            entry.recovery;
        const guidance = !entry.available ? `${entry.unavailableReason} ${entry.recovery}` :
            id === 'roadmap-change-file' && blocked ?
                `The Roadmap source replacement is blocked in the recorded ${syncState ?? 'unlinked'} state. ` +
                (syncState === 'missing' || syncState === 'relink-needed' || syncState === 'unavailable' ?
                    'Open Roadmap Markdown and setup, use Relink Markdown to recover the missing current source, then Refresh Roadmap and preview again. ' :
                    `${recovery} `) +
                'Chat cannot change the link. The previous Markdown file remains on disk. Nothing changed.' :
            id === 'roadmap-change-file' && unlinkedImport ?
                `Open Roadmap, then Roadmap Markdown and setup > Import Roadmap. ${recovery} Chat cannot change the linked file. Nothing changed.` :
            id === 'roadmap-change-file' ?
                `Open Roadmap, then Roadmap Markdown and setup > Change linked file. Select the intended project Markdown file. Review the replacement preview and affected Roadmap content, then explicitly confirm the replacement. The previously linked Markdown file remains on disk. Chat cannot directly change the linked file. The recorded source state is ${syncState ?? 'unknown'}; Refresh Roadmap to check it before acting. Nothing changed in this Chat turn.` :
            id === 'roadmap-refresh' ?
                `The recorded Roadmap source state is ${syncState ?? 'unlinked'}${pendingSync ? ' with pending sync' : ''}. Open Roadmap and use Refresh Roadmap to check the current source, then open Roadmap Markdown and setup to review the result. Refresh does not approve source changes. Nothing changed in this Chat turn.` :
            id === 'roadmap-status' ?
                `${roadmapSummary} The recorded linked Markdown source state is ${syncState ?? 'unlinked'}${pendingSync ? ' with pending sync' : ''}. Refresh Roadmap to check for later external changes. Nothing changed in this Chat turn.` :
            id === 'roadmap-objective' && this.roadmap &&
                (await this.roadmap.read<RoadmapGateIndex>(root)).schemaVersion === 2 ?
                'Select the Phase or Gate in Roadmap and ask the existing saved Chat to propose a title or objective change. Review its exact diff, then Accept or Reject. A linked Markdown field uses a separate source-aware preview and publication approval. Nothing changed in this help turn.' :
            id === 'roadmap-objective' ?
                `Open Roadmap and select the checkpoint. In its inspector, edit Objective, then use Preview and save and review any required approval. A linked Objective may be read-only when its source cannot be safely edited; review Roadmap Markdown and setup and Refresh Roadmap if blocked. Chat cannot apply an Objective change from this help request. Nothing changed.` :
            id === 'planning-map-link' ?
                `Chat has no verified direct procedure for changing a Planning Map link. Open the relevant Planning Map and inspect its relationship and owner. The Roadmap source replacement control does not edit Planning Map links. Editing a checkpoint Objective is not a prerequisite. Nothing changed.` :
                `${entry.uiPath}. ${entry.limitation} ${entry.recovery} Nothing changed.`;
        const instruction = `Dope UI help (${id}): ${linkState} ${entry.limitation} ` +
            (entry.available && !blocked ? `Manual path: ${route}.` :
                `Do not claim this action is available now: ${entry.unavailableReason ?? 'Review the linked source state first.'}`) +
            ` ${recovery} Verified answer: ${guidance} This Chat turn cannot perform the UI action. ` +
            (strictJson ? 'Reply only as strict JSON {"type":"no-action","message":"brief useful answer"}; ' :
                'Answer in brief natural language; ') +
            'state that nothing changed. Do not propose an Objective edit or invent a control.';
        return { instruction, guidance: { capabilityId: id, version: DOPE_CAPABILITY_HELP_VERSION, text: guidance } };
    }

    private async roadmapContext(root: string, source: ChatContextSelection): Promise<{ label: string; text: string; omitted?: string }> {
        if (!this.roadmap) throw new Error('Roadmap context unavailable');
        const index = await this.roadmap.read(root);
        if (index.projectRoot !== root || !index.revision || !source.projectId || source.projectId !== index.projectId ||
            !Number.isSafeInteger(source.ownerRevision) || source.ownerRevision !== index.revision)
            throw new Error('Stale or foreign Roadmap context; select the checkpoint again');
        const checkpoint = index.checkpoints.find(item => item.id === source.id);
        if (!checkpoint) throw new Error('Roadmap checkpoint missing');
        if (checkpoint.source?.sha256 !== source.sourceHash)
            throw new Error('Stale Roadmap source; select the checkpoint again');
        const related = index.checkpoints.filter(item => item.id !== checkpoint.id &&
            (checkpoint.dependencies.includes(item.id) || item.dependencies.includes(checkpoint.id)));
        const ordered = [...index.checkpoints].sort((a, b) => a.order - b.order);
        const position = ordered.findIndex(item => item.id === checkpoint.id);
        const neighbors = [...new Map([
            ...related.slice(0, 2), ...ordered.slice(Math.max(0, position - 1), position),
            ...ordered.slice(position + 1, position + 2)
        ].map(item => [item.id, item] as const)).values()].slice(0, 4);
        // A checked linked-document edit changes its file hash without rewriting historical
        // import evidence. The current source citation is authoritative for that file.
        const currentEvidence = (item: RoadmapCheckpoint) => item.evidence.filter(citation =>
            citation.path !== index.linkedDocument?.path);
        const citations = [checkpoint, ...neighbors].flatMap(item =>
            [item.source, ...currentEvidence(item).slice(0, 1)]).filter(item => item !== undefined);
        // Source-backed index entries may outlive the Markdown that produced them.
        for (const citation of citations) {
            const path = await this.file(root, citation.path, 2 * 1024 * 1024);
            const bytes = await readFile(path);
            if (createHash('sha256').update(bytes).digest('hex') !== citation.sha256)
                throw new Error('Stale Roadmap source; refresh the import before using Chat context');
        }
        const fact = (item: RoadmapCheckpoint, selected = false) => ({ id: item.id, kind: item.kind, title: item.title,
            objective: item.objective.slice(0, selected ? 600 : 160), status: item.status,
            dependencies: item.dependencies.slice(0, selected ? 6 : 2), source: item.source,
            ...(selected ? { evidence: currentEvidence(item).slice(0, 1) } : {}) });
        const planningLinks = checkpoint.links.filter(link => link.owner === 'planning-map').slice(0, 1);
        const maps: unknown[] = [];
        if (planningLinks.length) {
            const planning = await this.planning.read(root);
            for (const link of planningLinks) {
                if (this.planningLinkCurrent && !await this.planningLinkCurrent(root, link))
                    throw new Error('Stale Planning Map basis in Roadmap context');
                const map = planning.maps.find(item => item.id === link.targetId);
                if (link.ownerProjectId !== planning.projectId || !map || map.revision !== link.ownerRevision ||
                    JSON.stringify(map.basis) !== JSON.stringify(link.basis))
                    throw new Error('Stale Planning Map basis in Roadmap context');
                maps.push({ id: map.id, title: map.title, objective: map.objective.slice(0, 160),
                    status: map.status, transformations: map.transformations.length,
                    workItems: map.workItems.length });
            }
            const again = await this.planning.read(root);
            if (again.projectId !== planning.projectId || again.revision !== planning.revision)
                throw new Error('Planning Map changed during context reading; preview again');
        }
        const current = await this.roadmap.read(root);
        if (current.projectId !== index.projectId || current.revision !== index.revision)
            throw new Error('Roadmap changed during context reading; preview again');
        const capabilities = index.linkedDocument && checkpoint.source?.path === index.linkedDocument.path
            ? await readRoadmapDocumentCapabilities(root, index, checkpoint.id) : undefined;
        return { label: `Roadmap checkpoint: ${checkpoint.title}`, text: JSON.stringify({
            projectId: index.projectId, ownerRevision: index.revision,
            capabilities: capabilities?.fields ?? { objective: { editable: false, reason: 'No linked editable source' } },
            allowedIntent: capabilities?.fields.objective.editable ? 'set-objective' : null,
            checkpoint: fact(checkpoint, true),
            verifiedDependencies: related.filter(item => checkpoint.dependencies.includes(item.id))
                .slice(0, 6).map(item => ({ id: item.id, title: item.title, status: item.status })),
            neighbors: neighbors.map(item => fact(item)), planningMaps: maps }),
            ...(index.checkpoints.length > neighbors.length + 1 || related.length > neighbors.length ||
                checkpoint.links.length > planningLinks.length ||
                checkpoint.evidence.length > 1 || checkpoint.objective.length > 600 ||
                neighbors.some(item => item.objective.length > 160) ?
                { omitted: 'Roadmap objective, neighbors, links or evidence omitted by compact query bound' } : {}) };
    }

    private async gateContext(root: string, source: ChatContextSelection, content: string,
        roadmapSkill: boolean): Promise<{ label: string; text: string; omitted?: string }> {
        if (!this.roadmap) throw new Error('Roadmap context unavailable');
        const index = await this.roadmap.read<RoadmapGateIndex>(root);
        if (index.schemaVersion !== 2 || !index.revision || index.projectRoot !== root ||
            index.projectId !== source.projectId || index.revision !== source.ownerRevision ||
            index.linkedDocument?.sourceHash !== source.sourceHash)
            throw new Error('Stale or foreign Roadmap context; select it again');
        if (index.linkedDocument && (await this.roadmap.previewGateDocumentSync(root)).state !== 'unchanged')
            throw new Error('Linked Roadmap source changed; review synchronization first');
        const phases = [...index.phases].sort((a, b) => a.order - b.order);
        const gates = [...index.gates].sort((a, b) => a.parentPhaseId.localeCompare(b.parentPhaseId) || a.order - b.order);
        const selected = index.phases.find(item => item.id === source.id) ?? index.gates.find(item => item.id === source.id);
        if (source.id !== 'roadmap' && !selected) throw new Error('Selected Roadmap item is missing');
        const mentions = (value: string) => !!value && new RegExp(`(^|[^a-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'i').test(content);
        const matches = source.id === 'roadmap' ? [...phases, ...gates].filter(item =>
            mentions(item.id) || mentions(item.title) || 'designation' in item && mentions(item.designation)) : [];
        const criterionMatches = source.id === 'roadmap' ? gates.flatMap(parent => parent.criteria
            .filter(item => mentions(item.id) || mentions(item.title)).map(item => ({ parent, item }))) : [];
        const correctionMatches = source.id === 'roadmap' ? index.corrections.filter(item =>
            mentions(item.id) || mentions(item.title)) : [];
        const uniqueTargets = new Set([...matches.map(item => item.id),
            ...criterionMatches.map(item => item.parent.id),
            ...correctionMatches.map(item => item.parent.id)]);
        const exactGateIds = gates.filter(item => mentions(item.id));
        const explicitGate = roadmapSkill && exactGateIds.length === 1 ? exactGateIds[0] : undefined;
        const target = explicitGate ?? selected ?? (uniqueTargets.size === 1 ?
            phases.find(item => item.id === [...uniqueTargets][0]) ??
            gates.find(item => item.id === [...uniqueTargets][0]) : undefined);
        const criterion = target && 'parentPhaseId' in target ? criterionMatches.find(item => item.parent.id === target.id)?.item : undefined;
        const correction = correctionMatches.length === 1 ? correctionMatches[0] : undefined;
        const phase = target && 'parentPhaseId' in target ? phases.find(item => item.id === target.parentPhaseId) :
            target && 'objective' in target ? target : undefined;
        const gate = target && 'parentPhaseId' in target ? target : undefined;
        const linked = index.linkedDocument;
        const targetData = target ? 'parentPhaseId' in target ? {
            id: target.id, parentPhaseId: target.parentPhaseId, designation: target.designation,
            title: target.title, purpose: target.purpose, order: target.order, dependencies: target.dependencies,
            criteria: target.criteria.map(item => ({ id: item.id, title: item.title,
                expectedResult: item.expectedResult, order: item.order })),
            qualification: evaluateGateQualification(target, target.qualificationSource)
        } : { id: target.id, title: target.title, objective: target.objective, order: target.order,
            dependencies: target.dependencies,
            qualification: evaluatePhaseQualification(index, target.id, target.qualificationSource) } : undefined;
        const nearby = gate ? gates.filter(item => item.parentPhaseId === gate.parentPhaseId) :
            phase ? gates.filter(item => item.parentPhaseId === phase.id) : [];
        const readNearby = gate ? nearby.slice(Math.max(0, nearby.findIndex(item => item.id === gate.id) - 2),
            nearby.findIndex(item => item.id === gate.id) + 3) : nearby.slice(0, 12);
        const facts = { projectId: index.projectId, ownerRevision: index.revision,
            selectedId: source.id, linkedDocument: linked && { path: linked.path,
                sourceHash: linked.sourceHash, syncState: linked.syncState,
                targetSourceOwned: target ? linked.sections.some(item => item.id === target.id) : undefined },
            phaseCount: phases.length, gateCount: gates.length, correctionCount: index.corrections.length,
            ...(targetData ? { target: targetData } : {}),
            ...(criterion ? { targetCriterion: { id: criterion.id, title: criterion.title,
                expectedResult: criterion.expectedResult, order: criterion.order } } : {}),
            ...(correction ? { targetCorrection: { id: correction.id, parent: correction.parent,
                criterionId: correction.criterionId, title: correction.title, objective: correction.objective } } : {}),
            ...(phase ? { parentPhase: { id: phase.id, title: phase.title, objective: phase.objective,
                order: phase.order, dependencies: phase.dependencies } } : {}),
            ...(roadmapSkill ? { phaseIndex: phases.slice(0, 64).map(item => ({ id: item.id, title: item.title, order: item.order })),
                phaseIndexRange: phases.length > 64 ? `1–64 of ${phases.length}; provide an exact Phase ID or title for a later item` : undefined,
                siblingGates: nearby.map(item => ({ id: item.id, designation: item.designation })),
                matchedTargets: uniqueTargets.size > 1 ? [...uniqueTargets].slice(0, 12) : undefined,
                lookup: source.id === 'roadmap' && !target && !correction ?
                    'No unique target resolved. Ask for one exact Phase, Gate, Criterion, or Correction ID before editing an existing item.' : undefined } :
                { nearbyGates: readNearby.map(item => ({ id: item.id, designation: item.designation, title: item.title,
                    qualification: evaluateGateQualification(item, item.qualificationSource).status })) }) };
        return { label: selected ? `Roadmap ${'parentPhaseId' in selected ? 'Gate' : 'Phase'}: ${selected.title}` : 'Roadmap',
            text: JSON.stringify(facts),
            ...(roadmapSkill && phases.length > 64 ? { omitted: 'Phase index lists the first 64 entries; exact target lookup searched every Phase and Gate' } :
                !roadmapSkill && nearby.length > readNearby.length ?
                    { omitted: 'Only nearby Gates were included; select an exact Gate for more facts' } : {}) };
    }

    private async selectedRoadmapElements(root: string, sources: ChatContextSelection[]):
        Promise<{ label: string; text: string; omitted?: string }> {
        if (!this.roadmap) throw new Error('Roadmap context unavailable');
        const index = await this.roadmap.read<RoadmapGateIndex>(root);
        if (index.schemaVersion !== 2 || index.projectRoot !== root || !index.revision)
            throw new Error('Open a current schema-2 Roadmap before using selected elements');
        if (index.linkedDocument && (await this.roadmap.previewGateDocumentSync(root)).state !== 'unchanged')
            throw new Error('Linked Roadmap source changed; review synchronization first');
        const text = roadmapElementContext(index, sources);
        const current = await this.roadmap.read<RoadmapGateIndex>(root);
        if (current.projectId !== index.projectId || current.revision !== index.revision ||
            current.linkedDocument?.sourceHash !== index.linkedDocument?.sourceHash)
            throw new Error('Roadmap changed while preparing selected elements; select them again');
        return { label: `Selected Roadmap elements: ${sources.map(item => `${item.elementKind} ${item.id}`).join(', ')}`, text };
    }

    private async file(root: string, path: string, maxBytes = 1_000_000): Promise<string> {
        projectPath(path);
        if (path.startsWith('.dope/')) throw new Error('Use a typed project context source for .dope data');
        const actual = await realpath(join(root, path));
        const within = relative(root, actual);
        if (!within || within === '..' || within.startsWith('../') || isAbsolute(within))
            throw new Error(`Context file escapes project: ${path}`);
        if (within.startsWith('.dope/')) throw new Error('Use a typed project context source for .dope data');
        const info = await stat(actual);
        if (!info.isFile() || info.size > maxBytes) throw new Error(`Context file is unavailable or exceeds read limit: ${path}`);
        return actual;
    }

    private async resolve(root: string, active: Chat, source: ChatContextSelection, content: string,
        roadmapSkill: boolean): Promise<{ label: string; text: string; omitted?: string }> {
        if (!source || typeof source.id !== 'string' || !source.id.trim()) throw new Error('Invalid context selection');
        if (source.kind === 'editor' || source.kind === 'selection' || source.kind === 'file') {
            const path = projectPath(source.id);
            const file = await this.file(root, path);
            if (source.kind === 'file') return { label: path, text: await readFile(file, 'utf8') };
            if (typeof source.text !== 'string' || source.text.length > 1_000_000) throw new Error('Invalid captured editor text');
            if (source.kind === 'selection' && (!Number.isSafeInteger(source.start) || !Number.isSafeInteger(source.end) ||
                source.start! < 0 || source.end! <= source.start! || source.text.length !== source.end! - source.start!))
                throw new Error('Invalid selection bounds');
            return { label: source.kind === 'selection' ? `${path}:${source.start}-${source.end}` : path, text: source.text };
        }
        if (source.kind === 'project-mind') {
            const mind = await this.mind.read(root);
            if (!mind || source.projectId && source.projectId !== mind.projectId) throw new Error('Stale Project Mind context');
            const artifact = mind.artifacts.find(item => item.id === source.id);
            if (!artifact) throw new Error('Project Mind artifact missing');
            return { label: `${artifact.type}: ${artifact.title}`, text: JSON.stringify(artifact) };
        }
        if (source.kind === 'roadmap-checkpoint') return this.roadmapContext(root, source);
        if (source.kind === 'roadmap') {
            const recent = roadmapSkill ? active.messages.filter(item => item.role === 'user')
                .slice(-3).map(item => item.content).join('\n') : '';
            return this.gateContext(root, source, `${content}\n${recent}`, roadmapSkill);
        }
        if (source.kind === 'architecture') {
            const state = await readInitialization(root);
            if (!state.initialized) throw new Error('Canonical Architecture unavailable');
            const architecture = (await readArchitecture(root)).architecture;
            const boundary = architecture.systems.flatMap(system => [system, ...system.subsystems.flatMap(subsystem =>
                [subsystem, ...(subsystem.components ?? [])])]).find(item => item.id === source.id);
            if (!boundary) throw new Error('Architecture identity missing');
            return { label: `Architecture: ${boundary.name}`, text: JSON.stringify(boundary) };
        }
        if (source.kind === 'physical-map' || source.kind === 'flow') {
            const snapshot = this.index.snapshot(root), status = this.index.status(root);
            if (!snapshot || status.state !== 'ready' || status.generation !== snapshot.metadata.generation ||
                !Number.isSafeInteger(source.generation) || source.generation !== snapshot.metadata.generation ||
                source.projectId !== snapshot.metadata.projectId || !await this.index.inputsCurrent(root) ||
                this.index.status(root).generation !== source.generation)
                throw new Error('Stale Physical Map context; analyze again');
            if (source.kind === 'physical-map') {
                const node = snapshot.nodes.find(item => item.id === source.id);
                if (!node) {
                    const evidence = snapshot.evidence.find(item => item.id === source.id);
                    if (!evidence) throw new Error('Physical Map identity missing');
                    return { label: `Physical Map evidence: ${evidence.id}`, text: JSON.stringify(evidence) };
                }
                const evidence = snapshot.evidence.filter(item => node.evidenceIds.includes(item.id)).slice(0, 20);
                const count = Math.max(0, node.evidenceIds.length - evidence.length);
                return { label: `Physical Map: ${node.name}`, text: JSON.stringify({ node, evidence, evidenceOmitted: count }),
                    ...(count ? { omitted: `${count} evidence records omitted by query bound` } : {}) };
            }
            const result = queryStaticFlow(snapshot, { projectId: source.projectId, generation: source.generation!,
                selectedId: source.id, direction: source.direction, maxNodes: 16, maxFacts: 12, maxHops: 8 });
            const evidenceIds = new Set(result.facts.flatMap(item => item.evidenceIds));
            const evidence = snapshot.evidence.filter(item => evidenceIds.has(item.id)).slice(0, 30);
            return { label: `Flow: ${source.id}`, text: JSON.stringify({ ...result, evidence }),
                ...(result.truncated || evidenceIds.size > evidence.length ?
                    { omitted: 'Flow query or evidence truncated at node/fact/hop bound' } : {}) };
        }
        if (source.kind === 'planning-map' || source.kind === 'work-item') {
            const collection = await this.planning.read(root);
            if (source.projectId && source.projectId !== collection.projectId) throw new Error('Stale Planning project context');
            const [mapId, workId] = source.kind === 'work-item' ? source.id.split(':') : [source.id];
            const map = collection.maps.find(item => item.id === mapId);
            if (!map) throw new Error('Planning Map missing');
            const status = this.index.status(root);
            const canonical = await readInitialization(root);
            if (status.state !== 'ready' || status.inputFingerprint !== map.basis.physicalInputFingerprint ||
                !canonical.initialized || canonical.declarationFingerprint !== map.basis.architectureFingerprint ||
                !await this.index.inputsCurrent(root) || this.index.status(root).generation !== status.generation)
                throw new Error('Stale Planning Map context');
            if (source.kind === 'planning-map') return { label: `Planning Map: ${map.title}`, text: JSON.stringify({
                id: map.id, title: map.title, objective: map.objective, status: map.status, basis: map.basis,
                transformations: map.transformations.slice(0, 20), workItems: map.workItems.slice(0, 20) }),
                ...(map.transformations.length > 20 || map.workItems.length > 20 ?
                    { omitted: 'Planning Map items omitted by query bound' } : {}) };
            const work = map.workItems.find(item => item.id === workId);
            if (!work) throw new Error('WorkItem missing');
            return { label: `WorkItem: ${work.title}`, text: JSON.stringify({ mapId: map.id, ...work }) };
        }
        if (source.kind === 'saved-chat') {
            if (!active.settings.context.savedChatSearch) throw new Error('Saved Chat retrieval disabled');
            if (source.id === active.id || !source.messageId) throw new Error('Select a message from another Chat');
            const saved = (await this.chats.read(root)).chats.find(item => item.id === source.id);
            const message = saved?.messages.find(item => item.id === source.messageId);
            if (!saved || !message || message.role === 'assistant' && message.execution.status !== 'complete')
                throw new Error('Saved Chat excerpt missing');
            return { label: `${saved.title}: ${message.id}`, text: message.content };
        }
        throw new Error('Unsupported context source');
    }

    async compose(root: string, chat: Chat, content: string, selections: ChatContextSelection[],
        capabilities: ConversationModelCapabilities, grounding?: GroundingResult,
        strictHelpJson = false, bridgeMode = false, roadmapOpportunity?: string,
        piMode = false, roadmapSkill = false): Promise<ComposedChatContext> {
        if (!content.trim()) throw new Error('Enter a message before sending');
        if (!Array.isArray(selections) || selections.length > 20) throw new Error('Too many context selections');
        const policy = chat.settings.context;
        const window = capabilities.contextWindowTokens ?? policy.maxInputTokens + policy.reservedOutputTokens;
        const budgetTokens = Math.min(availableChatContextTokens(policy, window), capabilities.maxInputTokens ?? Infinity);
        // Charge escaped JSON string bytes: the provider receives serialized messages,
        // where quotes, backslashes and newlines can expand source-heavy attachments.
        const tokens = (value: string) => Math.ceil(Buffer.byteLength(JSON.stringify(value), 'utf8') / 3) + 4;
        const fit = (prefix: string, value: string, available: number) => {
            const bytes = Buffer.from(value, 'utf8');
            let low = 0, high = bytes.length;
            while (low < high) {
                const middle = Math.ceil((low + high) / 2);
                const candidate = bytes.subarray(0, middle).toString('utf8').replace(/\uFFFD+$/, '');
                if (tokens(prefix + candidate) <= available) low = middle;
                else high = middle - 1;
            }
            return bytes.subarray(0, low).toString('utf8').replace(/\uFFFD+$/, '');
        };
        const helpId = roadmapSkill ? undefined : selectDopeCapabilityHelp(content);
        const help = helpId ? await this.helpContext(root, helpId, selections, strictHelpJson) : undefined;
        const gateAction = !help && roadmapSkill && selections.some(source => source.kind === 'roadmap');
        const roadmapAction = !help && selections.some(source => source.kind === 'roadmap-checkpoint');
        const roadmapInstruction = roadmapAction && !bridgeMode;
        const piInstruction = piMode ? `${PI_CHAT_INSTRUCTION} Workspace root: ${root}` : undefined;
        let remaining = budgetTokens - tokens(content) - (grounding ? tokens(GROUNDED_CHAT_INSTRUCTION) : 0) -
            (piInstruction ? tokens(piInstruction) : 0) -
            (roadmapOpportunity ? tokens(roadmapOpportunity) : 0) -
            (roadmapInstruction ? tokens(ROADMAP_ACTION_INSTRUCTION) : 0) -
            (gateAction ? tokens(GATE_ACTION_INSTRUCTION) : 0) -
            (!gateAction && selections.some(source => source.kind === 'roadmap') ? tokens(GATE_READ_INSTRUCTION) : 0) -
            (help ? tokens(help.instruction) : 0);
        if (remaining < 0) throw new Error('Message exceeds selected model input budget');
        const refs: ChatContextRef[] = [], diagnostics: ChatContextDiagnostic[] = [], attached: string[] = [];
        if (grounding) for (const diagnostic of grounding.diagnostics)
            diagnostics.push({ kind: diagnostic.kind === 'truncated' ? 'truncated' : 'omitted',
                source: diagnostic.source, message: diagnostic.message });
        const orderedSelections = [...selections.filter(source => source.kind === 'roadmap' || source.kind === 'roadmap-checkpoint'),
            ...selections.filter(source => source.kind !== 'roadmap' && source.kind !== 'roadmap-checkpoint')];
        const elementSelections = orderedSelections.filter(source => source.kind === 'roadmap' && source.elementKind);
        if (orderedSelections.some(source => source.elementKind && source.kind !== 'roadmap'))
            throw new Error('Roadmap element kind requires Roadmap context');
        if (elementSelections.length && !roadmapSkill)
            throw new Error('Selected Roadmap elements require the protected /roadmap command');
        const memory = !help && (roadmapAction || chat.messages.some(message => message.role === 'assistant' &&
            message.execution.status === 'complete' &&
            message.planningActivity?.status === 'applied')) ? this.decisionContext(chat) : undefined;
        const wrapperTokens = selections.length || grounding?.blocks.length || memory ? tokens('\n\nProject context:\n') : 0;
        const memoryBlock = memory ? `[Saved Chat planning decisions]\n${memory}` : undefined;
        const memoryTokens = memoryBlock ? tokens(memoryBlock) : 0;
        remaining -= wrapperTokens + memoryTokens;
        if (remaining < 0) throw new Error('Confirmed planning decisions exceed selected model input budget');
        for (const source of orderedSelections) {
            if (source.elementKind && source !== elementSelections[0]) continue;
            const resolved = source.elementKind ? await this.selectedRoadmapElements(root, elementSelections) :
                await this.resolve(root, chat, source, content, roadmapSkill);
            if (resolved.omitted) diagnostics.push({ kind: 'truncated', source: `${source.kind}:${source.id}`, message: resolved.omitted });
            const prefix = `[${source.kind}: ${resolved.label}]\n`;
            let text = resolved.text;
            if (tokens(prefix) >= remaining) {
                if (source.kind === 'roadmap-checkpoint' || source.kind === 'roadmap')
                    throw new Error('Selected Roadmap identity and field capability do not fit; shorten the request or select a larger local model');
                diagnostics.push({ kind: 'omitted', source: `${source.kind}:${source.id}`, message: 'Context budget exhausted' });
                continue;
            }
            if (tokens(prefix + text) > remaining && (source.kind === 'roadmap-checkpoint' || source.kind === 'roadmap'))
                throw new Error('Selected Roadmap identity, field capability or source does not fit; shorten the request or select a larger local model');
            if (tokens(prefix + text) > remaining) {
                text = fit(prefix, text, remaining);
                diagnostics.push({ kind: 'truncated', source: `${source.kind}:${source.id}`, message: 'Context truncated to input budget' });
            }
            if (!text) { diagnostics.push({ kind: 'omitted', source: `${source.kind}:${source.id}`, message: 'No context fits' }); continue; }
            const block = prefix + text, cost = tokens(block);
            remaining -= cost;
            attached.push(block);
            refs.push({ schemaVersion: 1, kind: source.kind, id: source.id, label: resolved.label,
                estimatedTokens: cost, includedBytes: Buffer.byteLength(text, 'utf8'),
                contentHash: createHash('sha256').update(text).digest('hex'),
                ...(source.projectId ? { projectId: source.projectId } : {}),
                ...(source.generation !== undefined ? { generation: source.generation } : {}),
                ...(source.ownerRevision !== undefined ? { ownerRevision: source.ownerRevision } : {}),
                ...(source.sourceHash !== undefined ? { sourceHash: source.sourceHash } : {}),
                ...(source.elementKind ? { elementKind: source.elementKind } : {}),
                ...(source.kind === 'selection' ? { start: source.start, end: source.end } : {}),
                ...(source.kind === 'saved-chat' ? { messageId: source.messageId } : {}) });
            if (source.elementKind) for (const other of elementSelections.slice(1)) refs.push({
                schemaVersion: 1, kind: 'roadmap', id: other.id,
                label: `Roadmap ${other.elementKind}: ${other.id}`, origin: 'manual',
                estimatedTokens: 0, includedBytes: 0, projectId: other.projectId,
                ownerRevision: other.ownerRevision, sourceHash: other.sourceHash,
                elementKind: other.elementKind });
        }
        if (memoryBlock) attached.push(memoryBlock);
        for (const block of grounding?.blocks ?? []) {
            const source = `${block.ref.kind}:${block.ref.id}`;
            const prefix = `[Auto ${block.ref.kind}: ${block.ref.label}]\n`;
            let evidence = block.text;
            if (tokens(prefix) >= remaining) evidence = '';
            else if (tokens(prefix + evidence) > remaining) {
                evidence = fit(prefix, evidence, remaining);
                diagnostics.push({ kind: 'truncated', source, message: 'Auto context truncated to input budget' });
            }
            if (!evidence) diagnostics.push({ kind: 'omitted', source, message: 'Auto context omitted by input budget' });
            const cost = evidence ? tokens(prefix + evidence) : 0;
            if (evidence) { remaining -= cost; attached.push(prefix + evidence); }
            // Cite exactly the excerpt sent to the model; a smaller budget cannot claim unseen bytes.
            refs.push({ ...block.ref, estimatedTokens: cost, includedBytes: Buffer.byteLength(evidence, 'utf8'),
                contentHash: createHash('sha256').update(evidence).digest('hex'),
                ...(evidence === block.text ? {} : { sourceHash: undefined }) });
        }
        if (!attached.length) remaining += wrapperTokens;
        const messages: ConversationMessage[] = grounding ? [{ role: 'system', content: GROUNDED_CHAT_INSTRUCTION }] : [];
        if (piInstruction) messages.push({ role: 'system', content: piInstruction });
        if (roadmapOpportunity) messages.push({ role: 'system', content: roadmapOpportunity });
        if (roadmapInstruction) messages.push({ role: 'system', content: ROADMAP_ACTION_INSTRUCTION });
        if (gateAction) messages.push({ role: 'system', content: GATE_ACTION_INSTRUCTION });
        else if (selections.some(source => source.kind === 'roadmap'))
            messages.push({ role: 'system', content: GATE_READ_INSTRUCTION });
        if (help) messages.push({ role: 'system', content: help.instruction });
        const historyMessages: ConversationMessage[] = [];
        if (policy.history === 'recent' && !help) {
            const exchanges: { user: Chat['messages'][number]; assistant: Chat['messages'][number] }[] = [];
            for (const item of chat.messages) {
                if (item.role === 'user') {
                    exchanges.push({ user: item, assistant: item });
                } else if (item.execution.status === 'complete' && exchanges.length) {
                    // A deliberate retry can complete after a failed assistant for the same user.
                    exchanges[exchanges.length - 1].assistant = item;
                }
            }
            for (const exchange of exchanges.reverse()) {
                if (exchange.assistant === exchange.user) continue;
                const cost = tokens(exchange.user.content) + tokens(exchange.assistant.content);
                if (cost > remaining) {
                    diagnostics.push({ kind: 'history', source: exchange.user.id, message: 'Older Chat exchange omitted by history budget' });
                    break;
                }
                remaining -= cost;
                historyMessages.unshift({ role: 'user', content: exchange.user.content },
                    { role: 'assistant', content: exchange.assistant.content });
            }
        }
        messages.push(...historyMessages);
        messages.push({ role: 'user', content: attached.length ? `${content}\n\nProject context:\n${attached.join('\n\n')}` : content });
        return { messages, refs, diagnostics, usedTokens: budgetTokens - remaining, budgetTokens,
            ...(help?.guidance ? { verifiedGuidance: help.guidance } : {}) };
    }
}
