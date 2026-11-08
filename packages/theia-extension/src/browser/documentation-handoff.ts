import type { ChatPanelController } from './chat-panel-controller';
import type { VerifiedDocumentsCandidate } from './documents-diff';

/** Explicit navigation only; no proposal decision or source write occurs here. */
export async function checkedDocumentationHandoff<T>(owner: ChatPanelController, uri: string,
    proposalId: string, digest: string,
    open: (candidate: VerifiedDocumentsCandidate) => Promise<T>): Promise<T> {
    const selected = owner.currentDocumentationProposal(proposalId, digest);
    if (!selected || owner.workspace !== uri)
        throw new Error('Exact current documentation candidate required');
    const candidate = await owner.inspectDocumentationProposal(proposalId, digest);
    if (owner.workspace !== uri || owner.currentDocumentationProposal(proposalId, digest) !== selected ||
        candidate.projectRoot !== selected.root || candidate.proposal?.id !== proposalId ||
        candidate.proposal.digest !== digest || candidate.proposal.chatId !== selected.chatId ||
        candidate.proposal.messageId !== selected.messageId)
        throw new Error('Documentation candidate changed before Documents navigation');
    return open(candidate);
}
