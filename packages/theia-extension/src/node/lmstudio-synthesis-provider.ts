import { architectureProposalSchema, assertSynthesisInputBudget, synthesisStageResultSchemas } from '@dope/software-map';
import type { SynthesisCapabilities, SynthesisStageRequest, SynthesisStageExecution, TargetedRefinementRequest } from '@dope/software-map';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:1234/v1';
export const DEFAULT_SYNTHESIS_TIMEOUT_MS = 900_000;
const readySchema = {
    type: 'object', additionalProperties: false, required: ['ready'],
    properties: { ready: { type: 'boolean', enum: [true] } },
} as const;
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

export function normalizeSynthesisEndpoint(value = DEFAULT_ENDPOINT): string {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Invalid synthesis endpoint'); }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password ||
        url.search || url.hash || !['/', '/v1', '/v1/'].includes(url.pathname)) throw new Error('Invalid synthesis endpoint');
    return `${url.origin}/v1`;
}

/** The actual runtime ID is retained; only display ordering prefers the reference family. */
export function preferredSynthesisModel(models: readonly string[]): string | undefined {
    return models.find(id => /qwen3[-_. ]coder[-_. ]30b[-_. ]a3b[-_. ]instruct/i.test(id)) ?? models[0];
}

export class LmStudioSynthesisProvider {
    readonly kind = 'local' as const;
    readonly endpoint: string;
    private readonly token?: string;
    private readonly timeoutMs: number;
    private readonly synthesisTimeoutMs: number;
    private models: string[] = [];
    private modelId?: string;
    private probed = false;
    private warmKey?: string;
    private generation = 0;
    private warmPromise?: Promise<void>;
    private readonly contextWindowTokens?: number;

