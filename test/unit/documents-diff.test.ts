import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatDocumentationProposal } from '../../packages/chat/lib/index.js';
import { projectCompareFile, projectDocumentsCompare } from '../../packages/theia-extension/lib/browser/documents-diff.js';

function proposal(targets: ChatDocumentationProposal['targets'], snapshot = 1): ChatDocumentationProposal {
    return { id: 'candidate', digest: 'reviewed-digest', root: '/project', projectId: 'project', worktreeId: 'tree',
        ownerId: 'owner', chatId: 'chat', messageId: 'message', leaseDigest: 'lease', roadmapRevision: 1,
        createdAt: '2026-11-07T00:00:00Z', expiresAt: '2026-11-07T01:00:00Z',
        dependencies: [], dependencySnapshotVersion: snapshot as 1, targets };
}
function target(path: string, before: string | null, after: string): ChatDocumentationProposal['targets'][number] {
    return { path, operation: before === null ? 'create' : 'update', before, beforeHash: before === null ? null : 'before',
        after, afterHash: 'after', diff: 'untrusted summary' };
}

test('create and nested paths expose affected tree, exact full proposed bytes and absent original', () => {
    const after = '# New\r\n\r\n  a  \r\n';
    const view = projectDocumentsCompare({ status: 'applicable', projectRoot: '/project', proposal: proposal([
        target('docs/guide/intro.md', null, after), target('docs/notes.txt', 'old\n', 'new\n')]) });
    assert.equal(view.status, 'applicable');
    assert.equal(view.approvable, true);
    assert.deepEqual(view.tree.map(item => item.path), ['docs']);
    assert.deepEqual(view.tree[0].children.map(item => item.path), ['docs/guide', 'docs/notes.txt']);
    assert.equal(view.tree[0].children[0].children[0].file?.label, 'Added');
    assert.equal(view.tree[0].children[1].file?.label, 'Modified');
    const file = view.files[0];
    assert.equal(file.defaultSide, 'proposed');
    assert.equal(file.original, null);
    assert.equal(file.proposed, after);
    assert.equal(file.proposedLines.map(line => line.text).join(''), after);
    assert.deepEqual(file.proposedLines.map(line => [line.start, line.end]), [[0, 7], [7, 9], [9, 16]]);
    assert.ok(file.proposedLines.every(line => line.kind === 'added'));
});

test('replacement across Markdown boundaries retains removed lines, exact anchors and source copy', () => {
    const before = '# Heading\n\n- old\n```ts\n  x\n```\nEnd\n';
    const after = '# Heading\n\n| new |\n| --- |\nEnd\n';
    const file = projectCompareFile({ path: 'docs/readme.md', operation: 'update', before, after });
    assert.equal(file.originalLines.map(line => line.text).join(''), before);
    assert.equal(file.proposedLines.map(line => line.text).join(''), after);
    assert.deepEqual(file.sourceDiff.map(line => line.kind),
        ['same', 'same', 'removed', 'removed', 'removed', 'removed', 'added', 'added', 'same']);
    assert.equal(file.originalLines[2].anchor, 'docs/readme.md:original:3');
    assert.equal(file.proposedLines[2].anchor, 'docs/readme.md:proposed:3');
    assert.equal(file.originalLines[2].start, before.indexOf('- old'));
    assert.equal(file.proposedLines[2].start, after.indexOf('| new |'));
});

test('CRLF, trailing spaces, tabs, blank and unterminated lines remain distinct', () => {
    const before = 'one\r\n\tvalue  \r\n\r\nlast';
    const after = 'one\r\n\tvalue \r\n\r\nlast\n';
    const file = projectCompareFile({ path: 'notes.txt', operation: 'update', before, after });
    assert.equal(file.originalLines.map(line => line.text).join(''), before);
    assert.equal(file.proposedLines.map(line => line.text).join(''), after);
    assert.ok(file.sourceDiff.some(line => line.kind === 'removed' && line.text === '\tvalue  \r\n'));
    assert.ok(file.sourceDiff.some(line => line.kind === 'added' && line.text === '\tvalue \r\n'));
    assert.ok(file.sourceDiff.some(line => line.kind === 'removed' && line.text === 'last'));
    assert.ok(file.sourceDiff.some(line => line.kind === 'added' && line.text === 'last\n'));
    assert.equal(file.originalLines.at(-1)?.end, before.length);
    assert.equal(file.proposedLines.at(-1)?.end, after.length);
});

test('empty existing and absent targets are different; fixture deletion is compare only', () => {
    const empty = projectCompareFile({ path: 'empty.md', operation: 'update', before: '', after: 'filled' });
    assert.equal(empty.original, '');
    assert.deepEqual(empty.originalLines, []);
    const deleted = projectCompareFile({ path: 'old.md', operation: 'delete', before: 'old\n', after: null });
    assert.equal(deleted.label, 'Deleted');
    assert.equal(deleted.proposed, null);
    assert.deepEqual(deleted.sourceDiff.map(line => line.kind), ['removed']);
    assert.throws(() => projectCompareFile({ path: 'bad.md', operation: 'delete', before: 'old', after: 'new' }));
    const unsupported = proposal([{ ...target('old.md', 'old', 'new'), operation: 'delete' as 'update', after: null as unknown as string }]);
    assert.equal(projectDocumentsCompare({ status: 'applicable', projectRoot: '/project', proposal: unsupported }).status,
        'unsupported');
    assert.equal(projectDocumentsCompare({ status: 'applicable', projectRoot: '/project', proposal: unsupported }).approvable,
        false);
});

test('old pending card and stale/missing source never project as approvable', () => {
    const saved = proposal([target('docs/a.md', 'old', 'new')]);
    delete saved.dependencySnapshotVersion;
    assert.equal(projectDocumentsCompare({ status: 'applicable', projectRoot: '/project', proposal: saved }).status, 'historical');
    assert.equal(projectDocumentsCompare({ status: 'applicable', projectRoot: '/project', proposal: saved }).approvable, false);
    const current = proposal([target('docs/a.md', 'old', 'new')]);
    assert.equal(projectDocumentsCompare({ status: 'stale', projectRoot: '/project', proposal: current }).approvable, false);
    assert.equal(projectDocumentsCompare({ status: 'applicable', projectRoot: '/other', proposal: current }).status, 'stale');
    assert.equal(projectDocumentsCompare({ status: 'missing', projectRoot: '/project', proposal: undefined }).files.length, 0);
});
