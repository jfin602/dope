import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { closeSync, fsyncSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { discoverRoadmapCandidates, roadmapSectionKey } from './roadmap-import';
import { RoadmapStore } from './roadmap-store';
import type { RoadmapIndex } from './roadmap-store';
import type { RoadmapGateIndex, RoadmapGate, RoadmapPhase } from './roadmap-gate-domain';

/** Historical implementation/task outline content. It never becomes a qualification Gate. */
export interface GreenfieldCheckpoint { id: string; title: string; objective: string; dependencies?: string[] }
export interface GreenfieldCriterion { id: string; title: string; expectedResult: string }
export interface GreenfieldGate { id: string; parentPhaseId: string; designation: string; title: string;
    purpose: string; criteria: GreenfieldCriterion[]; dependencies?: string[] }
export interface GreenfieldPhase { id: string; title: string; objective: string; checkpoints: GreenfieldCheckpoint[];
    gates?: GreenfieldGate[]; kind?: 'correction'; parentId?: string }
export interface GreenfieldDraft { revision: number; phases: GreenfieldPhase[] }
/** A reviewed, noncanonical plan associated with one Greenfield draft and its saved Chat. */
export interface ImplementationPlanStep { id: string; title: string; detail: string; expectedOutputs: string[];
    dependencies: string[]; evidenceIds: string[] }
export interface ImplementationPlanEvidence { id: string; path: string; sha256: string }
export interface ImplementationPlanDecision { text: string; origin: 'developer' | 'model-assumption' }
export interface ImplementationPlanDraft { schemaVersion: 1; revision: number; status: 'accepted'; objective: string;
    constraints: string[]; steps: ImplementationPlanStep[]; evidence: ImplementationPlanEvidence[];
    decisions: ImplementationPlanDecision[]; source: { projectId: string; roadmapRevision: number;
        draftRevision: number } }
export type ImplementationPlanInput = Pick<ImplementationPlanDraft, 'objective' | 'constraints' | 'evidence' | 'decisions'> & {
    steps: (Omit<ImplementationPlanStep, 'id'> & { id?: string })[] };
/** Model-suggested indexes refer to the accepted plan at the start of the turn. */
export interface ImplementationPlanRevision {
    type: 'implementation-plan-revision'; baseRevision: number;
    edits: ({ type: 'update'; step: number; title?: string; detail?: string } |
        { type: 'merge'; first: number; second: number; title: string; detail: string } |
        { type: 'move'; step: number; before: number } |
        { type: 'split'; step: number; title: string; detail: string } |
        { type: 'add'; before: number; title: string; detail: string })[];
    constraintsAdd: string[]; decisionsAdd: string[]; question: string;
}
export interface ImplementationPlanPreview { token: string; draftRevision: number; planRevision: number;
    before?: ImplementationPlanDraft; after: Omit<ImplementationPlanDraft, 'status'> & { status: 'proposed' }; requiresApproval: true }
export interface ImplementationPlanProjectionPreview { token: string; handle: string; planRevision: number;
    ownerRevision: number; draft: GreenfieldDraft; requiresApproval: true }
export type GreenfieldEdit =
    | { type: 'create-phase'; title: string; objective?: string }
    | { type: 'create-gate'; phaseId: string; title: string; purpose: string }
    | { type: 'edit-gate'; phaseId: string; gateId: string; title?: string; purpose?: string }
    | { type: 'add-criterion'; phaseId: string; gateId: string; title: string; expectedResult: string }
    | { type: 'edit-criterion'; phaseId: string; gateId: string; criterionId: string;
        title?: string; expectedResult?: string }
    | { type: 'create-checkpoint'; phaseId: string; title: string; objective?: string }
    | { type: 'edit-phase'; phaseId: string; title?: string; objective?: string }
    | { type: 'edit-checkpoint'; phaseId: string; checkpointId: string; title?: string; objective?: string }
    | { type: 'reorder-phase'; phaseId: string; order: number }
    | { type: 'reorder-checkpoint'; phaseId: string; checkpointId: string; order: number }
    | { type: 'split-checkpoint'; phaseId: string; checkpointId: string; title: string; objective?: string }
    | { type: 'move-checkpoint'; phaseId: string; checkpointId: string; targetPhaseId: string; order: number }
    | { type: 'add-dependency' | 'remove-dependency'; checkpointId: string; dependencyId: string }
    | { type: 'create-correction'; parentId: string; title: string; objective?: string }
    | { type: 'attach-correction'; correctionId: string; parentId: string };
export interface GreenfieldPreview { token: string; draftRevision: number; path: string; markdown: string;
    phases: GreenfieldPhase[]; gates: GreenfieldGate[]; unresolvedCoverage: string[]; requiresApproval: true }
export interface GreenfieldEditPreview { token: string; draftRevision: number; before: GreenfieldDraft;
    after: GreenfieldDraft; action: GreenfieldEdit; actions?: GreenfieldEdit[]; requiresApproval: true }
export interface StrategicDraftInput { projectId: string; ownerRevision: number; allowIncomplete?: true; phases: {
    title: string; objective: string; checkpoints: { title: string; objective: string; dependsOn: number[] }[];
    gates?: { title: string; purpose: string; criteria: { title: string; expectedResult: string }[] }[] }[] }
export interface StrategicDraftPreview { token: string; handle: string; projectId: string; ownerRevision: number;
    draftRevision: number; sourceHash: string; before: GreenfieldDraft; after: GreenfieldDraft; requiresApproval: true }
/** Noncanonical presentation notification. A proposed value is a fully validated preview, never an accepted edit. */
export interface GreenfieldChange { root: string; projectId: string; handle: string; revision: number;
    epoch: string; sequence: number; kind: 'accepted' | 'proposed' | 'cleared' | 'cancelled' | 'plan'; draft?: GreenfieldDraft }

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const line = (value: unknown, max: number): value is string => typeof value === 'string' &&
    value.length <= max && !/[\r\n\0\x00-\x08\x0b-\x1f]/.test(value);
const title = (value: unknown): value is string => line(value, 200) && !!value.trim() &&
    !/^#{1,6}\s/.test(value) && !/^\s/.test(value) && !/\s$/.test(value);
const objective = (value: unknown): value is string => line(value, 8192);
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const stableId = (value: string): string => {
    const hex = hash(value);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

/** Keep engineering detail in the plan; Roadmap gets one checkpoint per reviewed outcome. */
export function projectImplementationPlan(plan: ImplementationPlanDraft): GreenfieldDraft {
    const levels = new Map<string, number>();
    for (const step of plan.steps) {
        if (step.dependencies.some(id => !levels.has(id))) throw new Error('Plan dependencies must precede their outcomes');
        levels.set(step.id, Math.max(0, ...step.dependencies.map(id => levels.get(id)! + 1)));
    }
    const groups = new Map<number, ImplementationPlanStep[]>();
    for (const step of plan.steps) groups.set(levels.get(step.id)!, [...groups.get(levels.get(step.id)!) ?? [], step]);
    if (!groups.size || groups.size > 32) throw new Error('Plan exceeds strategic phase limit');
    const phases: GreenfieldPhase[] = [...groups].map(([level, steps], index) => ({
        id: stableId(`plan-phase:${plan.source.projectId}:${level}`),
        title: `Stage ${index + 1} — ${steps[0].title}`.slice(0, 200),
        objective: index === 0 ? plan.objective : `Reviewed implementation outcomes after stage ${index}`,
        checkpoints: steps.map(step => ({ id: stableId(`plan-step:${step.id}`), title: step.title,
            objective: [step.detail, ...step.expectedOutputs.map(output => `Output: ${output}`)].join(' | '),
            dependencies: step.dependencies.map(id => stableId(`plan-step:${id}`)) }))
    }));
    const projected: GreenfieldDraft = { revision: 1, phases };
    if (!validDraft(projected)) throw new Error('Plan cannot be projected to a unique Roadmap graph');
    return projected;
}
const MAX_DRAFT_BYTES = 512 * 1024;
const uuid = (value: unknown): value is string => typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const fields = (value: object, required: string[], optional: string[] = []): boolean =>
    required.every(key => Object.hasOwn(value, key)) &&
    Object.keys(value).every(key => required.includes(key) || optional.includes(key));
type StoredDraft = { handle: string; projectId: string; value: GreenfieldDraft; chatId?: string;
    implementationPlan?: ImplementationPlanDraft; planOnly?: true; ownerRevision?: number };
type DraftFile = { schemaVersion: 1; revision: number; drafts: StoredDraft[] };

function validPlan(value: unknown, projectId: string): value is ImplementationPlanDraft {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const plan = value as ImplementationPlanDraft;
    if (!fields(plan, ['schemaVersion', 'revision', 'status', 'objective', 'constraints', 'steps', 'evidence', 'decisions', 'source']) ||
        plan.schemaVersion !== 1 || !Number.isSafeInteger(plan.revision) || plan.revision < 1 || plan.status !== 'accepted' ||
        !line(plan.objective, 8192) || !plan.objective.trim() || !Array.isArray(plan.constraints) || plan.constraints.length > 32 ||
        plan.constraints.some(item => !line(item, 2048)) || !Array.isArray(plan.steps) || plan.steps.length > 64 ||
        !Array.isArray(plan.evidence) || plan.evidence.length > 64 || !Array.isArray(plan.decisions) || plan.decisions.length > 32 ||
        !plan.source || !fields(plan.source, ['projectId', 'roadmapRevision', 'draftRevision']) ||
        plan.source.projectId !== projectId ||
        !Number.isSafeInteger(plan.source.roadmapRevision) || plan.source.roadmapRevision < 0 ||
        !Number.isSafeInteger(plan.source.draftRevision) || plan.source.draftRevision < 0) return false;
    const evidenceIds = new Set<string>();
    for (const item of plan.evidence) {
        if (!item || !fields(item, ['id', 'path', 'sha256']) || !uuid(item.id) || evidenceIds.has(item.id) ||
            !line(item.path, 1024) || !item.path || isAbsolute(item.path) || item.path.includes('\\') ||
            item.path.includes(':') || item.path.split('/').some(part => !part || part === '.' || part === '..') ||
            item.path.split('/')[0] === '.dope' ||
            !/^[a-f0-9]{64}$/.test(item.sha256)) return false;
        evidenceIds.add(item.id);
    }
    if (plan.decisions.some(item => !item || !fields(item, ['text', 'origin']) || !line(item.text, 2048) ||
        !item.text.trim() || !['developer', 'model-assumption'].includes(item.origin))) return false;
    const ids = new Set<string>();
    for (const step of plan.steps) {
        if (!step || !fields(step, ['id', 'title', 'detail', 'expectedOutputs', 'dependencies', 'evidenceIds']) ||
            !uuid(step.id) || ids.has(step.id) || !title(step.title) || !line(step.detail, 8192) ||
            !Array.isArray(step.expectedOutputs) || step.expectedOutputs.length > 16 ||
            step.expectedOutputs.some(item => !line(item, 1024) || !item.trim()) ||
            !Array.isArray(step.dependencies) || step.dependencies.length > 64 ||
            step.dependencies.some(id => !uuid(id)) || new Set(step.dependencies).size !== step.dependencies.length ||
            !Array.isArray(step.evidenceIds) || step.evidenceIds.length > 64 ||
            step.evidenceIds.some(id => !evidenceIds.has(id)) || new Set(step.evidenceIds).size !== step.evidenceIds.length)
            return false;
        ids.add(step.id);
    }
    const byId = new Map(plan.steps.map(step => [step.id, step]));
    const visiting = new Set<string>(), visited = new Set<string>();
    const visit = (id: string): boolean => {
        if (visiting.has(id) || !byId.has(id)) return false;
        if (visited.has(id)) return true;
        visiting.add(id);
        for (const dependency of byId.get(id)!.dependencies) if (!visit(dependency)) return false;
        visiting.delete(id); visited.add(id); return true;
    };
    return [...ids].every(visit);
}

function verifyPlanEvidence(root: string, plan: ImplementationPlanDraft): void {
    for (const evidence of plan.evidence) {
        let path = root;
        for (const part of evidence.path.split('/')) {
            path = join(path, part);
            if (lstatSync(path).isSymbolicLink()) throw new Error('Plan source changed or became a symlink');
        }
        const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const before = fstatSync(fd);
            if (!before.isFile() || before.size > 64 * 1024) throw new Error('Plan source changed or exceeds read limit');
            const content = readFileSync(fd, 'utf8');
            const after = fstatSync(fd);
            if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
                hash(content) !== evidence.sha256) throw new Error('Plan source changed; review the new source before projection');
        } finally { closeSync(fd); }
    }
}