    constructor(options: { endpoint?: string; token?: string; timeoutMs?: number; contextWindowTokens?: number } = {}) {
        this.endpoint = normalizeSynthesisEndpoint(options.endpoint);
        if (options.token !== undefined && !/^[^\s]+$/.test(options.token)) throw new Error('Invalid synthesis token');
        if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1)) throw new Error('Invalid synthesis timeout');
        this.token = options.token;
        this.timeoutMs = options.timeoutMs ?? 120_000;
        this.synthesisTimeoutMs = options.timeoutMs ?? DEFAULT_SYNTHESIS_TIMEOUT_MS;
        if (options.contextWindowTokens !== undefined && (!Number.isSafeInteger(options.contextWindowTokens) || options.contextWindowTokens < 8192))
            throw new Error('Invalid synthesis context capacity');
        this.contextWindowTokens = options.contextWindowTokens;
    }

    get selectedModel(): string | undefined { return this.modelId; }
    get isProbed(): boolean { return this.probed; }

    /** Calling discovery again represents a reconnect and invalidates readiness. */
    async discoverModels(): Promise<string[]> {
        this.invalidateWarmState();
        this.probed = false;
        this.models = [];
        const data = await this.request('/models');
        if (!data || typeof data !== 'object' || !Array.isArray((data as { data?: unknown }).data)) throw new Error('Invalid synthesis model list');
        const ids = (data as { data: unknown[] }).data.map(entry => {
            const id = (entry as { id?: unknown } | null)?.id;
            if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid synthesis model list');
            return id;
        });
        this.models = [...new Set(ids)];
        if (this.modelId && !this.models.includes(this.modelId)) this.modelId = undefined;
        return [...this.models];
    }

    selectModel(modelId: string): void {
        if (!this.models.includes(modelId)) throw new Error('Synthesis model is unavailable');
        if (this.modelId !== modelId) {
            this.invalidateWarmState();
            this.probed = false;
            this.modelId = modelId;
        }
    }

    /** The caller invokes this during connection setup; it contains no project data. */
    async probe(): Promise<void> {
        const model = this.requireModel();
        this.invalidateWarmState();
        const generation = this.generation;
        this.probed = false;
        await this.synthetic(model, 'probe');
        if (generation !== this.generation || model !== this.modelId) throw new Error('Synthesis connection changed during probe');
        this.probed = true;
    }

    /** Call when the runtime is restarted or the selected model is known to be unloaded. */
    invalidateWarmState(): void {
        this.generation++;
        this.warmKey = undefined;
        this.warmPromise = undefined;
    }

    async capabilities(): Promise<SynthesisCapabilities> {
        const model = this.requireModel();
        if (!this.contextWindowTokens) throw new Error('Synthesis context capacity must be configured');
        return { modelLabel: model, contextWindowTokens: this.contextWindowTokens,
            maxInputTokens: this.contextWindowTokens, reservedInstructionTokens: 2048,
            reservedOutputTokens: 4096, reservedOverheadTokens: 1024, tokenEstimate: 'conservative',
            maxConcurrentGenerations: 1 };
    }

    /** Conservative fallback for the local adapter; a provider tokenizer can replace this. */
    async estimateTokens(input: string): Promise<number> { return new TextEncoder().encode(input).length; }

    /** A synthetic readiness request; no repository evidence is sent until this succeeds. */
    async warmUp(): Promise<void> {
        const model = this.requireModel();
        if (!this.probed) throw new Error('Synthesis capability probe required');
        await this.ensureWarm(model);
    }

    async runRefinement(request: TargetedRefinementRequest): Promise<SynthesisStageExecution> { return this.runStage(request); }

    async runStage(request: SynthesisStageRequest | TargetedRefinementRequest): Promise<SynthesisStageExecution> {
        const model = this.requireModel();
        if (!this.probed) throw new Error('Synthesis capability probe required');
        const capability = await this.capabilities();
        const input = JSON.stringify(request);
        await assertSynthesisInputBudget(this, capability, input);
        const generation = this.generation;
        await this.ensureWarm(model);
        if (generation !== this.generation || model !== this.modelId || !this.probed)
            throw new Error('Synthesis connection changed before stage submission');
        try {
            const stage = request.stage;
            const response = await this.chat(model, stage === 'target-refinement' ? architectureProposalSchema : synthesisStageResultSchemas[stage],
                stage.replaceAll('-', '_'), stage === 'system-challenge' ? SYSTEM_CHALLENGE_INSTRUCTION :
                    stage === 'target-refinement' ? TARGET_REFINEMENT_INSTRUCTION :
                    stage === 'subsystem-discovery' ? SUBSYSTEM_DISCOVERY_INSTRUCTION :
                    stage === 'subsystem-challenge' ? SUBSYSTEM_CHALLENGE_INSTRUCTION :
                    stage === 'component-discovery' ? COMPONENT_DISCOVERY_INSTRUCTION :
                    stage === 'reconciliation' ? RECONCILIATION_INSTRUCTION :
                    stage === 'verification' ? VERIFICATION_INSTRUCTION : SYSTEM_DISCOVERY_INSTRUCTION, input);
            if (generation !== this.generation || model !== this.modelId) throw new Error('Synthesis connection changed');
            try {
                const content = this.content(response);
                const requestBytes = Buffer.byteLength(input);
                const reported = (response as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown;
                    total_tokens?: unknown } }).usage;
                const count = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : undefined;
                const inputTokens = count(reported?.prompt_tokens);
                const outputTokens = count(reported?.completion_tokens);
                const totalTokens = count(reported?.total_tokens);
                const hasReported = inputTokens !== undefined || outputTokens !== undefined || totalTokens !== undefined;
                return { output: JSON.parse(content), usage: { providerKind: 'local', modelLabel: model,
                    requestBytes, outputBytes: Buffer.byteLength(content),
                    ...(hasReported ? (inputTokens === undefined ? {} : { inputTokens }) : { inputTokens: requestBytes }),
                    ...(outputTokens === undefined ? {} : { outputTokens }),
                    ...(totalTokens === undefined ? {} : { totalTokens }),
                    tokenMeasurement: hasReported ? 'provider-reported' : 'estimated' } };
            }
            catch (error) { if (error instanceof SyntaxError) throw new Error(`Invalid ${stage} JSON`); throw error; }
        } catch (error) {
            this.invalidateWarmState();
            throw error;
        }
    }

    private requireModel(): string {
        if (!this.modelId || !this.models.includes(this.modelId)) throw new Error('Synthesis model is unavailable');
        return this.modelId;
    }

    private async ensureWarm(model: string): Promise<void> {
        const key = `${this.endpoint}\n${model}`;
        if (this.warmKey === key) return;
        if (!this.warmPromise) {
            const generation = this.generation;
            this.warmPromise = this.synthetic(model, 'warm-up').then(() => {
                if (generation !== this.generation || model !== this.modelId) throw new Error('Synthesis connection changed during warm-up');
                this.warmKey = key;
            }).catch(error => {
                if (generation === this.generation) {
                    this.invalidateWarmState();
                    this.probed = false;
                }
                throw error;
            });
        }
        const pending = this.warmPromise;
        try { await pending; } finally { if (this.warmPromise === pending) this.warmPromise = undefined; }
    }

    private async synthetic(model: string, purpose: string): Promise<void> {
        const response = await this.chat(model, readySchema, 'readiness',
            `This is a synthetic ${purpose} check. Return {"ready":true}.`, 'Return readiness for this synthetic request.');
        let value: unknown;
        try { value = JSON.parse(this.content(response)); } catch { throw new Error('Invalid synthesis readiness JSON'); }
        if (!value || typeof value !== 'object' || Array.isArray(value) ||
            Object.keys(value).length !== 1 || (value as { ready?: unknown }).ready !== true) throw new Error('Invalid synthesis readiness response');
    }

    private async chat(model: string, schema: object, name: string, system: string, user: string): Promise<unknown> {
        return this.request('/chat/completions', {
            model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
            temperature: 0, max_tokens: name === 'readiness' ? 16 : 4096,
        }, name === 'readiness' ? this.timeoutMs : this.synthesisTimeoutMs);
    }

    private content(response: unknown): string {
        const choice = (response as { choices?: Array<{ message?: { content?: unknown; refusal?: unknown } }> } | null)?.choices?.[0];
        if (choice?.message?.refusal) throw new Error('Synthesis model refused the request');
        if (typeof choice?.message?.content !== 'string') throw new Error('Invalid synthesis response');
        return choice.message.content;
    }

    private async request(path: string, body?: object, timeoutMs = this.timeoutMs): Promise<unknown> {
        let response: { status: number; text: string };
        try {
            const url = new URL(`${this.endpoint}${path}`);
            response = await new Promise((resolve, reject) => {
                const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
                    method: body ? 'POST' : 'GET',
                    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
                    signal: AbortSignal.timeout(timeoutMs),
                }, incoming => {
                    const chunks: Buffer[] = [];
                    incoming.on('data', chunk => chunks.push(Buffer.from(chunk)));
                    incoming.on('end', () => resolve({ status: incoming.statusCode ?? 0, text: Buffer.concat(chunks).toString() }));
                    incoming.on('error', reject);
                });
                request.on('error', reject);
                request.end(body ? JSON.stringify(body) : undefined);
            });
        } catch {
            this.invalidateWarmState();
            this.probed = false;
            throw new Error('Synthesis connection failed or timed out');
        }
        if (response.status < 200 || response.status >= 300) {
            this.invalidateWarmState();
            this.probed = false;
            throw new Error(`Synthesis HTTP ${response.status}`);
        }
        try { return JSON.parse(response.text); } catch {
            this.invalidateWarmState();
            this.probed = false;
            throw new Error('Invalid synthesis HTTP JSON');
        }
    }
}
