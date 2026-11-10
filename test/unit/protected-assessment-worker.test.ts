import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { AssessmentReadReceipts } from '../../packages/theia-extension/lib/node/assessment-read-receipts.js';
import { PiRuntimeHost } from '../../packages/theia-extension/lib/node/pi-runtime-host.js';
import { PromptDraftStore } from '../../packages/theia-extension/lib/node/prompt-draft-store.js';
import { currentPromptDraft } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';

const run = promisify(execFile);
const guide = '# Clamp guide\n\nCurrent API clamps scalar numbers with Math.min/Math.max.\n\n' +
    'Compatibility note: retain the scalar clamp(value, min, max) export.\n'.repeat(90) +
    '\n## Late acceptance and migration\n\nReject nonnumeric inputs with typed errors. Define a clear policy for reversed bounds and NaN or Infinity. Preserve finite scalar behavior. A batch API should return one output per input and identify invalid entries. Update the ESM documentation and release notes.\n';
const fixture = {
    'src/clamp.js': 'export function clamp(value, min, max) {\n  return Math.min(Math.max(value, min), max);\n}\n',
    'test/clamp.test.js': "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { clamp } from '../src/clamp.js';\ntest('clamps finite values', () => {\n  assert.equal(clamp(12, 0, 10), 10);\n  assert.equal(clamp(-2, 0, 10), 0);\n  assert.equal(clamp(4, 0, 10), 4);\n});\n",
    'package.json': '{\n  "name": "clamp-fixture",\n  "version": "1.4.2",\n  "type": "module",\n  "scripts": {\n    "test": "node --test"\n  }\n}\n',
    'docs/late-guide.md': guide,
    'RELEASE_NOTES.md': '# Release notes\n\n## 1.4.2\n\nExisting finite scalar clamp behavior is stable. Future validation and batch changes need explicit compatibility notes.\n'
};
const paths = Object.keys(fixture);
const fixtureHashes: Record<string, string> = {
    'src/clamp.js': '2866677a4450ab1204005da2ab0cf28e203a590b16a8755ec0f867c295ca0827',
    'test/clamp.test.js': 'c5faeb988f856efacf18a711239ef9d29ba3b9382f032980b3090351dd7ea696',
    'package.json': '2a7e453fb2d7914158c7e72a2b66b27e162694200ed8caafa656c53ba6051c8a',
    'docs/late-guide.md': 'fd4d4c8f3d132b2875ee9fff6fdc6aa0b08d65ff61d4cb4f422857e442763767',
    'RELEASE_NOTES.md': 'a5b8f34b1383ec2bf8065b70e34f31a0bb6e8b373d6e2de00791a2e0dbf9d55d'
};
const receipts = (value: unknown): { path?: string; sourceHash?: string; nextOffset?: number | null }[] => {
    if (typeof value === 'string') {
        try { return receipts(JSON.parse(value)); } catch { return []; }
    }
    if (Array.isArray(value)) return value.flatMap(receipts);
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    return [item as { path?: string; sourceHash?: string; nextOffset?: number | null },
        ...Object.values(item).flatMap(receipts)];
};
const model = { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', api: 'openai-completions',
    provider: 'dope-local', reasoning: true, compat: { supportsReasoningEffort: true },
    samplingParams: { temperature: 1, top_p: 1 },
    input: ['text'], contextWindow: 32768,
    maxTokens: 8192, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };

