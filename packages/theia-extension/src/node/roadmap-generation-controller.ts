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
    totalTokens?: number; finishReason?: string; reasoning?: string }>;
export type GenerationPhase = Readonly<{ title: string; objective: string;
    gates: readonly { title: string; purpose: string; criteria: readonly { title: string;
        expectedResult: string }[] }[]; subcalls: number }>;
export type GenerationCallResult = Readonly<{ phase?: GenerationPhase; done: boolean;
    usage?: GenerationUsage }>;
export type GenerationProviderProgress = Readonly<{ generationId: string; call: number; sequence: number;
    kind: 'reasoning' | 'final' | 'usage'; text?: string; usage?: GenerationUsage }>;
export type GenerationEvent = Readonly<{ generationId: string; sequence: number; state: GenerationState;
    phase: number; calls: number; tokens: number | 'unknown'; diagnostic?: string }>;
export type GenerationResult = Readonly<{ state: GenerationState; identity: GenerationIdentity;
    events: readonly GenerationEvent[]; phases: number; calls: number;
    tokens: number | 'unknown'; usage: readonly GenerationUsage[];
    providerProgress: readonly GenerationProviderProgress[] }>;
export interface GenerationDependencies {
    /** Recheck the lease, selected model, Chat turn, project and canonical source before and after awaits. */
    current(identity: GenerationIdentity): Promise<boolean>;
    call(input: Readonly<{ identity: GenerationIdentity; scope: string; phase: number;
        context: string; ledger: readonly string[]; remainingCalls: number;
        remainingTokens: number; signal: AbortSignal;
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
    private calls = 0;
    private phases = 0;
    private knownTokens = 0;
    private chargedTokens = 0;
    private unknownTokens = false;
    private started = false;
    private deadline = 0;

    constructor(identity: Omit<GenerationIdentity, 'generationId'>, private readonly scope: string,
        private readonly context: string, private readonly deps: GenerationDependencies,
        private readonly limits: GenerationLimits = defaultGenerationLimits) {
        if (identity.origin !== 'trusted-user-chat' || !scope.trim() || !identity.root || !identity.projectId ||
            !identity.chatId || !identity.turnId || !identity.ownerId || identity.model.providerId !== 'local' ||
            !identity.model.connectionId || !identity.model.modelId || !Number.isSafeInteger(identity.revision) ||
            identity.revision < 0 || !bounded(identity.model.contextWindowTokens, 1_000_000) ||
            !bounded(limits.maxPhases, 100) || !bounded(limits.maxGatesPerPhase, 100) ||
            !bounded(limits.maxSubcallsPerPhase, 100) || !bounded(limits.maxCalls, 1_000) ||
            !bounded(limits.maxTokens, 10_000_000) || !bounded(limits.idleMs, 3_600_000) ||
            !bounded(limits.deadlineMs, 3_600_000) || !Number.isSafeInteger(limits.maxRetries) ||
            limits.maxRetries < 0 || limits.maxRetries > 3 || context.length > 24_000)
            throw new Error('Invalid Roadmap generation identity or limits');
        this.identity = Object.freeze({ ...identity, generationId: randomUUID(),
            model: Object.freeze({ ...identity.model,
                reasoningControls: Object.freeze({ ...identity.model.reasoningControls }) }) });
        this.scope = scope.trim();
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
            const timer = setTimeout(() => reject(new Error('generation call timed out')), remaining);
            const cancelled = () => reject(new Error('generation cancelled'));
            this.abort.signal.addEventListener('abort', cancelled, { once: true });
            work.then(resolve, reject).finally(() => {
                clearTimeout(timer); this.abort.signal.removeEventListener('abort', cancelled);
            }).catch(() => undefined);
        });
    }

    private result(): GenerationResult {
        return { state: this.state, identity: this.identity, events: [...this.events],
            phases: this.phases, calls: this.calls, tokens: this.unknownTokens ? 'unknown' : this.knownTokens,
            usage: [...this.usage], providerProgress: [...this.providerProgress] };
    }

    async run(): Promise<GenerationResult> {
        if (this.started) throw new Error('Roadmap generation already started');
        this.started = true;
        this.deadline = Date.now() + this.limits.deadlineMs;
        // P2 has no stage implementation. A real model call cannot begin until P3 supplies it.
        if (!this.deps.stage) { this.emit('incomplete', 'Native phase staging unavailable'); return this.result(); }
        try {
            if (!await this.current()) return this.result();
            while (this.phases < this.limits.maxPhases) {
                let accepted = false;
                for (let attempt = 0; attempt <= this.limits.maxRetries; attempt++) {
                    if (this.calls >= this.limits.maxCalls || this.chargedTokens >= this.limits.maxTokens) {
                        this.emit('incomplete', 'Generation budget exhausted'); return this.result();
                    }
                    if (!await this.current()) return this.result();
                    this.emit('generating-phase');
                    this.calls++;
                    const callNumber = this.calls;
                    let providerSequence = 0;
                    let accepting = true;
                    const answer = await this.timed(this.deps.call({ identity: this.identity, scope: this.scope,
                        phase: this.phases + 1, context: this.context, ledger: [...this.ledger],
                        remainingCalls: this.limits.maxCalls - this.calls,
                        remainingTokens: this.limits.maxTokens - this.chargedTokens, signal: this.abort.signal,
                        report: event => {
                            if (!accepting || this.abort.signal.aborted || this.state !== 'generating-phase' ||
                                event.generationId !== this.identity.generationId || event.call !== callNumber ||
                                !Number.isSafeInteger(event.sequence) || event.sequence <= providerSequence) return;
                            providerSequence = event.sequence;
                            this.providerProgress.push(event);
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
                        this.emit('validating');
                        if (!await this.timed(this.deps.stage.complete(this.identity, this.abort.signal)) ||
                            !await this.current()) {
                            if (!terminal.has(this.state)) this.emit('incomplete', 'Stage is incomplete');
                            return this.result();
                        }
                        this.emit('review-ready'); return this.result();
                    }
                    const phase = answer.phase;
                    if (!phase || !bounded(phase.subcalls, this.limits.maxSubcallsPerPhase) ||
                        !phase.title.trim() || !phase.objective.trim() || !phase.gates.length ||
                        phase.gates.length > this.limits.maxGatesPerPhase) continue;
                    if (this.calls + phase.subcalls - 1 > this.limits.maxCalls) {
                        this.emit('incomplete', 'Phase subcall budget exceeded'); return this.result();
                    }
                    this.calls += phase.subcalls - 1;
                    this.emit('validating');
                    if (!await this.timed(this.deps.stage.validate(phase, this.identity, this.abort.signal)) ||
                        !await this.current()) continue;
                    this.emit('staging');
                    const reference = await this.timed(this.deps.stage.stage(phase, this.identity, this.abort.signal));
                    if (!await this.current()) return this.result();
                    if (!reference || reference.length > 256) {
                        this.emit('failed', 'Native stage did not return a bounded reference'); return this.result();
                    }
                    this.ledger.push(reference);
                    this.phases++;
                    accepted = true;
                    break;
                }
                if (!accepted) { this.emit('incomplete', 'Phase retry limit reached'); return this.result(); }
            }
            this.emit('incomplete', 'Phase limit reached');
        } catch (error) {
            if (!terminal.has(this.state)) {
                this.abort.abort();
                this.emit(Date.now() >= this.deadline ? 'cancelled' : 'failed', String(error));
            }
        }
        return this.result();
    }
}
