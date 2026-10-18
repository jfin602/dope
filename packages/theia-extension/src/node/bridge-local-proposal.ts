import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { projectPath } from '@dope/software-map';
import { sameSemanticBasis, type PlanningMap } from '@dope/visual-planning';
import type { WorkItemSuggestion } from '@dope/visual-planning';
import type { EditCommand } from '@dope/visual-planning/lib/editing';
import type { VisualPlanningService } from '@dope/visual-planning/lib/service';
import type { ChatTurnRequest } from '@dope/chat/lib/service';

type Selection = NonNullable<ChatTurnRequest['bridgeProposal']>;
const exact = (value: Record<string, unknown>, keys: string[]) =>
    Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const strings = (value: unknown, max: number): value is string[] =>
    Array.isArray(value) && value.length <= max && value.every(item => typeof item === 'string' &&
        item.trim() === item && item.length > 0 && item.length <= 400);
function commandShape(value: Record<string, unknown>): boolean {
    const shapes: Record<string, string[]> = {
        add: ['kind', 'node'], move: ['kind', 'id', 'parentId'], remove: ['kind', 'id'],
        'draw-relationship': ['kind', 'sourceId', 'targetId'],
        'redirect-relationship': ['kind', 'from', 'to'],
        modify: ['kind', 'currentIds', 'futureNodes'],
        'change-contract': ['kind', 'currentIds', 'futureNodes'],
        split: ['kind', 'currentIds', 'futureNodes'], merge: ['kind', 'currentIds', 'futureNodes'],
    };
    return typeof value.kind === 'string' && Object.hasOwn(shapes, value.kind) &&
        exact(value, shapes[value.kind]);
}
function commandInScope(command: Record<string, unknown>, branches: readonly string[]): boolean {
    const selected = new Set(branches);
    const ids = command.kind === 'add' ? [((command.node as Record<string, unknown>)?.parentId)] :
        command.kind === 'move' ? [command.id, command.parentId] :
        command.kind === 'remove' ? [command.id] :
        command.kind === 'draw-relationship' ? [command.sourceId, command.targetId] :
        command.kind === 'redirect-relationship' ?
            [((command.from as Record<string, unknown>)?.sourceId), ((command.from as Record<string, unknown>)?.targetId),
                ((command.to as Record<string, unknown>)?.sourceId), ((command.to as Record<string, unknown>)?.targetId)] :
            Array.isArray(command.currentIds) ? command.currentIds : [];
    return ids.length > 0 && ids.every(id => typeof id === 'string' && selected.has(id));
}

/** A disposable, owner-backed context. Chat holds no Planning Map writer or approval authority. */
export class BridgeLocalProposal {
    private constructor(private readonly service: VisualPlanningService, private readonly handle: string,
        private readonly selection: Selection, private readonly map: PlanningMap,
        private readonly collectionRevision: number, private readonly evidencePaths: string[],
        private readonly approvedSuggestions: WorkItemSuggestion[],
        readonly instruction: string) {}

    get reference() {
        return { schemaVersion: 1 as const, kind: 'planning-map' as const, id: this.map.id,
            label: `Bridge impact and Planning Map ${this.map.id} revision ${this.map.revision}`,
            projectId: this.map.projectId, ownerRevision: this.map.revision,
            estimatedTokens: Math.ceil(Buffer.byteLength(this.instruction, 'utf8') / 3),
            includedBytes: Buffer.byteLength(this.instruction, 'utf8'),
            contentHash: createHash('sha256').update(this.instruction).digest('hex') };
    }

