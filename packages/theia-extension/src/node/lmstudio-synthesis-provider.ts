import { architectureProposalSchema, assertSynthesisInputBudget, parseArchitectureProposal,
    synthesisStageResultSchemas, validateArchitectureEvidencePacket } from '@dope/software-map';
import type { ArchitectureEvidencePacket, ArchitectureProposal, SynthesisCapabilities,
    SynthesisStageRequest } from '@dope/software-map';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:1234/v1';
export const DEFAULT_SYNTHESIS_TIMEOUT_MS = 900_000;
const readySchema = {
    type: 'object', additionalProperties: false, required: ['ready'],
    properties: { ready: { type: 'boolean', enum: [true] } },
} as const;
export const SYSTEM_DISCOVERY_INSTRUCTION = `Discover candidate Systems from the bounded repository-global deterministic evidence view.
A System is a major independently meaningful software, runtime or product responsibility with a coherent architectural boundary and enough owned behavior to contain lower-level structure.
A directory, package, framework, UI panel, persistence mechanism, Browser variant or Electron variant is not a System merely because it is separately named or deployed. Multiple packages can serve one System; one repository can contain multiple Systems. Do not force a target count.
Return only candidate Systems. Do not infer or emit Subsystems or Components, and do not generate canonical architecture IDs. Each candidate needs a temporary candidateKey, name, purpose, boundaryRationale explaining the responsibility and boundary signals, confidence, uncertainty or counter-signals, and directly relevant evidenceRefs from this view. Test fixtures or generated files cannot be the sole support for a production System. Use only supplied evidence IDs; do not invent facts, request filesystem access, or use tools. The complete parent packet is retained by Dope for validation. Return only the strict JSON stage result, including the supplied stage/version, parentPacketFingerprint and viewId.`;
export const SYSTEM_CHALLENGE_INSTRUCTION = `Independently challenge the supplied first-pass System candidates using their cited facts and the bounded deterministic counter and cross-boundary evidence view. Produce an explicit disposition for every input candidate. A System owns a major independent responsibility with enough behavior for lower-level structure; a package, Browser or Electron application shell, transport/runtime variant, persistence mechanism, framework integration, or UI surface alone does not establish one.
For each candidate or candidate group choose exactly one action: keep one candidate with its existing temporary key; merge two or more candidates into one corrected candidate with a new temporary key; split one candidate into two or more corrected candidates with new temporary keys; or reject one candidate with no output System. No candidate may appear in more than one decision. For every decision explain why the boundary holds or changes and cite evidenceRefs from this view. Every resulting System must cite directly relevant source-backed production behavior; test/example/generated facts alone are insufficient. Keep candidate keys temporary; never use canonical architecture IDs.
Actively test whether each candidate owns an independent responsibility, whether candidates jointly implement one responsibility, whether a broad candidate hides separate responsibilities, and whether dependency direction, entrypoints, framework registrations, ownership or counter-evidence undermine the initial boundaries. Do not assume the first pass is correct. Do not force a target System count. Use only supplied facts; do not invent evidence, access files, or use tools. Return only strict JSON for the system-challenge stage with decisions, supplied stage/version, parentPacketFingerprint and viewId. Do not emit Subsystems, Components or a final architecture proposal.`;
export const SUBSYSTEM_DISCOVERY_INSTRUCTION = `Discover coherent Subsystems and Components only inside the challenged System named by context.subjectSystemKey. This is one bounded per-System pass. The view carries whole deterministic facts with original parent-packet IDs; the System's cited facts and boundary neighbors are proposal context, not ownership truth.
A Subsystem has a distinct responsibility and may span several packages. A directory or package alone is not a Subsystem. A Component is a cohesive implementation unit under one Subsystem, not every file, class or function. One package may contain several Components. Do not force a count. If evidence does not support useful subdivision, return zero nodes and explain that explicitly in subdivisionAssessment with confidence and uncertainty. Otherwise, each Subsystem needs temporary candidateKey, parentCandidateKey equal to the subject System, name, purpose, rationale, siblingDistinction, confidence, uncertainty, directly relevant evidenceRefs and ownershipEvidenceRefs for direct production behavior. Each Component needs the same fields and a parentCandidateKey naming a Subsystem from this output. ownershipEvidenceRefs must be a subset of evidenceRefs. Distinguish siblings by responsibility, not folder name. Never claim another System's boundary, fabricate refs, create canonical IDs, or emit a final ArchitectureProposal. Return only strict subsystem-discovery JSON with supplied stage/version, parentPacketFingerprint, viewId, systemKey, nodes and subdivisionAssessment.`;
export const RECONCILIATION_INSTRUCTION = `Review the challenged Systems and their per-System Subsystem and Component candidates against the bounded deterministic cross-System evidence. Identify responsibility duplication, contradictory ownership, overlapping source regions, weak support and dependencies that may challenge a boundary. Structural conflicts are also audited by Dope independently. Return findings with candidateKeys, evidenceRefs from this view, status and concise message; list unresolvedCandidateKeys. Do not rewrite candidate hierarchy, claim canonical identity or invent evidence. A finding is interpretation, not physical fact. Return strict reconciliation JSON with supplied stage/version, parentPacketFingerprint and viewId.`;
export const VERIFICATION_INSTRUCTION = `Answer only context.boundaryQuestion about context.targetCandidateKeys using directly relevant candidate state and this small deterministic evidence view. Return supported, uncertain or contradicted findings with targeted candidateKeys, evidenceRefs from this view and a concise message. If evidence cannot settle the question, return uncertain. Do not request more evidence, alter hierarchy, invent facts or claim canonical identity. Return strict verification JSON with supplied stage/version, parentPacketFingerprint and viewId.`;

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

    async runStage(request: SynthesisStageRequest): Promise<unknown> {
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
            try { return JSON.parse(this.content(response)); }
            catch (error) { if (error instanceof SyntaxError) throw new Error(`Invalid ${stage} JSON`); throw error; }
        } catch (error) {
            this.invalidateWarmState();
            throw error;
        }
    }

    async synthesize(packet: ArchitectureEvidencePacket): Promise<ArchitectureProposal> {
        validateArchitectureEvidencePacket(packet);
        const model = this.requireModel();
        if (!this.probed) throw new Error('Synthesis capability probe required');
        const generation = this.generation;
        await this.ensureWarm(model);
        if (generation !== this.generation || model !== this.modelId || !this.probed) throw new Error('Synthesis connection changed before packet submission');
        try {
            const priority = { topology: 0, framework: 1, entrypoint: 2, configuration: 3, dependency: 4, semantic: 5 };
            const facts = [...packet.items].sort((a, b) => priority[a.kind] - priority[b.kind] || a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
            const paths = [...new Set(facts.flatMap(item => [item.path, ...('sourcePaths' in item ? item.sourcePaths ?? [] : []),
                ...('workspaces' in item ? item.workspaces ?? [] : []), ...('targetPath' in item ? [item.targetPath] : [])]))].sort();
            const pathIndex = new Map(paths.map((path, index) => [path, index]));
            const refs = new Map(facts.map((item, index) => [`e${index + 1}`, item.id]));
            // Keep the exact packet server-side; send every fact with short refs and a path dictionary to fit local context.
            const compact = { fingerprint: packet.inputFingerprint, paths, items: facts.map((item, index) => {
                const { id, sourceEvidenceIds, ...fact } = item;
                const result: Record<string, unknown> = { ref: `e${index + 1}`, ...fact, path: pathIndex.get(item.path) };
                delete result.relationshipIds;
                delete result.producer;
                delete result.producerVersion;
                if ('targetPath' in item) result.targetPath = pathIndex.get(item.targetPath);
                if ('sourcePaths' in item && item.sourcePaths) result.sourcePaths = item.sourcePaths.map(path => pathIndex.get(path));
                if ('workspaces' in item && item.workspaces) result.workspaces = item.workspaces.map(path => pathIndex.get(path));
                return result;
            }) };
            const response = await this.chat(model, architectureProposalSchema, 'architecture_proposal',
                'Propose a concise hierarchy from the deterministic facts. Every System has null parent; every Subsystem parents a System; every Component parents a Subsystem. A package or application variant is evidence, not automatically a System. Facts are ordered with topology and framework registrations first; each path number indexes paths. Give each node 1-4 directly relevant, distinct fact aliases (e1, e2, etc.) in evidenceRefs, including frontend/view and backend/RPC or DI facts where relevant. Do not use test fixtures or unrelated facts to support production boundaries. Limit unassignedEvidenceRefs to 10 representative facts. Keep rationale and evidence brief. Return only the required JSON proposal. Do not invent physical facts or canonical IDs.',
                JSON.stringify(compact));
            if (generation !== this.generation || model !== this.modelId) throw new Error('Synthesis connection changed');
            let value: unknown;
            const content = this.content(response);
            try { value = JSON.parse(content); } catch { throw new Error('Invalid architecture proposal: malformed JSON'); }
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const output = value as Record<string, unknown>;
                const expand = (items: unknown) => Array.isArray(items) ? items.map(ref => typeof ref === 'string' ? refs.get(ref) ?? ref : ref) : items;
                if (Array.isArray(output.nodes)) for (const node of output.nodes) {
                    if (node && typeof node === 'object' && !Array.isArray(node)) node.evidenceRefs = expand(node.evidenceRefs);
                }
                output.unassignedEvidenceRefs = expand(output.unassignedEvidenceRefs);
            }
            return parseArchitectureProposal(value, packet);
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
