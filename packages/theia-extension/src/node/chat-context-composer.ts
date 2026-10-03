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

export interface ComposedChatContext { messages: ConversationMessage[]; refs: ChatContextRef[];
    diagnostics: ChatContextDiagnostic[]; usedTokens: number; budgetTokens: number }

/** One project-scoped translation boundary. Model requests never read project state directly. */
export class ChatContextComposer {
    constructor(private readonly mind: ProjectMindStore, private readonly planning: PlanningStore,
        private readonly index: SoftwareMapIndex, private readonly chats: ChatRepository) {}

    private async file(root: string, path: string): Promise<string> {
        projectPath(path);
        if (path.startsWith('.dope/')) throw new Error('Use a typed project context source for .dope data');
        const actual = await realpath(join(root, path));
        const within = relative(root, actual);
        if (!within || within === '..' || within.startsWith('../') || isAbsolute(within))
            throw new Error(`Context file escapes project: ${path}`);
        if (within.startsWith('.dope/')) throw new Error('Use a typed project context source for .dope data');
        const info = await stat(actual);
        if (!info.isFile() || info.size > 1_000_000) throw new Error(`Context file is unavailable or exceeds 1 MB: ${path}`);
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
        capabilities: ConversationModelCapabilities): Promise<ComposedChatContext> {
        if (!content.trim()) throw new Error('Enter a message before sending');
        if (!Array.isArray(selections) || selections.length > 20) throw new Error('Too many context selections');
        const policy = chat.settings.context;
        const window = capabilities.contextWindowTokens ?? policy.maxInputTokens + policy.reservedOutputTokens;
        const budgetTokens = Math.min(availableChatContextTokens(policy, window), capabilities.maxInputTokens ?? Infinity);
        // ponytail: no conversational adapter exposes a tokenizer; UTF-8 bytes / 3 is a conservative deterministic estimate.
        const tokens = (value: string) => Math.ceil(Buffer.byteLength(value, 'utf8') / 3) + 4;
        let remaining = budgetTokens - tokens(content);
        if (remaining < 0) throw new Error('Message exceeds selected model input budget');
        const refs: ChatContextRef[] = [], diagnostics: ChatContextDiagnostic[] = [], attached: string[] = [];
        const wrapperTokens = selections.length ? tokens('\n\nProject context:\n') : 0;
        remaining -= wrapperTokens;
        for (const source of selections) {
            const resolved = await this.resolve(root, chat, source);
            if (resolved.omitted) diagnostics.push({ kind: 'truncated', source: `${source.kind}:${source.id}`, message: resolved.omitted });
            const prefix = `[${source.kind}: ${resolved.label}]\n`;
            let text = resolved.text;
            if (tokens(prefix) >= remaining) {
                diagnostics.push({ kind: 'omitted', source: `${source.kind}:${source.id}`, message: 'Context budget exhausted' });
                continue;
            }
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
                ...(source.kind === 'selection' ? { start: source.start, end: source.end } : {}),
                ...(source.kind === 'saved-chat' ? { messageId: source.messageId } : {}) });
        }
        if (!attached.length) remaining += wrapperTokens;
        const messages: ConversationMessage[] = [];
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
