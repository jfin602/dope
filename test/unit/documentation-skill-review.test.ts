import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { materializeDocumentationChanges, parseDocumentationSkillReview,
    requireCompleteDocumentationReview } from '../../packages/theia-extension/lib/node/documentation-skill-review.js';
import { prepareDocumentationReview } from '../../packages/theia-extension/lib/node/documentation-review.js';

test('incomplete create-only review cannot claim a requested current-document update', () => {
    const discovery = { enumerated: 2, searched: 2, omitted: [], candidates: [
        { path: 'docs/history/old-scoring.md', line: 1, heading: '# Archived', historical: true, score: 12 },
        { path: 'docs/current/scoring.md', line: 1, heading: '# Scoring', historical: false, score: 9 }] };
    const output = JSON.stringify({ report: 'Both documents are updated.', changes: [
        { path: 'docs/current/validation.txt', after: 'new\n' }] });
    const review = parseDocumentationSkillReview(output, ['docs/current/scoring.md']);
    assert.throws(() => requireCompleteDocumentationReview(
        '/docs-review update the current scoring contract and create docs/current/validation.txt; read its late section',
        discovery, review.changes, [{ path: 'docs/current/scoring.md', offset: 0, endOffset: 4096,
            fileBytes: 15267, sourceHash: 'a'.repeat(64), text: '# Scoring' }]),
    /required target omitted: docs\/current\/scoring.md/);
    assert.throws(() => requireCompleteDocumentationReview(
        '/docs-review update docs/current/scoring.md and create docs/current/validation.txt',
        discovery, [], []), /required target omitted/);
    assert.doesNotThrow(() => requireCompleteDocumentationReview(
        '/docs-review update docs/current/scoring.md and create docs/current/validation.txt; read scoring.md late section',
        discovery, [{ path: 'docs/current/scoring.md' }, { path: 'docs/current/validation.txt' }], [
            { path: 'docs/current/scoring.md', offset: 12000, endOffset: 15267,
                fileBytes: 15267, sourceHash: 'a'.repeat(64), text: '## Late requirement' }]));
    assert.throws(() => requireCompleteDocumentationReview(
        '/docs-review update docs/current/missing.md and create docs/current/validation.txt',
        discovery, [{ path: 'docs/current/validation.txt' }], []),
    /requested update source not discovered/);
});

test('create target is distinct from the current document cited as its source', () => {
    const discovery = { enumerated: 1, searched: 1, omitted: [], candidates: [
        { path: 'docs/current/rules.md', line: 1, heading: '# Rules', historical: false, score: 10 }] };
    const objective = '/docs-review Create docs/current/r2-check.txt from docs/current/rules.md';
    assert.doesNotThrow(() => requireCompleteDocumentationReview(objective, discovery,
        [{ path: 'docs/current/r2-check.txt' }], [{ path: 'docs/current/rules.md', offset: 0,
            endOffset: 100, fileBytes: 100, sourceHash: 'a'.repeat(64), text: '# Rules' }]));
    assert.throws(() => requireCompleteDocumentationReview(objective, discovery, [], []),
        /required target omitted: docs\/current\/r2-check.txt/);
    assert.throws(() => requireCompleteDocumentationReview(
        '/docs-review create docs/current/one.txt and docs/current/two.txt from docs/current/rules.md',
        discovery, [{ path: 'docs/current/one.txt' }], []),
    /required target omitted: docs\/current\/two.txt/);
});

test('named root update is checked instead of an unrelated discovered document', () => {
    const discovery = { enumerated: 2, searched: 2, omitted: [], candidates: [
        { path: 'AGENTS.md', line: 1, heading: '# Instructions', historical: false, score: 5 },
        { path: 'docs/current/rules.md', line: 1, heading: '# Rules', historical: false, score: 10 }] };
    const objective = '/docs-review Update AGENTS.md after reading docs/current/rules.md';
    assert.doesNotThrow(() => requireCompleteDocumentationReview(objective, discovery,
        [{ path: 'AGENTS.md' }], [{ path: 'AGENTS.md', offset: 0, endOffset: 12,
            fileBytes: 12, sourceHash: 'a'.repeat(64), text: '# Instructions' }]));
    assert.throws(() => requireCompleteDocumentationReview(objective, discovery,
        [{ path: 'docs/current/rules.md' }], []), /required target omitted: AGENTS\.md/);
});