test('Assessment read receipts bind source, sequence, execution, owner and expiry', () => {
    const owner = { root: '/fixture/a', projectHandle: 'project-a', chatId: 'chat-a',
        turnId: 'turn-a', leaseToken: 'lease-a', ownerId: 'owner-a' };
    const hash = 'a'.repeat(64);
    const required = { path: 'docs/late-guide.md', coveredBytes: 4096,
        nextOffset: 4096, expectedSourceHash: hash };
    const ledger = new AssessmentReadReceipts(owner);
    const resolve = (path = required.path, offset = 4096,
        status: typeof required | undefined = required, current = owner, now = 1000) =>
        ledger.resolve(path, offset, status, current, now);
    assert.equal(resolve(), undefined, 'no initial verified read');
    ledger.record({ path: required.path, sourceHash: hash, nextOffset: 4096 }, 1000);
    assert.equal(resolve(), hash);
    assert.deepEqual(ledger.next(required.path, required, owner, 1000),
        { offset: 4096, sourceHash: hash });
    assert.equal(resolve(required.path, 5000), undefined);
    assert.equal(resolve('docs/other.md'), undefined);
    assert.equal(ledger.resolve(required.path, 4096, undefined, owner, 1000), undefined);
    assert.equal(resolve(required.path, 4096, { ...required, expectedSourceHash: 'b'.repeat(64) }), undefined);
    assert.equal(resolve(required.path, 4096, { ...required, nextOffset: 5000 }), undefined);
    for (const field of Object.keys(owner) as (keyof typeof owner)[])
        assert.equal(resolve(required.path, 4096, required,
            { ...owner, [field]: `${owner[field]}-foreign` }), undefined, field);
    assert.equal(resolve(required.path, 4096, required, owner, 1000 + 30 * 60_000), undefined);
    assert.equal(ledger.resolve(required.path, 4096, required, owner, 1000, false), undefined,
        'cancelled or switched executions cannot use a receipt');
    ledger.record({ path: required.path, sourceHash: hash, nextOffset: null }, 1000);
    assert.equal(resolve(), undefined, 'a completed page cannot be replayed');
    assert.equal(ledger.next(required.path, required, owner, 1000), undefined);
    assert.equal(new AssessmentReadReceipts(owner).resolve(required.path, 4096, required, owner, 1000),
        undefined, 'a new execution starts without a receipt');
});

