import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { proposalSnapshot, promptStackSnapshot, proposalTabKey, ProposalTabSelection, lineEndingComparison } from
    '../../packages/theia-extension/lib/browser/native-doc-editor-proposal-model.js';
import type { ChatDocumentationProposal, ChatPromptStackProposal } from '../../packages/chat/lib/index.js';

const source = readFileSync('packages/theia-extension/src/browser/native-doc-editor-proposal.ts', 'utf8');
const moduleSource = readFileSync('packages/theia-extension/src/browser/frontend-module.ts', 'utf8');

function proposal(before: string | null = 'first\r\n  second\n', after = 'first\n second\r\n'): ChatDocumentationProposal {
    return { id: 'proposal-1', digest: 'digest-1', root: '/work/a', projectId: 'a', worktreeId: 'tree-a',
        ownerId: 'owner-a', chatId: 'chat-a', messageId: 'message-a', leaseDigest: 'lease', roadmapRevision: 1,
        createdAt: '', expiresAt: '', proposalRevision: 1, dependencies: [], targets: [
            { path: 'docs/readme.md', operation: before === null ? 'create' : 'update', before,
                beforeHash: before === null ? null : 'old-hash', after, afterHash: 'new-hash', diff: '' }] };
}

test('virtual tab key is exact and disjoint from a canonical file URI', () => {
    const basis = proposalSnapshot(proposal(), 'docs/readme.md', 'applicable');
    const key = proposalTabKey(basis.identity);
    assert.notEqual(key, 'file:///work/a/docs/readme.md');
    for (const changed of [{ root: '/work/b' }, { worktreeId: 'tree-b' }, { ownerId: 'owner-b' },
        { proposalId: 'proposal-2' }, { revision: 2 }, { digest: 'digest-2' }, { path: 'docs/other.md' }])
        assert.notEqual(proposalTabKey({ ...basis.identity, ...changed }), key);
    assert.equal(proposalTabKey({ ...basis.identity }), key);
});

test('snapshot retains exact original and proposed bytes; new-file original is absent', () => {
    const prior = 'one\r\n  two\t\n';
    const next = 'one\n two\t\r\n';
    const update = proposalSnapshot(proposal(prior, next), 'docs/readme.md', 'stale');
    assert.equal(update.original, prior);
    assert.equal(update.proposed, next);
    const created = proposalSnapshot(proposal(null, next), 'docs/readme.md', 'applicable');
    assert.equal(created.original, null);
    assert.equal(created.proposed, next);
    assert.throws(() => proposalSnapshot(proposal(), 'docs/missing.md', 'applicable'));
    assert.throws(() => proposalSnapshot({ ...proposal(), targets: [{ ...proposal().targets[0], operation: 'create' }] },
        'docs/readme.md', 'applicable'));
});

test('mode, version, status and project invalidation are independent of immutable bytes', () => {
    const snapshot = proposalSnapshot(proposal(), 'docs/readme.md', 'rejected');
    const selection = new ProposalTabSelection(snapshot);
    assert.equal(selection.mode, 'formatted');
    assert.equal(selection.version, 'proposed');
    selection.selectVersion('original');
    selection.selectMode('diff');
    assert.equal(selection.text, snapshot.original);
    assert.equal(selection.mode, 'diff');
    assert.equal(snapshot.status, 'rejected');
    selection.invalidateForProject('/work/a');
    assert.equal(selection.invalid, false);
    selection.invalidateForProject('/work/b');
    assert.equal(selection.invalid, true);
    assert.equal(snapshot.proposed, proposal().targets[0].after);
    assert.equal(proposalTabKey(snapshot.identity), proposalTabKey(proposalSnapshot(proposal(), 'docs/readme.md', 'revised').identity));
    assert.notEqual(proposalTabKey(snapshot.identity), proposalTabKey(proposalSnapshot(
        { ...proposal(), digest: 'digest-2', proposalRevision: 2 }, 'docs/readme.md', 'revised').identity));
});

test('plain-text proposal defaults to source and cannot select formatted', () => {
    const text = proposal();
    text.targets[0].path = 'notes.txt';
    const selection = new ProposalTabSelection(proposalSnapshot(text, 'notes.txt', 'partial-recovery'));
    assert.equal(selection.mode, 'source');
    assert.throws(() => selection.selectMode('formatted'));
    text.targets[0].path = 'main.ts';
    assert.throws(() => proposalSnapshot(text, 'main.ts', 'stale'));
});

test('prompt stack adapter keeps exact read-only files, absent originals and revision identity', () => {
    const prompt: ChatPromptStackProposal = { id: 'prompt-1', digest: 'digest-a', root: '/work/a',
        projectId: 'project', ownerId: 'owner', chatId: 'chat', messageId: 'message',
        leaseDigest: 'lease', revision: 1, folder: 'c1-example', sourceVersion: '0.13.11',
        gitHead: 'head', worktreeId: 'tree', assessmentMessageId: 'assessment',
        planMessageId: 'plan', createdAt: '', files: [
            { path: 'docs/tasks/c1-example/README.md', before: null, after: '# Ready\n', afterHash: 'hash-1' },
            { path: 'docs/tasks/c1-example/P1-do-work.txt', before: null, after: 'TASK: work\n', afterHash: 'hash-2' }] };
    const markdown = promptStackSnapshot(prompt, prompt.files[0].path, 'pending');
    const text = promptStackSnapshot(prompt, prompt.files[1].path, 'pending');
    assert.equal(markdown.original, null);
    assert.equal(markdown.proposed, '# Ready\n');
    assert.equal(new ProposalTabSelection(markdown).mode, 'formatted');
    assert.equal(new ProposalTabSelection(text).mode, 'source');
    assert.throws(() => new ProposalTabSelection(text).selectMode('formatted'));
    assert.notEqual(proposalTabKey(text.identity), proposalTabKey(
        promptStackSnapshot({ ...prompt, digest: 'digest-b', revision: 2 }, prompt.files[1].path, 'revised').identity));
    assert.throws(() => promptStackSnapshot(prompt, 'docs/tasks/c1-example/other.md', 'pending'));
});

test('native diff uses original and proposed virtual resources and no writer', () => {
    assert.match(source, /DiffUris\.encode\(original, proposed/);
    assert.match(source, /this\.provider\.get\(uris\.diff\)/);
    assert.match(source, /ignoreTrimWhitespace: false/);
    assert.match(source, /readOnly: true, autosaveable: false/);
    assert.match(source, /this\.bytes\.get\(uri\.toString\(\)\)/);
    assert.match(source, /new ProposalDocumentWidget\(snapshot, this\.provider, this\.resources\)/);
    assert.match(source, /this\.shell\.addWidget\(widget, \{ area: 'main' \}\)/);
    assert.match(moduleSource, /bind\(ResourceResolver\)\.toService\(ProposalDocumentResources\)/);
    assert.doesNotMatch(source, /\b(?:saveContents|saveStream|saveContentChanges|FileService|writeFile|applyDocumentationProposal)\b/);
    assert.doesNotMatch(source, /withScheme\('file'\)/);
});

test('supplemental comparison names exact CRLF and LF changes', () => {
    assert.equal(lineEndingComparison(null, 'new\n'), 'Original absent (new file)');
    assert.equal(lineEndingComparison('a\r\nb\n', 'a\nb\r\n'),
        'Line endings: line 1: CRLF → LF; line 2: LF → CRLF');
    assert.equal(lineEndingComparison('same\r\n', 'same\r\n'), 'Line endings unchanged');
});