    static async prepare(service: VisualPlanningService, root: string, selection: Selection): Promise<BridgeLocalProposal> {
        if (!selection || !selection.projectId || !selection.checkpointId || !selection.mapId ||
            !Number.isSafeInteger(selection.roadmapRevision) || !Number.isSafeInteger(selection.mapRevision) ||
            !Array.isArray(selection.branchIds) || !selection.branchIds.length || selection.branchIds.length > 8 ||
            new Set(selection.branchIds).size !== selection.branchIds.length ||
            selection.branchIds.some(id => typeof id !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(id)))
            throw new Error('Select a current checkpoint, map and affected Architecture branches');
        const handle = (await service.attach(pathToFileURL(root).href)).projectHandle;
        const collection = await service.read(handle);
        const map = collection.maps.find(item => item.id === selection.mapId);
        if (!map || map.projectId !== collection.projectId || map.revision !== selection.mapRevision ||
            !['draft', 'active'].includes(map.status)) throw new Error('Stale or foreign Bridge Planning Map');
        const impact = await service.currentSoftwareImpact({ projectHandle: handle,
            projectId: selection.projectId, checkpointId: selection.checkpointId,
            expectedRoadmapRevision: selection.roadmapRevision, branchIds: selection.branchIds });
        if (impact.status !== 'ready' || impact.checkpoint?.id !== selection.checkpointId ||
            impact.roadmapRevision !== selection.roadmapRevision || !impact.basis ||
            !sameSemanticBasis(impact.basis, map.basis) ||
            impact.planningMap?.id !== map.id || impact.planningMap.revision !== map.revision)
            throw new Error(`Bridge impact requires current owner review: ${impact.reason ?? impact.status}`);
        const target = map.transformations.length ? await service.targetDesign(handle, map.id,
            collection.revision, map.revision) : undefined;
        const approvedSuggestions = target && await service.targetApproved(handle, selection.checkpointId,
            selection.branchIds) ? await service.suggestApprovedWorkItems(handle, selection.checkpointId,
                selection.branchIds) : [];
        const paths = impact.sources.map(source => projectPath(source.path));
        const payload = { selected: { projectId: selection.projectId, checkpointId: selection.checkpointId,
            roadmapRevision: selection.roadmapRevision, mapId: map.id, mapRevision: map.revision,
            basis: map.basis, collectionRevision: collection.revision }, impact,
            target: target ? { diff: target.diff, nodes: target.target.nodes.slice(0, 24),
                relationships: target.target.relationships.slice(0, 24) } : { state: 'no target transformations yet' },
            workItems: map.workItems.map(item => ({ id: item.id, transformationIds: item.transformationIds,
                dependsOn: item.dependsOn })).slice(0, 24),
            transformations: map.transformations.map(item => ({ id: item.id, kind: item.kind,
                dependsOn: item.dependsOn })).slice(0, 24),
            approvedWorkItemSuggestions: approvedSuggestions.slice(0, 12) };
        const instruction = 'Bridge proposal mode. Use only this owner-checked evidence. Return one strict JSON object: ' +
            '{"type":"bridge-proposal","projectId":"...","checkpointId":"...","roadmapRevision":1,' +
            '"mapId":"...","mapRevision":1,"basis":{},"suggestion":{"kind":"target","transformationId":"...","command":{}}' +
            ',"questions":[]} or use suggestion {"kind":"work-item","objective":"...","transformationIds":[],' +
            '"dependsOn":[],"acceptanceCriteria":[],"validationTargets":[],"workingSet":[]}.' +
            ' Copy identities, revisions and basis exactly. A target command uses existing Planning edit kinds and must be previewable.' +
            ' A WorkItem suggestion requires an approved target and must use a listed approved transformation group,' +
            ' existing WorkItem dependencies and evidenced source paths.' +
            ' If evidence is insufficient or the user asks a question, return {"type":"no-action","message":"one useful answer or question"}.' +
            ' This is inspection only; the developer must review and explicitly approve any change in Planning Map.' +
            ' Never claim a write, adoption or Run occurred. Evidence: ' + JSON.stringify(payload);
        return new BridgeLocalProposal(service, handle, selection, map, collection.revision, paths,
            approvedSuggestions, instruction);
    }

