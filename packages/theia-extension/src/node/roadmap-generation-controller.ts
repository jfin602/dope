import { randomUUID } from 'node:crypto';

/** Transient scheduling state. The RoadmapStore and native stage owner remain the only data authorities. */
export type GenerationState = 'initializing' | 'generating-phase' | 'validating' | 'staging' |
    'review-ready' | 'incomplete' | 'failed' | 'cancelled' | 'stale';
export type GenerationIdentity = Readonly<{ generationId: string; root: string; projectId: string;
    revision: number; sourceHash: string | null; indexHash: string | null;
    chatId: string; turnId: string; ownerId: string;
    model: Readonly<{ connectionId: string; modelId: string; providerId: 'local';
        contextWindowTokens: number; reasoningControls: Readonly<Record<string, string>> }>;
    origin: 'trusted-user-chat' }>;
export type GenerationLimits = Readonly<{ maxPhases: number; maxGatesPerPhase: number;
    maxSubcallsPerPhase: number; maxCalls: number; maxTokens: number; idleMs: number;
    deadlineMs: number; maxRetries: number }>;
export const defaultGenerationLimits: GenerationLimits = {
    maxPhases: 12, maxGatesPerPhase: 12, maxSubcallsPerPhase: 8, maxCalls: 64,
    maxTokens: 256_000, idleMs: 60_000, deadlineMs: 8 * 60_000, maxRetries: 1
};
export type GenerationUsage = Readonly<{ inputTokens?: number; outputTokens?: number;
    totalTokens?: number; reasoningTokens?: number; finishReason?: string; reasoning?: string }>;
export type GenerationPhase = Readonly<{ title: string; objective: string;
    gates: readonly { title: string; purpose: string; criteria: readonly { title: string;
        expectedResult: string }[] }[]; subcalls: number }>;
export type GenerationCallResult = Readonly<{ phase?: GenerationPhase; done: boolean;
    usage?: GenerationUsage; unresolved?: readonly string[]; invalidReason?: string }>;
export type GenerationScopeLedger = Readonly<{ requirements: readonly string[];
    staged: readonly Readonly<{ phase: number; title: string; objective: string;
        gates: readonly Readonly<{ title: string; criteria: readonly string[] }>[] }>[];
    unresolved: readonly string[]; candidateCoverage: readonly Readonly<{
        requirement: string; candidates: readonly string[] }>[];
    semanticCoverage: 'unverified' }>;
export type GenerationMetrics = Readonly<{ startedAt: string; endedAt: string;
    durationMs: number; timeToFirstStageMs?: number; timeToReviewMs?: number;
    retries: number }>;
export type GenerationProviderProgress = Readonly<{ generationId: string; call: number; sequence: number;
    kind: 'reasoning' | 'final' | 'tool-argument' | 'usage'; text?: string; usage?: GenerationUsage }>;
export type GenerationEvent = Readonly<{ generationId: string; sequence: number; state: GenerationState;
    phase: number; calls: number; tokens: number | 'unknown'; diagnostic?: string }>;
export type GenerationResult = Readonly<{ state: GenerationState; identity: GenerationIdentity;
    events: readonly GenerationEvent[]; phases: number; calls: number;
    tokens: number | 'unknown'; usage: readonly GenerationUsage[];
    providerProgress: readonly GenerationProviderProgress[];
    scopeLedger: GenerationScopeLedger; metrics: GenerationMetrics;
    /** Validated content only; replay requires a fresh trusted command and source-bound stage. */
    validatedPhases: readonly GenerationPhase[] }>;
