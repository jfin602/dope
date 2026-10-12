import { parseSessionArtifactRef } from '@dope/contracts/lib/developer-session';
import type { SessionArtifactRef } from '@dope/contracts/lib/developer-session';
import type { SessionCandidate, SessionCandidateResult } from '@dope/contracts/lib/developer-session-service';
import { ChatRepository } from '@dope/chat/lib/node/chat-repository';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { ProjectMindStore } from '@dope/project-intelligence/lib/node/project-mind-store';

const LIMIT = 50;
const kinds: SessionArtifactRef['kind'][] = ['chat', 'planning-map', 'work-item', 'agent-task',
    'agent-run', 'agent-sequence', 'project-mind'];

/** One explicit request reads one owning store. The response contains only IDs and short labels. */
export class DeveloperSessionCandidates {
    constructor(private readonly chats = new ChatRepository(), private readonly planning = new PlanningStore(),
        private readonly agents = new AgentStore(), private readonly mind = new ProjectMindStore()) {}

    async list(root: string, kind: SessionArtifactRef['kind']): Promise<SessionCandidateResult> {
        if (!kinds.includes(kind)) throw new Error('Invalid Session candidate kind');
        const unavailable = (diagnostic: string): SessionCandidateResult =>
            ({ kind, availability: 'unavailable', candidates: [], truncated: false, diagnostic });
        // listRuns reads candidate review/diff payload. There is no safe run metadata list yet.
        if (kind === 'agent-run') return unavailable('AgentRun browsing is unavailable; enter the exact task and run IDs.');
        try {
            let entries: SessionCandidate[] = [];
            let truncated = false;
            if (kind === 'chat') {
                const result = await this.chats.peekCandidateIds(root, LIMIT);
                entries = result.ids.map(chatId => ({ ref: { kind, chatId }, label: `Chat · ${chatId}` }));
                truncated = result.truncated;
            } else if (kind === 'planning-map' || kind === 'work-item') {
                const collection = await this.planning.read(root);
                for (const map of collection.maps) {
                    if (map.projectId !== collection.projectId) continue;
                    if (kind === 'planning-map') entries.push({ ref: { kind, mapId: map.id },
                        label: map.title.slice(0, 160) });
                    else for (const item of map.workItems) {
                        entries.push({ ref: { kind, mapId: map.id, workItemId: item.id },
                            label: `${map.title.slice(0, 80)} / ${item.title.slice(0, 80)}` });
                        if (entries.length > LIMIT) break;
                    }
                    if (entries.length > LIMIT) break;
                }
                truncated = entries.length > LIMIT;
                entries = entries.slice(0, LIMIT);
            } else if (kind === 'agent-task') {
                for (const task of await this.agents.listTasks(root)) {
                    if (task.origin.kind === 'work-item' && task.projectId !== task.origin.projectId) continue;
                    entries.push({ ref: { kind, taskId: task.id }, label: task.objective.slice(0, 160) });
                    if (entries.length > LIMIT) break;
                }
                truncated = entries.length > LIMIT;
                entries = entries.slice(0, LIMIT);
            } else if (kind === 'agent-sequence') {
                for (const sequence of await this.agents.listSequences(root)) {
                    entries.push({ ref: { kind, sequenceId: sequence.id },
                        label: sequence.stack.folderName.slice(0, 160) });
                    if (entries.length > LIMIT) break;
                }
                truncated = entries.length > LIMIT;
                entries = entries.slice(0, LIMIT);
            } else if (kind === 'project-mind') {
                const project = await this.mind.read(root);
                for (const artifact of project?.artifacts ?? []) {
                    if (artifact.type !== 'decision' && artifact.type !== 'idea') continue;
                    entries.push({ ref: { kind, artifactType: artifact.type, artifactId: artifact.id },
                        label: artifact.title.slice(0, 160) });
                    if (entries.length > LIMIT) break;
                }
                truncated = entries.length > LIMIT;
                entries = entries.slice(0, LIMIT);
            }
            return { kind, availability: 'ready', candidates: entries.map(item => ({
                ref: parseSessionArtifactRef(item.ref), label: item.label })), truncated,
                diagnostic: truncated ? `Showing the first ${LIMIT} owner records; use exact ID for others.` :
                    entries.length ? '' : 'No existing artifacts of this type were found.' };
        } catch {
            return unavailable('Owner metadata is unavailable; enter a verified exact ID or retry later.');
        }
    }
}
