import type { ChatAssistantMessage, ChatPromptDraftIdentity } from '@dope/chat';
import { ChatRepository } from '@dope/chat/lib/node';
import type { ChatProjectGrounder } from './chat-project-grounder';
import { PromptDraftStore, type StoredPromptDraft } from './prompt-draft-store';
import { requestedPaths, validatedAssessment, validatedAssessmentFinding,
    type AssessmentCategory, type AssessmentRead, type AssessmentRecord } from './prompt-authoring-stage';

type Partial = NonNullable<StoredPromptDraft['partialAssessment']>;
const categories = ['observations', 'preservation', 'dependencies', 'risks'] as const;
const short = (value: unknown, limit = 500): value is string => typeof value === 'string' &&
    !!value.trim() && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value);
const initial = (requested: string[]): Partial => ({ requested, pages: [], blocked: {},
    findings: { observations: [], preservation: [], dependencies: [], risks: [] }, emptyReasons: {} });
export interface AssessmentStageInput { category: AssessmentCategory | 'scope' | 'tiers';
    claim?: string; path?: string; quote?: string; reason?: string; text?: string;
    T1?: string; T2?: string; T3?: string }

/** One Chat draft, one guarded store. The model supplies content, never authority or citation metadata. */
export class IncrementalAssessment {
    private readonly store: PromptDraftStore;
    constructor(repository: ChatRepository, private readonly grounder: ChatProjectGrounder,
        private readonly root: string, private readonly identity: ChatPromptDraftIdentity,
        private readonly leaseToken: string, private readonly requestedText: string,
        store?: PromptDraftStore) {
        this.store = store ?? new PromptDraftStore(repository, grounder);
    }
    async begin(): Promise<AssessmentRecord | undefined> {
        if (requestedPaths(this.requestedText).length > 16)
            throw new Error('ASSESSMENT_SOURCE_LIMIT: Request at most 16 explicit source paths');
        try { await this.store.begin(this.root, this.identity, this.leaseToken); }
        catch (error) {
            if (!(error instanceof Error) || !error.message.includes('already started')) throw error;
            const saved = await this.store.read(this.root, this.identity, this.leaseToken);
            return saved.assessment?.record as AssessmentRecord | undefined;
        }
        return undefined;
    }
    private async snapshot(): Promise<{ draft: StoredPromptDraft; partial: Partial }> {
        const draft = await this.store.read(this.root, this.identity, this.leaseToken);
        return { draft, partial: draft.partialAssessment ?? initial(requestedPaths(this.requestedText)) };
    }
    async readPage(page: { path: string; offset: number; endOffset: number;
        fileBytes: number; sourceHash: string }): Promise<void> {
        if ((page.fileBytes === 0 ? page.offset !== 0 || page.endOffset !== 0 :
            page.endOffset <= page.offset) || page.endOffset > page.fileBytes) return;
        const { draft, partial } = await this.snapshot();
        if (draft.assessment || partial.pages.some(item => item.path === page.path &&
            item.start === page.offset && item.end === page.endOffset && item.sourceHash === page.sourceHash)) return;
        const { [page.path]: _blocked, ...remainingBlocked } = partial.blocked;
        await this.store.updatePartialAssessment(this.root, this.identity, this.leaseToken,
            draft.revision, { ...partial, blocked: remainingBlocked, pages: [...partial.pages,
                { path: page.path, start: page.offset, end: page.endOffset,
                    fileBytes: page.fileBytes, sourceHash: page.sourceHash }] });
    }
    async blockedRead(path: string, reason: string): Promise<void> {
        const { draft, partial } = await this.snapshot();
        if (draft.assessment || !partial.requested.includes(path)) return;
        await this.store.updatePartialAssessment(this.root, this.identity, this.leaseToken,
            draft.revision, { ...partial, blocked: { ...partial.blocked, [path]: reason.slice(0, 80) } });
    }
    static coverage(partial: Partial): { inspected: string[]; remaining: string[] } {
        const inspected = partial.requested.filter(path => {
            const pages = partial.pages.filter(page => page.path === path)
                .sort((a, b) => a.start - b.start);
            if (!pages.length) return false;
            let covered = 0;
            for (const page of pages) {
                if (page.sourceHash !== pages[0].sourceHash || page.fileBytes !== pages[0].fileBytes ||
                    page.start > covered) return false;
                covered = Math.max(covered, page.end);
            }
            return covered === pages[0].fileBytes;
        });
        return { inspected, remaining: partial.requested.filter(path => !inspected.includes(path)) };
    }
    async status(): Promise<{ assessment: string; sources: string; findings: number;
        required: { path: string; state: string; reason?: string }[];
        categories: Record<AssessmentCategory, string>; remaining: string[]; nextAction: string }> {
        const { draft, partial } = await this.snapshot();
        if (draft.assessment) return { assessment: this.identity.slug,
            sources: `${draft.assessment.sourceRefs.length}/${partial.requested.length} inspected`,
            required: [], findings: categories.reduce((count, category) =>
                count + (draft.assessment!.record as unknown as AssessmentRecord)[category].length, 0),
            categories: { observations: 'complete', preservation: 'complete', dependencies: 'complete',
                risks: 'complete' }, remaining: [], nextAction: '/prompt-plan' };
        const coverage = IncrementalAssessment.coverage(partial);
        const categoryState = Object.fromEntries(categories.map(category => [category,
            partial.findings[category].length ? 'complete' : partial.emptyReasons[category] ?
                'justified empty' : 'incomplete'])) as Record<AssessmentCategory, string>;
        const incomplete = categories.find(category => categoryState[category] === 'incomplete');
        return { assessment: this.identity.slug,
            sources: `${coverage.inspected.length}/${partial.requested.length} inspected`,
            required: partial.requested.map(path => ({ path,
                state: coverage.inspected.includes(path) ? 'required range inspected' :
                    partial.blocked[path] ? 'unavailable or blocked' :
                        partial.pages.some(page => page.path === path) ? 'partially inspected' : 'not inspected',
                ...(partial.blocked[path] ? { reason: partial.blocked[path] } : {}) })),
            findings: categories.reduce((sum, category) => sum + partial.findings[category].length, 0),
            categories: categoryState, remaining: coverage.remaining,
            nextAction: coverage.remaining.length ? `read_file ${coverage.remaining[0]} using offset 0 and continue to fileBytes` :
                !partial.pages.length ? 'read_file relevant source with offset 0' :
                !partial.scope ? 'stage scope' : incomplete ? `stage ${incomplete} or a justified empty reason` :
                    !partial.tiers ? 'stage T1/T2/T3' : 'assessment_finish' };
    }
    async stage(raw: unknown, refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>,
        evidence: readonly AssessmentRead[]): Promise<{ accepted: true; category: string; findings: number; nextAction: string }> {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            throw new Error('ASSESSMENT_STAGE_SHAPE: Supply a top-level category object');
        const input = raw as AssessmentStageInput;
        if (!['scope', 'tiers', ...categories].includes(input.category) ||
            Object.keys(input).some(key => !['category', 'claim', 'path', 'quote', 'reason', 'text', 'T1', 'T2', 'T3'].includes(key)))
            throw new Error('ASSESSMENT_STAGE_CATEGORY: Choose scope, tiers or one finding category');
        const { draft, partial } = await this.snapshot();
        if (draft.assessment) throw new Error('ASSESSMENT_STAGE_SEALED: Assessment is already complete');
        let next: Partial;
        if (input.category === 'scope') {
            if (!short(input.text, 1000) || Object.keys(input).some(key => !['category', 'text'].includes(key)))
                throw new Error('ASSESSMENT_SCOPE: Supply a bounded scope as text');
            if (partial.scope && partial.scope !== input.text)
                throw new Error('ASSESSMENT_CONFLICTING_REPLAY: Scope changed; start a reviewed revision');
            next = { ...partial, scope: input.text };
        } else if (input.category === 'tiers') {
            if (!short(input.T1) || !short(input.T2) || !short(input.T3) ||
                Object.keys(input).some(key => !['category', 'T1', 'T2', 'T3'].includes(key)))
                throw new Error('ASSESSMENT_TIERS: Supply T1 focused, T2 integration and T3 manual browser qualification');
            if (partial.tiers && (partial.tiers.T1 !== input.T1 || partial.tiers.T2 !== input.T2 ||
                partial.tiers.T3 !== input.T3))
                throw new Error('ASSESSMENT_CONFLICTING_REPLAY: Tiers changed; start a reviewed revision');
            next = { ...partial, tiers: { T1: input.T1, T2: input.T2, T3: input.T3 } };
        } else {
            const category = input.category as AssessmentCategory;
            if (input.reason !== undefined) {
                if (!['dependencies', 'risks'].includes(category) || !short(input.reason) ||
                    Object.keys(input).some(key => !['category', 'reason'].includes(key)) ||
                    partial.findings[category].length || !partial.pages.length ||
                    IncrementalAssessment.coverage(partial).remaining.length)
                    throw new Error(`ASSESSMENT_${category.toUpperCase()}_EMPTY: Read all requested sources and supply an explicit reason`);
                if (partial.emptyReasons[category] && partial.emptyReasons[category] !== input.reason)
                    throw new Error('ASSESSMENT_CONFLICTING_REPLAY: Empty reason changed; start a reviewed revision');
                next = { ...partial, emptyReasons: { ...partial.emptyReasons, [category]: input.reason } };
            } else {
                if (Object.keys(input).some(key => !['category', 'claim', 'path', 'quote'].includes(key)))
                    throw new Error('ASSESSMENT_STAGE_SHAPE: Supply category, claim, path and quote only');
                const finding = validatedAssessmentFinding({ claim: input.claim, path: input.path,
                    quote: input.quote }, category, refs, evidence);
                if (partial.emptyReasons[category])
                    throw new Error('ASSESSMENT_CONFLICTING_REPLAY: Category was completed empty; start a reviewed revision');
                const existing = partial.findings[category].find(item => item.claim === finding.claim &&
                    item.path === finding.path);
                if (existing && JSON.stringify(existing) !== JSON.stringify(finding))
                    throw new Error('ASSESSMENT_CONFLICTING_REPLAY: Revise the assessment in a new authorized turn');
                if (partial.findings[category].length >= 12 && !existing)
                    throw new Error('ASSESSMENT_STAGE_LIMIT: Category already has 12 findings');
                next = existing ? partial : { ...partial,
                    findings: { ...partial.findings, [category]: [...partial.findings[category], finding] },
                    emptyReasons: partial.emptyReasons };
            }
        }
        if (JSON.stringify(next) !== JSON.stringify(partial))
            await this.store.updatePartialAssessment(this.root, this.identity, this.leaseToken,
                draft.revision, next);
        const status = await this.status();
        return { accepted: true, category: input.category, findings: status.findings,
            nextAction: status.nextAction };
    }
    async finish(): Promise<{ record: AssessmentRecord; revision: number;
        refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']> }> {
        const { draft, partial } = await this.snapshot();
        if (draft.assessment) {
            const refs = [...new Map(draft.assessment.sourceRefs.map(ref => [ref.id, ref])).values()].map(ref => ({ schemaVersion: 1 as const,
                kind: 'file' as const, origin: 'tool' as const, id: ref.id, label: ref.id,
                projectId: ref.projectId, sourceHash: ref.sourceHash,
                start: ref.start, end: ref.end, estimatedTokens: 0 }));
            return { record: draft.assessment.record as unknown as AssessmentRecord,
                revision: draft.assessment.revision, refs };
        }
        const coverage = IncrementalAssessment.coverage(partial);
        if (coverage.remaining.length)
            throw new Error(`ASSESSMENT_SOURCE_COVERAGE: ${coverage.remaining.length} requested sources remain unread; use assessment_status`);
        if (!partial.scope || !partial.tiers || !partial.findings.observations.length ||
            !partial.findings.preservation.length || categories.some(category =>
                !partial.findings[category].length && !partial.emptyReasons[category]))
            throw new Error('ASSESSMENT_CATEGORY_INCOMPLETE: Stage observations, preservation, dependencies, risks, scope and tiers');
        if (!/\bfocused\b/iu.test(partial.tiers.T1) ||
            !/\b(?:unit|source)\b/iu.test(partial.tiers.T1) ||
            !/\b(?:integration|cross.boundary)\b/iu.test(partial.tiers.T2) ||
            !/\bmanual\b/iu.test(partial.tiers.T3) ||
            !/\bbrowser\b/iu.test(partial.tiers.T3))
            throw new Error('ASSESSMENT_TIERS: T1 focused source/unit, T2 integration, T3 independent manual browser');
        const evidence: AssessmentRead[] = [];
        const refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']> = [];
        for (const page of partial.pages) {
            const current = await this.grounder.readFileRange(this.root, page.path,
                page.start, Math.max(1, page.end - page.start), page.sourceHash);
            if (current.endOffset !== page.end || current.fileBytes !== page.fileBytes)
                throw new Error('ASSESSMENT_SOURCE_DRIFT: Brokered page changed');
            evidence.push({ path: page.path, start: page.start, end: page.end,
                sourceHash: page.sourceHash, text: current.text });
            refs.push({ schemaVersion: 1, kind: 'file', origin: 'tool', id: page.path,
                label: page.path, projectId: this.identity.projectId, sourceHash: page.sourceHash,
                ...(page.fileBytes ? { start: page.start, end: page.end } : {}), estimatedTokens: 0 });
        }
        const fields = Object.fromEntries(categories.map(category => [category,
            partial.findings[category].map(({ claim, path, quote }) => ({ claim, path, quote }))]));
        const record = validatedAssessment(JSON.stringify({ scope: partial.scope, ...fields,
            emptyReasons: partial.emptyReasons, tiers: partial.tiers }), refs, this.requestedText, evidence);
        if (record.omittedRequestedFiles.length) throw new Error('ASSESSMENT_SOURCE_COVERAGE: Requested source unread');
        const packagePage = evidence.filter(page => page.path === 'package.json');
        if (packagePage.length && IncrementalAssessment.coverage({ ...partial,
            requested: ['package.json'] }).inspected.length) {
            const fileBytes = partial.pages.find(page => page.path === 'package.json')!.fileBytes;
            const bytes = Buffer.alloc(fileBytes);
            for (const page of packagePage) Buffer.from(page.text, 'utf8').copy(bytes, page.start);
            try {
                const manifest = JSON.parse(bytes.toString('utf8')) as { dependencies?: Record<string, unknown>;
                    optionalDependencies?: Record<string, unknown>; peerDependencies?: Record<string, unknown> };
                const declared = [...new Set([...Object.keys(manifest.dependencies ?? {}),
                    ...Object.keys(manifest.optionalDependencies ?? {}),
                    ...Object.keys(manifest.peerDependencies ?? {})])];
                if (!record.dependencies.length && declared.length)
                    throw new Error('ASSESSMENT_DEPENDENCIES_EMPTY: Inspected package declares dependencies');
                if (record.dependencies.some(item => item.path === 'package.json' &&
                    !declared.some(name => item.quote.includes(name))))
                    throw new Error('ASSESSMENT_DEPENDENCIES_UNSUPPORTED: Package citation names no declared dependency');
            } catch (error) {
                if (error instanceof Error && error.message.startsWith('ASSESSMENT_')) throw error;
                throw new Error('ASSESSMENT_DEPENDENCIES_EMPTY: Cannot verify package manifest');
            }
        }
        const saved = await this.store.stage(this.root, this.identity, this.leaseToken, 'assessment',
            draft.revision, record as unknown as Record<string, unknown>, refs.map(ref => ({ id: ref.id,
                sourceHash: ref.sourceHash!, projectId: ref.projectId!,
                ...(ref.start !== undefined ? { start: ref.start } : {}),
                ...(ref.end !== undefined ? { end: ref.end } : {}) })));
        const compactRefs = [...new Set(partial.pages.map(page => page.path))].map(path => {
            const page = partial.pages.find(item => item.path === path)!;
            return { schemaVersion: 1 as const, kind: 'file' as const, origin: 'tool' as const,
                id: path, label: path, projectId: this.identity.projectId, sourceHash: page.sourceHash,
                ...(page.fileBytes ? { start: 0, end: page.fileBytes } : {}), estimatedTokens: 0 };
        });
        return { record, revision: saved.assessment!.revision, refs: compactRefs };
    }
}