/** Apply only named changes. IDs, inherited decisions, evidence and constraints stay app-owned. */
export function reviseImplementationPlan(base: ImplementationPlanDraft,
    revision: ImplementationPlanRevision): ImplementationPlanInput {
    if (revision.baseRevision !== base.revision || !revision.edits.length || revision.edits.length > 8)
        throw new Error('Stale or empty implementation plan revision');
    const steps: ImplementationPlanInput['steps'] = copy(base.steps);
    const ids = base.steps.map(step => step.id);
    const at = (number: number): string => {
        if (!Number.isSafeInteger(number) || number < 1 || number > ids.length)
            throw new Error('Invalid implementation plan step number');
        return ids[number - 1];
    };
    const position = (id: string): number => {
        const index = steps.findIndex(step => step.id === id);
        if (index < 0) throw new Error('Implementation plan step already changed');
        return index;
    };
    const used = new Set<string>();
    for (const edit of revision.edits) {
        const targets = edit.type === 'merge' ? [at(edit.first), at(edit.second)] :
            edit.type === 'add' ? [] : [at(edit.step)];
        if (targets.some(id => used.has(id))) throw new Error('Conflicting implementation plan edits');
        targets.forEach(id => used.add(id));
        if (edit.type === 'add') {
            steps.splice(position(at(edit.before)), 0, { title: edit.title, detail: edit.detail,
                expectedOutputs: [], dependencies: [], evidenceIds: [] });
            continue;
        }
        const id = targets[0], index = position(id);
        if (edit.type === 'update') {
            if (edit.title !== undefined) steps[index].title = edit.title;
            if (edit.detail !== undefined) steps[index].detail = edit.detail;
        } else if (edit.type === 'merge') {
            const removed = targets[1];
            if (id === removed || position(removed) !== index + 1)
                throw new Error('Only adjacent implementation plan steps may merge');
            const next = steps[index + 1];
            steps[index] = { ...steps[index], title: edit.title, detail: edit.detail,
                expectedOutputs: [...new Set([...steps[index].expectedOutputs, ...next.expectedOutputs])],
                evidenceIds: [...new Set([...steps[index].evidenceIds, ...next.evidenceIds])],
                dependencies: [...new Set([...steps[index].dependencies, ...next.dependencies.filter(dep => dep !== id)])] };
            steps.splice(index + 1, 1);
            for (const step of steps) step.dependencies = [...new Set(step.dependencies.map(dep => dep === removed ? id : dep))];
        } else if (edit.type === 'move') {
            const before = at(edit.before);
            if (before === id) throw new Error('Implementation plan move has no effect');
            const [moving] = steps.splice(index, 1);
            steps.splice(position(before), 0, moving);
        } else if (edit.type === 'split') {
            steps.splice(index + 1, 0, { title: edit.title, detail: edit.detail,
                expectedOutputs: [], dependencies: [id], evidenceIds: [] });
        }
    }
    for (const [index, step] of steps.entries())
        if (step.dependencies.some(dep => steps.findIndex(item => item.id === dep) >= index))
            throw new Error('Implementation plan dependency order or cycle');
    return { objective: base.objective, constraints: [...base.constraints, ...revision.constraintsAdd],
        evidence: copy(base.evidence), decisions: [...copy(base.decisions), ...revision.decisionsAdd.map(text =>
            ({ text, origin: 'model-assumption' as const }))], steps };
}

function validDraft(value: unknown): value is GreenfieldDraft {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const draft = value as GreenfieldDraft;
    if (!fields(draft, ['revision', 'phases']) || !Number.isSafeInteger(draft.revision) || draft.revision < 0 ||
        !Array.isArray(draft.phases) || draft.phases.length > 32) return false;
    let checkpoints = 0;
    const ids = new Set<string>();
    const keys = new Set<string>();
    const dependencies = new Map<string, string[]>();
    for (const [index, phase] of draft.phases.entries()) {
        if (!phase || !fields(phase, ['id', 'title', 'objective', 'checkpoints'], ['gates', 'kind', 'parentId']) || !uuid(phase.id) ||
            ids.has(phase.id) || !title(phase.title) || !objective(phase.objective) ||
            !Array.isArray(phase.checkpoints) || (phase.kind !== undefined && phase.kind !== 'correction') ||
            (phase.kind === 'correction' ? !uuid(phase.parentId) || phase.parentId === phase.id ||
                phase.checkpoints.some(item => item.id === phase.parentId) : phase.parentId !== undefined)) return false;
        ids.add(phase.id);
        if (phase.parentId) dependencies.set(phase.id, [phase.parentId]);
        const phaseKey = roadmapSectionKey(phase.kind === 'correction' ? `Correction ${phase.title}` :
            `Phase ${draft.phases.slice(0, index + 1).filter(item => !item.kind).length} — ${phase.title}`, true);
        if (!phaseKey || keys.has(phaseKey)) return false;
        keys.add(phaseKey);
        if (phase.gates !== undefined && (!Array.isArray(phase.gates) || phase.gates.length > 128 || phase.kind)) return false;
        const designations = new Set<string>();
        for (const gate of phase.gates ?? []) {
            if (!gate || !fields(gate, ['id', 'parentPhaseId', 'designation', 'title', 'purpose', 'criteria'], ['dependencies']) ||
                !uuid(gate.id) || ids.has(gate.id) || gate.parentPhaseId !== phase.id ||
                !/^G[1-9]\d*$/.test(gate.designation) || designations.has(gate.designation) ||
                !title(gate.title) || !objective(gate.purpose) || !Array.isArray(gate.criteria) ||
                gate.criteria.length > 128 || gate.dependencies !== undefined &&
                (!Array.isArray(gate.dependencies) || gate.dependencies.length > 128 ||
                    gate.dependencies.some(id => !uuid(id)) || new Set(gate.dependencies).size !== gate.dependencies.length)) return false;
            ids.add(gate.id); designations.add(gate.designation);
            dependencies.set(gate.id, gate.dependencies ?? []);
            for (const criterion of gate.criteria) {
                if (!criterion || !fields(criterion, ['id', 'title', 'expectedResult']) || !uuid(criterion.id) ||
                    ids.has(criterion.id) || !title(criterion.title) || !objective(criterion.expectedResult)) return false;
                ids.add(criterion.id);
            }
        }
        for (const checkpoint of phase.checkpoints) {
            checkpoints++;
            if (!checkpoint || !fields(checkpoint, ['id', 'title', 'objective'], ['dependencies']) || !uuid(checkpoint.id) ||
                ids.has(checkpoint.id) || !title(checkpoint.title) ||
                !objective(checkpoint.objective) || (checkpoint.dependencies !== undefined &&
                    (!Array.isArray(checkpoint.dependencies) || checkpoint.dependencies.length > 128 ||
                        checkpoint.dependencies.some(id => !uuid(id)) ||
                        new Set(checkpoint.dependencies).size !== checkpoint.dependencies.length))) return false;
            ids.add(checkpoint.id);
            dependencies.set(checkpoint.id, checkpoint.dependencies ?? []);
            const key = roadmapSectionKey(`Milestone ${checkpoint.title}`, true);
            if (!key || keys.has(key)) return false;
            keys.add(key);
        }
    }
    if (checkpoints > 256) return false;
    const visiting = new Set<string>(), visited = new Set<string>();
    const visit = (id: string): boolean => {
        if (!ids.has(id) || visiting.has(id)) return false;
        if (visited.has(id)) return true;
        visiting.add(id);
        for (const dependency of dependencies.get(id) ?? []) if (!visit(dependency)) return false;
        visiting.delete(id); visited.add(id); return true;
    };
    return [...ids].every(visit);
}

