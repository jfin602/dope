import type { ChatDocumentationProposal } from '@dope/chat';
import { nativeDocumentFormat, type NativeDocumentFormat, type NativeDocumentMode } from './native-doc-editor-modes';

export type ProposalViewStatus = 'applicable' | 'stale' | 'rejected' | 'revised' | 'partial-recovery' |
    'accepted' | 'expired' | 'wrong-project' | 'unavailable';
export interface ProposalTabIdentity {
    root: string; worktreeId: string; ownerId: string; proposalId: string;
    revision: number; digest: string; path: string;
}
export interface ProposalTabSnapshot {
    identity: ProposalTabIdentity; format: NativeDocumentFormat;
    original: string | null; proposed: string; status: ProposalViewStatus;
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
