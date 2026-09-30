import type { ArchitectureEvidenceItem, ArchitectureEvidencePacket } from './synthesis';
import { isDirectSystemResponsibilityEvidence, isProductionEvidencePath, validateArchitectureEvidencePacket } from './synthesis';
import { createArchitectureEvidenceView, deriveResponsibilitySignals, evidenceSourceArea, usableEvidenceTokens, validateSynthesisStageRequest,
    SYNTHESIS_STAGE_VERSION } from './hierarchical-synthesis';
import type { SynthesisCapabilities, SynthesisProvider, SynthesisStage, SynthesisStageContext,
    SynthesisStageRequest } from './hierarchical-synthesis';

/** Selection policy version. Increment when ranking, quotas, or scope rules change. */
export const EVIDENCE_PLANNER_VERSION = 5;
type Category = ArchitectureEvidenceItem['kind'];
const categories: Category[] = ['topology', 'entrypoint', 'framework', 'dependency', 'configuration', 'semantic'];
const globalLimits: Record<Category, number> = {
    topology: 48, entrypoint: 24, framework: 36, dependency: 24, configuration: 20, semantic: 48,
};
const focusedLimits: Record<Category, number> = {
    topology: 20, entrypoint: 16, framework: 32, dependency: 48, configuration: 16, semantic: 48,
};
const verificationLimits: Record<Category, number> = {
    topology: 2, entrypoint: 4, framework: 6, dependency: 6, configuration: 2, semantic: 6,
};

export interface EvidencePlan {
    plannerVersion: 5;
    /** Selection identity includes scope, capability, policy version, and selected whole facts. */
    planId: string;
    request: SynthesisStageRequest;
    includedEvidenceRefs: string[];
    omittedEvidenceRefs: string[];
    selectionReasons: string[];
    inputTokens: number;
    inputBudgetTokens: number;
    tokenEstimate: SynthesisCapabilities['tokenEstimate'];
}

const digest = (value: unknown): string => {
    let hash = 0xcbf29ce484222325n;
    for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
        hash = (hash ^ BigInt(byte)) * 0x100000001b3n & 0xffffffffffffffffn;
    }
    return `plan:v1:${hash.toString(16).padStart(16, '0')}`;
};
const nonProduction = (path: string): boolean => !isProductionEvidencePath(path);
const physical = (item: ArchitectureEvidenceItem): boolean => !item.path.startsWith('.dope/');
const group = (path: string): string => {
    const parts = path.split('/');
    return parts[0] === 'packages' || parts[0] === 'apps' ? parts.slice(0, 2).join('/') :
        parts[0] === 'src' ? parts.slice(0, parts[1] !== 'client' && parts.length > 3 ? 3 : 2).join('/') : parts[0];
};
const sameArea = (a: string, b: string): boolean => a === b || group(a) === group(b);
const rank = (item: ArchitectureEvidenceItem): number => {
    let score = nonProduction(item.path) ? -100 : 0;
    if (item.kind === 'topology') score += item.scope === 'workspace' ? 30 : 15;
    if (item.kind === 'entrypoint') score += /^(main|module|browser|bin|exports|script:(start|serve|dev)|frontend|backend)/.test(item.role) ? 15 : 0;
    if (item.kind === 'entrypoint' && item.path === 'package.json') score -= 20;
    if (item.kind === 'framework') score += /bootstrap|binding|registration|container|manifest-extension|frontend|backend|service/.test(`${item.concept} ${item.role ?? ''}`) ? 12 : 0;
    if (item.kind === 'dependency') score += item.relation === 'imports' || item.relation === 'depends-on' ? 10 : 0;
    if (item.kind === 'configuration') score += /^(configured-ts-js-project|dependencies:|main:|module:)/.test(item.signal) ? 8 : 0;
    if (item.kind === 'semantic') score += item.relation.includes(':exported') ? 10 : 0;
    return score;
};
const ordered = (items: ArchitectureEvidenceItem[]): ArchitectureEvidenceItem[] => [...items].sort((a, b) =>
    rank(b) - rank(a) || group(a.path).localeCompare(group(b.path)) || a.path.localeCompare(b.path) || a.id.localeCompare(b.id));

