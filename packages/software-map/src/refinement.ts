import { createArchitectureEvidenceView, usableEvidenceTokens } from './hierarchical-synthesis';
import type { ArchitectureEvidencePacket, ArchitectureProposal, DocumentSupport } from './synthesis';
import { isDirectSystemResponsibilityEvidence, parseArchitectureProposal } from './synthesis';
import type { ArchitectureReviewNode } from './service';
import type { CoverageLedgerEntry, SynthesisProvider } from './hierarchical-synthesis';

export type RefinementBasis = { reviewId: string; expectedCanonicalFingerprint?: never; providerKind?: never; modelLabel?: never } |
    { expectedCanonicalFingerprint: string; reviewId?: never; providerKind: 'local' | 'gemini'; modelLabel: string };
export type TargetedRefinementInput = RefinementBasis & {
    targetKey: string;
    targetKind: 'system' | 'subsystem';
    parentKey: string | null;
    parentContext?: ArchitectureReviewNode;
    branchFingerprint: string;
    branch: ArchitectureReviewNode[];
};
export type TargetedRefinementRequest = TargetedRefinementInput & {
    stage: 'target-refinement';
    parentPacketFingerprint: string;
    view: ReturnType<typeof createArchitectureEvidenceView>;
    coverageCues: CoverageLedgerEntry[];
    documents: DocumentSupport[];
};
export type TargetedRefinementResult = TargetedRefinementInput & {
    parentPacketFingerprint: string;
    proposal: ArchitectureProposal;
    evidence?: { id: string; kind: string; path: string; uri: string; sourcePaths?: string[] }[];
};

/** Branch order does not affect revision; every editable field and descendant does. */
export function branchFingerprint(branch: ArchitectureReviewNode[], parentContext?: ArchitectureReviewNode): string {
    const value = JSON.stringify([parentContext ?? null, ...[...branch].sort((a, b) => a.proposalKey.localeCompare(b.proposalKey))]);
    let hash = 0xcbf29ce484222325n;
    for (const byte of new TextEncoder().encode(value)) hash = (hash ^ BigInt(byte)) * 0x100000001b3n & 0xffffffffffffffffn;
    return `branch:v1:${hash.toString(16).padStart(16, '0')}`;
}
export function targetBranch(draft: ArchitectureReviewNode[], key: string): ArchitectureReviewNode[] {
    const descendants = new Set([key]);
    for (let changed = true; changed;) {
        changed = false;
        for (const node of draft) if (node.parentProposalKey && descendants.has(node.parentProposalKey) && !descendants.has(node.proposalKey)) {
            descendants.add(node.proposalKey); changed = true;
        }
    }
    return draft.filter(node => descendants.has(node.proposalKey));
}
export function validateTarget(input: TargetedRefinementInput): void {
    if ((!input.reviewId && !input.expectedCanonicalFingerprint) || !!input.reviewId === !!input.expectedCanonicalFingerprint ||
        input.expectedCanonicalFingerprint && (!input.providerKind || !input.modelLabel) ||
        !input.targetKey || !['system', 'subsystem'].includes(input.targetKind) ||
        !Array.isArray(input.branch) || !input.branch.length || input.branch.length > 100 ||
        input.branchFingerprint !== branchFingerprint(input.branch, input.parentContext)) throw new Error('Invalid refinement branch');
    const root = input.branch.find(node => node.proposalKey === input.targetKey);
    if (!root || root.kind !== input.targetKind || root.parentProposalKey !== input.parentKey ||
        input.targetKind === 'system' && input.parentKey !== null || input.targetKind === 'subsystem' && !input.parentKey ||
        input.targetKind === 'system' && input.parentContext !== undefined ||
        input.targetKind === 'subsystem' && (input.parentContext?.kind !== 'system' || input.parentContext.proposalKey !== input.parentKey) ||
        new Set(input.branch.map(node => node.proposalKey)).size !== input.branch.length ||
        targetBranch(input.branch, input.targetKey).length !== input.branch.length ||
        input.branch.some(node => node !== root && !input.branch.some(parent => parent.proposalKey === node.parentProposalKey &&
            parent.kind === (node.kind === 'subsystem' ? 'system' : 'subsystem'))) ||
        input.branch.some(node => node !== root && (node.kind === 'system' ||
            input.targetKind === 'subsystem' && node.kind !== 'component'))) throw new Error('Invalid refinement target');
}

