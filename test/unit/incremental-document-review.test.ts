import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { IncrementalDocumentReview } from '../../packages/theia-extension/lib/node/incremental-document-review.js';
import { applyDocumentationProposal } from '../../packages/theia-extension/lib/node/documentation-application.js';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const discovery = { enumerated: 1, searched: 1, omitted: [], candidates: [
    { path: 'docs/rule.md', line: 1, heading: '# Rule', historical: false, score: 8 }] };
function stage(sequence: number, target: string, chunkIndex: number, value: object, complete: boolean) {
    const content = JSON.stringify(value);
    return { version: 1 as const, sequence, expectedRevision: sequence - 1,
        idempotencyKey: `stage-key-${sequence}`, target, chunkIndex, content, digest: hash(content), complete };
}
function snapshot(root: string, stages: ReturnType<typeof stage>[] = []) {
    return { schemaVersion: 1 as const, id: 'session', identity: { root, chatId: 'chat', messageId: 'message',
        leaseToken: 'lease', ownerId: 'owner', worktreeId: 'worktree', sourceBasis: 'basis', domain: 'document' as const },
        createdAt: Date.now(), revision: stages.length, calls: stages.length, state: 'staging' as const,
        stages: stages.map(item => ({ ...item, byteLength: Buffer.byteLength(item.content) })) };
}
test('incremental Docs stages preserve source bytes, allow more than four edits and a large chunked create', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-incremental-doc-'));
    try {
        await mkdir(join(root, 'docs'));
        const before = '# Rule\r\n' + Array.from({ length: 6 }, (_, index) => `Line ${index}: old\r\n`).join('') + 'Unrelated.\r\n';
        await writeFile(join(root, 'docs/rule.md'), before);
        const page = { path: 'docs/rule.md', offset: 0, endOffset: Buffer.byteLength(before),
            fileBytes: Buffer.byteLength(before), sourceHash: hash(`source:${root}`), fullHash: hash(before), text: before };
        const adapter = new IncrementalDocumentReview(new RoadmapStore(), { root, chatId: 'chat',
            messageId: 'message', ownerId: 'owner', leaseToken: 'lease',
            objective: '/docs-review update docs/rule.md and create docs/new.txt', discovery,
            pages: [page], readPaths: () => [page.path] });
        const stages: ReturnType<typeof stage>[] = [];
        for (let index = 0; index < 6; index++) {
            const next = stage(stages.length + 1, 'docs/rule.md', index, { operation: 'replace',
                sourceHash: hash(before), before: `Line ${index}: old`, after: `Line ${index}: new` }, index === 5);
            await adapter.validateStage(snapshot(root, stages), next); stages.push(next);
        }
        await assert.rejects(adapter.validateComplete(snapshot(root, stages)),
            /required target omitted: docs\/new\.txt/);
        const large = '# New\n' + 'A checked paragraph.\n'.repeat(1400);
        for (let offset = 0, index = 0; offset < large.length; offset += 6000, index++) {
            const next = stage(stages.length + 1, 'docs/new.txt', index,
                { operation: 'create', chunk: large.slice(offset, offset + 6000) }, offset + 6000 >= large.length);
            await adapter.validateStage(snapshot(root, stages), next); stages.push(next);
        }
        const proposal = await adapter.validateComplete(snapshot(root, stages));
        assert.equal(proposal.targets.length, 2);
        assert.equal(proposal.targets[0].after, before.replaceAll(': old', ': new'));
        assert.equal(proposal.targets[1].after, large);
        assert.equal(await readFile(join(root, 'docs/rule.md'), 'utf8'), before);
        await assert.rejects(readFile(join(root, 'docs/new.txt')));
        const applied = await applyDocumentationProposal(new RoadmapStore(), proposal, root, 'lease');
        assert.equal(applied.status, 'complete');
        assert.equal(await readFile(join(root, 'docs/rule.md'), 'utf8'), before.replaceAll(': old', ': new'));
        assert.equal(await readFile(join(root, 'docs/new.txt'), 'utf8'), large);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('late anchors require a real page and stale, ambiguous and overlapping edits fail closed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-incremental-negative-'));
    try {
        await mkdir(join(root, 'docs'));
        const before = '# Rule\n' + 'filler line\n'.repeat(1200) + '## Late\nunique old\n';
        await writeFile(join(root, 'docs/rule.md'), before);
        const page = { path: 'docs/rule.md', offset: Buffer.byteLength(before) - 50,
            endOffset: Buffer.byteLength(before), fileBytes: Buffer.byteLength(before),
            sourceHash: hash(`source:${root}`), fullHash: hash(before), text: before.slice(-50) };
        const context = { root, chatId: 'chat', messageId: 'message', ownerId: 'owner', leaseToken: 'lease',
            objective: '/docs-review update docs/rule.md late section', discovery, pages: [page],
            readPaths: () => [page.path] };
        const adapter = new IncrementalDocumentReview(new RoadmapStore(), context);
        const good = stage(1, 'docs/rule.md', 0, { operation: 'replace', sourceHash: hash(before),
            before: 'unique old', after: 'unique new' }, true);
        await adapter.validateStage(snapshot(root), good);
        const proposal = await adapter.validateComplete(snapshot(root, [good]));
        assert.match(proposal.targets[0].after, /unique new/);
        await assert.rejects(new IncrementalDocumentReview(new RoadmapStore(),
            { ...context, pages: [], readPaths: () => [] }).validateStage(snapshot(root), good), /broker-read/);
        await assert.rejects(adapter.validateStage(snapshot(root), stage(1, 'docs/rule.md', 0,
            { operation: 'replace', sourceHash: hash('foreign'), before: 'unique old', after: 'x' }, true)), /source changed/);
        await assert.rejects(adapter.validateStage(snapshot(root), stage(1, 'docs/rule.md', 0,
            { operation: 'replace', sourceHash: page.sourceHash, before: 'unique old', after: 'x' }, true)),
        /PROPOSAL_DOCUMENT_USE_FULL_HASH/);
        await assert.rejects(adapter.validateStage(snapshot(root, [good]), stage(2, 'docs/rule.md', 1,
            { operation: 'replace', sourceHash: hash(before), before: 'unique old', after: 'again' }, true)), /Overlapping/);
        const ambiguous = before.replace('## Late\nunique old\n', '## Late\nunique old\nunique old\n');
        await writeFile(join(root, 'docs/rule.md'), ambiguous);
        const ambiguousPage = { ...page, fullHash: hash(ambiguous), fileBytes: Buffer.byteLength(ambiguous),
            endOffset: Buffer.byteLength(ambiguous), text: ambiguous.slice(-50) };
        await assert.rejects(new IncrementalDocumentReview(new RoadmapStore(),
            { ...context, pages: [ambiguousPage] }).validateStage(snapshot(root), stage(1, 'docs/rule.md', 0,
            { operation: 'replace', sourceHash: hash(ambiguous), before: 'unique old', after: 'x' }, true)),
        /ambiguous/);
        await writeFile(join(root, 'docs/rule.md'), before.replace('unique old', 'owner changed'));
        await assert.rejects(adapter.validateComplete(snapshot(root, [good])), /source changed/);
        assert.equal(proposal.targets[0].afterHash, hash(proposal.targets[0].after));
    } finally { await rm(root, { recursive: true, force: true }); }
});