export interface GenerationDependencies {
    /** Recheck the lease, selected model, Chat turn, project and canonical source before and after awaits. */
    current(identity: GenerationIdentity): Promise<boolean>;
    call(input: Readonly<{ identity: GenerationIdentity; scope: string; phase: number;
        context: string; ledger: readonly string[]; remainingCalls: number;
        remainingTokens: number; correction?: string; signal: AbortSignal;
        report(event: GenerationProviderProgress): void }>): Promise<GenerationCallResult>;
    /** P3 supplies the checked native stage owner. No stage means no inference. */
    stage?: Readonly<{ validate(phase: GenerationPhase, identity: GenerationIdentity, signal: AbortSignal): Promise<boolean>;
        stage(phase: GenerationPhase, identity: GenerationIdentity, signal: AbortSignal): Promise<string>;
        complete(identity: GenerationIdentity, signal: AbortSignal): Promise<boolean> }>;
    onEvent?(event: GenerationEvent): void;
    onProviderProgress?(event: GenerationProviderProgress): void;
}

const terminal = new Set<GenerationState>(['review-ready', 'incomplete', 'failed', 'cancelled', 'stale']);
const bounded = (value: number, ceiling: number) => Number.isSafeInteger(value) && value > 0 && value <= ceiling;

export class RoadmapGenerationController {
    readonly identity: GenerationIdentity;
    private state: GenerationState = 'initializing';
    private readonly abort = new AbortController();
    private readonly events: GenerationEvent[] = [];
    private readonly usage: GenerationUsage[] = [];
    private readonly providerProgress: GenerationProviderProgress[] = [];
    private readonly ledger: string[] = [];
    private readonly staged: { phase: number; title: string; objective: string;
        gates: { title: string; criteria: string[] }[] }[] = [];
    private readonly validatedPhases: GenerationPhase[] = [];
    private readonly requirements: string[];
    private unresolved: string[] = [];
    private calls = 0;
    private phases = 0;
    private knownTokens = 0;
    private chargedTokens = 0;
    private unknownTokens = false;
    private started = false;
    private deadline = 0;
    private startedAt = 0;
    private endedAt = 0;
    private firstStageAt = 0;
    private retries = 0;

    constructor(identity: Omit<GenerationIdentity, 'generationId'>, private readonly scope: string,
        private readonly context: string, private readonly deps: GenerationDependencies,
        private readonly limits: GenerationLimits = defaultGenerationLimits,
        private readonly resume: readonly GenerationPhase[] = []) {
        if (identity.origin !== 'trusted-user-chat' || !scope.trim() || !identity.root || !identity.projectId ||
            !identity.chatId || !identity.turnId || !identity.ownerId || identity.model.providerId !== 'local' ||
            !identity.model.connectionId || !identity.model.modelId || !Number.isSafeInteger(identity.revision) ||
            identity.revision < 0 || !bounded(identity.model.contextWindowTokens, 1_000_000) ||
            !bounded(limits.maxPhases, 100) || !bounded(limits.maxGatesPerPhase, 100) ||
            !bounded(limits.maxSubcallsPerPhase, 100) || !bounded(limits.maxCalls, 1_000) ||
            !bounded(limits.maxTokens, 10_000_000) || !bounded(limits.idleMs, 3_600_000) ||
            !bounded(limits.deadlineMs, 3_600_000) || !Number.isSafeInteger(limits.maxRetries) ||
            limits.maxRetries < 0 || limits.maxRetries > 1 || context.length > 24_000 ||
            scope.length > 4_000 || resume.length > limits.maxPhases)
            throw new Error('Invalid Roadmap generation identity or limits');
        this.identity = Object.freeze({ ...identity, generationId: randomUUID(),
            model: Object.freeze({ ...identity.model,
                reasoningControls: Object.freeze({ ...identity.model.reasoningControls }) }) });
        this.scope = scope.trim();
        this.requirements = this.scope.split(/[\n;,]+/u).map(item => item.trim()).filter(Boolean);
        if (!this.requirements.length) this.requirements = [this.scope];
        this.emit('initializing');
    }

