import { architectureProposalSchema, parseArchitectureProposalJson, validateArchitectureEvidencePacket } from '@dope/software-map';
import type { ArchitectureEvidencePacket, ArchitectureProposal, ArchitectureSynthesisProvider } from '@dope/software-map';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:1234/v1';
const readySchema = {
    type: 'object', additionalProperties: false, required: ['ready'],
    properties: { ready: { type: 'boolean', enum: [true] } },
} as const;

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

export class LmStudioSynthesisProvider implements ArchitectureSynthesisProvider {
    readonly endpoint: string;
    private readonly token?: string;
    private readonly timeoutMs: number;
    private models: string[] = [];
    private modelId?: string;
    private probed = false;
    private warmKey?: string;
    private generation = 0;
    private warmPromise?: Promise<void>;

    constructor(options: { endpoint?: string; token?: string; timeoutMs?: number } = {}) {
        this.endpoint = normalizeSynthesisEndpoint(options.endpoint);
        if (options.token !== undefined && !/^[^\s]+$/.test(options.token)) throw new Error('Invalid synthesis token');
        if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1)) throw new Error('Invalid synthesis timeout');
        this.token = options.token;
        this.timeoutMs = options.timeoutMs ?? 120_000;
    }

    get selectedModel(): string | undefined { return this.modelId; }

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

    async synthesize(packet: ArchitectureEvidencePacket): Promise<ArchitectureProposal> {
        validateArchitectureEvidencePacket(packet);
        const model = this.requireModel();
        if (!this.probed) throw new Error('Synthesis capability probe required');
        const generation = this.generation;
        await this.ensureWarm(model);
        if (generation !== this.generation || model !== this.modelId || !this.probed) throw new Error('Synthesis connection changed before packet submission');
        try {
            const response = await this.chat(model, architectureProposalSchema, 'architecture_proposal',
                'Propose Systems, Subsystems and Components from the supplied deterministic evidence. Use only packet item IDs for evidenceRefs. Return only the required JSON proposal. Do not invent physical facts or canonical IDs.',
                JSON.stringify(packet));
            if (generation !== this.generation || model !== this.modelId) throw new Error('Synthesis connection changed');
            return parseArchitectureProposalJson(this.content(response), packet);
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
            temperature: 0, max_tokens: name === 'readiness' ? 16 : 8192,
        });
    }

    private content(response: unknown): string {
        const choice = (response as { choices?: Array<{ message?: { content?: unknown; refusal?: unknown } }> } | null)?.choices?.[0];
        if (choice?.message?.refusal) throw new Error('Synthesis model refused the request');
        if (typeof choice?.message?.content !== 'string') throw new Error('Invalid synthesis response');
        return choice.message.content;
    }

    private async request(path: string, body?: object): Promise<unknown> {
        let response: Response;
        try {
            response = await fetch(`${this.endpoint}${path}`, {
                method: body ? 'POST' : 'GET',
                headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        } catch {
            this.invalidateWarmState();
            this.probed = false;
            throw new Error('Synthesis connection failed or timed out');
        }
        if (!response.ok) {
            this.invalidateWarmState();
            this.probed = false;
            throw new Error(`Synthesis HTTP ${response.status}`);
        }
        try { return await response.json(); } catch {
            this.invalidateWarmState();
            this.probed = false;
            throw new Error('Invalid synthesis HTTP JSON');
        }
    }
}
