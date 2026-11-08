import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatPanelController } from '../../packages/theia-extension/lib/browser/chat-panel-controller.js';
import { checkedDocumentationHandoff } from '../../packages/theia-extension/lib/browser/documentation-handoff.js';
import { DocumentsWorkspaceState } from '../../packages/theia-extension/lib/browser/documents-workspace-state.js';

test('Open Review selects the exact checked candidate and never navigates on foreign or changed identity', async () => {
    const proposal = { id: 'p', digest: 'd', root: '/project', chatId: 'c', messageId: 'm',
        dependencySnapshotVersion: 1, targets: [] };
    const activity = { kind: 'documentation-proposal', status: 'pending', proposalId: 'p', documentProposal: proposal };
    const chat = { id: 'c', messages: [{ role: 'assistant', id: 'm', planningActivity: activity }] };
    const state = new DocumentsWorkspaceState();
    state.setProject('file:///project');
    let inspections = 0, opens = 0;
    const connection = { inspectDocumentation: async () => {
        inspections++;
        return { status: 'applicable', projectRoot: '/project', proposal };
    } };
    const controller = new ChatPanelController(() => { throw new Error('unused'); }, () => {});
    Object.assign(controller, { workspace: 'file:///project', chatId: 'c', snapshot: { chats: [chat] },
        lease: { workspace: 'file:///project', chatId: 'c', handle: 'h', token: 't', connection } });
    const open = async (candidate: { proposal?: { id: string; digest: string } }) => {
        opens++;
        assert.equal(candidate.proposal?.digest, 'd');
        assert.equal(state.selectCandidate('docs-proposal', 'file:///project', candidate.proposal!.id), true);
        return state.selection;
    };
    const selected = await checkedDocumentationHandoff(controller, 'file:///project', 'p', 'd', open);
    assert.equal(selected.candidateId, 'p');
    assert.equal(inspections, 1);
    await assert.rejects(checkedDocumentationHandoff(controller, 'file:///project', 'p', 'foreign', open));
    assert.equal(inspections, 1);
    assert.equal(opens, 1);
    connection.inspectDocumentation = async () => {
        inspections++; controller.workspace = 'file:///other';
        return { status: 'applicable', projectRoot: '/project', proposal };
    };
    await assert.rejects(checkedDocumentationHandoff(controller, 'file:///project', 'p', 'd', open));
    assert.equal(opens, 1);
    assert.equal(state.selection.candidateId, 'p', 'earlier reviewed selection is retained');
});
