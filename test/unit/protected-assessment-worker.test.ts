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
const model = { id: 'offline-assessment', name: 'Offline Assessment', api: 'openai-completions',
    provider: 'dope-local', reasoning: true, compat: { supportsReasoningEffort: true },
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
    assert.equal(new AssessmentReadReceipts(owner).resolve(required.path, 4096, required, owner, 1000),
        undefined, 'a new execution starts without a receipt');
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

test('real Pi worker and Chat broker seal five-file protected Assessment with late-page citation', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'dope-assessment-worker-'));
    const root = join(temporary, 'project');
    await mkdir(root);
    for (const [path, content] of Object.entries(fixture)) {
        assert.equal(createHash('sha256').update(content).digest('hex'), fixtureHashes[path], path);
        await mkdir(join(root, path.split('/').slice(0, -1).join('/')), { recursive: true });
        await writeFile(join(root, path), content);
    }
    assert.equal(Buffer.byteLength(guide), 6584);
    await run('git', ['init', '-q', root]);
    await run('git', ['-C', root, 'add', ...paths]);
    await run('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
        'commit', '-qm', 'Fixture']);

    const calls: { name: string; args: Record<string, unknown>; output: string }[] = [];
    let next = 0;
    let allowPlanProbe = false;
    let planProbe = false;
    let guideHash = '';
    let extendedRequest: { messages: Record<string, unknown>[]; tools: { function: { name: string } }[];
        reasoning_effort?: string } | undefined;
    const plan: { name: string; args: () => Record<string, unknown> }[] = [
        { name: 'assessment_status', args: () => ({}) },
        { name: 'read_file', args: () => ({ path: 'docs/late-guide.md', offset: 4096 }) },
        ...paths.slice(0, 4).map(path => ({ name: 'read_file', args: () => ({ path, offset: 0, maxBytes: 4096 }) })),
        { name: 'read_file', args: () => ({ path: 'docs/other-guide.md', offset: 4096 }) },
        { name: 'read_file', args: () => ({ path: 'docs/late-guide.md', offset: 4096,
            expectedSourceHash: '0'.repeat(64) }) },
        { name: 'read_file', args: () => ({ path: 'docs/late-guide.md', offset: 5000,
            expectedSourceHash: guideHash }) },
        { name: 'read_file', args: () => ({ path: 'docs/late-guide.md', offset: 4096 }) },
        { name: 'read_file', args: () => ({ path: 'docs/late-guide.md', offset: 4096,
            maxBytes: 2048 }) },
        { name: 'read_file', args: () => ({ path: 'RELEASE_NOTES.md', offset: 0 }) },
        { name: 'assessment_status', args: () => ({}) },
        { name: 'assessment_finish', args: () => ({}) },
        { name: 'assessment_stage', args: () => ({ category: 'observations',
            claim: 'Scalar clamp uses Math.min and Math.max', path: 'src/clamp.js',
            quote: 'return Math.min(Math.max(value, min), max);' }) },
        { name: 'assessment_stage', args: () => ({ category: 'preservation',
            claim: 'Finite scalar behavior remains stable', path: 'RELEASE_NOTES.md',
            quote: 'Invented source quote' }) },
        { name: 'assessment_status', args: () => ({}) },
        { name: 'assessment_stage', args: () => ({ category: 'preservation',
            claim: 'Finite scalar behavior remains stable', path: 'RELEASE_NOTES.md',
            quote: 'Existing finite scalar clamp behavior is stable.' }) },
        { name: 'assessment_stage', args: () => ({ category: 'dependencies',
            claim: 'The fixture test uses node:test', path: 'test/clamp.test.js',
            quote: "import test from 'node:test';" }) },
        { name: 'assessment_stage', args: () => ({ category: 'risks',
            claim: 'Late guide calls for a NaN and Infinity policy', path: 'docs/late-guide.md',
            quote: 'Define a clear policy for reversed bounds and NaN or Infinity.' }) },
        { name: 'assessment_stage', args: () => ({ category: 'scope', text: 'Assess the five-file clamp correction' }) },
        { name: 'assessment_stage', args: () => ({ category: 'tiers',
            T1: 'Focused source and unit tests', T2: 'Cross-boundary integration checks',
            T3: 'Independent manual browser qualification' }) },
        { name: 'assessment_finish', args: () => ({}) }
    ];
    const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        const incoming = JSON.parse(body) as { messages: Record<string, unknown>[];
            tools: { function: { name: string } }[]; reasoning_effort?: string };
        assert.ok(incoming.messages.length);
        if (next === 14) extendedRequest = incoming;
        const operation = plan[next++];
        if (operation?.name === 'read_file' && operation.args().path === 'docs/late-guide.md' &&
            operation.args().offset === 4096 && !guideHash && next > 2) {
            const verified = receipts(incoming.messages).find(receipt =>
                receipt.path === 'docs/late-guide.md' && receipt.nextOffset === 4096 &&
                typeof receipt.sourceHash === 'string');
            assert.ok(verified?.sourceHash, 'provider must receive first-page sourceHash');
            guideHash = verified.sourceHash;
        }
        const base = { id: 'offline-assessment', object: 'chat.completion.chunk',
            created: 1, model: model.id };
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        const send = (delta: object, finish_reason: string | null) => response.write(
            `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
        if (operation) {
            send({ role: 'assistant', reasoning: 'Synthetic source check.' }, null);
            send({ role: 'assistant', tool_calls: [{ index: 0, id: `call-${next}`, type: 'function',
                function: { name: operation.name, arguments: JSON.stringify(operation.args()) } }] }, null);
            send({}, 'tool_calls');
        } else if (allowPlanProbe && !planProbe) {
            planProbe = true;
            send({ role: 'assistant', tool_calls: [{ index: 0, id: 'plan-source', type: 'function',
                function: { name: 'read_file', arguments: JSON.stringify({ path: 'src/clamp.js', offset: 0 }) } }] }, null);
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
        maxOutputTokens?: number; signal?: AbortSignal; projectTools?: { root: string; operationPolicy?: unknown;
            assessmentTools?: boolean;
            generationId?: string; execute(name: string, args: unknown, signal?: AbortSignal, id?: number): Promise<string> } }) {
        const host = new PiRuntimeHost();
        try {
            await host.start();
            await host.openChatToolsSession({ ...model, baseUrl: endpoint }, root, undefined,
                'low', false, false, false, request.projectTools?.assessmentTools ?? false,
                request.projectTools?.operationPolicy as never);
            for await (const event of host.streamTurn(request.messages, request.maxOutputTokens ?? 4096,
                request.signal, async call => {
                    const output = await request.projectTools!.execute(call.name, call.arguments, request.signal, call.id);
                    calls.push({ name: call.name, args: call.arguments as Record<string, unknown>, output });
                    return { status: 'completed' as const, output };
                }, request.projectTools?.generationId, request.projectTools?.operationPolicy as never)) {
                if (event.type === 'complete') yield { type: 'complete' as const,
                    text: event.result.text, actualModelId: event.result.modelId,
                    finishReason: event.result.finishReason, usage: event.result.usage };
                else if (event.type === 'delta' || event.type === 'activity' || event.type === 'reset') yield event;
                else throw new Error('Unexpected mock Assessment pause');
            }
        } finally { host.dispose(); }
    } };
    const composer = { compose: async () => ({ messages: [{ role: 'user', content: 'saved' }],
        refs: [], diagnostics: [], usedTokens: 10, budgetTokens: 32768 }) };
    const repository = new ChatRepository();
    const grounder = new ChatProjectGrounder({} as never);
    const backend = new ChatBackend(repository, { notifyChatEvent() {} },
        models as never, composer as never, undefined, grounder);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Five-file Assessment' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'fixture-owner' });
        assert.equal(lease.acquired, true);
        await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: model.id },
            content: `/prompt-ass clamp-api-correction Inspect ${paths.join(' ')}` });
        const saved = (await backend.get(projectHandle, chatId))!;
        const assistant = saved.messages.find(message => message.role === 'assistant');
        assert.equal(assistant?.execution.status, 'complete');
        assert.equal(assistant.execution.sourceRefs?.filter(ref => ref.kind === 'file').length, 5);
        const draft = currentPromptDraft(saved);
        assert.equal(draft?.state, 'plan');
        assert.ok(draft?.identity);
        const checked = await new PromptDraftStore(repository, grounder).read(root, draft.identity,
            lease.token);
        assert.equal(checked.assessment?.revision, 1);
        assert.equal(checked.plan, undefined);
        const record = checked.assessment!.record as { omittedRequestedFiles: string[];
            sourceRefs: unknown[]; observations: unknown[]; preservation: unknown[];
            dependencies: unknown[]; risks: { path: string; start: number }[];
            tiers: { T1: string; T2: string; T3: string } };
        assert.deepEqual(record.omittedRequestedFiles, []);
        assert.equal(new Set(checked.assessment!.sourceRefs.map(ref => ref.id)).size, 5);
        assert.deepEqual([record.observations.length, record.preservation.length,
            record.dependencies.length, record.risks.length], [1, 1, 1, 1]);
        assert.equal(record.risks[0].path, 'docs/late-guide.md');
        assert.ok(record.risks[0].start >= 4096);
        assert.deepEqual(Object.keys(record.tiers).sort(), ['T1', 'T2', 'T3']);
        await assert.rejects(new PromptDraftStore(repository, grounder).read(root,
            { ...draft.identity, id: randomUUID() }, lease.token));
        assert.deepEqual(calls.map(call => call.name), plan.map(call => call.name));
        assert.equal(extendedRequest?.reasoning_effort, 'low');
        assert.equal(extendedRequest?.messages.length, 30);
        assert.equal(extendedRequest?.tools.length, 7);
        assert.ok(Buffer.byteLength(JSON.stringify(extendedRequest)) > 12_000,
            'the long-history request includes source-like page content');
        const history = extendedRequest!.messages;
        for (let index = 2; index < history.length; index += 2) {
            const assistantCall = history[index];
            const toolReply = history[index + 1];
            assert.equal(assistantCall.role, 'assistant');
            assert.equal(toolReply.role, 'tool');
            assert.equal((assistantCall.tool_calls as { id: string }[])[0].id, toolReply.tool_call_id);
            assert.equal(typeof (assistantCall.reasoning ?? assistantCall.reasoning_content), 'string');
        }
        assert.equal(calls.filter(call => call.name === 'read_file').length, 11);
        const guideCalls = calls.filter(call => call.name === 'read_file' &&
            call.args.path === 'docs/late-guide.md' && call.args.offset === 4096 &&
            call.args.expectedSourceHash === undefined);
        assert.match(guideCalls[0].output, /^SOURCE_IDENTITY_REQUIRED:/u);
        assert.match(calls.find(call => call.args.path === 'docs/other-guide.md')!.output,
            /^SOURCE_IDENTITY_REQUIRED:/u);
        assert.match(guideCalls[2].output, /^SOURCE_IDENTITY_REQUIRED:/u);
        assert.match(calls.find(call => call.args.expectedSourceHash === '0'.repeat(64))!.output,
            /^STALE_SOURCE:/u);
        assert.match(calls.find(call => call.args.offset === 5000)!.output,
            /^INVALID_OFFSET: Use the verified nextOffset 4096/u);
        assert.match(calls.find(call => call.name === 'assessment_finish')!.output,
            /ASSESSMENT_CATEGORY_INCOMPLETE/u);
        assert.equal(JSON.parse(calls.filter(call => call.name === 'assessment_status')[1].output).sources,
            '5/5 inspected');
        assert.equal(JSON.parse(calls.filter(call => call.name === 'assessment_status')[2].output).findings, 1);
        assert.equal(JSON.parse(calls.filter(call => call.name === 'assessment_stage')[1].output).code,
            'ASSESSMENT_UNSUPPORTED_SOURCE');
        const firstGuide = JSON.parse(calls.find(call => call.name === 'read_file' &&
            call.args.path === 'docs/late-guide.md' && call.args.offset === 0)!.output);
        const lateGuide = JSON.parse(calls.find(call => call.name === 'read_file' &&
            call.args.path === 'docs/late-guide.md' && call.args.offset === 4096 &&
            call.args.expectedSourceHash === undefined && call.output.startsWith('{'))!.output);
        assert.equal(firstGuide.nextOffset, 4096);
        assert.equal(lateGuide.offset, 4096);
        assert.equal(lateGuide.nextOffset, null);
        assert.equal(firstGuide.text + lateGuide.text, guide);
        assert.equal(guideCalls[1].args.expectedSourceHash, undefined);
        const finished = JSON.parse(calls.at(-1)!.output);
        assert.equal(finished.complete, true);
        assert.equal(assistant?.execution.toolEvents?.filter(event => event.name === 'assessment_stage' &&
            event.status === 'completed').length, 6);
        assert.equal(assistant?.execution.toolEvents?.findLast(event => event.name === 'assessment_finish')?.status,
            'completed');
        assert.ok(saved.messages.every(message => message.role !== 'assistant' ||
            message.execution.status !== 'failed'));
        await assert.rejects(readFile(join(root, 'docs/tasks/clamp-api-correction/prompt-assessment.md')),
            /ENOENT/);
        const owner = saved.messages.find(message => message.role === 'user' && message.promptDraft);
        assert.ok(owner?.role === 'user');
        allowPlanProbe = true;
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: model.id },
            content: '/prompt-plan clamp-api-correction Outline checked implementation work',
            promptDraftTarget: { draftId: draft.identity.id, ownerUserMessageId: owner.id,
                stageMessageId: assistant!.id, stage: 'assessment', stageRevision: 1,
                projectId: draft.identity.projectId, sourceFingerprint: draft.identity.sourceFingerprint,
                leaseDigest: draft.identity.leaseDigest } }),
        error => { assert.match(String(error), /PLAN_/u,
            JSON.stringify({ error: String(error), detail: (error as { toolFailure?: unknown }).toolFailure }));
            return true; }, 'bound Plan entry must reach Plan validation, not fail Assessment authority');
        assert.equal((await new PromptDraftStore(repository, grounder).read(root, draft.identity,
            lease.token)).plan, undefined);
        await assert.rejects(readFile(join(root, 'docs/tasks/clamp-api-correction/implementation-plan.md')),
            /ENOENT/);
    } finally {
        backend.dispose(); server.close();
        await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
    }
});