    private emit(state: GenerationState, diagnostic?: string): void {
        if (terminal.has(this.state) && state !== this.state) return;
        this.state = state;
        const event: GenerationEvent = Object.freeze({ generationId: this.identity.generationId,
            sequence: this.events.length + 1, state, phase: this.phases + 1, calls: this.calls,
            tokens: this.unknownTokens ? 'unknown' : this.knownTokens, ...(diagnostic ? { diagnostic } : {}) });
        this.events.push(event);
        try { this.deps.onEvent?.(event); } catch { /* A projection listener cannot drive scheduling. */ }
    }

    cancel(): void {
        if (terminal.has(this.state)) return;
        this.abort.abort();
        this.emit('cancelled');
    }

    private async current(): Promise<boolean> {
        if (this.abort.signal.aborted || terminal.has(this.state)) return false;
        if (Date.now() >= this.deadline) { this.cancel(); return false; }
        if (!await this.deps.current(this.identity)) { this.abort.abort(); this.emit('stale'); return false; }
        return !this.abort.signal.aborted && !terminal.has(this.state);
    }

    private async timed<T>(work: Promise<T>): Promise<T> {
        const remaining = Math.min(this.limits.idleMs, this.deadline - Date.now());
        if (remaining <= 0) throw new Error('generation deadline exceeded');
        return new Promise<T>((resolve, reject) => {
            let settled = false;
            const finish = (action: () => void) => {
                if (settled) return;
                settled = true; clearTimeout(timer); this.abort.signal.removeEventListener('abort', cancelled);
                action();
            };
            const timer = setTimeout(() => finish(() => reject(new Error('generation call timed out'))), remaining);
            const cancelled = () => finish(() => reject(new Error('generation cancelled')));
            this.abort.signal.addEventListener('abort', cancelled, { once: true });
            work.then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
        });
    }

    /** Only validated output from the selected provider refreshes this call's idle clock. */
    private timedCall<T>(invoke: (progress: () => void) => Promise<T>): Promise<T> {
        const hardRemaining = this.deadline - Date.now();
        if (hardRemaining <= 0) return Promise.reject(new Error('generation deadline exceeded'));
        return new Promise<T>((resolve, reject) => {
            let settled = false;
            let idleTimer: ReturnType<typeof setTimeout>;
            const finish = (action: () => void) => {
                if (settled) return;
                settled = true;
                clearTimeout(idleTimer); clearTimeout(hardTimer);
                this.abort.signal.removeEventListener('abort', cancelled);
                action();
            };
            const idle = () => finish(() => {
                reject(new Error('generation provider idle timeout'));
                this.abort.abort();
            });
            const progress = () => {
                if (settled || this.abort.signal.aborted) return;
                clearTimeout(idleTimer);
                idleTimer = setTimeout(idle, this.limits.idleMs);
            };
            const cancelled = () => finish(() => reject(new Error('generation cancelled')));
            idleTimer = setTimeout(idle, this.limits.idleMs);
            const hardTimer = setTimeout(() => finish(() => {
                reject(new Error('generation deadline exceeded'));
                this.abort.abort();
            }), hardRemaining);
            this.abort.signal.addEventListener('abort', cancelled, { once: true });
            Promise.resolve().then(() => {
                if (settled || this.abort.signal.aborted) throw new Error('generation cancelled');
                return invoke(progress);
            }).then(
                value => finish(() => resolve(value)), error => finish(() => reject(error)));
        });
    }