/** Select evidence from the explicitly pinned review or accepted-edit packet. */
export async function planTargetedRefinement(input: TargetedRefinementInput, packet: ArchitectureEvidencePacket,
    ledger: CoverageLedgerEntry[], provider: SynthesisProvider, original?: ArchitectureProposal): Promise<TargetedRefinementRequest> {
    validateTarget(input);
    const refs = new Set(input.branch.flatMap(node => node.roots));
    if (!refs.size) for (const root of input.parentContext?.roots ?? []) refs.add(root);
    const previous = new Set(input.branch.flatMap(node => node.proposalKey));
    const originalRefs = new Set(original?.nodes.filter(node => previous.has(node.proposalKey)).flatMap(node => node.evidenceRefs) ?? []);
    const unscoped = !refs.size && !originalRefs.size;
    const related = (ref: string): boolean => originalRefs.has(ref) || packet.items.some(item => item.id === ref &&
        [...refs].some(path => item.path === path || item.path.startsWith(`${path}/`) || path.startsWith(`${item.path}/`)));
    const cues = ledger.filter(cue => cue.candidateKeys.some(key => previous.has(key)) || cue.evidenceRefs.some(related) ||
        unscoped && cue.status === 'unresolved').slice(0, 16);
    const priority = new Set([...originalRefs, ...cues.flatMap(cue => cue.evidenceRefs),
        ...(unscoped ? packet.items.filter(isDirectSystemResponsibilityEvidence).slice(0, 24).map(item => item.id) : [])]);
    const items = [...packet.items].filter(item => item.sourceEvidenceIds.length &&
        (priority.has(item.id) || related(item.id)));
    const ordered = items.sort((a, b) => Number(priority.has(b.id)) - Number(priority.has(a.id)) ||
        Number(isDirectSystemResponsibilityEvidence(b)) - Number(isDirectSystemResponsibilityEvidence(a)) || a.id.localeCompare(b.id));
    const documents = (packet.documents ?? []).filter(doc => ['modules-seed', 'readme-orientation'].includes(doc.class) ||
        [...refs].some(path => doc.path.startsWith(path.split('/').slice(0, 2).join('/')))).slice(0, 6)
        .map(doc => ({ ...doc, content: doc.content.slice(0, 4000), truncated: doc.truncated || doc.content.length > 4000 }));
    const base = { ...input, stage: 'target-refinement' as const, parentPacketFingerprint: packet.inputFingerprint,
        coverageCues: cues, documents };
    const ids: string[] = [];
    const budget = usableEvidenceTokens(await provider.capabilities());
    for (const item of ordered.slice(0, 120)) {
        const next = [...ids, item.id];
        const request = { ...base, view: createArchitectureEvidenceView(packet, next) };
        if (await provider.estimateTokens(JSON.stringify(request)) <= budget) ids.push(item.id);
    }
    if (!ids.some(id => isDirectSystemResponsibilityEvidence(packet.items.find(item => item.id === id)!)))
        throw new Error('Targeted refinement needs bounded observed implementation evidence');
    return { ...base, view: createArchitectureEvidenceView(packet, ids) };
}

export function parseTargetedRefinement(output: unknown, request: TargetedRefinementRequest,
    packet: ArchitectureEvidencePacket): TargetedRefinementResult {
    const proposal = parseArchitectureProposal(output, packet);
    const roots = proposal.nodes.filter(node => node.kind === request.targetKind);
    const parent = request.targetKind === 'subsystem' ? proposal.nodes.find(node => node.kind === 'system') : undefined;
    if (!roots.length || proposal.nodes.length > 100 ||
        proposal.nodes.some(node => !node.evidenceRefs.length || node.evidenceRefs.some(ref => !request.view.items.some(item => item.id === ref))) ||
        request.targetKind === 'subsystem' && (proposal.nodes.filter(node => node.kind === 'system').length !== 1 || !parent) ||
        proposal.nodes.some(node => node.kind === 'subsystem' && request.targetKind === 'subsystem' && node.parentProposalKey !== parent?.proposalKey ||
            node.kind === 'component' && request.targetKind === 'system' && !proposal.nodes.some(parent => parent.proposalKey === node.parentProposalKey && parent.kind === 'subsystem')) ||
        roots.some(node => request.targetKind === 'system' && node.parentProposalKey !== null || !node.evidenceRefs.some(ref =>
            isDirectSystemResponsibilityEvidence(packet.items.find(item => item.id === ref)!))) ||
        proposal.nodes.some(node => node.kind !== 'system' && !node.evidenceRefs.some(ref =>
            isDirectSystemResponsibilityEvidence(packet.items.find(item => item.id === ref)!))))
        throw new Error('Invalid targeted refinement boundary');
    return { ...(request.reviewId ? { reviewId: request.reviewId } : { expectedCanonicalFingerprint: request.expectedCanonicalFingerprint!,
        providerKind: request.providerKind!, modelLabel: request.modelLabel! }),
        targetKey: request.targetKey, targetKind: request.targetKind,
        parentKey: request.parentKey, ...(request.parentContext ? { parentContext: request.parentContext } : {}),
        branchFingerprint: request.branchFingerprint, branch: request.branch,
        parentPacketFingerprint: request.parentPacketFingerprint, proposal };
}
