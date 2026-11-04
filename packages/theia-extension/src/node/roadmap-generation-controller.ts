import { randomUUID } from 'node:crypto';

/** Transient scheduling state. The RoadmapStore and native stage owner remain the only data authorities. */
export type GenerationState = 'initializing' | 'generating-phase' | 'validating' | 'staging' |
    'review-ready' | 'incomplete' | 'failed' | 'cancelled' | 'stale';
export type GenerationIdentity = Readonly<{ generationId: string; root: string; projectId: string;
    revision: number; sourceHash: string | null; indexHash: string | null; baselinePhases?: number;
    chatId: string; turnId: string; ownerId: string;
    model: Readonly<{ connectionId: string; modelId: string; providerId: 'local';
        contextWindowTokens: number; reasoningControls: Readonly<Record<string, string>> }>;
    origin: 'trusted-user-chat' }>;
export type GenerationLimits = Readonly<{ maxPhases: number; maxGatesPerPhase: number;
    maxSubcallsPerPhase: number; maxCalls: number; maxTokens: number; idleMs: number;
    deadlineMs: number; maxRetries: number }>;
export const defaultGenerationLimits: GenerationLimits = {
    maxPhases: 12, maxGatesPerPhase: 12, maxSubcallsPerPhase: 8, maxCalls: 16,
    maxTokens: 256_000, idleMs: 60_000, deadlineMs: 8 * 60_000, maxRetries: 1
};
export type GenerationUsage = Readonly<{ inputTokens?: number; outputTokens?: number;
    totalTokens?: number; reasoningTokens?: number; finishReason?: string; reasoning?: string }>;
export type GenerationPhase = Readonly<{ title: string; objective: string;
    gates: readonly { title: string; purpose: string; criteria: readonly { title: string;
        expectedResult: string }[] }[]; subcalls: number }>;
export type GenerationCallResult = Readonly<{ usage?: GenerationUsage }>;
export type GenerationStageReceipt = Readonly<{ proposalId: string; stageSequence: number;
    phase: number; phases: number; gates: number; criteria: number; status: 'staged' }>;
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
    scopeLedger: GenerationScopeLedger; metrics: GenerationMetrics }>;
export interface GenerationDependencies {
    /** Recheck the lease, selected model, Chat turn, project and canonical source before and after awaits. */
    current(identity: GenerationIdentity): Promise<boolean>;
    call(input: Readonly<{ identity: GenerationIdentity; scope: string; phase: number;
        context: string; ledger: readonly string[]; remainingCalls: number;
        remainingTokens: number; correction?: string; signal: AbortSignal;
        report(event: GenerationProviderProgress): void;
        admitTool(): Promise<void>;
        rejectTool(): void;
        submitPhase(phaseNumber: number, phase: GenerationPhase): Promise<GenerationStageReceipt>;
        finish(unresolved: readonly string[]): Promise<void> }>): Promise<GenerationCallResult>;
    /** P3 supplies the checked native stage owner. No stage means no inference. */
    stage?: Readonly<{ validate(phase: GenerationPhase, identity: GenerationIdentity, signal: AbortSignal): Promise<boolean>;
        stage(phase: GenerationPhase, identity: GenerationIdentity, signal: AbortSignal): Promise<string>;
        complete(identity: GenerationIdentity, signal: AbortSignal): Promise<boolean>;
        snapshot?(identity: GenerationIdentity, signal: AbortSignal): Promise<{
            proposalId: string; sequence: number; counts: { phases: number; gates: number; criteria: number } } | undefined> }>;
    onEvent?(event: GenerationEvent): void;
    onProviderProgress?(event: GenerationProviderProgress): void;
}

