import { architectureProposalSchema } from './synthesis';
import { assertSynthesisInputBudget, synthesisStageResultSchemas } from './hierarchical-synthesis';
import type { SynthesisProvider, SynthesisStageRequest } from './hierarchical-synthesis';
import type { TargetedRefinementRequest } from './refinement';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ModelRuntime } from '@dope/contracts/lib/model-runtime';

const COMPACT_RULES = `Return only strict JSON for the supplied stage/version, parentPacketFingerprint and viewId. Use temporary candidate keys matching ^candidate:[A-Za-z0-9._-]+$ and supplied evidence IDs only. Name <=80 characters; responsibility is a semantic label <=160 characters. Use only schema-defined ambiguityCodes and finding codes. Do not emit explanations, rationale, uncertainty strings or other prose fields. view.documents are Documented context, never observed implementation evidence or canonical truth. Root MODULES.md is strong System/Subsystem intent; root README.md is secondary project orientation. Corroborate documented claims with implementation facts before proposing implemented boundaries. Prefer unresolved to invention. Never invent physical facts or canonical IDs.`;
export const SYSTEM_DISCOVERY_INSTRUCTION = `Discover repository-global Systems by independently meaningful software responsibility. One cohesive product may be one System. Return zero Systems only when production evidence supports no System responsibility. Responsibilities may span client, API, persistence and worker source areas; responsibilitySignals are derived cues, not architecture facts. Packages, runtime tiers, framework integrations, root manifests and start scripts provide context but cannot alone establish responsibility. Cite at least one direct source-backed production behavior fact per System. Do not force a count. ${COMPACT_RULES}`;
export const SYSTEM_CHALLENGE_INSTRUCTION = `Challenge every input System boundary against source-backed counter-evidence. For a one-System candidate, test umbrella collapse: does it merely name the repository or product while hiding independently meaningful System responsibilities? Check runtime, process, state and external contract boundaries for supported splits; keep one when behavior forms one coherent responsibility. Cover each source candidate exactly once: keep one with its key, merge two or more into one new key, split one into two or more new keys, or reject one with no output. Context facts such as manifests and start scripts cannot alone establish responsibility; cite direct production behavior for every output. Do not force a count. ${COMPACT_RULES}`;
const OWNERSHIP_RULE = 'ownershipEvidenceRefs must also appear in evidenceRefs and cite production view.items of kind semantic or entrypoint, or framework except import/container-module/manifest-extension. Never use dependency, topology, configuration, test, or document refs as ownership. Omit a boundary that lacks valid ownership.';
export const SUBSYSTEM_DISCOVERY_INSTRUCTION = `Discover Subsystems only under context.subjectSystemKey. Seek enduring responsibilities that may cross UI, HTTP/API, service, repository/state, worker/job and delivery/provider source areas. A technical plane or folder is evidence, not automatically a responsibility. ${OWNERSHIP_RULE} Return zero candidates when no useful subdivision is supported. ${COMPACT_RULES}`;
export const SUBSYSTEM_CHALLENGE_INSTRUCTION = `Challenge all initial Subsystems under context.subjectSystemKey. Inspect whether each boundary mainly mirrors client/server, frontend/backend, HTTP, persistence/database/repository, framework, worker/process or package/directory topology. Keep a technical-plane Subsystem when direct evidence shows that plane owns an independent responsibility, including an execution platform. Seek enduring responsibilities across source areas. Cover each source exactly once: keep one with its key, merge two or more into one fresh key, split one into two or more fresh keys, or reject one with no output. Optionally return recovered (at most four) for omitted responsibilities tied to an uncovered behavior responsibilitySignals cueKey and direct source-backed ownership. Do not recover from documents alone or duplicate covered ownership. If there are no source candidates, decisions is empty; recovery may still be source-backed. ${OWNERSHIP_RULE} Cite bounded counter evidence for every output. ${COMPACT_RULES}`;
export const COMPONENT_DISCOVERY_INSTRUCTION = `Discover Components only within the exact challenged context.subjectSubsystemKey under context.subjectSystemKey. ${OWNERSHIP_RULE} If components is empty, include exactly one disposition with kind leaf-responsibility, insufficient-evidence, responsibility-belongs-elsewhere, or no-stable-component-boundary; systemKey/subsystemKey must match the challenged parents, parentPacketFingerprint/viewId must match the request, and evidenceRefs must cite source-backed implementation ownership of the parent in the view. Omit disposition when components is nonempty. Prefer a truthful empty disposition to generic service/controller/database Components or folder mirrors with weak evidence. Documents including MODULES.md cannot prove a leaf. ${COMPACT_RULES}`;
export const RECONCILIATION_INSTRUCTION = `Review cross-System ownership, overlap, dependency, weak support and context.subtrees componentDescents. A leaf-responsibility is terminal, not a defect; insufficient-evidence remains unresolved; responsibility-belongs-elsewhere requires ownership challenge; no-stable-component-boundary remains explicit uncertainty. Return only typed findings with candidateKeys, evidenceRefs, status and code, plus unresolved candidateKey/code pairs. Each unresolved candidateKey may appear only once. Do not alter the hierarchy. ${COMPACT_RULES}`;
export const VERIFICATION_INSTRUCTION = `Check only context.boundaryCode for context.targetCandidateKeys using this bounded view. Return typed supported, uncertain or contradicted findings. Do not alter the hierarchy. ${COMPACT_RULES}`;
export const TARGET_REFINEMENT_INSTRUCTION = `Search deeper only within the supplied current edited target branch. Respect its manual names, parents, additions and removals. Return strict ArchitectureProposal JSON with schemaVersion 1, summary, needsMoreEvidence false, nodes, unassignedEvidenceRefs [], openQuestions, evidenceRequests []. Use proposal keys matching ^proposal:[A-Za-z0-9._-]+$, never canonical IDs. For a System target, propose only replacement System(s) and descendants. For a Subsystem target, include one context System parent as an unchanged anchor and propose replacement Subsystem(s) with Components only under that anchor; the anchor is never applied. Cite only view.items evidence IDs for every proposed boundary, including direct production behavior. coverageCues are diagnostic; documents are Documented orientation only and cannot prove implementation. Do not move content into siblings or other Systems. This is one bounded call, not recursive search.`;

