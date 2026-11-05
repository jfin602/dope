import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkDocumentRouting, selectDocumentPointers } from '../../packages/theia-extension/lib/node/work-document-routing.js';

const hash = 'a'.repeat(64);
const page = (path: string, offset = 0, endOffset = 128, sourceHash = hash) => ({
    call: { id: 'read-1', name: 'read' as const, arguments: { path, offset, maxBytes: 128,
        ...(offset ? { expectedSourceHash: sourceHash } : {}) } },
    output: JSON.stringify({ path, offset, endOffset, fileBytes: 9000, sourceHash, nextOffset: endOffset,
        truncated: true, text: 'bounded section' }) });

test('optional pointers are task relevant, path only, and absent for no-reference work', () => {
    assert.equal(new WorkDocumentRouting('Fix the parser', '').notice(), '');
    const task = 'Fix parser validation using [parser contract](docs/parser.md#validation).';
    const instructions = 'For parser validation see [the parser design](docs/design.md#parser) and `docs/limits.txt#parser`.\n' +
        'For billing migration see [billing history](docs/billing.md).\n' +
        'See [protected](.dope/private.md), [secret](secrets/entry.md) and [escape](../outside.md).';
    const pointers = selectDocumentPointers(task, instructions, ['src/parser.ts']);
    assert.deepEqual(pointers.map(item => item.path), ['docs/parser.md', 'docs/design.md', 'docs/limits.txt']);
    const notice = new WorkDocumentRouting(task, instructions).notice();
    assert.match(notice, /offered, not read or adopted/);
    assert.match(notice, /source unknown until read/);
    assert.doesNotMatch(notice, /billing|private|secrets|outside/);
});

test('late pages, repeated ranges, cycles, changed source and new ranges remain readable', () => {
    const routing = new WorkDocumentRouting('Implement [spec](docs/a.md#late)', '');
    const first = page('docs/a.md', 0, 128);
    assert.equal(routing.observe(first.call, first.output).record?.section, 'late');
    const late = page('docs/a.md', 4096, 4224);
    assert.equal(routing.observe(late.call, late.output).record?.offset, 4096);
    assert.match(routing.observe(late.call, late.output).signal ?? '', /Unchanged document range/);
    assert.equal(routing.observe(late.call, page('docs/a.md', 4096, 4224, 'b'.repeat(64)).output).record?.repeated, false);
    const cycle = new WorkDocumentRouting('Implement [spec](docs/a.md)', '');
    const a = page('docs/a.md');
    cycle.observe(a.call, a.output);
    const b = page('docs/b.md');
    cycle.observe(b.call, b.output);
    assert.match(cycle.observe(a.call, a.output).signal ?? '', /Circular document reference/);
});

test('failed and protected reads produce no finding; clipped legacy reads have unknown identity', () => {
    const routing = new WorkDocumentRouting('Fix parser', '');
    const read = page('docs/parser.md');
    assert.deepEqual(routing.observe(read.call, 'FAILED'), {});
    const legacy = routing.observe({ ...read.call, arguments: { path: 'docs/parser.md', maxBytes: 128 } }, 'clipped prefix');
    assert.equal(legacy.record?.clipped, true);
    assert.equal(legacy.record?.sourceHash, null);
    assert.equal(legacy.record?.fileBytes, null);
    assert.deepEqual(routing.observe(page('AGENTS.md').call, page('AGENTS.md').output), {});
});

test('sequential late pages and distinct open questions do not raise documentation-only signals', () => {
    const routing = new WorkDocumentRouting('Implement [spec](docs/a.md#late)',
        'For implementation use [another spec](docs/b.md).');
    for (let offset = 0; offset < 4096 * 6; offset += 4096)
        assert.equal(routing.observe(page('docs/a.md', offset, offset + 128).call,
            page('docs/a.md', offset, offset + 128).output).signal, undefined);
    assert.equal(routing.observe(page('docs/b.md').call, page('docs/b.md').output).signal, undefined);
});

test('documentation-only activity is advisory and an active-step effect resets the signal', () => {
    const routing = new WorkDocumentRouting('Implement [spec](docs/a.md)', '');
    for (let index = 0; index < 3; index++) {
        const item = page(`docs/section-${index}.md`);
        assert.equal(routing.observe(item.call, item.output).signal, undefined);
    }
    const fourth = page('docs/section-3.md');
    assert.match(routing.observe(fourth.call, fourth.output).signal ?? '', /Documentation-only activity/);
    routing.activeStepActivity();
    const newQuestion = page('docs/new-question.md', 4096, 4224);
    assert.equal(routing.observe(newQuestion.call, newQuestion.output).signal, undefined);
});

test('newly applicable nested instructions offer only new relevant pointers', () => {
    const routing = new WorkDocumentRouting('Implement parser validation using [base](docs/base.md)', '');
    const added = routing.additionalInstructions('For parser validation use [nested rule](docs/nested.md#rule).', 'src/parser.ts');
    assert.match(added, /docs\/nested.md#rule/);
    assert.doesNotMatch(added, /docs\/base.md/);
    assert.equal(routing.additionalInstructions('For parser validation use [nested rule](docs/nested.md#rule).', 'src/parser.ts'), '');
});

test('a verified prior range does not repeat its optional pointer on continuation', () => {
    const task = 'Implement [parser contract](docs/parser.md#validation).';
    const prior = [{ path: 'docs/parser.md', section: 'validation', question: 'parser contract',
        sourceHash: hash, contentHash: 'b'.repeat(64), offset: 0, endOffset: 128, fileBytes: 9000 }];
    const recovered = new WorkDocumentRouting(task, '', [], () => true, prior);
    assert.equal(recovered.notice(), '');
    const changedQuestion = new WorkDocumentRouting('Check [new rule](docs/parser.md#validation).',
        '', [], () => true, prior);
    assert.match(changedQuestion.notice(), /docs\/parser.md#validation/);
});