/** A local, disposable draft. Only an approved preview crosses into the Roadmap owner. */
export class RoadmapGreenfield {
    private readonly strategicPreviews = new Map<string, { root: string; preview: StrategicDraftPreview }>();
    private readonly drafts = new Map<string, { root: string; projectId: string; value: GreenfieldDraft;
        implementationPlan?: ImplementationPlanDraft; planOnly?: true; ownerRevision?: number }>();
    private readonly chats = new Map<string, { root: string; handle: string }>();
    private readonly generations = new Map<string, number>();
    private readonly editPreviews = new Map<string, GreenfieldEditPreview>();
    private readonly planPreviews = new Map<string, ImplementationPlanPreview>();
    private readonly projectionPreviews = new Map<string, ImplementationPlanProjectionPreview>();
    private readonly planHistory = new Map<string, { before: ImplementationPlanDraft; revision: number }>();
    private readonly creationPreviews = new Map<string, string>();
    private readonly history = new Map<string, { before: GreenfieldDraft; after: GreenfieldDraft; redo?: boolean }>();
    private readonly accepting = new Set<string>();
    private readonly listeners = new Set<(change: GreenfieldChange) => void>();
    private readonly eventEpoch = randomUUID();
    private readonly sequences = new Map<string, number>();
    constructor(private readonly store: RoadmapStore) {}

    onChange(listener: (change: GreenfieldChange) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private announce(handle: string, kind: GreenfieldChange['kind'], draft?: GreenfieldDraft): void {
        const entry = this.drafts.get(handle);
        if (!entry) return;
        const change: GreenfieldChange = { root: entry.root, projectId: entry.projectId, handle,
            revision: entry.value.revision, epoch: this.eventEpoch,
            sequence: (this.sequences.get(handle) ?? 0) + 1, kind,
            ...(draft ? { draft: copy(draft) } : {}) };
        this.sequences.set(handle, change.sequence);
        for (const listener of this.listeners) {
            try { listener(change); } catch { /* Presentation delivery cannot roll back an accepted draft. */ }
        }
    }

    private paths(root: string, create = false): { directory: string; file: string } {
        if (!isAbsolute(root) || resolve(root) !== root || !lstatSync(root).isDirectory())
            throw new Error('Invalid greenfield project root');
        const directory = join(root, '.dope');
        let info: ReturnType<typeof lstatSync> | undefined;
        try { info = lstatSync(directory); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        if (create && !info) {
            mkdirSync(directory, { mode: 0o700 });
            info = lstatSync(directory);
            const parent = openSync(root, constants.O_RDONLY | constants.O_DIRECTORY);
            try { fsyncSync(parent); } finally { closeSync(parent); }
        }
        if (info) {
            if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe greenfield draft directory');
        }
        return { directory, file: join(directory, 'roadmap-drafts.json') };
    }

    private file(root: string): DraftFile {
        const { file } = this.paths(root);
        let info: ReturnType<typeof lstatSync>;
        try { info = lstatSync(file); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { schemaVersion: 1, revision: 0, drafts: [] };
            throw error;
        }
        if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_DRAFT_BYTES)
            throw new Error('Unsafe or oversized greenfield draft file');
        let parsed: unknown;
        const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            if (!fstatSync(fd).isFile() || fstatSync(fd).size > MAX_DRAFT_BYTES) throw new Error('Unsafe greenfield draft file');
            parsed = JSON.parse(readFileSync(fd, 'utf8'));
        } catch { throw new Error('Corrupt or unsafe greenfield draft file'); }
        finally { closeSync(fd); }
        const value = parsed as DraftFile;
        if (!value || !fields(value, ['schemaVersion', 'revision', 'drafts']) ||
            value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
            !Array.isArray(value.drafts) || value.drafts.length > 8 ||
            value.drafts.some(item => !item || !fields(item, ['handle', 'projectId', 'value'],
                ['chatId', 'implementationPlan', 'planOnly', 'ownerRevision']) ||
                !uuid(item.handle) || !line(item.projectId, 256) || !item.projectId ||
                item.chatId !== undefined && !uuid(item.chatId) || !validDraft(item.value) ||
                (item.planOnly === true ? item.value.revision !== 0 || item.value.phases.length !== 0 ||
                    !Number.isSafeInteger(item.ownerRevision) || item.ownerRevision! < 0 :
                    item.planOnly !== undefined || item.ownerRevision !== undefined) ||
                item.implementationPlan !== undefined && !validPlan(item.implementationPlan, item.projectId)) ||
            new Set(value.drafts.map(item => item.handle)).size !== value.drafts.length ||
            new Set(value.drafts.map(item => item.chatId).filter(Boolean)).size !== value.drafts.filter(item => item.chatId).length)
            throw new Error('Corrupt or unsupported greenfield draft file');
        return value;
    }

