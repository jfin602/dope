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
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { HistoryBackend } from '../../packages/theia-extension/lib/node/history-backend.js';

test('protected Docs turn stages from brokered reads; command alone cannot approve or write', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-doc-command-'));
    const repo = new ChatRepository();
    const seen: string[][] = [];
    let calls = 0;
    const before = '# Policy\n' + 'filler\n'.repeat(700) + '## Late policy\nold\n';
    const after = before.replace('## Late policy\nold\n', '## Late policy\nnew\n');
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local', label: 'Local',
        models: [{ id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
            streaming: true, contextWindowTokens: 8192, maxInputTokens: 8192 } }] }] }),
    async *generate(_selection: unknown, request: { messages: { role: string; content: string }[];
        projectTools?: { execute(name: string, args: unknown): Promise<string> } }) {
        calls++;
        seen.push(request.messages.map(message => message.content));
        if (request.messages.some(message => message.content.includes('Dope skill /docs-review'))) {
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
    const composer = { compose: async (_root: string, _chat: unknown, content: string) => ({
        messages: [{ role: 'user', content }], refs: [], diagnostics: [], usedTokens: 20, budgetTokens: 8192 }) };
    const store = new RoadmapStore();
    const backend = new ChatBackend(repo, { notifyChatEvent() {} }, models as never, composer as never,
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
        await assert.rejects(turn('/docs-apply'), /exactly one current reviewed/i);
        await turn('Please update the policy.');
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
            text.includes('The changes array must be a sibling of report'))), true);
        const history = new HistoryBackend();
        const attached = await history.attach(pathToFileURL(root).href);
        assert.equal((await history.read(attached.projectHandle)).entries.some(entry => entry.source === 'documentation'), false);
        await turn('/docs-apply');
        assert.equal(calls, 3, 'apply uses deterministic dispatch without an additional model turn');
        assert.equal(await readFile(join(root, 'docs', 'policy.md'), 'utf8'), before);
        messages = (await backend.get(projectHandle, chatId))!.messages;
        assert.equal(messages.find(message => message.role === 'assistant' &&
            message.planningActivity?.proposalId === proposal.id)?.planningActivity?.status, 'pending');
        const applied = await backend.applyDocumentation(projectHandle, chatId, lease.token, proposal.id, proposal.digest);
        assert.equal(applied.status, 'complete');
        assert.equal(await readFile(join(root, 'docs', 'policy.md'), 'utf8'), after);
        assert.equal(await readFile(join(root, 'docs', 'new.txt'), 'utf8'), 'Validation cases\n');
        assert.equal((await history.read(attached.projectHandle)).entries.filter(entry => entry.source === 'documentation').length, 1);
        await assert.rejects(turn('/docs-apply'), /exactly one current reviewed/i);
        history.dispose();
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true,
        maxRetries: 5, retryDelay: 50 }); }
});
