import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer, ORDINARY_CHAT_RESPONSE_INSTRUCTION, SPECIALIZED_TURN_OUTPUT_INSTRUCTION } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { HistoryBackend } from '../../packages/theia-extension/lib/node/history-backend.js';

test('protected Docs review revises one card while only Accept applies its latest bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-doc-command-'));
    const repo = new ChatRepository();
    const seen: string[][] = [];
    const sent: { role: string; content: string }[][] = [];
    let calls = 0;
    let revisionCalls = 0;
    let signalCancelledRevisionStart!: () => void;
    const cancelledRevisionStarted = new Promise<void>(resolve => { signalCancelledRevisionStart = resolve; });
    const before = '# Policy\n' + 'filler\n'.repeat(700) + '## Late policy\nold\n';
    const after = before.replace('## Late policy\nold\n', '## Late policy\nnew\n');
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local', label: 'Local',
        models: [{ id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
            streaming: true, contextWindowTokens: 8192, maxInputTokens: 8192 } }] }] }),
    async *generate(_selection: unknown, request: { messages: { role: string; content: string }[]; signal: AbortSignal;
        projectTools?: { execute(name: string, args: unknown): Promise<string> } }) {
        calls++;
        seen.push(request.messages.map(message => message.content));
        sent.push(request.messages);
        if (request.messages.some(message => message.content.includes('Dope skill /docs-review'))) {
            if (request.messages.some(message => message.content.includes('selected pending documentation proposal'))) {
                revisionCalls++;
                const context = request.messages.map(message => message.content).join('\n');
                assert.match(context, /"path":"docs\/policy.md"/);
                assert.match(context, /never copy operation, hashes, or other saved-proposal metadata into a change/);
                if (revisionCalls === 1) assert.match(context, /"path":"docs\/new.txt"/);
                assert.match(context, /"reviewIntent":"\/docs-review update docs\/policy.md/);
                assert.match(context, /"beforeHash":"[a-f0-9]{64}"/);
                if (revisionCalls === 3) {
                    yield { type: 'complete' as const, text: 'invalid revision output',
                        actualModelId: 'q4', finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' as const } };
                    return;
                }
                if (revisionCalls === 4) {
                    signalCancelledRevisionStart();
                    await new Promise<void>(resolve => request.signal.addEventListener('abort', () => resolve(), { once: true }));
                    yield { type: 'complete' as const, text: JSON.stringify({
                        final_response: 'Cancelled response', report: 'No proposal should be committed.',
                        changes: [{ path: 'docs/replacement.txt', remove: true }] }),
                    actualModelId: 'q4', finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' as const } };
                    return;
                }
                yield { type: 'complete' as const, text: JSON.stringify({
                    final_response: 'I revised the selected proposal. Review its updated card.',
                    report: 'The requested proposal changes are staged.',
                    changes: revisionCalls === 1 ? [{ path: 'docs/new.txt', remove: true }] :
                        [{ path: 'docs/policy.md', replace: { before: '## Late policy\nnew\n',
                            after: '## Late policy\nnewer\n' } },
                        { path: 'docs/replacement.txt', after: 'Replacement guide\n' }] }),
                actualModelId: 'q4', finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' as const } };
                return;
            }
            const page = JSON.parse(await request.projectTools!.execute('read_file',
                { path: 'docs/policy.md', offset: 0, maxBytes: 4096 })) as {
                text: string; sourceHash: string; nextOffset: number };
            assert.equal(page.text.includes('## Late policy'), false);
            const late = JSON.parse(await request.projectTools!.execute('read_file',
                { path: 'docs/policy.md', offset: page.nextOffset, maxBytes: 4096 })) as { text: string };
            assert.match(late.text, /## Late policy\nold/);
            const notes = JSON.parse(await request.projectTools!.execute('read_file',
                { path: 'docs/notes.md', offset: 0, maxBytes: 4096 })) as { text: string };
            assert.equal(notes.text, '# Notes\n');
            yield { type: 'complete' as const, text: JSON.stringify({
                final_response: 'I prepared the policy update and a new validation note. The proposal is ready for your review; no files have changed yet.',
                report: 'Current policy needs the approved new wording.',
                changes: [{ path: 'docs/policy.md', replace: { before: '## Late policy\nold\n',
                    after: '## Late policy\nnew\n' } },
                { path: 'docs/new.txt', after: 'Validation cases\n' }] }),
            actualModelId: 'q4', finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' as const } };
        } else yield { type: 'complete' as const, text: 'A literal command example is inert.',
            actualModelId: 'q4', finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' as const } };
    } };
    const store = new RoadmapStore();
    const composer = new ChatContextComposer({} as never, {} as never, {} as never, repo, store);
    const backend = new ChatBackend(repo, { notifyChatEvent() {} }, models as never, composer,
        undefined, new ChatProjectGrounder({} as never), undefined, undefined, undefined, store);
    try {
        await mkdir(join(root, 'docs'));
        await writeFile(join(root, 'docs', 'policy.md'), before);
        await writeFile(join(root, 'docs', 'search-only.txt'), 'Policy search match, never read.\n');
        await writeFile(join(root, 'docs', 'notes.md'), '# Notes\n');
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Policy decision' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'developer-panel' });
        if (!lease.acquired) throw new Error('Chat lease unavailable');
        const turn = (content: string) => backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' }, content });
        await turn('Please update the policy. In ordinary Chat use short bullets and stop early.');
        await turn('Explain the literal command `/docs-review` in a code sample.');
        assert.equal((await backend.get(projectHandle, chatId))!.messages.at(-2)?.role === 'user' &&
            (await backend.get(projectHandle, chatId))!.messages.at(-2)?.skill, undefined);
        await turn('/docs-review update docs/policy.md at its late section and create docs/new.txt');
        let messages = (await backend.get(projectHandle, chatId))!.messages;
        const review = messages.at(-1);
        assert.equal(review?.role, 'assistant');
        const proposal = review?.role === 'assistant' ? review.planningActivity?.documentProposal : undefined;
        assert.ok(proposal);
        assert.deepEqual(proposal.targets.map(target => [target.path, target.operation]),
            [['docs/policy.md', 'update'], ['docs/new.txt', 'create']]);
        assert.equal(review?.role === 'assistant' && review.planningActivity?.status, 'pending');
        assert.equal(messages.at(-2)?.role === 'user' && messages.at(-2)?.skill?.name, 'docs-review');
        assert.equal(await readFile(join(root, 'docs', 'policy.md'), 'utf8'), before);
        assert.equal(review?.role === 'assistant' ? review.content : '',
            'I prepared the policy update and a new validation note. The proposal is ready for your review; no files have changed yet.');
        assert.deepEqual(review?.role === 'assistant' ? review.planningActivity?.documentationDiscovery?.reads : [],
            [{ path: 'docs/notes.md', count: 1 }, { path: 'docs/policy.md', count: 2 }]);
        assert.equal(review?.role === 'assistant' ? review.planningActivity?.documentationDiscovery?.detected : undefined, 3);
        assert.equal(review?.role === 'assistant' && review.execution.toolEvents?.length, 3);
        assert.equal(review?.role === 'assistant' && review.execution.toolEvents?.[1].endOffset, Buffer.byteLength(before));
        assert.equal(seen.some(turnMessages => turnMessages.some(text => text.includes('Dope skill /docs-review'))), true);
        assert.equal(seen.some(turnMessages => turnMessages.some(text =>
            text.includes('with exactly these sibling keys'))), true);
        const ordinary = sent.find(messages => messages.at(-1)?.content.startsWith('Please update the policy.'))!;
        assert.ok(ordinary.some(message => message.role === 'system' &&
            message.content === ORDINARY_CHAT_RESPONSE_INSTRUCTION));
        const reviewRequest = sent.find(messages => messages.at(-1)?.content.startsWith('/docs-review'))!;
        assert.ok(reviewRequest.some(message => message.role === 'system' &&
            message.content === SPECIALIZED_TURN_OUTPUT_INSTRUCTION));
        assert.ok(!reviewRequest.some(message => message.role === 'system' &&
            message.content === ORDINARY_CHAT_RESPONSE_INSTRUCTION));
        assert.ok(reviewRequest.some(message => message.role === 'system' &&
            message.content.includes('with exactly these sibling keys')));
        assert.ok(reviewRequest.some(message => message.role === 'user' &&
            message.content.includes('In ordinary Chat use short bullets')));
        const history = new HistoryBackend();
        const attached = await history.attach(pathToFileURL(root).href);
        assert.equal((await history.read(attached.projectHandle)).entries.some(entry => entry.source === 'documentation'), false);
        const revise = (candidate: NonNullable<typeof proposal>, instructions: string) => backend.runTurn({
            projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: `/docs-review ${instructions}`,
            documentationRevision: { proposalId: candidate.id, revision: candidate.proposalRevision ?? 1,
                digest: candidate.digest } });
        await revise(proposal, 'Remove the proposed docs/new.txt; keep the policy update.');
        messages = (await backend.get(projectHandle, chatId))!.messages;
        const firstRevision = (messages.find(message => message.id === review.id) as typeof review).planningActivity!.documentProposal!;
        assert.equal(firstRevision.id, proposal.id);
        assert.equal(firstRevision.proposalRevision, 2);
        assert.deepEqual(firstRevision.targets.map(target => target.path), ['docs/policy.md']);
        assert.equal(messages.filter(message => message.role === 'assistant' &&
            message.planningActivity?.kind === 'documentation-proposal').length, 1);
        await assert.rejects(revise(proposal, 'Stale revision'), /missing or stale/);
        assert.equal((await backend.get(projectHandle, chatId))!.messages.find(message => message.id === review.id)?.role === 'assistant' &&
            ((await backend.get(projectHandle, chatId))!.messages.find(message => message.id === review.id) as typeof review)
                .planningActivity?.documentProposal?.digest, firstRevision.digest);
        await revise(firstRevision, 'Change the proposed policy wording and add docs/replacement.txt.');
        messages = (await backend.get(projectHandle, chatId))!.messages;
        const latest = (messages.find(message => message.id === review.id) as typeof review).planningActivity!.documentProposal!;
        assert.equal(latest.id, proposal.id);
        assert.equal(latest.proposalRevision, 3);
        assert.deepEqual(latest.targets.map(target => target.path), ['docs/policy.md', 'docs/replacement.txt']);
        await revise(latest, 'Try a malformed revision.');
        messages = (await backend.get(projectHandle, chatId))!.messages;
        assert.equal((messages.find(message => message.id === review.id) as typeof review).planningActivity!
            .documentProposal!.digest, latest.digest, 'failed generation leaves the last valid card intact');
        assert.match(messages.at(-1)?.role === 'assistant' ? messages.at(-1).content : '',
            /could not stage a proposal/);
        const cancelledRevision = revise(latest, 'Cancel this revision.');
        await cancelledRevisionStarted;
        await backend.cancelTurn(projectHandle, chatId, lease.token);
        await cancelledRevision.catch(() => undefined);
        messages = (await backend.get(projectHandle, chatId))!.messages;
        assert.equal((messages.find(message => message.id === review.id) as typeof review).planningActivity!
            .documentProposal!.digest, latest.digest, 'cancelled revision leaves the last valid card intact');
        assert.equal(await readFile(join(root, 'docs', 'policy.md'), 'utf8'), before);
        assert.equal(await readFile(join(root, 'docs', 'policy.md'), 'utf8'), before);
        messages = (await backend.get(projectHandle, chatId))!.messages;
        assert.equal(messages.find(message => message.role === 'assistant' &&
            message.planningActivity?.proposalId === proposal.id)?.planningActivity?.status, 'pending');
        await assert.rejects(backend.applyDocumentation(projectHandle, chatId, lease.token, proposal.id, proposal.digest),
            /Exact pending documentation proposal/);
        const applied = await backend.applyDocumentation(projectHandle, chatId, lease.token, latest.id, latest.digest);
        assert.equal(applied.status, 'complete');
        assert.equal(await readFile(join(root, 'docs', 'policy.md'), 'utf8'), after.replace('new\n', 'newer\n'));
        await assert.rejects(readFile(join(root, 'docs', 'new.txt'), 'utf8'));
        assert.equal(await readFile(join(root, 'docs', 'replacement.txt'), 'utf8'), 'Replacement guide\n');
        assert.equal((await history.read(attached.projectHandle)).entries.filter(entry => entry.source === 'documentation').length, 1);
        history.dispose();
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true,
        maxRetries: 5, retryDelay: 50 }); }
});