    private result(): GenerationResult {
        if (!this.endedAt) this.endedAt = Date.now();
        const candidates = this.requirements.map(requirement => {
            const words = requirement.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
            const matches = this.staged.flatMap(phase => phase.gates.filter(gate =>
                words.some(word => [phase.title, phase.objective, gate.title, ...gate.criteria]
                    .some(value => value.toLowerCase().includes(word)))).map(gate =>
                `${phase.title} / ${gate.title}`));
            return { requirement, candidates: [...new Set(matches)].slice(0, 8) };
        });
        return { state: this.state, identity: this.identity, events: [...this.events],
            phases: this.phases, calls: this.calls, tokens: this.unknownTokens ? 'unknown' : this.knownTokens,
            usage: [...this.usage], providerProgress: [...this.providerProgress],
            scopeLedger: { requirements: [...this.requirements], staged: structuredClone(this.staged),
                unresolved: [...this.unresolved], candidateCoverage: candidates,
                semanticCoverage: 'unverified' }, validatedPhases: structuredClone(this.validatedPhases),
            metrics: { startedAt: new Date(this.startedAt).toISOString(),
                endedAt: new Date(this.endedAt).toISOString(), durationMs: this.endedAt - this.startedAt,
                ...(this.firstStageAt ? { timeToFirstStageMs: this.firstStageAt - this.startedAt } : {}),
                ...(this.state === 'review-ready' ? { timeToReviewMs: this.endedAt - this.startedAt } : {}),
                retries: this.retries } };
    }

