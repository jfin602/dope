import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkAgentsRouting } from '../../packages/theia-extension/lib/node/work-agents-routing.js';

test('AGENTS routing reads root and applicable nested files once, ahead of other Work tools', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-agents-'));
    const events: any[] = [];
    const reads: string[] = [];
    try {
        await mkdir(join(root, 'src', 'feature'), { recursive: true });
        await mkdir(join(root, 'docs'));
        await writeFile(join(root, 'AGENTS.md'), 'Root practice.\n');
        await writeFile(join(root, 'src', 'AGENTS.md'), 'Only src practice.\n');
        await writeFile(join(root, 'docs', 'AGENTS.md'), 'Only docs practice.\n');
        const request: any = { executionRoot: root, prompt: 'Implement the accepted task.',
            onEvent(event: unknown) { events.push(event); } };
        const broker: any = { async assertActive() {}, async execute(call: any) {
            reads.push(call.arguments.path);
            const body = await readFile(join(root, call.arguments.path));
            const hash = createHash('sha256').update(body).digest('hex');
            if (call.arguments.expectedSourceHash && call.arguments.expectedSourceHash !== hash)
                return { status: 'denied' };
            const start = call.arguments.offset;
            const end = Math.min(start + call.arguments.maxBytes, body.length);
            return { status: 'completed', output: JSON.stringify({ text: body.subarray(start, end).toString(),
                sourceHash: hash, nextOffset: end < body.length ? end : null, fileBytes: body.length }) };
        } };
        const routing = new WorkAgentsRouting(request, broker);
        const first = await routing.route('src/feature/code.ts', request.prompt, new AbortController().signal);
        assert.match(first, /Root practice/);
        assert.match(first, /Only src practice/);
        assert.doesNotMatch(first, /Only docs practice/);
        assert.deepEqual(reads, ['AGENTS.md', 'src/AGENTS.md']);
        assert.equal(await routing.route('src/other.ts', request.prompt + first,
            new AbortController().signal), '');
        assert.deepEqual(reads, ['AGENTS.md', 'src/AGENTS.md']);
        const next = await routing.route('docs/spec.md', request.prompt + first,
            new AbortController().signal);
        assert.match(next, /Only docs practice/);
        assert.equal(reads.at(-1), 'docs/AGENTS.md');
        assert.ok(events.some(event => /AGENTS src\/AGENTS.md: Dope brokered read; source [a-f0-9]{64}/.test(event.summary)));
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('AGENTS routing stops on stale pages, symlinks and oversized instructions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-agents-negative-'));
    const request: any = { executionRoot: root, onEvent() {} };
    try {
        await writeFile(join(root, 'AGENTS.md'), 'a'.repeat(5000));
        let page = 0;
        const stale: any = { async assertActive() {}, async execute() {
            page++;
            return { status: 'completed', output: JSON.stringify({ text: 'a'.repeat(page === 1 ? 4096 : 904),
                sourceHash: page === 1 ? 'a'.repeat(64) : 'b'.repeat(64),
                nextOffset: page === 1 ? 4096 : null, fileBytes: 5000 }) };
        } };
        await assert.rejects(new WorkAgentsRouting(request, stale).route('.', 'task',
            new AbortController().signal), /changed/);
        await rm(join(root, 'AGENTS.md'));
        await symlink('/etc/passwd', join(root, 'AGENTS.md'));
        await assert.rejects(new WorkAgentsRouting(request, stale).route('.', 'task',
            new AbortController().signal), /not a regular file/);
        await rm(join(root, 'AGENTS.md'));
        await writeFile(join(root, 'AGENTS.md'), 'a'.repeat(24_001));
        await assert.rejects(new WorkAgentsRouting(request, stale).route('.', 'task',
            new AbortController().signal), /budget/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('AGENTS routing accepts absent files, suppresses exact duplicate and reports unreadable instructions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-agents-'));
    try {
        await mkdir(join(root, 'src'));
        const broker: any = { async assertActive() {}, async execute(call: any) {
            const body = await readFile(join(root, call.arguments.path));
            return { status: 'completed', output: JSON.stringify({ text: body.toString(),
                sourceHash: createHash('sha256').update(body).digest('hex'), nextOffset: null,
                fileBytes: body.length }) };
        } };
        const request: any = { executionRoot: root, onEvent() {} };
        assert.equal(await new WorkAgentsRouting(request, broker).route('src/code.ts', 'task',
            new AbortController().signal), '');
        await writeFile(join(root, 'src', 'AGENTS.md'), 'Nested only.\n');
        const nested = await new WorkAgentsRouting(request, broker).route('src/code.ts', 'task',
            new AbortController().signal);
        assert.match(nested, /Nested only/);
        assert.equal(await new WorkAgentsRouting(request, broker).route('src/code.ts', 'Nested only.\n',
            new AbortController().signal), '');
        const denied: any = { async assertActive() {}, async execute() { return { status: 'denied' }; } };
        await assert.rejects(new WorkAgentsRouting(request, denied).route('src/code.ts', 'task',
            new AbortController().signal), /could not be read.*denied/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
