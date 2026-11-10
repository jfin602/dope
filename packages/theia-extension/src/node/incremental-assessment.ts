import type { ChatAssistantMessage, ChatPromptDraftIdentity } from '@dope/chat';
import { ChatRepository } from '@dope/chat/lib/node';
import type { ChatProjectGrounder } from './chat-project-grounder';
import { PromptDraftStore, type StoredPromptDraft } from './prompt-draft-store';
import { validatedAssessmentWireframe, requestedWorkPromptCount, isAssessmentWireframe,
    type AssessmentRead, type AssessmentRecord, type AssessmentWireframe } from './prompt-authoring-stage';

type Partial = NonNullable<StoredPromptDraft['partialAssessment']>;
const initial = (requested: string[]): Partial => ({ requested, pages: [], blocked: {},
    findings: { observations: [], preservation: [], dependencies: [], risks: [] }, emptyReasons: {} });
/** One Chat draft, one guarded store. The model supplies content, never authority or citation metadata. */
export class IncrementalAssessment {
    private readonly store: PromptDraftStore;
    private revisionCandidate?: AssessmentWireframe;
    constructor(private readonly repository: ChatRepository, private readonly grounder: ChatProjectGrounder,
        private readonly root: string, private readonly identity: ChatPromptDraftIdentity,
        private readonly leaseToken: string, private readonly requestedText: string,
        store?: PromptDraftStore, private readonly revisionMode = false) {
        this.store = store ?? new PromptDraftStore(repository, grounder);
    }
    async begin(): Promise<AssessmentRecord | undefined> {
        if (this.revisionMode) {
            let saved = await this.store.read(this.root, this.identity, this.leaseToken);
            if (saved.pendingAssessment) {
                const message = (await this.repository.read(this.root)).chats
                    .find(chat => chat.id === this.identity.chatId)?.messages
                    .find(item => item.id === saved.pendingAssessment?.messageId);
                if (!(message?.role === 'assistant' && message.execution.status === 'complete' &&
                    message.planningActivity?.kind === 'prompt-assessment-revision' &&
                    message.planningActivity.status === 'pending')) {
                    await this.store.decideAssessment(this.root, this.identity, this.leaseToken,
                        saved.pendingAssessment.messageId,
                        saved.pendingAssessment.value.contentHash, 'reject');
                    saved = await this.store.read(this.root, this.identity, this.leaseToken);
                }
            }
            if (!saved.assessment || saved.pendingAssessment)
                throw new Error('ASSESSMENT_STAGE_STALE: A current Assessment without pending revision is required');
            return undefined;
        }
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
        return { draft, partial: draft.partialAssessment ?? initial([]) };
    }
    async readPage(page: { path: string; offset: number; endOffset: number;
        fileBytes: number; sourceHash: string }): Promise<'complete' | 'page' | 'idempotent'> {
        if (this.revisionMode) return 'page';
        if ((page.fileBytes === 0 ? page.offset !== 0 || page.endOffset !== 0 :
            page.endOffset <= page.offset) || page.endOffset > page.fileBytes) return 'idempotent';
        const { draft, partial } = await this.snapshot();
        if (draft.assessment || partial.pages.some(item => item.path === page.path &&
            item.start === page.offset && item.end === page.endOffset && item.sourceHash === page.sourceHash)) return 'idempotent';
        const observed = [...new Set([...partial.pages.map(item => item.path), page.path])];
        const beforeComplete = IncrementalAssessment.coverage({ ...partial, requested: observed }).inspected.includes(page.path);
        const { [page.path]: _blocked, ...remainingBlocked } = partial.blocked;
        const updated = { ...partial, blocked: remainingBlocked, pages: [...partial.pages,
            { path: page.path, start: page.offset, end: page.endOffset,
                fileBytes: page.fileBytes, sourceHash: page.sourceHash }] };
        await this.store.updatePartialAssessment(this.root, this.identity, this.leaseToken,
            draft.revision, updated);
        return !beforeComplete &&
            IncrementalAssessment.coverage({ ...updated, requested: observed }).inspected.includes(page.path) ?
            'complete' : 'page';
    }
    async blockedRead(path: string, reason: string): Promise<void> {
        if (this.revisionMode) return;
        const { draft, partial } = await this.snapshot();
        if (draft.assessment || !partial.requested.includes(path)) return;
        await this.store.updatePartialAssessment(this.root, this.identity, this.leaseToken,
            draft.revision, { ...partial, blocked: { ...partial.blocked, [path]: reason.slice(0, 80) } });
    }
    static coverage(partial: Partial): { inspected: string[]; remaining: string[];
        progress: Record<string, { coveredBytes: number; fileBytes?: number; nextOffset: number | null;
            expectedSourceHash?: string }> } {
        const progress = Object.fromEntries(partial.requested.map(path => {
            const pages = partial.pages.filter(page => page.path === path)
                .sort((a, b) => a.start - b.start);
            if (!pages.length) return [path, { coveredBytes: 0, nextOffset: 0 }];
            let covered = 0;
            for (const page of pages) {
                if (page.sourceHash !== pages[0].sourceHash || page.fileBytes !== pages[0].fileBytes ||
                    page.start > covered) break;
                covered = Math.max(covered, page.end);
            }
            return [path, { coveredBytes: covered, fileBytes: pages[0].fileBytes,
                nextOffset: covered === pages[0].fileBytes ? null : covered,
                expectedSourceHash: pages[0].sourceHash }];
        })) as Record<string, { coveredBytes: number; fileBytes?: number; nextOffset: number | null;
            expectedSourceHash?: string }>;
        const inspected = partial.requested.filter(path => progress[path].nextOffset === null);
        return { inspected, remaining: partial.requested.filter(path => !inspected.includes(path)), progress };
    }
    async status(): Promise<{ assessment: string; sources: string; findings: number;
        required: { path: string; coveredBytes: number; nextOffset: number | null;
            expectedSourceHash?: string }[];
        remaining: string[]; nextAction: string; finishReady: boolean; blockedBy: string[];
        revision: number }> {
        if (this.revisionMode) {
            const draft = await this.store.read(this.root, this.identity, this.leaseToken);
            return { assessment: this.identity.slug, sources: 'revision source reads', required: [], remaining: [],
                findings: this.revisionCandidate?.sourceClaims.length ?? 0,
                nextAction: this.revisionCandidate ? 'Call assessment_finish.' :
                    'Stage one replacement wireframe for owner review.',
                finishReady: !!this.revisionCandidate, blockedBy: this.revisionCandidate ? [] : ['wireframe'],
                revision: draft.revision };
        }
        const { draft, partial } = await this.snapshot();
        const complete = draft.assessment?.record as AssessmentRecord | undefined;
        if (complete && !isAssessmentWireframe(complete))
            throw new Error('ASSESSMENT_LEGACY_DRAFT: Historical assessment cannot be converted');
        const legacyPartial = !!partial.scope || !!partial.tiers ||
            Object.values(partial.findings).some(items => items.length > 0);
        const ready = !!complete || !!partial.wireframe;
        const observed = [...new Set(partial.pages.map(page => page.path))];
        const progress = IncrementalAssessment.coverage({ ...partial, requested: observed });
        return { assessment: this.identity.slug,
            sources: `${partial.pages.length} brokered source pages`,
            required: observed.map(path => ({ path, ...progress.progress[path] })),
            findings: complete?.sourceClaims.length ?? partial.wireframe?.sourceClaims.length ?? 0,
            remaining: [], nextAction: complete ? '/prompt-plan' : legacyPartial ?
                'Historical incomplete assessment requires a fresh named draft.' :
                ready ? 'Call assessment_finish.' :
                'Read relevant source, then submit one bounded wireframe with assessment_stage.',
            finishReady: ready, blockedBy: ready ? [] :
                legacyPartial ? ['legacyDraft'] : ['wireframe'], revision: draft.revision };
    }
    async stage(raw: unknown, refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>,
        evidence: readonly AssessmentRead[]): Promise<{ accepted: true; idempotent: boolean;
            category: string; findings: number; nextAction: string }> {
        if (this.revisionMode) {
            const wireframe = validatedAssessmentWireframe(raw, refs, evidence,
                requestedWorkPromptCount(this.requestedText));
            const idempotent = JSON.stringify(this.revisionCandidate) === JSON.stringify(wireframe);
            if (this.revisionCandidate && !idempotent)
                throw new Error('ASSESSMENT_CONFLICTING_REPLAY: Revision candidate changed');
            this.revisionCandidate = wireframe;
            return { accepted: true, idempotent, category: 'wireframe',
                findings: wireframe.sourceClaims.length, nextAction: 'Call assessment_finish.' };
        }
        const { draft, partial } = await this.snapshot();
        if (draft.assessment) throw new Error('ASSESSMENT_STAGE_SEALED: Assessment is already complete');
        if (partial.scope || partial.tiers || Object.values(partial.findings).some(items => items.length))
            throw new Error('ASSESSMENT_LEGACY_DRAFT: Historical partial assessment needs a fresh named draft');
        const wireframe = validatedAssessmentWireframe(raw, refs, evidence,
            requestedWorkPromptCount(this.requestedText));
        if (!partial.pages.length && wireframe.sourceClaims.length)
            throw new Error('ASSESSMENT_READ_REQUIRED: Read claimed source with read_file');
        const idempotent = JSON.stringify(partial.wireframe) === JSON.stringify(wireframe);
        if (partial.wireframe && !idempotent)
            throw new Error('ASSESSMENT_CONFLICTING_REPLAY: Wireframe changed; start a reviewed revision');
        if (!idempotent) await this.store.updatePartialAssessment(this.root, this.identity,
            this.leaseToken, draft.revision, { ...partial, wireframe });
        return { accepted: true, idempotent, category: 'wireframe',
            findings: wireframe.sourceClaims.length, nextAction: 'Call assessment_finish.' };
    }
    async finish(): Promise<{ record: AssessmentRecord; revision: number;
        refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']> }> {
        if (this.revisionMode) {
            if (!this.revisionCandidate) throw new Error('ASSESSMENT_WIREFRAME_INCOMPLETE: Submit a wireframe first');
            const draft = await this.store.read(this.root, this.identity, this.leaseToken);
            if (!draft.assessment) throw new Error('ASSESSMENT_STAGE_STALE: Assessment missing');
            return { record: this.revisionCandidate, revision: draft.assessment.revision,
                refs: [] };
        }
        const { draft, partial } = await this.snapshot();
        if (draft.assessment) {
            const record = draft.assessment.record as unknown as AssessmentRecord;
            if (!isAssessmentWireframe(record))
                throw new Error('ASSESSMENT_LEGACY_DRAFT: Historical assessment cannot be converted');
            return { record, revision: draft.assessment.revision,
                refs: draft.assessment.sourceRefs.map(ref => ({ schemaVersion: 1, kind: 'file',
                    origin: 'tool', id: ref.id, label: ref.id, projectId: ref.projectId,
                    sourceHash: ref.sourceHash, start: ref.start, end: ref.end, estimatedTokens: 0 })) };
        }
        if (!partial.wireframe) throw new Error('ASSESSMENT_WIREFRAME_INCOMPLETE: Submit a wireframe first');
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
                start: page.start, end: page.end, estimatedTokens: 0 });
        }
        const claims = partial.wireframe.sourceClaims.map(({ claim, path, quote }) =>
            ({ claim, path, quote }));
        const record = validatedAssessmentWireframe({ ...partial.wireframe, sourceClaims: claims },
            refs, evidence, requestedWorkPromptCount(this.requestedText));
        const saved = await this.store.stage(this.root, this.identity, this.leaseToken, 'assessment',
            draft.revision, record as unknown as Record<string, unknown>, refs.map(ref => ({
                id: ref.id, sourceHash: ref.sourceHash!, projectId: ref.projectId!,
                start: ref.start, end: ref.end })));
        return { record, revision: saved.assessment!.revision, refs };
    }

}