const terminal = new Set<GenerationState>(['review-ready', 'incomplete', 'failed', 'cancelled', 'stale']);
const bounded = (value: number, ceiling: number) => Number.isSafeInteger(value) && value > 0 && value <= ceiling;
const requestedPhaseCount = (scope: string): number => {
    const plain = scope.replace(/\*/gu, '');
    const match = plain.match(/\b(?:(?:build|create)\s+)?exactly\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+phases?\b/iu) ??
        plain.match(/\b(?:build|create)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+phases?\b/iu);
    if (!match) return 0;
    const words = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
        'nine', 'ten', 'eleven', 'twelve'];
    return /^\d+$/u.test(match[1]) ? Number(match[1]) : words.indexOf(match[1].toLowerCase()) + 1;
};

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
    private consecutiveFailures = 0;
    private finished = false;

    constructor(identity: Omit<GenerationIdentity, 'generationId'>, private readonly scope: string,
        private readonly context: string, private readonly deps: GenerationDependencies,
        private readonly limits: GenerationLimits = defaultGenerationLimits) {
        if (identity.origin !== 'trusted-user-chat' || !scope.trim() || !identity.root || !identity.projectId ||
            !identity.chatId || !identity.turnId || !identity.ownerId || identity.model.providerId !== 'local' ||
            !Number.isSafeInteger(identity.baselinePhases ?? 0) || (identity.baselinePhases ?? 0) < 0 ||
            !identity.model.connectionId || !identity.model.modelId || !Number.isSafeInteger(identity.revision) ||
            identity.revision < 0 || !bounded(identity.model.contextWindowTokens, 1_000_000) ||
            !bounded(limits.maxPhases, 100) || !bounded(limits.maxGatesPerPhase, 100) ||
            !bounded(limits.maxSubcallsPerPhase, 100) || !bounded(limits.maxCalls, 1_000) ||
            !bounded(limits.maxTokens, 10_000_000) || !bounded(limits.idleMs, 3_600_000) ||
            !bounded(limits.deadlineMs, 3_600_000) || !Number.isSafeInteger(limits.maxRetries) ||
            limits.maxRetries < 0 || limits.maxRetries > 1 || context.length > 24_000 ||
            scope.length > 4_000)
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
                semanticCoverage: 'unverified' },
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
        if (!this.deps.stage) { this.emit('incomplete', 'Native phase staging unavailable'); return this.result(); }
        try {
            if (!await this.current()) return this.result();
            this.emit('generating-phase');
            const callNumber = 1;
            let providerSequence = 0;
            let accepting = true;
            let refreshIdle: () => void = () => undefined;
            const answer = await this.timedCall(progress => {
                refreshIdle = progress;
                return this.deps.call({ identity: this.identity, scope: this.scope, phase: 1,
                    context: this.context, ledger: this.ledger, remainingCalls: this.limits.maxCalls,
                    remainingTokens: this.limits.maxTokens, signal: this.abort.signal,
                    report: event => {
                        if (!accepting || this.abort.signal.aborted || terminal.has(this.state) ||
                            event.generationId !== this.identity.generationId || event.call !== callNumber ||
                            !Number.isSafeInteger(event.sequence) || event.sequence <= providerSequence) return;
                        if (!['reasoning', 'final', 'tool-argument', 'usage'].includes(event.kind) ||
                            event.kind !== 'usage' && (typeof event.text !== 'string' ||
                                !event.text.trim() || event.text.length > 8192)) return;
                        providerSequence = event.sequence;
                        this.providerProgress.push(event);
                        if (event.kind !== 'usage') progress();
                        try { this.deps.onProviderProgress?.(event); } catch { /* Advisory. */ }
                    },
                    admitTool: async () => {
                        if (!await this.current() || this.calls >= this.limits.maxCalls ||
                            this.consecutiveFailures > this.limits.maxRetries ||
                            this.chargedTokens >= this.limits.maxTokens)
                            throw new Error('ROADMAP_GENERATION_TOOL_BUDGET_OR_STALE');
                        this.calls++;
                    },
                    rejectTool: () => { this.consecutiveFailures++; this.retries++; },
                    submitPhase: async (number, phase) => {
                        if (!await this.current() || this.finished || number !== this.phases + 1 ||
                            this.phases >= this.limits.maxPhases ||
                            !bounded(phase.subcalls, this.limits.maxSubcallsPerPhase) ||
                            phase.gates.length > this.limits.maxGatesPerPhase)
                            throw new Error('ROADMAP_GENERATION_PHASE_ORDER_OR_BUDGET');
                        this.emit('validating');
                        if (!await this.timed(this.deps.stage!.validate(phase, this.identity, this.abort.signal)) ||
                            !await this.current()) throw new Error('ROADMAP_GENERATION_INVALID_PHASE');
                        this.emit('staging');
                        const reference = await this.timed(this.deps.stage!.stage(phase, this.identity, this.abort.signal));
                        if (!await this.current() || !reference) throw new Error('ROADMAP_GENERATION_STAGE_CHANGED');
                        const snapshot = await this.deps.stage!.snapshot?.(this.identity, this.abort.signal);
                        if (!snapshot || snapshot.counts.phases !== (this.identity.baselinePhases ?? 0) + this.phases + 1)
                            throw new Error('ROADMAP_GENERATION_RECEIPT_MISSING');
                        this.ledger.push(`${reference}; Gates: ${phase.gates.map(gate => gate.title.trim()).join(', ')}`.slice(0, 256));
                        this.staged.push({ phase: number, title: phase.title.trim(), objective: phase.objective.trim(),
                            gates: phase.gates.map(gate => ({ title: gate.title.trim(),
                                criteria: gate.criteria.map(item => item.expectedResult.trim()) })) });
                        this.phases++; this.consecutiveFailures = 0;
                        if (!this.firstStageAt) this.firstStageAt = Date.now();
                        this.emit('generating-phase'); refreshIdle();
                        return { proposalId: snapshot.proposalId, stageSequence: snapshot.sequence,
                            phase: number, ...snapshot.counts, status: 'staged' };
                    },
                    finish: async unresolved => {
                        if (!await this.current())
                            throw new Error('ROADMAP_GENERATION_FINISH_DENIED: Project, source or lease changed; start a fresh request.');
                        if (this.finished)
                            throw new Error('ROADMAP_GENERATION_FINISH_DENIED: This draft is already review-ready.');
                        if (!this.phases)
                            throw new Error('ROADMAP_GENERATION_FINISH_DENIED: Stage a valid Phase before finishing.');
                        if (this.chargedTokens >= this.limits.maxTokens)
                            throw new Error('ROADMAP_GENERATION_FINISH_DENIED: Token budget exhausted.');
                        const requiredCount = requestedPhaseCount(this.scope);
                        if (requiredCount && this.phases !== requiredCount)
                            throw new Error(`ROADMAP_GENERATION_REQUIRED_PHASES_MISSING: Stage exactly ${requiredCount} requested Phases before finishing; ${this.phases} staged.`);
                        // Word overlap is only an advisory coverage candidate. Different wording
                        // cannot prove a requested requirement absent, or prove it satisfied.
                        // The review ledger keeps every request and marks semantic coverage unverified.
                        this.unresolved = [...new Set(unresolved.map(item => item.trim()).filter(Boolean))].slice(0, 16);
                        this.emit('validating');
                        if (!await this.timed(this.deps.stage!.complete(this.identity, this.abort.signal)) ||
                            !await this.current()) throw new Error('ROADMAP_GENERATION_STAGE_INCOMPLETE');
                        this.finished = true; refreshIdle();
                        this.emit('generating-phase');
                    } });
            });
            accepting = false;
            if (!await this.current()) return this.result();
            this.usage.push(answer.usage ?? {});
            const tokens = answer.usage?.totalTokens;
            if (tokens === undefined) this.unknownTokens = true;
            else if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error('Invalid provider usage');
            else { this.knownTokens = tokens; this.chargedTokens = tokens; }
            if (this.chargedTokens > this.limits.maxTokens) throw new Error('Token budget exhausted');
            this.emit(this.finished ? 'review-ready' : 'incomplete',
                this.finished ? undefined : 'The model stopped before roadmap_finish');
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