function scopeRefs(stage: SynthesisStage, context: SynthesisStageContext): Set<string> {
    const refs = new Set<string>();
    const add = (candidate: { evidenceRefs: string[] }) => candidate.evidenceRefs.forEach(ref => refs.add(ref));
    if (stage === 'system-challenge' || stage === 'reconciliation') context.systems.forEach(add);
    if (stage === 'subsystem-discovery' || stage === 'subsystem-challenge') {
        const subject = context.systems.find(system => system.candidateKey === context.subjectSystemKey);
        if (subject) add(subject);
    }
    if (stage === 'subsystem-challenge') context.subsystems.forEach(add);
    if (stage === 'component-discovery') {
        const subject = context.subsystems.find(item => item.candidateKey === context.subjectSubsystemKey);
        if (subject) add(subject);
    }
    if (stage === 'reconciliation') context.subtrees.forEach(tree => tree.nodes.forEach(add));
    if (stage === 'verification') {
        const targets = new Set(context.targetCandidateKeys);
        context.systems.filter(system => targets.has(system.candidateKey)).forEach(add);
        context.subtrees.flatMap(tree => tree.nodes).filter(node => targets.has(node.candidateKey)).forEach(add);
    }
    return refs;
}

/** Pure packet projection; neither candidate text nor paths can add filesystem evidence. */
export async function planArchitectureEvidence(packet: ArchitectureEvidencePacket, stage: SynthesisStage,
    context: SynthesisStageContext, capability: SynthesisCapabilities,
    counter: Pick<SynthesisProvider, 'estimateTokens'>): Promise<EvidencePlan> {
    validateArchitectureEvidencePacket(packet);
    const budget = usableEvidenceTokens(capability);
    const makeRequest = (ids: string[]): SynthesisStageRequest => ({ schemaVersion: 1, stage,
        stageVersion: SYNTHESIS_STAGE_VERSION, parentPacketFingerprint: packet.inputFingerprint,
        view: createArchitectureEvidenceView(packet, ids, stage), context: structuredClone(context) });
    // P1 validation also rejects malformed candidate scopes and unknown evidence references.
    validateSynthesisStageRequest(makeRequest([]), packet);
    const byId = new Map(packet.items.map(item => [item.id, item]));
    const refs = scopeRefs(stage, context);
    if ([...refs].some(ref => !physical(byId.get(ref)!))) throw new Error('Evidence planner candidate scope references project declarations');
    const related = [...refs].map(ref => byId.get(ref)!).filter(Boolean);
    const signals = deriveResponsibilitySignals(packet.items);
    const signalRefs = new Set(signals.filter(signal => stage === 'system-discovery' || stage === 'reconciliation' ||
        stage === 'system-challenge' && context.systems.length === 1 ||
        signal.evidenceRefs.some(ref => refs.has(ref))).flatMap(signal => signal.evidenceRefs));
    const lowerStage = stage === 'subsystem-discovery' || stage === 'subsystem-challenge' || stage === 'component-discovery';
    const rootManifestScope = lowerStage &&
        related.some(item => item.kind === 'entrypoint' && item.path === 'package.json');
    const candidateGroups = new Set(related.map(item => group(item.path)));
    const otherSystemRefs = new Set(lowerStage ? context.systems
        .filter(system => system.candidateKey !== context.subjectSystemKey).flatMap(system => system.evidenceRefs) : []);
    const otherGroups = new Set([...otherSystemRefs].map(ref => group(byId.get(ref)!.path)));
    const ownGroups = new Set([...candidateGroups].filter(value => !otherGroups.has(value)));
    const sharedGroups = new Set([...candidateGroups].filter(value => otherGroups.has(value)));
    const linkedGroups = new Set(candidateGroups);
    if (stage === 'system-challenge') {
        for (const item of packet.items) if (item.kind === 'dependency' &&
            (candidateGroups.has(group(item.path)) || candidateGroups.has(group(item.targetPath)))) {
            linkedGroups.add(group(item.path)); linkedGroups.add(group(item.targetPath));
        }
    }
    const eligible = (item: ArchitectureEvidenceItem): boolean => {
        if (!physical(item)) return false;
        if (stage === 'system-discovery') return !nonProduction(item.path);
        if (stage === 'reconciliation') return true;
        if (stage === 'system-challenge') return refs.has(item.id) || signalRefs.has(item.id) ||
            context.systems.length === 1 && !nonProduction(item.path) ||
            item.kind === 'topology' && item.scope === 'workspace' || linkedGroups.has(group(item.path)) ||
            item.kind === 'dependency' && linkedGroups.has(group(item.targetPath));
        if (lowerStage) {
            if (refs.has(item.id)) return true;
            if (otherSystemRefs.has(item.id)) return false;
            if (stage === 'subsystem-challenge' && isDirectSystemResponsibilityEvidence(item)) return true;
            if (signalRefs.has(item.id)) return true;
            if (rootManifestScope && !nonProduction(item.path)) return true;
            if (ownGroups.has(group(item.path))) return true;
            if (sharedGroups.has(group(item.path)) && ['semantic', 'framework', 'entrypoint'].includes(item.kind)) return true;
            return item.kind === 'dependency' &&
                (ownGroups.has(group(item.path)) || ownGroups.has(group(item.targetPath)));
        }
        if (refs.has(item.id) || signalRefs.has(item.id)) return true;
        return related.some(seed => sameArea(item.path, seed.path) ||
            item.kind === 'dependency' && (sameArea(item.targetPath, seed.path) ||
                seed.kind === 'dependency' && sameArea(item.path, seed.targetPath)));
    };
    const selected: string[] = [];
    const selectedSet = new Set<string>();
    const counts = new Map<Category, number>();
    const groupCounts = new Map<string, number>();
    const limits = stage === 'verification' ? verificationLimits :
        stage === 'system-discovery' || stage === 'system-challenge' ? globalLimits : focusedLimits;
    const estimate = async (ids: string[]): Promise<number> => {
        const count = await counter.estimateTokens(JSON.stringify(makeRequest(ids)));
        if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid evidence planner token estimate');
        return count;
    };
    // A global view must contain actual repository topology and, when present, an executable/export boundary.
    const production = packet.items.filter(item => physical(item) && !nonProduction(item.path));
    const base = production.length ? production : packet.items.filter(physical);
    const mandatory: ArchitectureEvidenceItem[] = [];
    if (stage === 'system-discovery') {
        const topology = ordered(base.filter(item => item.kind === 'topology'))[0];
        const entrypoint = ordered(base.filter(item => item.kind === 'entrypoint'))[0];
        const behavior = ordered(base.filter(isDirectSystemResponsibilityEvidence))[0];
        if (topology) mandatory.push(topology);
        if (entrypoint) mandatory.push(entrypoint);
        if (behavior) mandatory.push(behavior);
        if (!mandatory.length && base.length) mandatory.push(ordered(base)[0]);
    } else if (stage === 'system-challenge') {
        // The independent challenge must see every fact P3 cited, even when that
        // leaves less room for counter evidence. Fail if the bounded call cannot fit.
        mandatory.push(...ordered([...refs].map(ref => byId.get(ref)!).filter(Boolean)));
    } else if (stage === 'reconciliation') {
        for (const system of context.systems) {
            const first = ordered(system.evidenceRefs.map(ref => byId.get(ref)!).filter(Boolean))[0];
            if (first) mandatory.push(first);
        }
    } else if (stage === 'verification') {
        const targets = new Set(context.targetCandidateKeys);
        const candidates = [...context.systems, ...context.subtrees.flatMap(tree => tree.nodes)];
        for (const candidate of candidates.filter(candidate => targets.has(candidate.candidateKey))) {
            const first = ordered(candidate.evidenceRefs.map(ref => byId.get(ref)!).filter(Boolean))[0];
            if (first) mandatory.push(first);
        }
    } else if (stage === 'subsystem-discovery' || stage === 'subsystem-challenge') {
        // Every cited System fact must remain visible in the focused view; budget failure is explicit.
        mandatory.push(...ordered(related));
    } else if (stage === 'component-discovery') {
        const subject = context.subsystems.find(item => item.candidateKey === context.subjectSubsystemKey)!;
        mandatory.push(...ordered(subject.evidenceRefs.map(ref => byId.get(ref)!).filter(Boolean)));
    } else if (refs.size) {
        mandatory.push(...ordered([...refs].map(ref => byId.get(ref)!).filter(Boolean)).slice(0, 1));
    }
    if (!base.length) throw new Error('Evidence planner requires non-declaration physical evidence');
    for (const item of mandatory) {
        if (selectedSet.has(item.id)) continue;
        const next = [...selected, item.id];
        if (await estimate(next) > budget) throw new Error(`Evidence planner minimal ${stage} skeleton exceeds input budget`);
        selected.push(item.id); selectedSet.add(item.id);
        counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
        groupCounts.set(group(item.path), (groupCounts.get(group(item.path)) ?? 0) + 1);
    }
    if (!mandatory.length && await estimate([]) > budget) throw new Error(`Evidence planner ${stage} context exceeds input budget`);
    const scoped = packet.items.filter(eligible);
    // Global discovery first needs breadth of direct behavior; pairs can inform later boundary challenges.
    for (const signal of stage === 'system-discovery' ? [] : signals) {
        const representatives = [...new Set(signal.evidenceRefs.map(ref => evidenceSourceArea(byId.get(ref)!.path)))].slice(0, 2)
            .map(area => signal.evidenceRefs.map(ref => byId.get(ref)!).find(item => evidenceSourceArea(item.path) === area && eligible(item)))
            .filter((item): item is ArchitectureEvidenceItem => !!item);
        if (representatives.length < 2) continue;
        const additions = representatives.filter(item => !selectedSet.has(item.id));
        if (additions.some(item => (counts.get(item.kind) ?? 0) + additions.filter(other => other.kind === item.kind).length >
            (stage === 'verification' ? verificationLimits : stage === 'system-discovery' || stage === 'system-challenge' ? globalLimits : focusedLimits)[item.kind])) continue;
        if (await estimate([...selected, ...additions.map(item => item.id)]) > budget) continue;
        for (const item of additions) {
            selected.push(item.id); selectedSet.add(item.id);
            counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
            groupCounts.set(group(item.path), (groupCounts.get(group(item.path)) ?? 0) + 1);
        }
    }
    const crossCandidate = (item: ArchitectureEvidenceItem): boolean => item.kind === 'dependency' &&
        group(item.path) !== group(item.targetPath) &&
        (candidateGroups.has(group(item.path)) || candidateGroups.has(group(item.targetPath)));
    const priority = (item: ArchitectureEvidenceItem) => (refs.has(item.id) ? 1000 : 0) +
        (signalRefs.has(item.id) ? 60 : 0) + rank(item) +
        (lowerStage && ownGroups.has(group(item.path)) ? 40 : 0) +
        (stage === 'subsystem-challenge' && crossCandidate(item) ? 100 : 0) +
        (stage === 'system-challenge' && crossCandidate(item) ? 100 : 0) +
        (stage === 'reconciliation' && item.kind === 'dependency' && group(item.path) !== group(item.targetPath) ? 25 : 0);
    const stageCategories: Category[] = stage === 'system-discovery'
        ? ['topology', 'entrypoint', 'semantic', 'framework', 'dependency', 'configuration'] : lowerStage
        ? ['semantic', 'framework', 'dependency', 'entrypoint', 'topology', 'configuration'] : stage === 'system-challenge'
        ? ['dependency', 'entrypoint', 'framework', 'semantic', 'topology', 'configuration'] : stage === 'reconciliation'
        ? ['dependency', 'entrypoint', 'framework', 'topology', 'configuration', 'semantic'] : categories;
    for (const category of stageCategories) {
        const candidates = scoped.filter(item => item.kind === category).sort((a, b) =>
            priority(b) - priority(a) || group(a.path).localeCompare(group(b.path)) || a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
        if (lowerStage || (stage === 'system-discovery' || stage === 'system-challenge') &&
            (category === 'semantic' || category === 'framework')) {
            const positions = new Map<string, number>();
            const turns = new Map(candidates.map(item => {
                const area = group(item.path);
                const turn = positions.get(area) ?? 0;
                positions.set(area, turn + 1);
                return [item.id, turn] as const;
            }));
            candidates.sort((a, b) => turns.get(a.id)! - turns.get(b.id)! || priority(b) - priority(a) || a.path.localeCompare(b.path));
        }
        for (const item of candidates) {
            if (selectedSet.has(item.id) || (counts.get(category) ?? 0) >= limits[category] ||
                stage === 'verification' && selected.length >= 24) continue;
            if (stage === 'system-discovery' && category === 'entrypoint' &&
                selected.filter(id => byId.get(id)?.kind === 'entrypoint' && byId.get(id)?.path === item.path).length >= 2) continue;
            if (stage === 'system-discovery' && category === 'dependency' &&
                selected.filter(id => byId.get(id)?.kind === 'dependency' && byId.get(id)?.path === item.path).length >= 4) continue;
            // Diversity prevents one package or repeated test surface from consuming a whole category.
            if (!refs.has(item.id) && category !== 'topology' &&
                (groupCounts.get(group(item.path)) ?? 0) >= (lowerStage ? 4 : 20)) continue;
            const next = [...selected, item.id];
            if (await estimate(next) > budget) continue;
            selected.push(item.id); selectedSet.add(item.id);
            counts.set(category, (counts.get(category) ?? 0) + 1);
            groupCounts.set(group(item.path), (groupCounts.get(group(item.path)) ?? 0) + 1);
        }
    }
    const request = makeRequest(selected);
    validateSynthesisStageRequest(request, packet);
    const inputTokens = await estimate(selected);
    if (inputTokens > budget) throw new Error('Evidence planner input exceeds budget');
    const includedEvidenceRefs = request.view.items.map(item => item.id);
    const omittedEvidenceRefs = packet.items.map(item => item.id).filter(id => !selectedSet.has(id)).sort();
    const selectionReasons = categories.filter(category => counts.has(category)).map(category => {
        const description: Record<Category, string> = {
            topology: 'workspace and package topology', entrypoint: 'runtime and public entrypoints',
            framework: 'framework bootstraps and registrations', dependency: 'direct dependency direction',
            configuration: 'application and project configuration', semantic: 'representative exported responsibilities',
        };
        return `${description[category]}: ${counts.get(category)} whole facts`;
    });
    if (refs.size) selectionReasons.push(`candidate scope: ${refs.size} parent evidence refs`);
    if (request.view.responsibilitySignals.length) selectionReasons.push(`${request.view.responsibilitySignals.length} cross-area responsibility cues from selected source facts`);
    if (stage === 'system-challenge') selectionReasons.push('cross-candidate dependencies, entrypoints, framework ownership and production counter-signals');
    if (stage === 'subsystem-discovery') selectionReasons.push('System support and cross-area responsibility signals; ownership remains proposed');
    if (stage === 'subsystem-challenge') selectionReasons.push('all initial Subsystem support and bounded cross-area counter evidence');
    if (stage === 'component-discovery') selectionReasons.push('challenged Subsystem responsibility and cross-area implementation neighbors');
    return { plannerVersion: EVIDENCE_PLANNER_VERSION,
        planId: digest([EVIDENCE_PLANNER_VERSION, stage, SYNTHESIS_STAGE_VERSION, packet.inputFingerprint,
            context, capability, request.view.viewId]), request, includedEvidenceRefs, omittedEvidenceRefs,
        selectionReasons, inputTokens, inputBudgetTokens: budget, tokenEstimate: capability.tokenEstimate };
}
