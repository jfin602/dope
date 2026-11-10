import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
import { PromptDraftStore } from '../../packages/theia-extension/lib/node/prompt-draft-store.js';
import { currentPromptDraft } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import { validatePromptStackProposal } from '../../packages/theia-extension/lib/node/prompt-stack-proposal.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';

const run = promisify(execFile);
const model = { id: 'openai/gpt-oss-20b', name: 'Deterministic GPT-OSS fixture',
    api: 'openai-completions', provider: 'dope-local', reasoning: true,
    compat: { supportsReasoningEffort: true }, samplingParams: { temperature: 1, top_p: 1 },
    input: ['text'], contextWindow: 32768, maxTokens: 8192,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
const wireframe = { kind: 'wireframe', objective: 'Implement finite scalar clamp validation', count: 1,
    rationale: 'One bounded clamp implementation step covers the requested behavior',
    work: [{ id: 'step-1', title: 'Validate scalar clamp', objective: 'Implement scalar validation',
        boundary: 'Scalar clamp implementation', dependsOn: [] }],
    constraints: ['Preserve finite scalar results'], deferrals: ['Defer unrelated batch API'],
    closeout: { title: 'Manual clamp closeout', objective: 'Observe scalar clamp in browser',
        manualReason: 'Human interaction requires an independent check' }, sourceClaims: [] };
const audit = ['Single responsibility stays within scalar clamp validation',
    'Runtime target 8 minutes, soft 10 and hard 15',
    'Test precision uses the focused clamp test',
    'Build precision requires no compiled output for ESM source tests',
    'Evidence distribution keeps browser observation in T3',
    'Command deduplication avoids repeated aggregate tests',
    'Model economy uses Medium and defers unrelated batch work',
    'Runnable traceable grammar preserves one terminal closeout',
    'UI design is not applicable to non-UI clamp work',
    'Human usability is not applicable to non-UI clamp work'];
const plan = { work: [{ id: 'step-1', title: 'Validate scalar clamp',
    assessmentObjective: 'Implement scalar validation', boundary: 'Scalar clamp implementation',
    objective: 'Implement finite scalar clamp input validation', tier: 'T1', dependsOn: [],
    workingSet: ['src/clamp.js'], requirements: ['Reject nonnumeric scalar input'],
    preservedBehavior: ['Keep finite scalar clamp results'], risks: ['Check current finite bounds'],
    deferrals: ['Defer unrelated batch API'], validationTargets: ['Run test/clamp.test.js'],
    buildNeeds: 'none', acceptanceCriteria: ['Finite inputs retain their clamped result'],
    sourceClaims: [{ claim: 'Clamp currently uses Math.min', path: 'src/clamp.js',
        quote: 'return Math.min(Math.max(value, min), max);' }], estimatedMinutes: 6 }],
    closeout: { title: 'Manual clamp closeout', objective: 'Observe scalar clamp in browser',
        manualReason: 'Human interaction requires an independent check', browserRequired: true,
        acceptanceCriteria: ['Observe scalar clamp behavior in the browser'], tier: 'T3' },
    efficiencyAudit: audit };
const work = { target: 'step-1', kind: 'work', title: plan.work[0].title,
    objective: plan.work[0].objective, tier: 'T1', dependsOn: [],
    workingSet: plan.work[0].workingSet, requirements: plan.work[0].requirements,
    acceptanceCriteria: plan.work[0].acceptanceCriteria,
    validationTargets: plan.work[0].validationTargets, complete: true };
const closeout = { target: 'closeout', kind: 'closeout', title: plan.closeout.title,
    objective: plan.closeout.objective, manualReason: plan.closeout.manualReason,
    browserRequired: true, acceptanceCriteria: plan.closeout.acceptanceCriteria,
    efficiencyAudit: audit, complete: true };

test('real Pi worker carries checked wireframe through Plan, Prompt Write and guarded Accept', async t => {
    const temporary = await mkdtemp(join(tmpdir(), 'dope-p4-chain-'));
    const root = join(temporary, 'project');
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'test'), { recursive: true });
    await mkdir(join(root, 'docs', 'tasks'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{"name":"clamp-fixture","version":"0.13.11","type":"module"}\n');
    await writeFile(join(root, 'src/clamp.js'), 'export function clamp(value, min, max) {\n  return Math.min(Math.max(value, min), max);\n}\n');
    await writeFile(join(root, 'test/clamp.test.js'), "import { clamp } from '../src/clamp.js';\n");
    await run('git', ['init', '-q', root]);
    await run('git', ['-C', root, 'add', 'package.json', 'src/clamp.js', 'test/clamp.test.js']);
    await run('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
        'commit', '-qm', 'Fixture']);
    const turns = [
        { operations: [{ name: 'assessment_stage', args: wireframe },
            { name: 'assessment_finish', args: {} }], final: 'Compact wireframe sealed.' },
        { operations: [{ name: 'read_file', args: { path: 'src/clamp.js' } },
            { name: 'read_file', args: { path: 'test/clamp.test.js' } }], final: JSON.stringify(plan) },
        { operations: [{ name: 'proposal_stage_prompt', args: work },
            { name: 'proposal_stage_prompt', args: closeout },
            { name: 'proposal_finish', args: { finalMessage: 'Prompt stack ready for owner review.' } }],
        final: 'Prompt stack staged.' }
    ];
    let active = turns[0], turnIndex = 0;
    const calls: { turn: number; name: string; output: string }[] = [];
    const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += String(chunk);
        const messages = JSON.parse(body).messages as { role: string }[];
        const acknowledged = messages.filter(message => message.role === 'tool').length;
        const operation = active.operations[acknowledged];
        const base = { id: `offline-p4-${turnIndex}`, object: 'chat.completion.chunk',
            created: 1, model: model.id };
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        const send = (delta: object, finish_reason: string | null) => response.write(
            `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
        if (operation) {
            send({ role: 'assistant', tool_calls: [{ index: 0, id: `p4-${turnIndex}-${acknowledged}`,
                type: 'function', function: { name: operation.name,
                    arguments: JSON.stringify(operation.args) } }] }, null);
            send({}, 'tool_calls');
        } else { send({ role: 'assistant', content: active.final }, null); send({}, 'stop'); }
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
            operationPolicy?: unknown; assessmentTools?: boolean; proposalTools?: boolean;
            generationId?: string; execute(name: string, args: unknown, signal?: AbortSignal, id?: number): Promise<string> } }) {
        active = turns[turnIndex++];
        const host = new PiRuntimeHost();
        try {
            await host.start();
            await host.openChatToolsSession({ ...model, baseUrl: endpoint }, root, undefined, 'low',
                false, false, request.projectTools?.proposalTools ?? false,
                request.projectTools?.assessmentTools ?? false, request.projectTools?.operationPolicy as never);
            for await (const event of host.streamTurn(request.messages, request.maxOutputTokens ?? 4096,
                request.signal, async call => {
                    const output = await request.projectTools!.execute(call.name, call.arguments,
                        request.signal, call.id);
                    calls.push({ turn: turnIndex, name: call.name, output });
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
        { compose: async () => ({ messages: [{ role: 'user', content: 'saved Chat' }], refs: [],
            diagnostics: [], usedTokens: 10, budgetTokens: 32768 }) } as never,
        undefined, grounder);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'P4 chain' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'fixture-owner' });
        assert.equal(lease.acquired, true);
        const selectedModel = { connectionId: 'local', modelId: model.id };
        await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token, selectedModel,
            content: '/prompt-ass clamp-api-correction Validate scalar clamp behavior' });
        const assessed = (await backend.get(projectHandle, chatId))!;
        const owner = assessed.messages.find(message => message.role === 'user' && message.promptDraft);
        const assessmentMessage = assessed.messages.find(message => message.role === 'assistant' &&
            message.execution.status === 'complete');
        assert.ok(owner?.role === 'user' && owner.promptDraft && assessmentMessage);
        const identity = owner.promptDraft;
        const chip = (stage: 'assessment' | 'plan', stageMessageId: string) => ({
            draftId: identity.id, ownerUserMessageId: owner.id, stageMessageId, stage,
            stageRevision: 1, projectId: identity.projectId,
            sourceFingerprint: identity.sourceFingerprint, leaseDigest: identity.leaseDigest });
        const store = new PromptDraftStore(repository, grounder);
        const first = await store.read(root, identity, lease.token);
        assert.equal(first.assessment?.revision, 1);
        assert.equal((first.assessment?.record as { count: number }).count, 1);
        assert.equal(first.assessment?.sourceRefs.length, 0);
        assert.equal(currentPromptDraft(assessed)?.state, 'plan');
        const reopenedAssessment = (await new ChatRepository().read(root)).chats.find(chat => chat.id === chatId);
        assert.equal(currentPromptDraft(reopenedAssessment!)?.state, 'plan');
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel, content: '/prompt-plan' }), /Select the current Prompt Stack Draft card/);
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel, content: '/prompt-plan', promptDraftTarget: {
                ...chip('assessment', assessmentMessage.id), projectId: 'foreign' } }), /stale or belongs/);
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel, content: '/prompt-plan', promptDraftTarget: {
                ...chip('assessment', assessmentMessage.id), stageMessageId: randomUUID() } }), /stale or belongs/);
        await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token, selectedModel,
            content: '/prompt-plan', promptDraftTarget: chip('assessment', assessmentMessage.id) });
        const plannedChat = (await backend.get(projectHandle, chatId))!;
        const planMessage = plannedChat.messages.filter(message => message.role === 'assistant' &&
            message.execution.status === 'complete').at(-1);
        assert.ok(planMessage);
        const second = await store.read(root, identity, lease.token);
        assert.equal(second.plan?.dependencyHash, first.assessment?.contentHash);
        assert.deepEqual(second.plan?.sourceRefs.map(ref => ref.id).sort(), ['src/clamp.js', 'test/clamp.test.js']);
        const checkedPlan = second.plan?.record as { work: { id: string; boundary: string }[];
            efficiencyAudit: string[] };
        assert.equal(checkedPlan.work[0].id, 'step-1');
        assert.equal(checkedPlan.work[0].boundary, wireframe.work[0].boundary);
        assert.equal(checkedPlan.efficiencyAudit.length, 10);
        const reopenedPlan = (await new ChatRepository().read(root)).chats.find(chat => chat.id === chatId);
        assert.equal(currentPromptDraft(reopenedPlan!)?.state, 'write');
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: 'foreign',
            selectedModel, content: '/prompt-write',
            promptDraftTarget: chip('plan', planMessage.id) }), /lease|owner|token/iu);
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel, content: '/prompt-write alternate-folder',
            promptDraftTarget: chip('plan', planMessage.id) }), /destination comes from the selected Plan card/);
        await writeFile(join(root, 'src/clamp.js'), 'export const changed = true;\n');
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel, content: '/prompt-write',
            promptDraftTarget: chip('plan', planMessage.id) }), /source changed|source basis|stale/iu);
        await writeFile(join(root, 'src/clamp.js'), 'export function clamp(value, min, max) {\n  return Math.min(Math.max(value, min), max);\n}\n');
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel, content: '/prompt-write', promptDraftTarget: {
                ...chip('plan', planMessage.id), stageRevision: 99 } }), /stage changed/);
        await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token, selectedModel,
            content: '/prompt-write', promptDraftTarget: chip('plan', planMessage.id) });
        const completed = (await backend.get(projectHandle, chatId))!;
        const proposalMessage = completed.messages.filter(message => message.role === 'assistant' &&
            message.planningActivity?.kind === 'prompt-stack-proposal').at(-1);
        const proposal = proposalMessage?.planningActivity?.promptStackProposal;
        assert.ok(proposal);
        validatePromptStackProposal(proposal);
        assert.deepEqual(proposal.files.map(file => file.path.split('/').at(-1)),
            ['prompt-assessment.md', 'implementation-plan.md', 'README.md',
                'P1-validate-scalar-clamp.txt', 'P2-manual-clamp-closeout.txt']);
        assert.match(proposal.files[0].after, /Work prompts \(1\)/);
        assert.match(proposal.files[1].after, /Prompt Efficiency Gates:/);
        assert.match(proposal.files[3].after, /Draft Chat plan step: step-1/);
        assert.match(proposal.files[4].after, /Browser required: yes/);
        assert.equal(proposal.folder, identity.slug);
        assert.equal(proposal.assessmentMessageId, assessmentMessage.id);
        assert.equal(proposal.planMessageId, planMessage.id);
        await assert.rejects(stat(join(root, 'docs/tasks', identity.slug)), /ENOENT/);
        assert.deepEqual(calls.map(call => call.name), ['assessment_stage', 'assessment_finish',
            'read_file', 'read_file', 'proposal_stage_prompt', 'proposal_stage_prompt', 'proposal_finish']);
        assert.equal(JSON.parse(calls.at(-1)!.output).state, 'ready-for-review');
        await assert.rejects(backend.publishPromptStack(projectHandle, chatId, lease.token,
            proposal.id, '0'.repeat(64)), /Exact saved prompt proposal unavailable/);
        const published = await backend.publishPromptStack(projectHandle, chatId, lease.token,
            proposal.id, proposal.digest);
        assert.equal(published.status, 'published');
        for (const file of proposal.files)
            assert.equal(await readFile(join(root, file.path), 'utf8'), file.after);
        const discovered = (await discoverRoadmapTaskStacks(root)).find(item => item.folderName === identity.slug);
        assert.equal(discovered?.prompts.length, 2);
        assert.equal(discovered?.executable, false);
        t.diagnostic(JSON.stringify({ workCount: 1, stepIds: ['step-1'],
            proposalDigest: proposal.digest, proposalFiles: proposal.files.length,
            publisherStatus: published.status, publisherPaths: published.paths.length,
            publishedBytesMatch: true, workExecutable: discovered?.executable }));
    } finally {
        backend.dispose(); server.close();
        await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
    }
});