    private assertUninitialized(root: string): void {
        const file = join(this.paths(root).directory, 'roadmap.json');
        try { lstatSync(file); throw new Error('Stale greenfield Roadmap owner'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }

    private assertNoCanonicalMarkdown(root: string): void {
        try { lstatSync(join(root, 'ROADMAP.md')); throw new Error('Existing canonical Roadmap requires reviewed import'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }

    private async assertNoRoadmapSource(root: string): Promise<void> {
        this.assertNoCanonicalMarkdown(root);
        if ((await discoverRoadmapCandidates(root)).candidates.length)
            throw new Error('Existing Roadmap Markdown candidate requires reviewed import');
    }

    /** Restore only accepted draft state. Approval previews are never serialized. */
    async restore(root: string): Promise<{ handle: string; draft: GreenfieldDraft; chatId?: string }[]> {
        if ([...this.accepting].some(handle => this.drafts.get(handle)?.root === root))
            throw new Error('Greenfield draft acceptance in progress');
        const owner = await this.store.read(root);
        const file = this.file(root);
        if (file.drafts.length && (file.drafts.some(item => item.projectId !== owner.projectId) ||
            file.drafts.some(item => !item.planOnly && (owner.revision || owner.linkedDocument || owner.pendingCreation))))
            throw new Error('Stale greenfield draft owner');
        for (const [handle, entry] of this.drafts) if (entry.root === root) {
            this.drafts.delete(handle);
            this.history.delete(handle);
            this.editPreviews.delete(handle);
            this.planPreviews.delete(handle);
            this.projectionPreviews.delete(handle);
            this.creationPreviews.delete(handle);
        }
        for (const [id, binding] of this.chats) if (binding.root === root) this.chats.delete(id);
        for (const item of file.drafts) {
            this.drafts.set(item.handle, { root, projectId: item.projectId, value: copy(item.value),
                ...(item.implementationPlan ? { implementationPlan: copy(item.implementationPlan) } : {}),
                ...(item.planOnly ? { planOnly: true, ownerRevision: item.ownerRevision } : {}) });
            if (item.chatId) this.chats.set(item.chatId, { root, handle: item.handle });
        }
        this.generations.set(root, file.revision);
        return file.drafts.filter(item => !item.planOnly).map(item => ({ handle: item.handle, draft: copy(item.value),
            ...(item.chatId ? { chatId: item.chatId } : {}) }));
    }

    async ensureRestored(root: string): Promise<void> {
        if (!this.generations.has(root)) await this.restore(root);
    }

    async list(root: string): Promise<{ handle: string; draft: GreenfieldDraft; chatId?: string;
        plan?: ImplementationPlanDraft }[]> {
        await this.ensureRestored(root);
        return this.entries(root).filter(item => !item.planOnly).map(item => ({ handle: item.handle, draft: copy(item.value),
            ...(item.chatId ? { chatId: item.chatId } : {}),
            ...(item.implementationPlan ? { plan: copy(item.implementationPlan) } : {}) }));
    }

    /** Read-only opportunity snapshot for ordinary Chat; no draft or owner is created. */
    async readOpportunity(root: string): Promise<{ projectId: string; revision: number;
        linkedDocument?: string; canonicalMarkdown: boolean; pendingCreation: boolean; checkpoints: number;
        gates: number; draftGates: number; proposedGates: number;
        drafts: number; acceptedPlans: number; pendingPlans: number }> {
        const owner = await this.store.read<RoadmapGateIndex>(root);
        await this.ensureRestored(root);
        const entries = this.entries(root);
        const current = await this.store.read<RoadmapGateIndex>(root);
        if (current.projectRoot !== root || current.projectId !== owner.projectId ||
            current.revision !== owner.revision || entries.some(item => item.projectId !== current.projectId ||
                item.planOnly && item.ownerRevision !== current.revision))
            throw new Error('Roadmap owner changed during opportunity read');
        let canonicalMarkdown = false;
        try { lstatSync(join(root, 'ROADMAP.md')); canonicalMarkdown = true; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        return { projectId: current.projectId, revision: current.revision,
            ...(current.linkedDocument ? { linkedDocument: current.linkedDocument.path } : {}),
            canonicalMarkdown, pendingCreation: false, checkpoints: 0,
            gates: current.gates.filter(gate => gate.draftAcceptance !== 'proposed').length,
            draftGates: entries.filter(item => !item.planOnly).reduce((count, item) =>
                count + item.value.phases.reduce((sum, phase) => sum + (phase.gates?.length ?? 0), 0), 0),
            proposedGates: [...this.strategicPreviews.values()].filter(item => item.root === root).reduce((count, item) =>
                count + item.preview.after.phases.reduce((sum, phase) => sum + (phase.gates?.length ?? 0), 0), 0),
            drafts: entries.filter(item => !item.planOnly).length,
            acceptedPlans: entries.filter(item => !!item.implementationPlan).length,
            pendingPlans: entries.filter(item => item.planOnly && !item.implementationPlan).length };
    }

    private persist(root: string, entries: StoredDraft[]): void {
        const { directory, file } = this.paths(root, true);
        const lock = join(directory, 'roadmap-drafts.lock');
        let lockFd: number | undefined;
        for (let attempt = 0; attempt < 2 && lockFd === undefined; attempt++) {
            try { lockFd = openSync(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                const info = lstatSync(lock);
                if (!info.isFile() || info.isSymbolicLink() || info.size > 32) throw new Error('Unsafe greenfield draft lock');
                const reader = openSync(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
                let owner: string;
                try { owner = readFileSync(reader, 'utf8').trim(); } finally { closeSync(reader); }
                if (!/^[1-9]\d*$/.test(owner)) throw new Error('Greenfield draft locked; inspect lock');
                try { process.kill(Number(owner), 0); throw new Error('Greenfield draft locked; retry'); }
                catch (probe) { if ((probe as NodeJS.ErrnoException).code !== 'ESRCH') throw probe; }
                if (lstatSync(lock).ino !== info.ino) throw new Error('Greenfield draft lock changed');
                rmSync(lock);
            }
        }
        if (lockFd === undefined) throw new Error('Greenfield draft locked; retry');
        try {
            writeFileSync(lockFd, `${process.pid}\n`); fsyncSync(lockFd);
            const current = this.file(root);
            if (current.revision !== this.generations.get(root)) throw new Error('Concurrent greenfield draft change; restore and retry');
            const next: DraftFile = { schemaVersion: 1, revision: current.revision + 1, drafts: entries };
            const bytes = Buffer.from(`${JSON.stringify(next)}\n`);
            if (entries.length > 8 || bytes.length > MAX_DRAFT_BYTES) throw new Error('Greenfield draft size limit');
            const temporary = join(directory, `roadmap-drafts.${randomUUID()}.tmp`);
            try {
                const fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
                renameSync(temporary, file);
                const parent = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY);
                try { fsyncSync(parent); } finally { closeSync(parent); }
                this.generations.set(root, next.revision);
            } finally { rmSync(temporary, { force: true }); }
        } finally { closeSync(lockFd); rmSync(lock, { force: true }); }
    }

    private entries(root: string): StoredDraft[] {
        return [...this.drafts].filter(([, entry]) => entry.root === root).map(([handle, entry]) => {
            const chatId = [...this.chats].find(([, binding]) => binding.root === root && binding.handle === handle)?.[0];
            return { handle, projectId: entry.projectId, value: entry.value, ...(chatId ? { chatId } : {}),
                ...(entry.implementationPlan ? { implementationPlan: entry.implementationPlan } : {}),
                ...(entry.planOnly ? { planOnly: true as const, ownerRevision: entry.ownerRevision } : {}) };
        });
    }

    async begin(root: string): Promise<{ handle: string; draft: GreenfieldDraft }> {
        if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
            throw new Error('Invalid greenfield project root');
        const current = await this.store.read(root);
        if (current.revision || current.linkedDocument || current.pendingCreation)
            throw new Error('Roadmap already initialized or creation pending');
        await this.assertNoRoadmapSource(root);
        await this.ensureRestored(root);
        const fresh = await this.store.read(root);
        if (fresh.projectId !== current.projectId || fresh.revision || fresh.linkedDocument || fresh.pendingCreation)
            throw new Error('Stale greenfield project identity');
        const handle = randomUUID();
        const value = { revision: 0, phases: [] };
        this.persist(root, [...this.entries(root), { handle, projectId: current.projectId, value }]);
        this.drafts.set(handle, { root, projectId: current.projectId, value });
        return { handle, draft: copy(value) };
    }

    /** Complete strategic outline stays transient until its own review is approved. */
    async previewStrategicDraft(root: string, input: StrategicDraftInput, sourceHash: string): Promise<StrategicDraftPreview> {
        if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
            throw new Error('Invalid strategic draft project root');
        await this.ensureRestored(root);
        const owner = await this.store.read(root);
        if (!input || input.projectId !== owner.projectId || input.ownerRevision !== owner.revision || owner.revision ||
            owner.linkedDocument || owner.pendingCreation || this.entries(root).length)
            throw new Error('Stale or foreign Roadmap owner or competing draft');
        await this.assertNoRoadmapSource(root);
        if ([...this.strategicPreviews.values()].some(item => item.root === root))
            throw new Error('Another strategic draft awaits review');
        if (!/^[0-9a-f]{64}$/.test(sourceHash) || !input || !fields(input, ['projectId', 'ownerRevision', 'phases'], ['allowIncomplete']) ||
            (input.allowIncomplete !== undefined && input.allowIncomplete !== true) ||
            !Array.isArray(input.phases) || input.phases.length < 1 || input.phases.length > 32)
            throw new Error('Invalid strategic draft phase count or source');
        const handle = randomUUID(), ids: string[] = [];
        let checkpointCount = 0;
        const phases: GreenfieldPhase[] = input.phases.map((phase, phaseIndex) => {
            if (!phase || !fields(phase, ['title', 'objective', 'checkpoints'], ['gates']) ||
                !title(phase.title) || !objective(phase.objective) ||
                (!input.allowIncomplete && !phase.objective.trim()) ||
                !Array.isArray(phase.checkpoints ?? []) || !Array.isArray(phase.gates ?? []) ||
                (!input.allowIncomplete && !(phase.gates?.length || phase.checkpoints?.length)) ||
                (phase.checkpoints?.length ?? 0) > 16 || (phase.gates?.length ?? 0) > 16)
                throw new Error(`Invalid strategic phase ${phaseIndex + 1}: title, objective or requirements missing`);
            const phaseId = stableId(`strategic-phase:${owner.projectId}:${sourceHash}:${phaseIndex}:${phase.title}`);
            return { id: phaseId, title: phase.title, objective: phase.objective,
                gates: (phase.gates ?? []).map((gate, index) => {
                    if (!gate || !fields(gate, ['title', 'purpose', 'criteria']) || !title(gate.title) ||
                        !objective(gate.purpose) || !Array.isArray(gate.criteria) || gate.criteria.length > 16)
                        throw new Error(`Invalid strategic Gate ${phaseIndex + 1}.${index + 1}`);
                    const id = stableId(`strategic-gate:${owner.projectId}:${sourceHash}:${phaseIndex}:${index}`);
                    return { id, parentPhaseId: phaseId, designation: `G${index + 1}`, title: gate.title,
                        purpose: gate.purpose, criteria: gate.criteria.map((criterion, criterionIndex) => {
                            if (!criterion || !fields(criterion, ['title', 'expectedResult']) ||
                                !title(criterion.title) || !objective(criterion.expectedResult))
                                throw new Error('Invalid strategic Gate criterion');
                            return { id: stableId(`strategic-criterion:${id}:${criterionIndex}`),
                                title: criterion.title, expectedResult: criterion.expectedResult };
                        }) };
                }),
                checkpoints: (phase.checkpoints ?? []).map((checkpoint, index) => {
                    checkpointCount++;
                    if (!checkpoint || !fields(checkpoint, ['title', 'objective', 'dependsOn']) ||
                        !title(checkpoint.title) || !objective(checkpoint.objective) ||
                        (!input.allowIncomplete && !checkpoint.objective.trim()) ||
                        !Array.isArray(checkpoint.dependsOn) || checkpoint.dependsOn.length > 128 ||
                        new Set(checkpoint.dependsOn).size !== checkpoint.dependsOn.length ||
                        checkpoint.dependsOn.some(value => !Number.isSafeInteger(value) || value < 1 || value >= checkpointCount))
                        throw new Error(`Invalid strategic checkpoint ${phaseIndex + 1}.${index + 1} or dependency`);
                    const id = stableId(`strategic-checkpoint:${owner.projectId}:${sourceHash}:${checkpointCount}:${checkpoint.title}`);
                    const dependencies = checkpoint.dependsOn.map(number => ids[number - 1]);
                    ids.push(id);
                    return { id, title: checkpoint.title, objective: checkpoint.objective, dependencies };
                }) };
        });
        const before: GreenfieldDraft = { revision: 0, phases: [] };
        const after: GreenfieldDraft = { revision: 1, phases };
        if (checkpointCount > 256 || !validDraft(after) || Buffer.byteLength(JSON.stringify(after), 'utf8') > MAX_DRAFT_BYTES)
            throw new Error('Strategic draft graph is empty, cyclic, duplicated or exceeds size limits');
        const preview: StrategicDraftPreview = { token: randomUUID(), handle, projectId: owner.projectId,
            ownerRevision: owner.revision, draftRevision: 0, sourceHash, before, after, requiresApproval: true };
        this.strategicPreviews.set(preview.token, { root, preview: copy(preview) });
        return copy(preview);
    }

    rejectStrategicDraft(token: string): void { this.strategicPreviews.delete(token); }

    async acceptStrategicDraft(root: string, chatId: string, preview: StrategicDraftPreview,
        currentSourceHash: string): Promise<GreenfieldDraft> {
        const pending = this.strategicPreviews.get(preview?.token);
        this.strategicPreviews.delete(preview?.token);
        if (!pending || pending.root !== root || !uuid(chatId) ||
            JSON.stringify(pending.preview) !== JSON.stringify(preview) || preview.sourceHash !== currentSourceHash)
            throw new Error('Stale strategic draft preview or source');
        await this.ensureRestored(root);
        const owner = await this.store.read(root);
        if (owner.projectId !== preview.projectId || owner.revision !== preview.ownerRevision || owner.revision ||
            owner.linkedDocument || owner.pendingCreation || this.entries(root).length || this.chats.has(chatId))
            throw new Error('Stale or foreign Roadmap owner or competing draft');
        this.persist(root, [{ handle: preview.handle, projectId: preview.projectId, value: preview.after, chatId }]);
        this.drafts.set(preview.handle, { root, projectId: preview.projectId, value: copy(preview.after) });
        this.chats.set(chatId, { root, handle: preview.handle });
        this.announce(preview.handle, 'accepted', preview.after);
        return copy(preview.after);
    }

    /** A plan-only handle shares the Greenfield file/lock without impersonating a canonical Roadmap draft. */
    async beginImplementationPlan(root: string): Promise<{ handle: string; ownerRevision: number }> {
        if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
            throw new Error('Invalid implementation plan project root');
        const owner = await this.store.read(root);
        await this.ensureRestored(root);
        const fresh = await this.store.read(root);
        if (fresh.projectId !== owner.projectId || fresh.revision !== owner.revision ||
            fresh.pendingCreation || this.entries(root).length > 0)
            throw new Error('Stale or existing implementation plan owner');
        const handle = randomUUID(), value: GreenfieldDraft = { revision: 0, phases: [] };
        this.persist(root, [...this.entries(root), { handle, projectId: owner.projectId, value,
            planOnly: true, ownerRevision: owner.revision }]);
        this.drafts.set(handle, { root, projectId: owner.projectId, value, planOnly: true,
            ownerRevision: owner.revision });
        return { handle, ownerRevision: owner.revision };
    }

    cancel(handle: string): void {
        if (this.accepting.has(handle)) throw new Error('Greenfield draft acceptance in progress');
        const entry = this.drafts.get(handle);
        if (entry) this.persist(entry.root, this.entries(entry.root).filter(item => item.handle !== handle));
        this.announce(handle, 'cancelled');
        this.drafts.delete(handle);
        this.sequences.delete(handle);
        this.editPreviews.delete(handle);
        this.planPreviews.delete(handle);
        this.projectionPreviews.delete(handle);
        this.creationPreviews.delete(handle);
        this.history.delete(handle);
        for (const [chatId, binding] of this.chats) if (binding.handle === handle) this.chats.delete(chatId);
    }

    bindChat(root: string, handle: string, chatId: string): void {
        if (this.accepting.has(handle)) throw new Error('Greenfield draft acceptance in progress');
        if (!uuid(chatId) || this.drafts.get(handle)?.root !== root) throw new Error('Foreign greenfield draft');
        if (!this.drafts.get(handle)?.planOnly) this.assertUninitialized(root);
        const entries = this.entries(root).map(item => ({ ...item, ...(item.handle === handle ? { chatId } : {} ) }));
        for (const item of entries) if (item.handle !== handle && item.chatId === chatId) delete item.chatId;
        this.persist(root, entries);
        this.clearEditPreview(handle);
        this.planPreviews.delete(handle);
        const prior = this.chats.get(chatId);
        if (prior) this.planPreviews.delete(prior.handle);
        for (const [id, binding] of this.chats) if (binding.handle === handle || id === chatId) this.chats.delete(id);
        this.chats.set(chatId, { root, handle });
    }

    unbindChat(root: string, handle: string): void {
        if (this.accepting.has(handle)) throw new Error('Greenfield draft acceptance in progress');
        if (this.drafts.get(handle)?.root !== root) throw new Error('Foreign greenfield draft');
        if (!this.drafts.get(handle)?.planOnly) this.assertUninitialized(root);
        const entries = this.entries(root).map(item => ({ ...item }));
        for (const item of entries) if (item.handle === handle) delete item.chatId;
        this.persist(root, entries);
        this.clearEditPreview(handle);
        this.planPreviews.delete(handle);
        for (const [chatId, binding] of this.chats) if (binding.handle === handle) this.chats.delete(chatId);
    }

    chatDraft(root: string, chatId: string): { handle: string; draft: GreenfieldDraft } | undefined {
        const binding = this.chats.get(chatId);
        if (!binding || binding.root !== root) return undefined;
        const entry = this.drafts.get(binding.handle);
        return entry?.root === root && !entry.planOnly ? { handle: binding.handle, draft: copy(entry.value) } : undefined;
    }

    chatImplementationPlan(root: string, chatId: string): { handle: string; planOnly: boolean;
        ownerRevision?: number; plan?: ImplementationPlanDraft } | undefined {
        const binding = this.chats.get(chatId);
        if (!binding || binding.root !== root) return undefined;
        const entry = this.drafts.get(binding.handle);
        return entry?.root === root ? { handle: binding.handle, planOnly: !!entry.planOnly,
            ...(entry.planOnly ? { ownerRevision: entry.ownerRevision } : {}),
            ...(entry.implementationPlan ? { plan: copy(entry.implementationPlan) } : {}) } : undefined;
    }

    owner(root: string): Promise<RoadmapIndex> { return this.store.read(root); }

    draftProjectId(handle: string): string {
        const entry = this.drafts.get(handle);
        if (!entry) throw new Error('Unknown greenfield draft');
        return entry.projectId;
    }

    read(handle: string): GreenfieldDraft {
        const entry = this.drafts.get(handle);
        if (!entry) throw new Error('Unknown greenfield draft');
        return copy(entry.value);
    }

    readImplementationPlan(handle: string): ImplementationPlanDraft | undefined {
        const entry = this.drafts.get(handle);
        if (!entry) throw new Error('Unknown greenfield draft');
        return entry.implementationPlan ? copy(entry.implementationPlan) : undefined;
    }

    async listImplementationPlans(root: string): Promise<{ handle: string; plan: ImplementationPlanDraft }[]> {
        await this.ensureRestored(root);
        return [...this.drafts].filter(([, entry]) => entry.root === root && entry.planOnly && !!entry.implementationPlan)
            .map(([handle, entry]) => ({ handle, plan: copy(entry.implementationPlan!) }));
    }

    clearImplementationPlanProjection(root: string, handle: string): void {
        if (this.drafts.get(handle)?.root !== root) throw new Error('Foreign implementation plan');
        if (this.projectionPreviews.delete(handle)) this.announce(handle, 'cleared');
    }

    async previewImplementationPlanProjection(root: string, handle: string): Promise<ImplementationPlanProjectionPreview> {
        await this.ensureRestored(root);
        const entry = this.drafts.get(handle);
        if (!entry || entry.root !== root || !entry.planOnly || !entry.implementationPlan ||
            entry.value.revision !== 0 || entry.value.phases.length || this.accepting.has(handle))
            throw new Error('Reviewed plan projection unavailable');
        if (this.entries(root).some(item => item.handle !== handle && !item.planOnly))
            throw new Error('Existing Roadmap draft needs a separate review');
        const owner = await this.store.read(root);
        if (owner.projectId !== entry.projectId || owner.revision !== 0 || owner.linkedDocument ||
            owner.pendingCreation || owner.revision !== entry.ownerRevision ||
            entry.implementationPlan.source.roadmapRevision !== owner.revision)
            throw new Error('Existing or changed Roadmap needs a separate supported document review');
        verifyPlanEvidence(root, entry.implementationPlan);
        const draft = projectImplementationPlan(entry.implementationPlan);
        const preview: ImplementationPlanProjectionPreview = { token: randomUUID(), handle,
            planRevision: entry.implementationPlan.revision, ownerRevision: owner.revision,
            draft, requiresApproval: true };
        this.projectionPreviews.set(handle, preview);
        this.announce(handle, 'proposed', draft);
        return copy(preview);
    }

    async applyImplementationPlanProjection(root: string, preview: ImplementationPlanProjectionPreview,
        approved: boolean): Promise<GreenfieldDraft> {
        const entry = this.drafts.get(preview?.handle);
        if (!approved || !entry || entry.root !== root || !entry.planOnly || this.accepting.has(preview.handle) ||
            JSON.stringify(this.projectionPreviews.get(preview.handle)) !== JSON.stringify(preview) ||
            entry.implementationPlan?.revision !== preview.planRevision ||
            entry.value.revision !== 0 || entry.value.phases.length)
            throw new Error('Stale plan projection or approval required');
        if (this.entries(root).some(item => item.handle !== preview.handle && !item.planOnly))
            throw new Error('Existing Roadmap draft needs a separate review');
        const owner = await this.store.read(root);
        if (owner.projectId !== entry.projectId || owner.revision !== 0 || owner.linkedDocument ||
            owner.pendingCreation || owner.revision !== preview.ownerRevision ||
            JSON.stringify(projectImplementationPlan(entry.implementationPlan!)) !== JSON.stringify(preview.draft))
            throw new Error('Roadmap or reviewed plan changed; refresh and review again');
        verifyPlanEvidence(root, entry.implementationPlan!);
        this.persist(root, this.entries(root).map(item => item.handle === preview.handle ?
            { handle: item.handle, projectId: item.projectId, value: copy(preview.draft),
                ...(item.chatId ? { chatId: item.chatId } : {}), implementationPlan: item.implementationPlan } : item));
        entry.value = copy(preview.draft);
        delete entry.planOnly;
        delete entry.ownerRevision;
        this.projectionPreviews.delete(preview.handle);
        this.planPreviews.delete(preview.handle);
        this.announce(preview.handle, 'accepted', entry.value);
        return copy(entry.value);
    }

    /** No proposal is durable. Callers must distinguish manual input from model suggestions. */
    async previewImplementationPlan(handle: string, expectedDraftRevision: number, expectedPlanRevision: number,
        input: ImplementationPlanInput, origin: 'manual' | 'model' = 'manual'): Promise<ImplementationPlanPreview> {
        const entry = this.drafts.get(handle);
        if (!entry || this.accepting.has(handle) || entry.value.revision !== expectedDraftRevision ||
            (entry.implementationPlan?.revision ?? 0) !== expectedPlanRevision ||
            !input || !fields(input, ['objective', 'constraints', 'steps', 'evidence', 'decisions']) ||
            !Array.isArray(input.steps) || input.steps.length > 64 || !['manual', 'model'].includes(origin))
            throw new Error('Stale or invalid implementation plan');
        const owner = await this.store.read(entry.root);
        if (owner.projectId !== entry.projectId || owner.revision !== (entry.ownerRevision ?? 0) ||
            owner.pendingCreation || !entry.planOnly && !!owner.linkedDocument)
            throw new Error('Stale implementation plan owner');
        if (!entry.planOnly) this.assertUninitialized(entry.root);
        const existingIds = new Set(entry.implementationPlan?.steps.map(step => step.id) ?? []);
        const assignedIds = input.steps.map(step => step?.id ?? randomUUID());
        const steps = input.steps.map((step, index) => {
            if (!step || !fields(step, ['title', 'detail', 'expectedOutputs', 'dependencies', 'evidenceIds'], ['id']) ||
                step.id !== undefined && !existingIds.has(step.id)) throw new Error('Foreign implementation plan step ID');
            return { ...step, id: assignedIds[index], dependencies: origin === 'model' ? step.dependencies.map(id => {
                const match = /^step:(\d+)$/.exec(id);
                if (!match) return id;
                const prior = Number(match[1]);
                if (!Number.isSafeInteger(prior) || prior < 1 || prior > index) throw new Error('Invalid plan dependency');
                return assignedIds[prior - 1];
            }) : step.dependencies };
        });
        const accepted: ImplementationPlanDraft = { schemaVersion: 1, revision: expectedPlanRevision + 1,
            status: 'accepted', objective: input.objective, constraints: input.constraints, steps,
            evidence: input.evidence, decisions: origin === 'model' ? input.decisions?.map(item =>
                entry.implementationPlan?.decisions.some(previous => previous.origin === 'developer' &&
                    previous.text === item.text) ? { ...item, origin: 'developer' as const } :
                    { ...item, origin: 'model-assumption' as const }) : input.decisions,
            source: { projectId: entry.projectId, roadmapRevision: owner.revision,
                draftRevision: entry.value.revision } };
        if (!validPlan(accepted, entry.projectId)) throw new Error('Invalid or cyclic implementation plan');
        const after: ImplementationPlanPreview['after'] = { ...copy(accepted), status: 'proposed' };
        const preview: ImplementationPlanPreview = { token: randomUUID(), draftRevision: expectedDraftRevision,
            planRevision: expectedPlanRevision, ...(entry.implementationPlan ? { before: copy(entry.implementationPlan) } : {}),
            after, requiresApproval: true };
        this.planPreviews.set(handle, preview);
        this.projectionPreviews.delete(handle);
        return copy(preview);
    }

    clearImplementationPlanPreview(handle: string): void { this.planPreviews.delete(handle); }

    async applyImplementationPlan(handle: string, preview: ImplementationPlanPreview,
        approved: boolean): Promise<ImplementationPlanDraft> {
        const entry = this.drafts.get(handle);
        if (!entry || !approved || this.accepting.has(handle) ||
            JSON.stringify(this.planPreviews.get(handle)) !== JSON.stringify(preview) ||
            entry.value.revision !== preview.draftRevision ||
            entry.value.revision !== preview.after.source.draftRevision ||
            (entry.implementationPlan?.revision ?? 0) !== preview.planRevision ||
            JSON.stringify(entry.implementationPlan) !== JSON.stringify(preview.before))
            throw new Error('Stale implementation plan preview or approval required');
        const current = await this.store.read(entry.root);
        if (current.projectId !== entry.projectId || current.revision !== preview.after.source.roadmapRevision ||
            current.revision !== (entry.ownerRevision ?? 0) || current.pendingCreation ||
            !entry.planOnly && !!current.linkedDocument)
            throw new Error('Stale implementation plan owner');
        if (!entry.planOnly) this.assertUninitialized(entry.root);
        const accepted = { ...copy(preview.after), status: 'accepted' as const };
        if (!validPlan(accepted, entry.projectId)) throw new Error('Invalid implementation plan');
        this.persist(entry.root, this.entries(entry.root).map(item => item.handle === handle ?
            { ...item, implementationPlan: accepted } : item));
        entry.implementationPlan = accepted;
        if (preview.before) this.planHistory.set(handle, { before: copy(preview.before), revision: accepted.revision });
        else this.planHistory.delete(handle);
        this.planPreviews.delete(handle);
        this.projectionPreviews.delete(handle);
        this.announce(handle, 'plan');
        return copy(accepted);
    }

    /** One explicit undo of the latest non-destructive accepted plan revision. */
    async undoImplementationPlan(handle: string, expectedRevision: number): Promise<ImplementationPlanDraft> {
        const entry = this.drafts.get(handle), history = this.planHistory.get(handle);
        if (!entry || !history || history.revision !== expectedRevision ||
            entry.implementationPlan?.revision !== expectedRevision || this.accepting.has(handle))
            throw new Error('Stale implementation plan undo');
        const owner = await this.store.read(entry.root);
        if (owner.projectId !== entry.projectId || owner.revision !== (entry.ownerRevision ?? 0) ||
            owner.pendingCreation || !entry.planOnly && !!owner.linkedDocument)
            throw new Error('Stale implementation plan owner');
        const restored = { ...copy(history.before), revision: expectedRevision + 1 };
        if (!validPlan(restored, entry.projectId)) throw new Error('Invalid implementation plan undo');
        this.persist(entry.root, this.entries(entry.root).map(item => item.handle === handle ?
            { ...item, implementationPlan: restored } : item));
        entry.implementationPlan = restored;
        this.planHistory.delete(handle);
        this.planPreviews.delete(handle);
        this.projectionPreviews.delete(handle);
        this.announce(handle, 'plan');
        return copy(restored);
    }

    private project(handle: string, expectedRevision: number, action: GreenfieldEdit,
        basis?: GreenfieldDraft): GreenfieldDraft {
        const entry = this.drafts.get(handle);
        if (this.accepting.has(handle)) throw new Error('Greenfield draft acceptance in progress');
        if (!entry || entry.planOnly || (basis ?? entry.value).revision !== expectedRevision ||
            basis && basis.revision < entry.value.revision) throw new Error('Stale greenfield draft');
        this.assertUninitialized(entry.root);
        const next = copy(basis ?? entry.value);
        const raw = action as unknown as Record<string, unknown>;
        const required: Record<GreenfieldEdit['type'], string[]> = {
            'create-phase': ['type', 'title'], 'create-checkpoint': ['type', 'phaseId', 'title'],
            'create-gate': ['type', 'phaseId', 'title', 'purpose'],
            'edit-gate': ['type', 'phaseId', 'gateId'],
            'add-criterion': ['type', 'phaseId', 'gateId', 'title', 'expectedResult'],
            'edit-criterion': ['type', 'phaseId', 'gateId', 'criterionId'],
            'edit-phase': ['type', 'phaseId'], 'edit-checkpoint': ['type', 'phaseId', 'checkpointId'],
            'reorder-phase': ['type', 'phaseId', 'order'],
            'reorder-checkpoint': ['type', 'phaseId', 'checkpointId', 'order'],
            'split-checkpoint': ['type', 'phaseId', 'checkpointId', 'title'],
            'move-checkpoint': ['type', 'phaseId', 'checkpointId', 'targetPhaseId', 'order'],
            'add-dependency': ['type', 'checkpointId', 'dependencyId'],
            'remove-dependency': ['type', 'checkpointId', 'dependencyId'],
            'create-correction': ['type', 'parentId', 'title'],
            'attach-correction': ['type', 'correctionId', 'parentId']
        };
        if (!action || !Object.hasOwn(required, action.type) ||
            required[action.type].some(key => !Object.hasOwn(raw, key)) ||
            Object.keys(raw).some(key => !required[action.type].includes(key) &&
                !(key === 'objective' && ['create-phase', 'create-checkpoint', 'edit-phase', 'edit-checkpoint',
                    'split-checkpoint', 'create-correction'].includes(action.type)) &&
                !(key === 'title' && ['edit-phase', 'edit-checkpoint', 'edit-gate', 'edit-criterion'].includes(action.type)) &&
                !(key === 'purpose' && action.type === 'edit-gate') &&
                !(key === 'expectedResult' && action.type === 'edit-criterion')))
            throw new Error('Invalid greenfield edit fields');
        const phase = 'phaseId' in action ? next.phases.find(item => item.id === action.phaseId) : undefined;
        if ('phaseId' in action && !phase) throw new Error('Unknown greenfield phase');
        if ('title' in action && action.title !== undefined && !title(action.title) ||
            'objective' in action && action.objective !== undefined && !objective(action.objective) ||
            'purpose' in action && action.purpose !== undefined && !objective(action.purpose) ||
            'expectedResult' in action && action.expectedResult !== undefined && !objective(action.expectedResult))
            throw new Error('Invalid greenfield text');
        switch (action.type) {
            case 'create-phase':
                if (next.phases.length >= 32) throw new Error('Greenfield phase limit');
                next.phases.push({ id: randomUUID(), title: action.title, objective: action.objective ?? '', checkpoints: [] });
                break;
            case 'create-gate': {
                if (phase!.kind || !action.purpose.trim() || (phase!.gates?.length ?? 0) >= 128)
                    throw new Error('Invalid Greenfield Gate parent, purpose or limit');
                const gates = phase!.gates ?? (phase!.gates = []);
                gates.push({ id: randomUUID(), parentPhaseId: phase!.id, designation: `G${gates.length + 1}`,
                    title: action.title, purpose: action.purpose, criteria: [] });
                break;
            }
            case 'edit-gate': {
                const gate = phase!.gates?.find(item => item.id === action.gateId);
                if (!gate || action.title === undefined && action.purpose === undefined)
                    throw new Error('Unknown or empty Greenfield Gate edit');
                if (action.title !== undefined) gate.title = action.title;
                if (action.purpose !== undefined) gate.purpose = action.purpose;
                break;
            }
            case 'add-criterion': {
                const gate = phase!.gates?.find(item => item.id === action.gateId);
                if (!gate || !action.expectedResult.trim() || gate.criteria.length >= 128)
                    throw new Error('Unknown Greenfield Gate or invalid criterion');
                gate.criteria.push({ id: randomUUID(), title: action.title, expectedResult: action.expectedResult });
                break;
            }
            case 'edit-criterion': {
                const criterion = phase!.gates?.find(item => item.id === action.gateId)?.criteria
                    .find(item => item.id === action.criterionId);
                if (!criterion || action.title === undefined && action.expectedResult === undefined)
                    throw new Error('Unknown or empty Greenfield criterion edit');
                if (action.title !== undefined) criterion.title = action.title;
                if (action.expectedResult !== undefined) criterion.expectedResult = action.expectedResult;
                break;
            }
            case 'create-checkpoint':
                if (next.phases.reduce((count, item) => count + item.checkpoints.length, 0) >= 256)
                    throw new Error('Greenfield checkpoint limit');
                phase!.checkpoints.push({ id: randomUUID(), title: action.title, objective: action.objective ?? '' });
                break;
            case 'edit-phase':
                if (action.title === undefined && action.objective === undefined) throw new Error('Empty greenfield edit');
                if (action.title !== undefined) phase!.title = action.title;
                if (action.objective !== undefined) phase!.objective = action.objective;
                break;
            case 'edit-checkpoint': {
                if (action.title === undefined && action.objective === undefined) throw new Error('Empty greenfield edit');
                const checkpoint = phase!.checkpoints.find(item => item.id === action.checkpointId);
                if (!checkpoint) throw new Error('Unknown greenfield checkpoint');
                if (action.title !== undefined) checkpoint.title = action.title;
                if (action.objective !== undefined) checkpoint.objective = action.objective;
                break;
            }
            case 'reorder-phase': {
                if (!Number.isSafeInteger(action.order) || action.order < 0 || action.order >= next.phases.length)
                    throw new Error('Invalid greenfield order');
                next.phases.splice(action.order, 0, next.phases.splice(next.phases.indexOf(phase!), 1)[0]);
                break;
            }
            case 'reorder-checkpoint': {
                const index = phase!.checkpoints.findIndex(item => item.id === action.checkpointId);
                if (index < 0 || !Number.isSafeInteger(action.order) || action.order < 0 || action.order >= phase!.checkpoints.length)
                    throw new Error('Invalid greenfield order');
                phase!.checkpoints.splice(action.order, 0, phase!.checkpoints.splice(index, 1)[0]);
                break;
            }
            case 'split-checkpoint': {
                const index = phase!.checkpoints.findIndex(item => item.id === action.checkpointId);
                if (index < 0) throw new Error('Unknown greenfield checkpoint');
                if (next.phases.reduce((count, item) => count + item.checkpoints.length, 0) >= 256)
                    throw new Error('Greenfield checkpoint limit');
                phase!.checkpoints.splice(index + 1, 0, { id: randomUUID(), title: action.title,
                    objective: action.objective ?? '', dependencies: [action.checkpointId] });
                break;
            }
            case 'move-checkpoint': {
                const target = next.phases.find(item => item.id === action.targetPhaseId);
                const index = phase!.checkpoints.findIndex(item => item.id === action.checkpointId);
                if (!target || index < 0 || !Number.isSafeInteger(action.order) || action.order < 0 ||
                    action.order >= target.checkpoints.length + (target === phase ? 0 : 1))
                    throw new Error('Unknown greenfield target or invalid order');
                target.checkpoints.splice(action.order, 0, phase!.checkpoints.splice(index, 1)[0]);
                break;
            }
            case 'add-dependency': case 'remove-dependency': {
                const target = next.phases.flatMap(item => item.checkpoints).find(item => item.id === action.checkpointId);
                const member = next.phases.some(item => item.id === action.dependencyId ||
                    item.checkpoints.some(checkpoint => checkpoint.id === action.dependencyId));
                if (!target || !member || target.id === action.dependencyId) throw new Error('Foreign or invalid greenfield dependency');
                const current = target.dependencies ?? [];
                if (action.type === 'add-dependency') {
                    if (current.includes(action.dependencyId)) throw new Error('Duplicate greenfield dependency');
                    target.dependencies = [...current, action.dependencyId];
                } else {
                    if (!current.includes(action.dependencyId)) throw new Error('Unknown greenfield dependency');
                    target.dependencies = current.filter(id => id !== action.dependencyId);
                }
                break;
            }
            case 'create-correction': {
                if (next.phases.length >= 32 || !next.phases.some(item => item.id === action.parentId ||
                    item.checkpoints.some(checkpoint => checkpoint.id === action.parentId)))
                    throw new Error('Foreign correction parent or phase limit');
                next.phases.push({ id: randomUUID(), title: action.title, objective: action.objective ?? '',
                    checkpoints: [], kind: 'correction', parentId: action.parentId });
                break;
            }
            case 'attach-correction': {
                const correction = next.phases.find(item => item.id === action.correctionId && item.kind === 'correction');
                if (!correction || correction.id === action.parentId || !next.phases.some(item =>
                    item.id === action.parentId || item.checkpoints.some(checkpoint => checkpoint.id === action.parentId)))
                    throw new Error('Foreign correction parent');
                correction.parentId = action.parentId;
                break;
            }
        }
        if (!validDraft(next)) throw new Error('Duplicate, cyclic or invalid greenfield graph');
        next.revision++;
        return copy(next);
    }

    edit(handle: string, expectedRevision: number, action: GreenfieldEdit): GreenfieldDraft {
        if (['split-checkpoint', 'move-checkpoint', 'add-dependency', 'remove-dependency',
            'create-correction', 'attach-correction'].includes(action?.type))
            throw new Error('Graph restructuring requires a reviewed preview and approval');
        const next = this.project(handle, expectedRevision, action);
        const entry = this.drafts.get(handle)!;
        const before = copy(entry.value);
        this.persist(entry.root, this.entries(entry.root).map(item => item.handle === handle ? { ...item, value: next } : item));
        entry.value = next;
        this.history.set(handle, { before, after: copy(next) });
        this.editPreviews.delete(handle);
        this.creationPreviews.delete(handle);
        this.announce(handle, 'accepted', next);
        return copy(next);
    }

    previewEdit(handle: string, expectedRevision: number, action: GreenfieldEdit): GreenfieldEditPreview {
        const before = this.read(handle);
        const after = this.project(handle, expectedRevision, action);
        const token = hash(JSON.stringify({ nonce: randomUUID(), handle, before, after, action }));
        const preview: GreenfieldEditPreview = { token, draftRevision: expectedRevision,
            before, after, action: copy(action), requiresApproval: true };
        this.editPreviews.set(handle, preview);
        this.announce(handle, 'proposed', preview.after);
        return copy(preview);
    }

    /** One approved transaction for two or three fully checked, provisional steps. */
    previewEditSequence(handle: string, expectedRevision: number, actions: GreenfieldEdit[]): GreenfieldEditPreview {
        if (!Array.isArray(actions) || actions.length < 2 || actions.length > 3)
            throw new Error('Invalid greenfield step count');
        const before = this.read(handle);
        if (before.revision !== expectedRevision) throw new Error('Stale greenfield draft');
        let after = before;
        for (const action of actions) after = this.project(handle, after.revision, action, after);
        const token = hash(JSON.stringify({ nonce: randomUUID(), handle, before, after, actions }));
        const preview: GreenfieldEditPreview = { token, draftRevision: expectedRevision,
            before, after, action: copy(actions[0]), actions: copy(actions), requiresApproval: true };
        this.editPreviews.set(handle, preview);
        this.announce(handle, 'proposed', preview.after);
        return copy(preview);
    }

    clearEditPreview(handle: string): void {
        if (this.editPreviews.delete(handle)) this.announce(handle, 'cleared');
    }

    async applyEdit(handle: string, preview: GreenfieldEditPreview, approved: boolean): Promise<GreenfieldDraft> {
        const entry = this.drafts.get(handle);
        if (!entry || entry.planOnly || !approved || !preview ||
            JSON.stringify(this.editPreviews.get(handle)) !== JSON.stringify(preview) ||
            entry.value.revision !== preview.draftRevision ||
            JSON.stringify(entry.value) !== JSON.stringify(preview.before) ||
            preview.after.revision !== preview.draftRevision + (preview.actions?.length ?? 1))
            throw new Error('Stale greenfield preview or approval required');
        const current = await this.store.read(entry.root);
        if (current.projectId !== entry.projectId || current.revision || current.linkedDocument || current.pendingCreation)
            throw new Error('Roadmap already initialized or creation pending');
        if (entry.value.revision !== preview.draftRevision ||
            JSON.stringify(entry.value) !== JSON.stringify(preview.before) ||
            JSON.stringify(this.editPreviews.get(handle)) !== JSON.stringify(preview))
            throw new Error('Stale greenfield draft');
        this.persist(entry.root, this.entries(entry.root).map(item => item.handle === handle ? { ...item, value: preview.after } : item));
        this.history.set(handle, { before: copy(entry.value), after: copy(preview.after) });
        entry.value = copy(preview.after);
        this.editPreviews.delete(handle);
        this.creationPreviews.delete(handle);
        this.announce(handle, 'accepted', entry.value);
        return copy(entry.value);
    }

    /** Last accepted draft change only. A newer human/model edit or revision invalidates redo. */
    undoEdit(handle: string, expectedRevision: number): GreenfieldDraft {
        return this.replay(handle, expectedRevision, false);
    }

    redoEdit(handle: string, expectedRevision: number): GreenfieldDraft {
        return this.replay(handle, expectedRevision, true);
    }

    private replay(handle: string, expectedRevision: number, redo: boolean): GreenfieldDraft {
        const entry = this.drafts.get(handle), history = this.history.get(handle);
        if (!entry || entry.planOnly || !history || !!history.redo !== redo || entry.value.revision !== expectedRevision ||
            this.accepting.has(handle)) throw new Error('Greenfield undo/redo conflict or unavailable');
        this.assertUninitialized(entry.root);
        const expected = redo ? history.before : history.after;
        if (JSON.stringify({ ...entry.value, revision: 0 }) !== JSON.stringify({ ...expected, revision: 0 }))
            throw new Error('Greenfield undo/redo conflict');
        const target = copy(redo ? history.after : history.before);
        target.revision = expectedRevision + 1;
        if (!validDraft(target)) throw new Error('Invalid greenfield undo/redo target');
        this.persist(entry.root, this.entries(entry.root).map(item => item.handle === handle ? { ...item, value: target } : item));
        entry.value = target;
        history.redo = !redo;
        this.clearEditPreview(handle);
        this.creationPreviews.delete(handle);
        this.announce(handle, 'accepted', target);
        return copy(target);
    }

    /** Review a structural acceptance and a separate, unpublished Markdown candidate. */
    preview(handle: string, path: string): GreenfieldPreview {
        const entry = this.drafts.get(handle);
        if (!entry || entry.planOnly) throw new Error('Unknown greenfield draft');
        this.assertUninitialized(entry.root);
        this.assertNoCanonicalMarkdown(entry.root);
        if (!entry.value.phases.some(phase => !phase.kind))
            throw new Error('Greenfield draft needs a Phase');
        if (!path || path.length > 512 || isAbsolute(path) || !/\.md$/i.test(path) ||
            path.includes('\\') || path.includes(':') || path.split('/')[0] === '.dope' ||
            path.split('/').some(part => !part || part === '.' || part === '..'))
            throw new Error('Unsafe greenfield Roadmap path');
        let candidate = entry.root;
        for (const part of path.split('/')) {
            candidate = join(candidate, part);
            try {
                const info = lstatSync(candidate);
                if (info.isSymbolicLink() || candidate === join(entry.root, path) || !info.isDirectory())
                    throw new Error('Greenfield Markdown path exists or is unsafe');
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
        }
        const lines = ['# Roadmap', ''];
        let phaseNumber = 0;
        const unresolvedCoverage: string[] = [];
        for (const phase of entry.value.phases) {
            if (phase.kind) { unresolvedCoverage.push(`${phase.title}: correction requires separate Gate/Phase review`); continue; }
            lines.push(`## Phase ${++phaseNumber} [id: ${phase.id}]: ${phase.title}`,
                `Objective: ${phase.objective || 'UNRESOLVED: define the Phase outcome'}`, '');
            unresolvedCoverage.push(`${phase.title}: complete required Gate-set coverage is not approved`);
            if (!phase.gates?.length) unresolvedCoverage.push(`${phase.title}: no accepted Gates; Gate-set coverage unreviewed`);
            if (phase.checkpoints.length) unresolvedCoverage.push(`${phase.title}: task or milestone bullets are not Gates`);
            for (const gate of phase.gates ?? []) {
                lines.push(`### Gate ${gate.designation} [id: ${gate.id}] [phase: ${phase.id}]: ${gate.title}`,
                    `Objective: ${gate.purpose || 'UNRESOLVED: define the Gate requirement'}`);
                if (!gate.criteria.length) unresolvedCoverage.push(`${gate.designation}: testable criteria unresolved`);
                for (const criterion of gate.criteria) lines.push(
                    `- Criterion C${gate.criteria.indexOf(criterion) + 1} [id: ${criterion.id}]: ${criterion.title} — Expected: ${criterion.expectedResult}`);
                lines.push('');
            }
        }
        const markdown = `${lines.join('\n')}\n`;
        if (Buffer.byteLength(markdown) > 2 * 1024 * 1024) throw new Error('Greenfield Roadmap size limit');
        const token = hash(JSON.stringify({ nonce: randomUUID(), handle, root: entry.root, path, revision: entry.value.revision, markdown }));
        this.creationPreviews.set(handle, token);
        return { token, draftRevision: entry.value.revision, path, markdown,
            phases: copy(entry.value.phases), gates: copy(entry.value.phases.flatMap(phase => phase.gates ?? [])),
            unresolvedCoverage, requiresApproval: true };
    }

    /** Approve schema-two Roadmap structure only. Linked Markdown needs its own reviewed publication. */
    async accept(handle: string, preview: GreenfieldPreview, approved: boolean): Promise<RoadmapGateIndex> {
        const entry = this.drafts.get(handle);
        if (!entry || !approved || !preview || this.accepting.has(handle) ||
            this.creationPreviews.get(handle) !== preview.token ||
            JSON.stringify({ ...this.preview(handle, preview.path), token: preview.token }) !== JSON.stringify(preview))
            throw new Error('Greenfield preview and approval required');
        this.accepting.add(handle);
        try {
            const current = await this.store.read<RoadmapGateIndex>(entry.root);
            if (current.revision || current.phases.length || current.gates.length || current.linkedDocument ||
                current.projectId !== entry.projectId)
                throw new Error('Stale greenfield Roadmap owner');
            await this.assertNoRoadmapSource(entry.root);
            if (entry.implementationPlan) verifyPlanEvidence(entry.root, entry.implementationPlan);
            if (entry.value.phases.some(phase => phase.kind || !phase.objective.trim() ||
                (phase.gates ?? []).some(gate => !gate.purpose.trim() || !gate.criteria.length ||
                    gate.criteria.some(criterion => !criterion.expectedResult.trim()))))
                throw new Error('Incomplete Gate or Phase definition; review the draft before acceptance');
            const projectId = current.projectId === 'uninitialized' ? stableId(`greenfield-project:${handle}`) : current.projectId;
            const phases: RoadmapPhase[] = entry.value.phases.map((phase, order) => ({
                id: phase.id, projectId, title: phase.title, objective: phase.objective, order,
                dependencies: [], implementationStatus: 'unknown', qualificationStatus: 'unknown',
                draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }));
            const gates: RoadmapGate[] = entry.value.phases.flatMap(phase => (phase.gates ?? []).map((gate, order) => ({
                id: gate.id, projectId, parentPhaseId: phase.id, designation: gate.designation,
                title: gate.title, purpose: gate.purpose, order, dependencies: gate.dependencies ?? [],
                criteria: gate.criteria.map((criterion, criterionOrder) => ({ id: criterion.id, projectId,
                    title: criterion.title, expectedResult: criterion.expectedResult, order: criterionOrder, evidence: [] })),
                implementationStatus: 'unknown' as const, qualificationStatus: 'unknown' as const,
                draftAcceptance: 'accepted' as const })));
            const candidate: RoadmapGateIndex = { schemaVersion: 2, projectId, projectRoot: entry.root,
                revision: 1, phases, gates, corrections: [] };
            const result = await this.store.saveGateIndex(entry.root, 0, current.projectId, candidate);
            this.accepting.delete(handle);
            this.cancel(handle);
            return result;
        } finally { this.accepting.delete(handle); }
    }
}