    async validate(raw: Record<string, unknown>): Promise<boolean> {
        if (!exact(raw, ['type', 'projectId', 'checkpointId', 'roadmapRevision', 'mapId', 'mapRevision', 'basis', 'suggestion', 'questions']) ||
            raw.type !== 'bridge-proposal' || raw.projectId !== this.selection.projectId ||
            raw.checkpointId !== this.selection.checkpointId || raw.roadmapRevision !== this.selection.roadmapRevision ||
            raw.mapId !== this.map.id || raw.mapRevision !== this.map.revision ||
            JSON.stringify(raw.basis) !== JSON.stringify(this.map.basis) ||
            !strings(raw.questions, 3) || !raw.suggestion || typeof raw.suggestion !== 'object' ||
            Array.isArray(raw.suggestion)) return false;
        const suggestion = raw.suggestion as Record<string, unknown>;
        if (suggestion.kind === 'target') {
            if (!exact(suggestion, ['kind', 'transformationId', 'command']) ||
                typeof suggestion.transformationId !== 'string' ||
                !/^[A-Za-z][A-Za-z0-9._-]*$/.test(suggestion.transformationId) ||
                !suggestion.command || typeof suggestion.command !== 'object' || Array.isArray(suggestion.command) ||
                !commandShape(suggestion.command as Record<string, unknown>) ||
                !commandInScope(suggestion.command as Record<string, unknown>, this.selection.branchIds)) return false;
            try { await this.service.preview(this.handle, this.map.id, this.collectionRevision, this.map.revision,
                suggestion.command as EditCommand, suggestion.transformationId); }
            catch { return false; }
        } else if (suggestion.kind === 'work-item') {
            if (!exact(suggestion, ['kind', 'objective', 'transformationIds', 'dependsOn', 'acceptanceCriteria',
                'validationTargets', 'workingSet']) || typeof suggestion.objective !== 'string' ||
                !suggestion.objective.trim() || suggestion.objective.length > 600 ||
                !this.approvedSuggestions.length ||
                !strings(suggestion.transformationIds, 12) || !suggestion.transformationIds.length ||
                new Set(suggestion.transformationIds).size !== suggestion.transformationIds.length ||
                !this.approvedSuggestions.some(item => JSON.stringify([...item.transformationIds].sort()) ===
                    JSON.stringify([...(suggestion.transformationIds as string[])].sort())) ||
                !suggestion.transformationIds.every(id => this.map.transformations.some(item => item.id === id)) ||
                !suggestion.transformationIds.every(id => {
                    const item = this.map.transformations.find(candidate => candidate.id === id)!;
                    return [...item.currentIds, ...item.futureNodes.map(node => node.parentId ?? node.id)]
                        .some(identity => this.selection.branchIds.includes(identity));
                }) ||
                !strings(suggestion.dependsOn, 12) ||
                new Set(suggestion.dependsOn).size !== suggestion.dependsOn.length ||
                !suggestion.dependsOn.every(id => this.map.workItems.some(item => item.id === id)) ||
                !strings(suggestion.acceptanceCriteria, 8) || !suggestion.acceptanceCriteria.length ||
                !strings(suggestion.validationTargets, 8) || !suggestion.validationTargets.length ||
                !strings(suggestion.workingSet, 24) ||
                !suggestion.workingSet.every(path => this.evidencePaths.includes(path))) return false;
        } else return false;
        const fresh = await this.service.read(this.handle);
        const map = fresh.maps.find(item => item.id === this.map.id);
        return fresh.revision === this.collectionRevision && map?.revision === this.map.revision &&
            JSON.stringify(map.basis) === JSON.stringify(this.map.basis) &&
            (await this.service.currentSoftwareImpact({ projectHandle: this.handle,
                projectId: this.selection.projectId, checkpointId: this.selection.checkpointId,
                expectedRoadmapRevision: this.selection.roadmapRevision,
                branchIds: this.selection.branchIds })).status === 'ready';
    }
}