    async run(): Promise<GenerationResult> {
        if (this.started) throw new Error('Roadmap generation already started');
        this.started = true;
        this.startedAt = Date.now();
        this.deadline = this.startedAt + this.limits.deadlineMs;
        // P2 has no stage implementation. A real model call cannot begin until P3 supplies it.
        if (!this.deps.stage) { this.emit('incomplete', 'Native phase staging unavailable'); return this.result(); }
        try {
            if (!await this.current()) return this.result();
            for (const phase of this.resume) {
                if (!await this.current() || !await this.timed(this.deps.stage.validate(phase, this.identity,
                    this.abort.signal))) {
                    if (!terminal.has(this.state)) this.emit('incomplete', 'Saved Phase cannot be revalidated');
                    return this.result();
                }
                const reference = await this.timed(this.deps.stage.stage(phase, this.identity, this.abort.signal));
                if (!await this.current() || !reference) return this.result();
                this.ledger.push(`${reference}; Gates: ${phase.gates.map(gate =>
                    gate.title.trim()).join(', ')}`.slice(0, 256));
                this.validatedPhases.push(structuredClone(phase));
                this.staged.push({ phase: ++this.phases, title: phase.title.trim(),
                    objective: phase.objective.trim(), gates: phase.gates.map(gate => ({
                        title: gate.title.trim(), criteria: gate.criteria.map(item => item.expectedResult.trim()) })) });
            }
            while (true) {
                let accepted = false;
                let correction: string | undefined;
                for (let attempt = 0; attempt <= this.limits.maxRetries; attempt++) {
                    if (attempt > 0) this.retries++;
                    if (this.calls >= this.limits.maxCalls || this.chargedTokens >= this.limits.maxTokens) {
                        this.emit('incomplete', 'Generation budget exhausted'); return this.result();
                    }
                    if (!await this.current()) return this.result();
                    this.emit('generating-phase');
                    this.calls++;
                    const callNumber = this.calls;
                    let providerSequence = 0;
                    let accepting = true;
                    const answer = await this.timedCall(progress => this.deps.call({ identity: this.identity, scope: this.scope,
                        phase: this.phases + 1, context: this.context, ledger: [...this.ledger],
                        remainingCalls: this.limits.maxCalls - this.calls,
                        remainingTokens: this.limits.maxTokens - this.chargedTokens,
                        ...(correction ? { correction } : {}), signal: this.abort.signal,
                        report: event => {
                            if (!accepting || this.abort.signal.aborted || this.state !== 'generating-phase' ||
                                event.generationId !== this.identity.generationId || event.call !== callNumber ||
                                !Number.isSafeInteger(event.sequence) || event.sequence <= providerSequence) return;
                            if (!['reasoning', 'final', 'tool-argument', 'usage'].includes(event.kind) ||
                                event.kind !== 'usage' && (typeof event.text !== 'string' ||
                                    !event.text.trim() || event.text.length > 8192)) return;
                            providerSequence = event.sequence;
                            this.providerProgress.push(event);
                            if (event.kind !== 'usage') progress();
                            try { this.deps.onProviderProgress?.(event); } catch { /* Projection is advisory. */ }
                        } }));
                    accepting = false;
                    if (!await this.current()) return this.result();
                    this.usage.push(answer.usage ?? {});
                    const tokens = answer.usage?.totalTokens;
                    if (tokens === undefined) {
                        this.unknownTokens = true;
                        this.chargedTokens += Math.min(this.identity.model.contextWindowTokens,
                            this.limits.maxTokens - this.chargedTokens);
                    }
                    else if (!Number.isSafeInteger(tokens) || tokens < 0) {
                        this.emit('failed', 'Invalid provider usage'); return this.result();
                    } else { this.knownTokens += tokens; this.chargedTokens += tokens; }
                    if (this.chargedTokens > this.limits.maxTokens) {
                        this.emit('incomplete', 'Token budget exhausted'); return this.result();
                    }
                    if (answer.done && !answer.phase) {
                        if (!this.phases) { this.emit('incomplete', 'No validated Phase'); return this.result(); }
                        this.unresolved = [...new Set((answer.unresolved ?? []).map(item => item.trim())
                            .filter(Boolean))].slice(0, 16);
                        this.emit('validating');
                        if (!await this.timed(this.deps.stage.complete(this.identity, this.abort.signal)) ||
                            !await this.current()) {
                            if (!terminal.has(this.state)) this.emit('incomplete', 'Stage is incomplete');
                            return this.result();
                        }
                        this.emit('review-ready'); return this.result();
                    }
                    const phase = answer.phase;
                    if (this.phases >= this.limits.maxPhases) {
                        this.emit('incomplete', 'Phase limit reached without a complete draft'); return this.result();
                    }
                    if (!phase || !bounded(phase.subcalls, this.limits.maxSubcallsPerPhase) ||
                        !phase.title.trim() || !phase.objective.trim() || !phase.gates.length ||
                        phase.gates.length > this.limits.maxGatesPerPhase) {
                        correction = answer.invalidReason ?? 'Provide one complete Phase with Gates and observable Criteria.';
                        continue;
                    }
                    this.emit('validating');
                    if (!await this.timed(this.deps.stage.validate(phase, this.identity, this.abort.signal)) ||
                        !await this.current()) {
                        correction = 'Correct this Phase: title, objective, unique Gate names, and observable Criteria are required.';
                        continue;
                    }
                    this.emit('staging');
                    const reference = await this.timed(this.deps.stage.stage(phase, this.identity, this.abort.signal));
                    if (!await this.current()) return this.result();
                    if (!reference || reference.length > 256) {
                        this.emit('failed', 'Native stage did not return a bounded reference'); return this.result();
                    }
                    this.ledger.push(`${reference}; Gates: ${phase.gates.map(gate =>
                        gate.title.trim()).join(', ')}`.slice(0, 256));
                    this.validatedPhases.push(structuredClone(phase));
                    this.staged.push({ phase: this.phases + 1, title: phase.title.trim(),
                        objective: phase.objective.trim(), gates: phase.gates.map(gate => ({
                            title: gate.title.trim(),
                            criteria: gate.criteria.map(criterion => criterion.expectedResult.trim()) })) });
                    if (!this.firstStageAt) this.firstStageAt = Date.now();
                    this.phases++;
                    accepted = true;
                    break;
                }
                if (!accepted) { this.emit('incomplete', 'Phase retry limit reached'); return this.result(); }
            }
        } catch (error) {
            if (!terminal.has(this.state)) {
                this.abort.abort();
                this.emit(String(error).includes('ROADMAP_GENERATION_STALE') ? 'stale' :
                    Date.now() >= this.deadline ? 'cancelled' : 'failed', String(error));
            }
        }
        return this.result();
    }
}