test('real worker seals one bounded Assessment wireframe without exhaustive reads', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'dope-assessment-r8-replay-'));
    const root = join(temporary, 'project');
    await mkdir(root);
    for (const [path, content] of Object.entries(fixture)) {
        await mkdir(join(root, path.split('/').slice(0, -1).join('/')), { recursive: true });
        await writeFile(join(root, path), content);
    }
    await run('git', ['init', '-q', root]);
    await run('git', ['-C', root, 'add', ...paths]);
    await run('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
        'commit', '-qm', 'Fixture']);
    const calls: { name: string; output: string }[] = [];
    const wireframe = { kind: 'wireframe', objective: 'Improve clamp behavior', count: 1,
        rationale: 'One bounded implementation step covers the requested change',
        work: [{ id: 'step-1', title: 'Improve clamp', objective: 'Change clamp behavior',
            boundary: 'Clamp implementation', dependsOn: [] }],
        constraints: ['Keep scalar behavior'], deferrals: ['Detailed validation belongs in Plan'],
        closeout: { title: 'Manual closeout', objective: 'Observe clamp behavior',
            manualReason: 'Human check is distinct' },
        sourceClaims: [{ claim: 'Clamp uses Math.min', path: 'src/clamp.js',
            quote: 'return Math.min(Math.max(value, min), max);' }] };
    const operations = [
        { name: 'assessment_status', args: {} },
        { name: 'read_file', args: { path: 'src/clamp.js' } },
        { name: 'assessment_stage', args: { ...wireframe, count: 2 } },
        { name: 'assessment_stage', args: { ...wireframe,
            sourceClaims: [{ ...wireframe.sourceClaims[0], quote: 'invented source' }] } },
        { name: 'assessment_stage', args: wireframe },
        { name: 'assessment_finish', args: {} }
    ];
    let next = 0, allowPlanProbe = false, planProbe = false;
    const server = createServer(async (request, response) => {
        for await (const _chunk of request) { /* Drain the deterministic provider request. */ }
        const operation = operations[next++];
        const base = { id: 'offline-r8', object: 'chat.completion.chunk',
            created: 1, model: model.id };
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        const send = (delta: object, finish_reason: string | null) => response.write(
            `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
        if (operation) {
            send({ role: 'assistant', tool_calls: [{ index: 0, id: `r8-${next}`, type: 'function',
                function: { name: operation.name, arguments: JSON.stringify(operation.args) } }] }, null);
            send({}, 'tool_calls');
        } else if (allowPlanProbe && !planProbe) {
            planProbe = true;
            send({ role: 'assistant', tool_calls: [{ index: 0, id: 'r8-plan-probe', type: 'function',
                function: { name: 'read_file', arguments: JSON.stringify({ path: 'src/clamp.js' }) } }] }, null);
            send({}, 'tool_calls');
        } else {
            send({ role: 'assistant', content: 'Assessment sealed.' }, null);
            send({}, 'stop');
        }
        response.end('data: [DONE]\n\n');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
    const models = { list: async () => ({ connections: [{ id: 'local', label: 'Local', ready: true,
        providerId: 'local', models: [{ id: model.id, label: model.name, usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 32768,
                maxInputTokens: 32768 } }] }] }),
    async *generate(_selection: unknown, request: { messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
        maxOutputTokens?: number; signal?: AbortSignal; projectTools?: { root: string;
            operationPolicy?: unknown; assessmentTools?: boolean; generationId?: string;
            execute(name: string, args: unknown, signal?: AbortSignal, id?: number): Promise<string> } }) {
        const host = new PiRuntimeHost();
        try {
            await host.start();
            await host.openChatToolsSession({ ...model, baseUrl: endpoint }, root, undefined,
                'low', false, false, false, request.projectTools?.assessmentTools ?? false,
                request.projectTools?.operationPolicy as never);
            for await (const event of host.streamTurn(request.messages, request.maxOutputTokens ?? 4096,
                request.signal, async call => {
                    const output = await request.projectTools!.execute(call.name, call.arguments,
                        request.signal, call.id);
                    calls.push({ name: call.name, output });
                    return { status: 'completed' as const, output };
                }, request.projectTools?.generationId, request.projectTools?.operationPolicy as never)) {
                if (event.type === 'complete') yield { type: 'complete' as const,
                    text: event.result.text, actualModelId: event.result.modelId,
                    finishReason: event.result.finishReason, usage: event.result.usage };
                else if (event.type === 'delta' || event.type === 'activity' || event.type === 'reset') yield event;
            }
        } finally { host.dispose(); }
    } };
    const repository = new ChatRepository(), grounder = new ChatProjectGrounder({} as never);
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
        { compose: async () => ({ messages: [{ role: 'user', content: 'saved' }], refs: [],
            diagnostics: [], usedTokens: 10, budgetTokens: 32768 }) } as never,
        undefined, grounder);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'R8 replay' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'fixture-owner' });
        assert.equal(lease.acquired, true);
        await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: model.id },
            content: `/prompt-ass clamp-api-correction Inspect ${paths.join(' ')}` });
        const saved = (await backend.get(projectHandle, chatId))!;
        const assistant = saved.messages.find(message => message.role === 'assistant');
        assert.equal(assistant?.execution.status, 'complete');
        const draft = currentPromptDraft(saved)!;
        assert.equal(draft.state, 'plan');
        const checked = await new PromptDraftStore(repository, grounder).read(root, draft.identity!, lease.token);
        assert.equal(checked.assessment?.revision, 1);
        assert.equal(checked.history.length, 0);
        const sealed = checked.assessment!.record as { kind: string; count: number;
            work: { id: string }[]; sourceClaims: unknown[] };
        assert.equal(sealed.kind, 'wireframe');
        assert.equal(sealed.count, 1);
        assert.deepEqual(sealed.work.map(item => item.id), ['step-1']);
        assert.equal(sealed.sourceClaims.length, 1);
        assert.equal(checked.assessment!.sourceRefs.length, 1);
        assert.equal(JSON.parse(calls[2].output).code, 'ASSESSMENT_WIREFRAME_COUNT');
        assert.equal(JSON.parse(calls[3].output).code, 'ASSESSMENT_UNSUPPORTED_SOURCE');
        assert.equal(JSON.parse(calls[4].output).accepted, true);
        assert.equal(JSON.parse(calls[5].output).complete, true);
        assert.ok(assistant?.execution.toolEvents?.some(event => event.assessmentOutcome === 'advanced'));
    } finally {
        backend.dispose(); server.close();
        await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
    }
});

test('broker-resolved Assessment identity is rechecked against changed file bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-assessment-source-drift-'));
    try {
        const path = 'late-guide.md';
        await writeFile(join(root, path), 'a'.repeat(5000));
        const grounder = new ChatProjectGrounder({} as never);
        const first = await grounder.readFileRange(root, path, 0, 4096);
        const owner = { root, projectHandle: 'project', chatId: 'chat', turnId: 'turn',
            leaseToken: 'lease', ownerId: 'owner' };
        const ledger = new AssessmentReadReceipts(owner);
        ledger.record(first);
        const sourceHash = ledger.resolve(path, first.nextOffset!, {
            path, coveredBytes: first.endOffset, nextOffset: first.nextOffset,
            expectedSourceHash: first.sourceHash }, owner);
        assert.equal(sourceHash, first.sourceHash);
        await writeFile(join(root, path), `${'a'.repeat(4999)}b`);
        await assert.rejects(grounder.readFileRange(root, path, first.nextOffset!, 4096,
            sourceHash), /Stale file continuation/u);
    } finally { await rm(root, { recursive: true, force: true }); }
});
