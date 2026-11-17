import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { PiRuntimeHost } from '../../packages/theia-extension/lib/node/pi-runtime-host.js';
import { classifyPiFailure } from '../../packages/theia-extension/lib/node/pi-conversation-runtime.js';
import { resolveOperationContextPolicy } from '../../packages/theia-extension/lib/node/operation-context-policy.js';
import { PromptDraftStore } from '../../packages/theia-extension/lib/node/prompt-draft-store.js';
import { validatePromptStackProposal } from '../../packages/theia-extension/lib/node/prompt-stack-proposal.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';

const run = promisify(execFile);
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const model = { id: 'offline-direct', name: 'Deterministic direct fixture', api: 'openai-completions',
    provider: 'dope-local', reasoning: true, compat: { supportsReasoningEffort: true },
    input: ['text'], contextWindow: 32768, maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
const gateLabels = ['Single responsibility', 'Runtime feasibility', 'Test precision', 'Build precision',
    'Evidence distribution', 'Command deduplication', 'Model economy and deferral',
    'Runnable and traceable contract', 'UI Design Compliance', 'Human Usability'];
const closeout = `MANUAL T3 CLOSEOUT\nIndependently inspect the implemented labels in the real browser.\n\nSCOPE\nInspect exact source and owner decision after every work prompt.\n\nACCEPTANCE\n- Record real behavior, source identity and any evidence gaps.\n\nVALIDATION\n- Check the exact built source manually in the real browser.\n\nPrompt Efficiency Gates\n${gateLabels.map((label, index) => `${index + 1}. ${label}: Check the label behavior, focused tests, build order and source evidence in this fixture.`).join('\n')}`;
function body(index: number, long = false) {
    return `SOURCE BASIS\nSource evidence: src/labels.js\nThe current helper exports toSlug. Proposed test/feature-${index}.test.js is a future output.\n\nSCOPE\nTier: ${index === 2 ? 'T2' : 'T1'}\nEstimated minutes: ${index === 2 ? '12' : '7'}\nDepends on: ${index === 1 ? 'none' : `P${index - 1}`}\nImplement distinct separator behavior ${index} in src/labels.js and focused test/feature-${index}.test.js. Preserve the exported function and non-string rejection.\n\nACCEPTANCE\n- Repeated separators collapse to one for case ${index}; existing word conversion remains.\n\nVALIDATION\n- Run node --test test/feature-${index}.test.js after implementation.\n- Build only the changed package.${index === 2 ? '\n- Run the affected-system integration check for label callers.' : ''}${long ? `\n${Array.from({ length: 150 }, (_, line) => `- Verify separator case ${index}.${line + 1} using the focused test and observed source.`).join('\n')}` : ''}`;
}

test('one trusted direct command reaches the real Pi worker, reviewed files and guarded publication at small and ten-file scale', async t => {
    for (const count of [2, 10]) {
        const temporary = await mkdtemp(join(tmpdir(), `dope-direct-worker-${count}-`));
        const root = join(temporary, 'project'), slug = `direct-worker-${count}`;
        await mkdir(join(root, 'src'), { recursive: true });
        await mkdir(join(root, 'docs', 'tasks'), { recursive: true });
        await writeFile(join(root, 'package.json'), '{"name":"direct-fixture","version":"0.13.11","type":"module"}\n');
        await writeFile(join(root, 'src/labels.js'), 'export function toSlug(value) { return String(value).trim().toLowerCase(); }\n');
        await run('git', ['init', '-q', root]);
        await run('git', ['-C', root, 'add', 'package.json', 'src/labels.js']);
        await run('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'Fixture']);
        const operations: { name: string; args: object }[] = [
            { name: 'proposal_status', args: {} }, { name: 'read_file', args: { path: 'src/labels.js' } }];
        for (let index = 1; index <= count; index++) {
            const text = body(index, count === 10 && index === 1);
            if (count === 10 && index === 1) {
                const middle = Math.floor(text.length / 2);
                operations.push({ name: 'proposal_stage_file', args: { title: `Implement label case ${index}`,
                    body: text.slice(0, middle), kind: 'work', complete: false } });
                operations.push({ name: 'proposal_stage_file', args: { title: `Implement label case ${index}`,
                    body: text.slice(middle), kind: 'work', handle: 'P1', complete: true } });
            } else operations.push({ name: 'proposal_stage_file', args: { title: `Implement label case ${index}`,
                body: text, kind: 'work', complete: true } });
        }
        operations.push({ name: 'proposal_stage_file', args: { title: 'Manual label closeout',
            body: closeout, kind: 'manual-closeout', complete: true } },
        { name: 'proposal_finish', args: { finalMessage: 'Complete prompt files are ready for owner review.' } });
        const calls: { name: string; output: string }[] = [];
        const server = createServer(async (request, response) => {
            let body = '';
            for await (const chunk of request) body += String(chunk);
            const acknowledged = (JSON.parse(body).messages as { role: string }[])
                .filter(message => message.role === 'tool').length;
            const operation = operations[acknowledged];
            response.writeHead(200, { 'content-type': 'text/event-stream' });
            const send = (delta: object, finish_reason: string | null) => response.write(`data: ${JSON.stringify({
                id: 'offline-direct', object: 'chat.completion.chunk', created: 1, model: model.id,
                choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
            if (operation) {
                send({ role: 'assistant', tool_calls: [{ index: 0, id: `direct-${acknowledged}`,
                    type: 'function', function: { name: operation.name,
                        arguments: JSON.stringify(operation.args) } }] }, null);
                send({}, 'tool_calls');
            } else { send({ role: 'assistant', content: 'The staged proposal is ready.' }, null); send({}, 'stop'); }
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
                operationPolicy?: unknown; proposalTools?: boolean; directProposalTools?: boolean; generationId?: string;
                execute(name: string, args: unknown, signal?: AbortSignal, id?: number): Promise<string> } }) {
            const host = new PiRuntimeHost();
            try {
                await host.start();
                await host.openChatToolsSession({ ...model, baseUrl: endpoint }, root, undefined, 'low',
                    false, false, request.projectTools?.proposalTools ?? false, false,
                    request.projectTools?.operationPolicy as never, false,
                    request.projectTools?.directProposalTools ?? false);
                for await (const event of host.streamTurn(request.messages, request.maxOutputTokens ?? 4096,
                    request.signal, async call => {
                        const output = await request.projectTools!.execute(call.name, call.arguments,
                            request.signal, call.id);
                        calls.push({ name: call.name, output });
                        return { status: 'completed' as const, output };
                    }, request.projectTools?.generationId, request.projectTools?.operationPolicy as never)) {
                    if (event.type === 'complete') yield { type: 'complete' as const, text: event.result.text,
                        actualModelId: event.result.modelId, finishReason: event.result.finishReason,
                        usage: event.result.usage };
                    else if (event.type === 'delta' || event.type === 'activity' || event.type === 'reset') yield event;
                }
            } catch (error) { throw classifyPiFailure(error) ?? error; }
            finally { host.dispose(); }
        } };
        const repository = new ChatRepository(), grounder = new ChatProjectGrounder({} as never);
        const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
            { compose: async () => ({ messages: [{ role: 'user', content: 'saved Chat request' }],
                refs: [], diagnostics: [], usedTokens: 10, budgetTokens: 32768 }) } as never,
            undefined, grounder);
        try {
            const { projectHandle } = await backend.attach(pathToFileURL(root).href), chatId = randomUUID();
            await backend.mutate({ projectHandle, expectedRevision: 0,
                operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Direct fixture' } });
            const lease = await backend.claim({ projectHandle, chatId, ownerId: 'fixture-owner' });
            assert.equal(lease.acquired, true);
            const selectedModel = { connectionId: 'local', modelId: model.id };
            await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token, selectedModel,
                content: `/gen-stack ${slug} Correct separator handling, preserve non-string behavior, update focused tests and document exact results` });
            const saved = (await backend.get(projectHandle, chatId))!;
            const owner = saved.messages.find(message => message.role === 'user' && message.promptDraft);
            assert.ok(owner?.role === 'user' && owner.promptDraft);
            const draft = await new PromptDraftStore(repository, grounder).read(root, owner.promptDraft, lease.token);
            assert.equal(draft.assessment, undefined);
            assert.equal(draft.plan, undefined);
            assert.equal(saved.messages.filter(message => message.role === 'user' && message.content.startsWith('/gen-stack')).length, 1);
            const assistant = saved.messages.filter(message => message.role === 'assistant').at(-1);
            const proposal = assistant?.role === 'assistant' ? assistant.planningActivity?.promptStackProposal : undefined;
            assert.ok(proposal);
            validatePromptStackProposal(proposal);
            assert.equal(assistant?.role === 'assistant' && assistant.proposalProgress?.state, 'ready-for-review');
            assert.equal(proposal.files.length, count + 2);
            assert.equal(proposal.files.filter(file => /manual-label-closeout\.txt$/u.test(file.path)).length, 1);
            assert.ok(proposal.files.every(file => !/prompt-assessment|implementation-plan/.test(file.path)));
            assert.deepEqual(calls.map(call => call.name), operations.map(operation => operation.name));
            assert.equal(JSON.parse(calls.at(-1)!.output).state, 'ready-for-review');
            assert.equal(assistant?.role === 'assistant' && assistant.execution.sourceRefs?.some(ref => ref.id === 'src/labels.js'), true);
            assert.equal(proposal.files[1].after.includes('separator case 1.150'), count === 10);
            const prompts = proposal.files.slice(1).map(file => ({ filename: file.path.split('/').at(-1)!, text: file.after }));
            assert.equal((await importPhaseStack(slug, prompts)).entries.length, count + 1);
            await assert.rejects(stat(join(root, 'docs', 'tasks', slug)), /ENOENT/);
            assert.equal((await discoverRoadmapTaskStacks(root)).some(item => item.folderName === slug), false);
            await assert.rejects(backend.publishPromptStack(projectHandle, chatId, lease.token,
                proposal.id, '0'.repeat(64)), /Exact saved prompt proposal unavailable/);
            const published = await backend.publishPromptStack(projectHandle, chatId, lease.token,
                proposal.id, proposal.digest);
            assert.equal(published.status, 'published');
            for (const file of proposal.files) assert.equal(await readFile(join(root, file.path), 'utf8'), file.after);
            const discovered = (await discoverRoadmapTaskStacks(root)).find(item => item.folderName === slug);
            assert.equal(discovered?.prompts.length, count + 1);
            assert.equal(discovered?.executable, false);
            t.diagnostic(JSON.stringify({ count, title: proposal.files.slice(1).map(file => file.path.split('/').at(-1)),
                bytes: proposal.files.map(file => Buffer.byteLength(file.after)), digest: proposal.digest,
                sourceReads: calls.filter(call => call.name === 'read_file').length,
                published: published.status, exactBytes: proposal.files.every(file => file.afterHash === sha(file.after)),
                workDiscovered: !!discovered, workExecutable: discovered?.executable }));
        } finally {
            backend.dispose(); server.close();
            await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
        }
    }
});

test('the real worker rejects a direct policy without the trusted direct tool mode', async () => {
    const host = new PiRuntimeHost();
    const policy = { commandId: randomUUID(), modelId: model.id,
        snapshot: resolveOperationContextPolicy('managed', 'gen-stack',
            { conversationalText: true, streaming: true, contextWindowTokens: 32768,
                maxInputTokens: 32768, maxOutputTokens: 8192 }) };
    try {
        await host.start();
        await assert.rejects(host.openChatToolsSession({ ...model, baseUrl: 'http://127.0.0.1:1/v1' },
            process.cwd(), undefined, 'low', false, false, false, false, policy),
        error => (error as { code?: string }).code === 'policy_invalid');
        await assert.rejects(host.openChatToolsSession({ ...model, baseUrl: 'http://127.0.0.1:1/v1' },
            process.cwd(), undefined, 'low', false, false, false, false,
            { ...policy, snapshot: { ...policy.snapshot, operation: 'chat' as const } }, false, true),
        error => (error as { code?: string }).code === 'policy_invalid');
    } finally { host.dispose(); }
});