/** Shared Software Map instructions; provider adapters only format and transport requests. */
export function synthesisInstruction(stage: SynthesisStageRequest['stage'] | TargetedRefinementRequest['stage']): string {
    switch (stage) {
        case 'system-discovery': return SYSTEM_DISCOVERY_INSTRUCTION;
        case 'system-challenge': return SYSTEM_CHALLENGE_INSTRUCTION;
        case 'subsystem-discovery': return SUBSYSTEM_DISCOVERY_INSTRUCTION;
        case 'subsystem-challenge': return SUBSYSTEM_CHALLENGE_INSTRUCTION;
        case 'component-discovery': return COMPONENT_DISCOVERY_INSTRUCTION;
        case 'reconciliation': return RECONCILIATION_INSTRUCTION;
        case 'verification': return VERIFICATION_INSTRUCTION;
        case 'target-refinement': return TARGET_REFINEMENT_INSTRUCTION;
    }
}

export const MAX_TRANSIENT_ATTEMPTS = 3;
/** Bounded Software Map recovery based on normalized failure, never provider identity. */
export function retrySynthesisFailure(failure: unknown, attempt: number): boolean {
    return failure instanceof ModelRuntimeFailure &&
        (failure.failureClass === 'transient-transport' || failure.failureClass === 'transient-upstream' ?
            attempt < MAX_TRANSIENT_ATTEMPTS : failure.failureClass === 'invalid-json' && attempt < 2);
}

/** Software Map strategy translates stage contracts into neutral model requests. */
export class SoftwareMapSynthesisStrategy implements SynthesisProvider {
    readonly warmUp?: () => Promise<void>;
    constructor(private readonly runtime: ModelRuntime) {
        if (runtime.warmUp) this.warmUp = () => runtime.warmUp!();
    }
    get kind() { return this.runtime.kind; }
    get runtimeIdentity() { return this.runtime.runtimeIdentity; }
    get isReady() { return this.runtime.isReady; }
    discoverModels() { return this.runtime.discoverModels(); }
    selectModel(modelId: string) { this.runtime.selectModel(modelId); }
    probe() { return this.runtime.probe(); }
    capabilities() { return this.runtime.capabilities(); }
    estimateTokens(input: string) { return this.runtime.estimateTokens(input); }
    runRefinement(request: TargetedRefinementRequest, signal?: AbortSignal) { return this.runStage(request, signal); }
    async runStage(request: SynthesisStageRequest | TargetedRefinementRequest, signal?: AbortSignal) {
        const input = JSON.stringify(request);
        await assertSynthesisInputBudget(this.runtime, await this.runtime.capabilities(), input);
        return this.runtime.generateStructured({ name: request.stage.replaceAll('-', '_'),
            instruction: synthesisInstruction(request.stage), input,
            schema: request.stage === 'target-refinement' ? architectureProposalSchema : synthesisStageResultSchemas[request.stage], signal });
    }
}