test('one wrapped review object is accepted; competing or malformed objects are not', () => {
    const valid = JSON.stringify({ report: 'Both targets are covered.', changes: [
        { path: 'docs/current/scoring.md', replace: { before: 'old', after: 'new' } },
        { path: 'docs/current/validation.txt', after: 'case\n' }] });
    assert.equal(parseDocumentationSkillReview(`Here is the review:\n\`\`\`json\n${valid}\n\`\`\`\nDone.`,
        ['docs/current/scoring.md']).changes.length, 2);
    assert.throws(() => parseDocumentationSkillReview(`${valid}\n${valid}`,
        ['docs/current/scoring.md']), /exactly one valid JSON object/);
    assert.throws(() => parseDocumentationSkillReview('{"report":"broken","changes":[]', []),
        /exactly one valid JSON object/);
});

test('a change embedded in report prose cannot cross the review boundary', () => {
    // Captured from the 2026-11-06 connected-browser failure after a real brokered read.
    const failed = JSON.stringify({ report: 'Read docs/current/rules.md. Changes:[{"path":"docs/current/rules.md",' +
        '"replace":{"before":"A fraction such as 42.8 truncates to 42 before clamping.",' +
        '"after":"A fraction such as 42.8 truncates to 42 before clamping.\\nThe bounds are inclusive."}}]' });
    assert.throws(() => parseDocumentationSkillReview(failed, ['docs/current/rules.md']),
        /Invalid documentation review structure/);
    const valid = JSON.stringify({ report: 'Read the current rule; append the requested sentence.', changes: [
        { path: 'docs/current/rules.md', replace: {
            before: 'A fraction such as 42.8 truncates to 42 before clamping.',
            after: 'A fraction such as 42.8 truncates to 42 before clamping.\nThe bounds are inclusive.' } }] });
    assert.deepEqual(parseDocumentationSkillReview(valid, ['docs/current/rules.md']).changes,
        [{ path: 'docs/current/rules.md', replace: {
            before: 'A fraction such as 42.8 truncates to 42 before clamping.',
            after: 'A fraction such as 42.8 truncates to 42 before clamping.\nThe bounds are inclusive.' } }]);
    assert.throws(() => parseDocumentationSkillReview(JSON.stringify({ report: 'Read the rule.', changes: {
        path: 'docs/current/rules.md', replace: { before: 'old', after: 'new' } } }),
    ['docs/current/rules.md']), /Invalid documentation review structure/);
    assert.throws(() => parseDocumentationSkillReview(JSON.stringify({ report: 'Read the rule.', changes: [
        { path: 'docs/current/rules.md', replace: { before: 'old', after: 'new' }, after: 'new' }] }),
    ['docs/current/rules.md']), /Invalid documentation change/);
});

test('late exact replacement preserves a long source and stages one create plus update', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-doc-late-review-'));
    try {
        await mkdir(join(root, 'docs'));
        const before = '# Scoring\namber kites remain visible\n' + 'background\n'.repeat(1480) +
            '## Late requirement\nold rule\n';
        assert.ok(Buffer.byteLength(before) > 12_000 && Buffer.byteLength(before) < 16_384);
        await writeFile(join(root, 'docs', 'scoring.md'), before);
        const changes = await materializeDocumentationChanges(root, [
            { path: 'docs/scoring.md', replace: { before: '## Late requirement\nold rule\n',
                after: '## Late requirement\nMath.trunc then clamp to 0..100\n' } },
            { path: 'docs/validation.txt', after: '-15 -> 0\n' }], [
            { path: 'docs/scoring.md', offset: 12000, endOffset: Buffer.byteLength(before),
                fileBytes: Buffer.byteLength(before), sourceHash: 'b'.repeat(64),
                text: before.slice(12000) }]);
        const proposal = await prepareDocumentationReview(new RoadmapStore(), { root,
            chatId: 'chat', messageId: 'message', ownerId: 'owner', leaseToken: 'lease', changes });
        assert.deepEqual(proposal.targets.map(target => target.operation), ['update', 'create']);
        assert.match(proposal.targets[0].after, /amber kites remain visible/);
        assert.match(proposal.targets[0].diff, /\+Math.trunc then clamp/);
        assert.ok(proposal.targets[0].diff.length < 1000);
        assert.equal(await readFile(join(root, 'docs', 'scoring.md'), 'utf8'), before);
        await assert.rejects(materializeDocumentationChanges(root, [
            { path: 'docs/scoring.md', replace: { before: 'old rule', after: 'new rule' } }], []),
        /not uniquely observed/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
