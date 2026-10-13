import { readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join, relative } from 'node:path';
import { availableChatContextTokens, type Chat, type ChatContextRef } from '@dope/chat';
import type { ChatContextDiagnostic, ChatContextSelection } from '@dope/chat/lib/service';
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
import type { GroundingResult } from './chat-project-grounder';

export const GROUNDED_CHAT_INSTRUCTION = 'Project facts are verified only when supported by the supplied project evidence. Do not claim to have read, listed, searched, or inspected project state beyond that evidence. State what is missing or unknown.';
const ROADMAP_ACTION_INSTRUCTION = 'For a linked Markdown checkpoint, only if capabilities.objective.editable is true, propose {"type":"roadmap-intent","intent":"set-objective","value":"one line"}. Otherwise reply {"type":"no-action","message":"brief reason"}. For an unlinked checkpoint, a validated roadmap-proposal action may be used. All proposals require developer approval. Never claim an edit was applied.';

export interface ComposedChatContext { messages: ConversationMessage[]; refs: ChatContextRef[];
    diagnostics: ChatContextDiagnostic[]; usedTokens: number; budgetTokens: number }

/** One project-scoped translation boundary. Model requests never read project state directly. */
export class ChatContextComposer {
    constructor(private readonly mind: ProjectMindStore, private readonly planning: PlanningStore,
        private readonly index: SoftwareMapIndex, private readonly chats: ChatRepository,
        private readonly roadmap?: RoadmapStore,
        private readonly planningLinkCurrent?: (root: string, link: RoadmapLink) => Promise<boolean>) {}

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
        const neighbors = related.slice(0, 2);
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
            neighbors: neighbors.map(item => fact(item)), planningMaps: maps }),
            ...(index.checkpoints.length > neighbors.length + 1 || related.length > neighbors.length ||
                checkpoint.links.length > planningLinks.length ||
                checkpoint.evidence.length > 1 || checkpoint.objective.length > 600 ||
                neighbors.some(item => item.objective.length > 160) ?
                { omitted: 'Roadmap objective, neighbors, links or evidence omitted by compact query bound' } : {}) };
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

    private async resolve(root: string, active: Chat, source: ChatContextSelection): Promise<{ label: string; text: string; omitted?: string }> {
        if (!source || typeof source.id !== 'string' || !source.id.trim()) throw new Error('Invalid context selection');
        if (!active.settings.context.allowedSources.includes(source.kind)) throw new Error(`Context source disabled: ${source.kind}`);
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
            if (!saved || !message) throw new Error('Saved Chat excerpt missing');
            return { label: `${saved.title}: ${message.id}`, text: message.content };
        }
        throw new Error('Unsupported context source');
    }

    async compose(root: string, chat: Chat, content: string, selections: ChatContextSelection[],
        capabilities: ConversationModelCapabilities, grounding?: GroundingResult): Promise<ComposedChatContext> {
        if (!content.trim()) throw new Error('Enter a message before sending');
        if (!Array.isArray(selections) || selections.length > 20) throw new Error('Too many context selections');
        const policy = chat.settings.context;
        const window = capabilities.contextWindowTokens ?? policy.maxInputTokens + policy.reservedOutputTokens;
        const budgetTokens = Math.min(availableChatContextTokens(policy, window), capabilities.maxInputTokens ?? Infinity);
        // ponytail: no conversational adapter exposes a tokenizer; UTF-8 bytes / 3 is a conservative deterministic estimate.
        const tokens = (value: string) => Math.ceil(Buffer.byteLength(value, 'utf8') / 3) + 4;
        const roadmapAction = selections.some(source => source.kind === 'roadmap-checkpoint');
        let remaining = budgetTokens - tokens(content) - (grounding ? tokens(GROUNDED_CHAT_INSTRUCTION) : 0) -
            (roadmapAction ? tokens(ROADMAP_ACTION_INSTRUCTION) : 0);
        if (remaining < 0) throw new Error('Message exceeds selected model input budget');
        const refs: ChatContextRef[] = [], diagnostics: ChatContextDiagnostic[] = [], attached: string[] = [];
        if (grounding) for (const diagnostic of grounding.diagnostics)
            diagnostics.push({ kind: diagnostic.kind === 'truncated' ? 'truncated' : 'omitted',
                source: diagnostic.source, message: diagnostic.message });
        const wrapperTokens = selections.length || grounding?.blocks.length ? tokens('\n\nProject context:\n') : 0;
        remaining -= wrapperTokens;
        for (const source of selections) {
            const resolved = await this.resolve(root, chat, source);
            if (resolved.omitted) diagnostics.push({ kind: 'truncated', source: `${source.kind}:${source.id}`, message: resolved.omitted });
            const prefix = `[${source.kind}: ${resolved.label}]\n`;
            let text = resolved.text;
            if (tokens(prefix) >= remaining) {
                if (source.kind === 'roadmap-checkpoint')
                    throw new Error('Selected Roadmap identity and field capability do not fit; shorten the request or select a larger local model');
                diagnostics.push({ kind: 'omitted', source: `${source.kind}:${source.id}`, message: 'Context budget exhausted' });
                continue;
            }
            if (tokens(prefix + text) > remaining && source.kind === 'roadmap-checkpoint')
                throw new Error('Selected Roadmap identity, field capability or source does not fit; shorten the request or select a larger local model');
            if (tokens(prefix + text) > remaining) {
                const bytes = Math.max(0, (remaining - tokens(prefix) - 4) * 3);
                text = Buffer.from(text, 'utf8').subarray(0, bytes).toString('utf8').replace(/\uFFFD+$/, '');
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
                ...(source.kind === 'selection' ? { start: source.start, end: source.end } : {}),
                ...(source.kind === 'saved-chat' ? { messageId: source.messageId } : {}) });
        }
        for (const block of grounding?.blocks ?? []) {
            const source = `${block.ref.kind}:${block.ref.id}`;
            const prefix = `[Auto ${block.ref.kind}: ${block.ref.label}]\n`;
            let evidence = block.text;
            if (tokens(prefix) >= remaining) evidence = '';
            else if (tokens(prefix + evidence) > remaining) {
                const bytes = Math.max(0, (remaining - tokens(prefix) - 4) * 3);
                evidence = Buffer.from(evidence, 'utf8').subarray(0, bytes).toString('utf8').replace(/\uFFFD+$/, '');
                diagnostics.push({ kind: 'truncated', source, message: 'Auto context truncated to input budget' });
            }
            if (!evidence) diagnostics.push({ kind: 'omitted', source, message: 'Auto context omitted by input budget' });
            const cost = evidence ? tokens(prefix + evidence) : 0;
            if (evidence) { remaining -= cost; attached.push(prefix + evidence); }
            // The original evidence hash and identity survive budget changes and retry.
            refs.push({ ...block.ref, estimatedTokens: cost, includedBytes: Buffer.byteLength(evidence, 'utf8') });
        }
        if (!attached.length) remaining += wrapperTokens;
        const messages: ConversationMessage[] = grounding ? [{ role: 'system', content: GROUNDED_CHAT_INSTRUCTION }] : [];
        if (roadmapAction) messages.push({ role: 'system', content: ROADMAP_ACTION_INSTRUCTION });
        if (policy.history === 'recent') {
            const history = chat.messages.filter(item => item.role === 'user' || item.execution.status === 'complete');
            for (const item of history.reverse()) {
                const cost = tokens(item.content);
                if (cost > remaining) {
                    diagnostics.push({ kind: 'history', source: item.id, message: 'Older Chat message omitted by history budget' });
                    break;
                }
                remaining -= cost;
                messages.unshift({ role: item.role, content: item.content });
            }
        }
        messages.push({ role: 'user', content: attached.length ? `${content}\n\nProject context:\n${attached.join('\n\n')}` : content });
        return { messages, refs, diagnostics, usedTokens: budgetTokens - remaining, budgetTokens };
    }
}
