import { createHash, randomUUID } from 'node:crypto';
import { lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import { projectHistory, proposeHistoryContinuation } from '@dope/contracts/lib/history';
import type { HistoryFocusTarget, HistoryProject } from '@dope/contracts/lib/history';
import type { HistoryService, HistorySnapshot, HistoryLocalExplanation } from '@dope/contracts/lib/history-service';
import { buildHistoryContextPreview, HISTORY_PREVIEW_MAX_BYTES } from '@dope/contracts/lib/history-context-preview';
import type { HistorySelection, HistoryContextPreview } from '@dope/contracts/lib/history-context-preview';
import { readHistoryOwnerMetadata } from './history-owner-metadata';
import { readHistoryWorkGitMetadata } from './history-work-git';
import { readHistoryFocus, writeHistoryFocus } from './history-focus';
import { explainHistoryLocally } from './history-local-understanding';
import type { AIRoleRoutingService } from './ai-role-routing';
import type { ModelConnectionsRegistry } from './model-connections';

/** Per-RPC-connection projection with one bounded focus hint. Late work cannot publish for a replaced root. */
export class HistoryBackend implements HistoryService {
    private project?: HistoryProject;
    private handle = randomUUID();
    private generation = 0;
    private disposed = false;
    private focusWrite: Promise<void> = Promise.resolve();
    private explanations = new Map<string, AbortController>();

    constructor(private readonly planning = new PlanningStore(),
        private readonly routing?: Pick<AIRoleRoutingService, 'resolve'>,
        private readonly models?: Pick<ModelConnectionsRegistry, 'generate'>) {}

    async attach(folderUri: string): Promise<{ projectHandle: string }> {
        if (this.disposed) throw new Error('History connection disposed');
        for (const controller of this.explanations.values()) controller.abort();
        const generation = ++this.generation;
        this.project = undefined;
        this.handle = randomUUID();
        const root = await this.planning.root(folderUri);
        const planning = await this.planning.read(root);
        if (this.disposed || generation !== this.generation) throw new Error('History attachment superseded');
        this.project = { projectRoot: root, projectId: planning.projectId };
        return { projectHandle: this.handle };
    }

    private digest(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

    async read(projectHandle: string): Promise<HistorySnapshot> {
        if (this.disposed || !this.project || projectHandle !== this.handle) throw new Error('Invalid History project handle');
        const project = this.project, generation = this.generation;
        const planning = await this.planning.read(project.projectRoot);
        if (planning.projectId !== project.projectId) throw new Error('History project identity changed; reattach');
        const observedAt = new Date().toISOString();
        const [owner, work] = await Promise.all([
            readHistoryOwnerMetadata(project, observedAt), readHistoryWorkGitMetadata(project, observedAt)
        ]);
        if (this.disposed || generation !== this.generation || projectHandle !== this.handle)
            throw new Error('History project changed during read');
        if ((await this.planning.read(project.projectRoot)).projectId !== project.projectId)
            throw new Error('History project identity changed during read');
        const entries = projectHistory([...owner.entries, ...work.entries], project);
        const focus = await readHistoryFocus(project);
        if (this.disposed || generation !== this.generation || projectHandle !== this.handle)
            throw new Error('History project changed during read');
        const evidenceBasis = this.digest({ project, entries: entries.map(entry => ({ ...entry,
            observedAt: entry.kind === 'snapshot' ? null : entry.observedAt })), dirtyPaths: work.dirtyPaths, gitBasis: work.gitBasis,
            diagnostics: [...owner.diagnostics, ...work.diagnostics], truncated: owner.truncated || work.truncated });
        return { project, entries, evidenceBasis, continueWith: proposeHistoryContinuation(project, entries, focus),
            diagnostics: [...owner.diagnostics, ...work.diagnostics].slice(0, 20).map(item => ({
                source: item.source, message: item.message.slice(0, 200)
            })), truncated: owner.truncated || work.truncated || owner.entries.length + work.entries.length > entries.length };
    }

    async preview(projectHandle: string, expectedBasis: string, selection: HistorySelection[]): Promise<HistoryContextPreview> {
        const snapshot = await this.read(projectHandle);
        if (snapshot.evidenceBasis !== expectedBasis) throw new Error('History evidence changed; refresh and select again');
        return buildHistoryContextPreview(snapshot.project, snapshot.evidenceBasis, snapshot.entries, selection,
            entry => this.digest({ ...entry, observedAt: entry.kind === 'snapshot' ? null : entry.observedAt }));
    }

    async verifyPreviewBasis(projectHandle: string, expectedBasis: string): Promise<boolean> {
        return (await this.read(projectHandle)).evidenceBasis === expectedBasis;
    }

    async explain(projectHandle: string, preview: HistoryContextPreview, selection: HistorySelection[],
        requestId: string, confirmed: boolean): Promise<HistoryLocalExplanation> {
        if (confirmed !== true) throw new Error('Explicit preview confirmation required');
        if (!this.routing || !this.models) throw new Error('Local explanation capability unavailable');
        if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(requestId) || this.explanations.has(requestId))
            throw new Error('Invalid local explanation request');
        if (!preview || typeof preview !== 'object' || typeof preview.evidenceBasis !== 'string' ||
            typeof preview.projectId !== 'string' || !Array.isArray(preview.items) ||
            Buffer.byteLength(JSON.stringify(preview), 'utf8') > HISTORY_PREVIEW_MAX_BYTES)
            throw new Error('Invalid History preview');
        const controller = new AbortController();
        this.explanations.set(requestId, controller);
        const generation = this.generation;
        try {
            const current = await this.preview(projectHandle, preview.evidenceBasis, selection);
            if (this.disposed || generation !== this.generation || controller.signal.aborted)
                throw new Error('History project changed or explanation cancelled');
            const stable = (value: HistoryContextPreview) => JSON.stringify({ projectId: value.projectId,
                evidenceBasis: value.evidenceBasis, items: value.items.map(item => ({ ...item, observedAt: null })),
                omissions: value.omissions });
            if (stable(current) !== stable(preview)) throw new Error('History preview changed; inspect and confirm again');
            const result = await explainHistoryLocally(current, controller.signal, this.routing, this.models);
            if (this.disposed || generation !== this.generation || controller.signal.aborted ||
                !(await this.verifyPreviewBasis(projectHandle, preview.evidenceBasis)))
                throw new Error('History evidence changed during explanation');
            return result;
        } finally { controller.abort(); this.explanations.delete(requestId); }
    }

    async cancelExplanation(requestId: string): Promise<void> { this.explanations.get(requestId)?.abort(); }

    async recordFocus(projectHandle: string, owner: HistoryFocusTarget): Promise<void> {
        if (this.disposed || !this.project || projectHandle !== this.handle) throw new Error('Invalid History project handle');
        const project = this.project, generation = this.generation;
        const current = () => !this.disposed && generation === this.generation && projectHandle === this.handle;
        const write = this.focusWrite.then(async () => {
            if (!current()) return;
            if ((await this.planning.read(project.projectRoot)).projectId !== project.projectId)
                throw new Error('History project identity changed');
            await writeHistoryFocus(project, owner, current);
        });
        this.focusWrite = write.catch(() => {});
        await write;
    }

    async resolveEditor(projectHandle: string, projectRelativePath: string): Promise<string> {
        if (this.disposed || !this.project || projectHandle !== this.handle) throw new Error('Invalid History project handle');
        const project = this.project, generation = this.generation;
        const parts = typeof projectRelativePath === 'string' ? projectRelativePath.split('/') : [];
        if (!parts.length || projectRelativePath.length > 512 || parts.some(part => !part || part === '.' || part === '..' || part.includes('\\') || part.includes('\0')))
            throw new Error('Unsafe project-relative editor path');
        if (await realpath(project.projectRoot) !== project.projectRoot) throw new Error('Project root moved');
        let file = project.projectRoot;
        for (const [index, part] of parts.entries()) {
            file = join(file, part);
            const info = await lstat(file);
            if (info.isSymbolicLink() || await realpath(file) !== file ||
                (index === parts.length - 1 ? !info.isFile() : !info.isDirectory()))
                throw new Error('Unsafe editor path');
        }
        if (this.disposed || generation !== this.generation || projectHandle !== this.handle ||
            (await this.planning.read(project.projectRoot)).projectId !== project.projectId)
            throw new Error('History project changed during editor validation');
        return pathToFileURL(file).toString();
    }

    dispose(): void { this.disposed = true; ++this.generation; this.project = undefined;
        for (const controller of this.explanations.values()) controller.abort(); }
}
