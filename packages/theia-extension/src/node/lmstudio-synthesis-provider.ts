import { assertSynthesisInputBudget, synthesisStageResultSchemas } from '@dope/software-map';
import type { SynthesisCapabilities, SynthesisStageRequest, SynthesisStageExecution } from '@dope/software-map';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:1234/v1';
export const DEFAULT_SYNTHESIS_TIMEOUT_MS = 900_000;
const readySchema = {
    type: 'object', additionalProperties: false, required: ['ready'],
    properties: { ready: { type: 'boolean', enum: [true] } },
} as const;
const COMPACT_RULES = `Return only strict JSON for the supplied stage/version, parentPacketFingerprint and viewId. Use temporary candidate keys and supplied evidence IDs only. Name <=80 characters; responsibility is a semantic label <=160 characters. Use only schema-defined ambiguityCodes and finding codes. Do not emit explanations, rationale, uncertainty strings or other prose fields. Never invent physical facts or canonical IDs.`;
export const SYSTEM_DISCOVERY_INSTRUCTION = `Discover repository-global candidate Systems with independent responsibilities and enough owned behavior for lower-level structure. Packages, application variants, framework integrations and UI surfaces alone are not Systems. Do not force a count. Cite direct production evidence. ${COMPACT_RULES}`;
export const SYSTEM_CHALLENGE_INSTRUCTION = `Challenge every input System boundary against source-backed counter-evidence. Cover each source candidate exactly once: keep one with its key, merge two or more into one new key, split one into two or more new keys, or reject one with no output. Cite directly relevant production evidence for outputs. Do not force a count. ${COMPACT_RULES}`;
export const SUBSYSTEM_DISCOVERY_INSTRUCTION = `Discover useful Subsystems and Components only inside context.subjectSystemKey. A Subsystem may span several packages; one package may contain several Components. A folder alone is not an architecture boundary. Each node cites direct ownershipEvidenceRefs that are a subset of evidenceRefs. Component parents must be Subsystems in this pass. Return zero nodes with typed ambiguityCodes when no useful subdivision is supported. ${COMPACT_RULES}`;
export const RECONCILIATION_INSTRUCTION = `Review cross-System ownership, overlap, dependency and weak support. Return only typed findings with candidateKeys, evidenceRefs, status and code, plus unresolved candidateKey/code pairs. Do not alter the hierarchy. ${COMPACT_RULES}`;
export const VERIFICATION_INSTRUCTION = `Check only context.boundaryCode for context.targetCandidateKeys using this bounded view. Return typed supported, uncertain or contradicted findings. Do not alter the hierarchy. ${COMPACT_RULES}`;

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

    async runStage(request: SynthesisStageRequest): Promise<SynthesisStageExecution> {
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
            const response = await this.chat(model, synthesisStageResultSchemas[request.stage],
                stage.replaceAll('-', '_'), stage === 'system-challenge' ? SYSTEM_CHALLENGE_INSTRUCTION :
                    stage === 'subsystem-discovery' ? SUBSYSTEM_DISCOVERY_INSTRUCTION :
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
