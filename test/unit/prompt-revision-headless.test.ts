import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
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

const execute = promisify(execFile);
const model = { id: 'openai/gpt-oss-20b', name: 'Deterministic fixture', api: 'openai-completions',
    provider: 'dope-local', reasoning: true, compat: { supportsReasoningEffort: true },
    samplingParams: { temperature: 1, top_p: 1 }, input: ['text'], contextWindow: 32768,
    maxTokens: 8192, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
const audit = ['Single responsibility per step', 'Runtime 8 minutes, soft 10, hard 15',
    'Test precision uses the focused clamp test', 'Build precision needs no compiled output',
    'Evidence distribution reserves manual T3', 'Command deduplication avoids repeats',
    'Model economy defers unrelated work', 'Runnable traceable grammar preserves one closeout',
    'UI design is not applicable to non-UI work', 'Human usability is not applicable to non-UI work'];
const outline = (count: number) => ({ kind: 'wireframe', objective: 'Improve scalar clamp validation',
    count, rationale: 'Each step owns one bounded responsibility',
    work: Array.from({ length: count }, (_, index) => ({ id: `step-${index + 1}`,
        title: `Clamp step ${index + 1}`, objective: `Implement clamp responsibility ${index + 1}`,
        boundary: `Clamp boundary ${index + 1}`, dependsOn: index ? [`step-${index}`] : [] })),
    constraints: ['Preserve finite scalar results'], deferrals: ['Defer batch API'],
    closeout: { title: 'Manual clamp closeout', objective: 'Observe clamp in browser',
        manualReason: 'Human observation is separate' }, sourceClaims: [] });
const plan = (count: number) => ({ work: outline(count).work.map(step => ({ ...step,
    assessmentObjective: step.objective, objective: `Implement finite ${step.id}`,
    tier: 'T1', workingSet: ['src/clamp.js'], requirements: [`Implement ${step.id}`],
    preservedBehavior: ['Keep finite results'], risks: ['Check bounds'], deferrals: ['Defer batch API'],
    validationTargets: ['Run test/clamp.test.js'], buildNeeds: 'none',
    acceptanceCriteria: [`Verify ${step.id}`], sourceClaims: [{ claim: 'Clamp uses Math.min',
        path: 'src/clamp.js', quote: 'return Math.min(Math.max(value, min), max);' }],
    estimatedMinutes: 6 })), closeout: { ...outline(count).closeout, browserRequired: true,
        acceptanceCriteria: ['Observe browser behavior'], tier: 'T3' }, efficiencyAudit: audit });
const operations = (count: number) => [...plan(count).work.map(step => ({ name: 'proposal_stage_prompt',
    args: { target: step.id, kind: 'work', title: step.title, objective: step.objective,
        tier: step.tier, dependsOn: step.dependsOn, workingSet: step.workingSet,
        requirements: step.requirements, acceptanceCriteria: step.acceptanceCriteria,
        validationTargets: step.validationTargets, complete: true } })),
    { name: 'proposal_stage_prompt', args: { target: 'closeout', kind: 'closeout',
        title: plan(count).closeout.title, objective: plan(count).closeout.objective,
        manualReason: plan(count).closeout.manualReason, browserRequired: true,
        acceptanceCriteria: plan(count).closeout.acceptanceCriteria,
        efficiencyAudit: audit, complete: true } },
    { name: 'proposal_finish', args: { finalMessage: 'Revised stack ready for review.' } }];

test('real worker reviews an Assessment redivision and invalidates its old Plan and proposal', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'dope-p4-r1-'));
    const root = join(temporary, 'project');
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'test'), { recursive: true });
    await mkdir(join(root, 'docs', 'tasks'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{"name":"fixture","version":"0.13.11","type":"module"}\n');
    await writeFile(join(root, 'src/clamp.js'), 'export function clamp(value, min, max) {\n  return Math.min(Math.max(value, min), max);\n}\n');
    await writeFile(join(root, 'test/clamp.test.js'), "import { clamp } from '../src/clamp.js';\n");
    await execute('git', ['init', '-q', root]);
    await execute('git', ['-C', root, 'add', 'package.json', 'src/clamp.js', 'test/clamp.test.js']);
    await execute('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
        'commit', '-qm', 'Fixture']);
    const turns = [
        { operations: [{ name: 'assessment_stage', args: outline(3) },
            { name: 'assessment_finish', args: {} }], final: 'Assessment v1 staged.' },
        { operations: [{ name: 'read_file', args: { path: 'src/clamp.js' } },
            { name: 'read_file', args: { path: 'test/clamp.test.js' } }], final: JSON.stringify(plan(3)) },
        { operations: operations(3), final: 'Proposal v1 staged.' },
        { operations: [{ name: 'assessment_stage', args: outline(4) },
            { name: 'assessment_finish', args: {} }], final: 'Assessment v2 candidate.' },
        { operations: [{ name: 'read_file', args: { path: 'src/clamp.js' } },
            { name: 'read_file', args: { path: 'test/clamp.test.js' } }], final: JSON.stringify(plan(4)) },
        { operations: operations(4), final: 'Proposal v2 staged.' },
        { operations: [{ name: 'assessment_stage', args: outline(5) },
            { name: 'assessment_finish', args: {} }], final: 'Rejected candidate staged.' }
    ];
    let active = turns[0], turnIndex = 0;
    const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += String(chunk);
        const acknowledged = (JSON.parse(body).messages as { role: string }[])
            .filter(message => message.role === 'tool').length;
        const operation = active.operations[acknowledged];
        const base = { id: `p4-r1-${turnIndex}`, object: 'chat.completion.chunk',
            created: 1, model: model.id };
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        const send = (delta: object, finish_reason: string | null) => response.write(
            `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
        if (operation) {
            send({ role: 'assistant', tool_calls: [{ index: 0,
                id: `r1-${turnIndex}-${acknowledged}`, type: 'function',
                function: { name: operation.name, arguments: JSON.stringify(operation.args) } }] }, null);
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
    async *generate(_selection: unknown, request: { messages: { role: 'system' | 'user' | 'assistant';
        content: string }[]; maxOutputTokens?: number; signal?: AbortSignal; projectTools?: {
            operationPolicy?: unknown; assessmentTools?: boolean; proposalTools?: boolean;
            generationId?: string; execute(name: string, args: unknown, signal?: AbortSignal,
                id?: number): Promise<string> } }) {
        active = turns[turnIndex++];
        const host = new PiRuntimeHost();
        try {
            await host.start();
            await host.openChatToolsSession({ ...model, baseUrl: endpoint }, root, undefined, 'low',
                false, false, request.projectTools?.proposalTools ?? false,
                request.projectTools?.assessmentTools ?? false, request.projectTools?.operationPolicy as never);
            for await (const event of host.streamTurn(request.messages, request.maxOutputTokens ?? 4096,
                request.signal, async call => ({ status: 'completed' as const,
                    output: await request.projectTools!.execute(call.name, call.arguments,
                        request.signal, call.id) }), request.projectTools?.generationId,
                request.projectTools?.operationPolicy as never)) {
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
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Revision chain' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'fixture-owner' });
        assert.equal(lease.acquired, true);
        const selectedModel = { connectionId: 'local', modelId: model.id };
        const turn = (content: string, promptDraftTarget?: object) => backend.runTurn({ projectHandle,
            chatId, leaseToken: lease.token, selectedModel, content,
            ...(promptDraftTarget ? { promptDraftTarget } : {}) } as never);
        await turn('/prompt-ass clamp-api-correction Build three implementation prompts');
        let chat = (await backend.get(projectHandle, chatId))!;
        const owner = chat.messages.find(message => message.role === 'user' && message.promptDraft);
        const assessment1 = chat.messages.find(message => message.role === 'assistant');
        assert.ok(owner?.role === 'user' && owner.promptDraft && assessment1);
        const identity = owner.promptDraft;
        const chip = (stage: 'assessment' | 'plan', stageMessageId: string,
            stageRevision = 1, purpose?: 'revise-assessment') => ({ draftId: identity.id,
            ownerUserMessageId: owner.id, stageMessageId, stage, stageRevision,
            projectId: identity.projectId, sourceFingerprint: identity.sourceFingerprint,
            leaseDigest: identity.leaseDigest, ...(purpose ? { purpose } : {}) });
        const store = new PromptDraftStore(repository, grounder);
        await turn('/prompt-plan', chip('assessment', assessment1.id));
        chat = (await backend.get(projectHandle, chatId))!;
        const plan1 = chat.messages.filter(message => message.role === 'assistant').at(-1)!;
        await turn('/prompt-write', chip('plan', plan1.id));
        chat = (await backend.get(projectHandle, chatId))!;
        const proposal1 = chat.messages.filter(message => message.role === 'assistant').at(-1)!
            .planningActivity?.promptStackProposal;
        assert.ok(proposal1);
        assert.equal((await backend.inspectPromptStack(projectHandle, chatId, lease.token,
            proposal1.id, proposal1.digest)).status, 'applicable');
        await assert.rejects(turn('/prompt-ass clamp-api-correction Four implementation prompts'),
            /already exists/);
        await assert.rejects(turn('/prompt-ass clamp-api-correction Change to four implementation prompts',
            { ...chip('assessment', assessment1.id, 1, 'revise-assessment'), draftId: randomUUID() }),
            /stale or belongs/);
        await turn('/prompt-ass clamp-api-correction Change this Assessment from three implementation prompts to four. Separate UI and backend work.',
            chip('assessment', assessment1.id, 1, 'revise-assessment'));
        chat = (await backend.get(projectHandle, chatId))!;
        const candidateMessage = chat.messages.filter(message => message.role === 'assistant').at(-1)!;
        const candidate = candidateMessage.planningActivity?.assessmentRevision;
        assert.ok(candidate);
        assert.equal(currentPromptDraft(chat)?.state, 'review');
        const pending = await store.read(root, identity, lease.token);
        assert.equal((pending.assessment?.record as { count: number }).count, 3);
        assert.equal(pending.plan?.revision, 1);
        assert.equal((pending.pendingAssessment?.value.record as { count: number }).count, 4);
        await assert.rejects(backend.decidePromptAssessmentRevision(projectHandle, chatId,
            lease.token, candidateMessage.id, '0'.repeat(64), 'accept'), /changed/);
        await backend.decidePromptAssessmentRevision(projectHandle, chatId,
            lease.token, candidateMessage.id, candidate.digest, 'accept');
        chat = (await backend.get(projectHandle, chatId))!;
        assert.equal(currentPromptDraft(chat)?.state, 'plan');
        assert.equal(currentPromptDraft(chat)?.stageRevision, 2);
        const accepted = await store.read(root, identity, lease.token);
        assert.equal(accepted.assessment?.revision, 2);
        assert.equal((accepted.assessment?.record as { count: number }).count, 4);
        assert.equal(accepted.plan, undefined);
        assert.equal(accepted.history.find(item => item.stage === 'assessment')?.value.revision, 1);
        assert.equal((await backend.inspectPromptStack(projectHandle, chatId, lease.token,
            proposal1.id, proposal1.digest)).status, 'stale');
        await assert.rejects(backend.publishPromptStack(projectHandle, chatId, lease.token,
            proposal1.id, proposal1.digest), /source or destination changed/);
        await assert.rejects(turn('/prompt-write', chip('plan', plan1.id)), /newer than|stale|missing/);
        await turn('/prompt-plan', chip('assessment', candidateMessage.id, 2));
        chat = (await backend.get(projectHandle, chatId))!;
        const plan2 = chat.messages.filter(message => message.role === 'assistant').at(-1)!;
        assert.equal((await store.read(root, identity, lease.token)).plan?.dependencyHash,
            accepted.assessment?.contentHash);
        await turn('/prompt-write', chip('plan', plan2.id, 1));
        chat = (await backend.get(projectHandle, chatId))!;
        const proposal2 = chat.messages.filter(message => message.role === 'assistant').at(-1)!
            .planningActivity?.promptStackProposal;
        assert.ok(proposal2);
        assert.equal(proposal2.assessmentMessageId, candidateMessage.id);
        assert.equal(proposal2.files.filter(file => /\/P\d+-.+\.txt$/u.test(file.path)).length, 5);
        assert.match(proposal2.files[0].after, /Work prompts \(4\)/);
        await turn('/prompt-ass clamp-api-correction Change this Assessment to five work prompts',
            chip('assessment', candidateMessage.id, 2, 'revise-assessment'));
        chat = (await backend.get(projectHandle, chatId))!;
        const rejectedMessage = chat.messages.filter(message => message.role === 'assistant').at(-1)!;
        const rejectedCandidate = rejectedMessage.planningActivity?.assessmentRevision;
        assert.ok(rejectedCandidate);
        await backend.decidePromptAssessmentRevision(projectHandle, chatId, lease.token,
            rejectedMessage.id, rejectedCandidate.digest, 'reject');
        chat = (await backend.get(projectHandle, chatId))!;
        assert.equal(currentPromptDraft(chat)?.state, 'ready');
        const retained = await store.read(root, identity, lease.token);
        assert.equal((retained.assessment?.record as { count: number }).count, 4);
        assert.ok(retained.plan);
        assert.equal((await backend.inspectPromptStack(projectHandle, chatId, lease.token,
            proposal2.id, proposal2.digest)).status, 'applicable');
        await assert.rejects(stat(join(root, 'docs', 'tasks', identity.slug)), /ENOENT/);
        assert.equal(turnIndex, 7);
    } finally {
        backend.dispose(); server.close();
        await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 });
    }
});
