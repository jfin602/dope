import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { discoverDocumentation } from '../../packages/theia-extension/lib/node/documentation-discovery.js';
import { documentationCoverage, parseDocumentationSkillReview } from
    '../../packages/theia-extension/lib/node/documentation-skill-review.js';

test('explicit Docs discovery ranks current relevant and late headings without body prefill', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-doc-skill-'));
    try {
        await mkdir(join(root, 'docs', 'tasks'), { recursive: true });
        await writeFile(join(root, 'docs', 'current.md'), '# Current\n' + 'filler\n'.repeat(300) +
            '## Casting approval rules\nowner approval is required\n');
        await writeFile(join(root, 'docs', 'unrelated.md'), '# Other\nunrelated content\n');
        await writeFile(join(root, 'docs', 'tasks', 'old.md'), '# Historical casting approval\n');
        const result = await discoverDocumentation(root, 'casting approval');
        assert.equal(result.enumerated, 3);
        assert.equal(result.searched, 3);
        assert.equal(result.candidates[0].path, 'docs/current.md');
        assert.equal(result.candidates[0].line, 302);
        assert.equal(result.candidates.some(item => item.path === 'docs/unrelated.md'), false);
        assert.equal(result.candidates.find(item => item.path === 'docs/tasks/old.md')?.historical, true);
        assert.match(documentationCoverage(result, ['docs/current.md']), /3 searched; 1 actually read/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('review output is bounded proposal data and requires actual brokered reads for changes', () => {
    const output = JSON.stringify({ final_response: 'I prepared the requested review.', report: 'Current requirement needs a clarification.',
        changes: [{ path: 'docs/current.md', after: '# Current\nclarified\n' }] });
    assert.equal(parseDocumentationSkillReview(output, ['docs/current.md']).changes.length, 1);
    assert.throws(() => parseDocumentationSkillReview(output, []), /brokered document read/);
    assert.throws(() => parseDocumentationSkillReview('Here is a patch', ['docs/current.md']), /JSON/);
    assert.throws(() => parseDocumentationSkillReview(JSON.stringify({ final_response: 'I prepared the requested review.', report: 'x', changes: [], apply: true }), []),
        /structure/);
});
