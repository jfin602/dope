import type { ChatDocumentationProposal, ChatPromptStackProposal, ChatProposalProgress } from '@dope/chat';
import { nativeDocumentFormat, type NativeDocumentFormat, type NativeDocumentMode } from './native-doc-editor-modes';

export type ProposalViewStatus = 'staging' | 'pending' | 'applicable' | 'stale' | 'rejected' | 'revised' | 'partial-recovery' |
    'accepted' | 'expired' | 'wrong-project' | 'unavailable';
export interface ProposalTabIdentity {
    root: string; worktreeId: string; ownerId: string; proposalId: string;
    revision: number; digest: string; path: string;
}
export interface ProposalTabSnapshot {
    identity: ProposalTabIdentity; format: NativeDocumentFormat;
    original: string | null; proposed: string; status: ProposalViewStatus; previewTruncated?: boolean;
}

export function proposalTabKey(identity: ProposalTabIdentity): string {
    return JSON.stringify([identity.root, identity.worktreeId, identity.ownerId, identity.proposalId,
        identity.revision, identity.digest, identity.path]);
}

export function proposalSnapshot(proposal: ChatDocumentationProposal, path: string,
    status: ProposalViewStatus): ProposalTabSnapshot {
    const target = proposal.targets.find(item => item.path === path);
    const format = nativeDocumentFormat('file', path);
    if (!target || !format || !['create', 'update'].includes(target.operation) ||
        (target.operation === 'create' ? target.before !== null : target.before === null))
        throw new Error('Exact supported proposal document is unavailable');
    return { identity: { root: proposal.root, worktreeId: proposal.worktreeId, ownerId: proposal.ownerId,
        proposalId: proposal.id, revision: proposal.proposalRevision ?? 1, digest: proposal.digest, path },
        format, original: target.before, proposed: target.after, status };
}

/** Prompt stacks use the same immutable editor surface with their own typed proposal owner. */
export function promptStackSnapshot(proposal: ChatPromptStackProposal, path: string,
    status: ProposalViewStatus): ProposalTabSnapshot {
    const target = proposal.files.find(item => item.path === path);
    const format = nativeDocumentFormat('file', path);
    if (!target || !format || target.before !== null)
        throw new Error('Exact supported prompt proposal file is unavailable');
    return { identity: { root: proposal.root, worktreeId: proposal.worktreeId, ownerId: proposal.ownerId,
        proposalId: proposal.id, revision: proposal.revision, digest: proposal.digest, path },
        format, original: null, proposed: target.after, status };
}
/** A stage has its own revision identity and can never alias a sealed review resource. */
export function stagedProposalSnapshot(progress: ChatProposalProgress, path: string): ProposalTabSnapshot {
    const target = progress.targets.find(item => item.path === path);
    const format = nativeDocumentFormat('file', path);
    if (!target || !format || progress.state === 'ready-for-review')
        throw new Error('Provisional proposal preview unavailable');
    return { identity: { root: progress.root, worktreeId: progress.worktreeId,
        ownerId: progress.ownerId, proposalId: progress.proposalId,
        revision: progress.revision, digest: `staging:${progress.proposalId}:${progress.revision}`, path },
        format, original: target.original, proposed: target.proposed,
        status: progress.state === 'staging' ? 'staging' : progress.state === 'stale' ? 'stale' : 'unavailable',
        previewTruncated: target.truncated };
}

/** Selection changes never change the reviewed bytes, identity, or status. */
export class ProposalTabSelection {
    mode: NativeDocumentMode;
    version: 'original' | 'proposed' = 'proposed';
    invalid = false;
    constructor(readonly snapshot: ProposalTabSnapshot) {
        this.mode = snapshot.format === 'md' ? 'formatted' : 'source';
    }
    selectMode(mode: NativeDocumentMode): void {
        if (mode === 'formatted' && this.snapshot.format !== 'md') throw new Error('Formatted text is unavailable');
        this.mode = mode;
    }
    selectVersion(version: 'original' | 'proposed'): void { this.version = version; }
    invalidateForProject(root: string | undefined): void {
        if (root !== this.snapshot.identity.root) this.invalid = true;
    }
    get text(): string | null {
        return this.version === 'original' ? this.snapshot.original : this.snapshot.proposed;
    }
}

/** Monaco compares text lines; expose exact retained EOL bytes alongside its diff. */
export function lineEndingComparison(original: string | null, proposed: string): string {
    if (original === null) return 'Original absent (new file)';
    const endings = (text: string) => [...text.matchAll(/\r\n|\r|\n/gu)].map(match =>
        match[0] === '\r\n' ? 'CRLF' : match[0] === '\r' ? 'CR' : 'LF');
    const before = endings(original), after = endings(proposed);
    const changes: string[] = [];
    for (let i = 0; i < Math.max(before.length, after.length); i++)
        if (before[i] !== after[i]) changes.push(`line ${i + 1}: ${before[i] ?? 'none'} → ${after[i] ?? 'none'}`);
    return changes.length ? `Line endings: ${changes.join('; ')}` : 'Line endings unchanged';
}
