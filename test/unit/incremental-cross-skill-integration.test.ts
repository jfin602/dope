import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { HistoryBackend } from '../../packages/theia-extension/lib/node/history-backend.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';

const execute = promisify(execFile);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const selection = { connectionId: 'local', modelId: 'q4' };
type ToolRequest = { projectTools?: { execute(name: string, args: unknown): Promise<string> };
    messages: { content: string }[] };

async function chat(backend: ChatBackend, root: string) {
    const { projectHandle } = await backend.attach(new URL(`file://${root}/`).href);
    const chatId = randomUUID();
    await backend.mutate({ projectHandle, expectedRevision: 0,
        operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Integration review' } });
    const lease = await backend.claim({ projectHandle, chatId, ownerId: 'owner-panel' });
    if (!lease.acquired) throw new Error('Fixture lease unavailable');
    const turn = (content: string) => backend.runTurn({ projectHandle, chatId,
        leaseToken: lease.token, selectedModel: selection, content });
    return { projectHandle, chatId, lease, turn };
}

function model(generate: (request: ToolRequest, turn: number) => Promise<void>) {
    let turns = 0;
    return { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        label: 'Local', models: [{ id: 'q4', label: 'Q4', usable: true,
            capabilities: { conversationalText: true, streaming: true,
                contextWindowTokens: 16384, maxInputTokens: 16384 } }] }] }),
    async *generate(_selection: unknown, request: ToolRequest) {
        await generate(request, turns++);
        yield { type: 'complete' as const, text: 'Tool sequence ended.', actualModelId: 'q4',
            finishReason: 'stop' as const, usage: { tokenMeasurement: 'unavailable' as const } };
    } };
}

async function stage(request: ToolRequest, domain: 'document' | 'prompt', sequence: number,
    target: string, chunkIndex: number, content: object, complete: boolean) {
    const result = JSON.parse(await request.projectTools!.execute(`proposal_stage_${domain}`, {
        version: 1, sequence, expectedRevision: sequence - 1,
        idempotencyKey: `integration-stage-${sequence}`, target, chunkIndex,
        content: JSON.stringify(content), complete }));
    assert.equal(result.revision, sequence, JSON.stringify(result));
    return result;
}

test('protected Docs tools stage two late source edits and a chunked long file; only Accept applies exact bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-cross-docs-'));
    const originals = ['# First\n' + 'ordinary\n'.repeat(700) + '## Late first\nold first\n',
        '# Second\n' + 'ordinary\n'.repeat(710) + '## Late second\nold second\n'];
    const long = '# Large review\n' + Array.from({ length: 1800 }, (_, i) => `Evidence line ${i}.\n`).join('');
    const chunks = [long.slice(0, 10000), long.slice(10000, 20000), long.slice(20000)];
    const repo = new ChatRepository(), store = new RoadmapStore();
    let toolCalls = 0;
    const models = model(async request => {
        const readLate = async (path: string, marker: string) => {
            let offset = 0, fullHash = '', found = false;
            do {
                const page = JSON.parse(await request.projectTools!.execute('read_file',
                    { path, offset, maxBytes: 4096 }));
                toolCalls++; fullHash = page.fullHash;
                found ||= page.text.includes(marker);
                offset = page.nextOffset;
                if (!Number.isSafeInteger(offset)) break;
            } while (!found);
            assert.equal(found, true, `late source actually read: ${path}`);
            return fullHash;
        };
        const firstHash = await readLate('docs/first.md', '## Late first\nold first');
        const secondHash = await readLate('docs/second.md', '## Late second\nold second');
        let sequence = 1;
        await stage(request, 'document', sequence++, 'docs/first.md', 0,
            { operation: 'replace', sourceHash: firstHash,
                before: '## Late first\nold first\n', after: '## Late first\nnew first\n' }, true);
        await stage(request, 'document', sequence++, 'docs/second.md', 0,
            { operation: 'replace', sourceHash: secondHash,
                before: '## Late second\nold second\n', after: '## Late second\nnew second\n' }, true);
        for (const [index, chunk] of chunks.entries())
            await stage(request, 'document', sequence++, 'docs/large.md', index,
                { operation: 'create', chunk }, index === chunks.length - 1);
        toolCalls += sequence;
        const status = JSON.parse(await request.projectTools!.execute('proposal_status', { version: 1 }));
        assert.equal(status.targets.length, 3);
        assert.equal(status.targets.find((item: { target: string }) => item.target === 'docs/large.md').chunks, 3);
        const sealed = JSON.parse(await request.projectTools!.execute('proposal_finish',
            { finalMessage: 'Three reviewed files are ready.' }));
        assert.equal(sealed.state, 'ready-for-review', JSON.stringify(sealed));
    });
    const backend = new ChatBackend(repo, { notifyChatEvent() {} }, models as never,
        new ChatContextComposer({} as never, {} as never, {} as never, repo, store),
        undefined, new ChatProjectGrounder({} as never), undefined, undefined, undefined, store);
    const history = new HistoryBackend();
    try {
        await mkdir(join(root, 'docs'));
        await writeFile(join(root, 'docs/first.md'), originals[0]);
        await writeFile(join(root, 'docs/second.md'), originals[1]);
        const owner = await chat(backend, root);
        await owner.turn('/docs-review update docs/first.md and docs/second.md at the late sections; create docs/large.md');
        const message = (await backend.get(owner.projectHandle, owner.chatId))!.messages.at(-1);
        assert.equal(message?.role, 'assistant');
        const proposal = message?.role === 'assistant' ? message.planningActivity?.documentProposal : undefined;
        assert.ok(proposal);
        assert.equal(message?.role === 'assistant' && message.content, 'Three reviewed files are ready.');
        assert.deepEqual(proposal.targets.map(item => item.path),
            ['docs/first.md', 'docs/second.md', 'docs/large.md']);
        assert.deepEqual(proposal.targets.map(item => hash(item.after)), proposal.targets.map(item => item.afterHash));
        assert.equal(proposal.targets[2].after, long);
        assert.equal(await readFile(join(root, 'docs/first.md'), 'utf8'), originals[0]);
        assert.equal(await readFile(join(root, 'docs/second.md'), 'utf8'), originals[1]);
        await assert.rejects(stat(join(root, 'docs/large.md')), /ENOENT/);
        const attached = await history.attach(new URL(`file://${root}/`).href);
        assert.equal((await history.read(attached.projectHandle)).entries.some(entry => entry.source === 'documentation'), false);
        await assert.rejects(backend.applyDocumentation(owner.projectHandle, owner.chatId,
            owner.lease.token, proposal.id, '0'.repeat(64)), /Exact/);
        const applied = await backend.applyDocumentation(owner.projectHandle, owner.chatId,
            owner.lease.token, proposal.id, proposal.digest);
        assert.equal(applied.status, 'complete');
        for (const target of proposal.targets)
            assert.equal(await readFile(join(root, target.path), 'utf8'), target.after);
        assert.equal((await history.read(attached.projectHandle)).entries.filter(entry => entry.source === 'documentation').length, 1);
        assert.ok(toolCalls >= 9);
    } finally { history.dispose(); backend.dispose(); await rm(root, { recursive: true, force: true,
        maxRetries: 5, retryDelay: 50 }); }
});

test('protected Prompt tools stage ten detailed dependent prompts and publish only through native Accept', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'dope-cross-prompt-'));
    const root = join(temporary, 'project'), repo = new ChatRepository();
    await execute('git', ['clone', '-q', '--local', '--no-hardlinks', '--no-checkout', process.cwd(), root]);
    await execute('git', ['-C', root, 'read-tree', 'HEAD']);
    await execute('git', ['-C', root, 'sparse-checkout', 'init', '--cone']);
    await mkdir(join(root, 'src'));
    await mkdir(join(root, 'docs/tasks'), { recursive: true });
    await writeFile(join(root, 'src/feature.js'), 'export const feature = true;\n');
    await writeFile(join(root, 'package.json'), '{"name":"fixture","version":"0.13.11"}\n');
    const answers = ['## Scope\nTen source-backed steps.\n## Preservation\nNo Work run.\n## Dependencies\nOrdered.\n' +
        '## Risks\nSource drift.\n## Source basis\nRead source.\n## Authority\nChat only.\n## Evidence\nT1/T2/T3.',
    '## Steps\n1. Implement ten steps.\n## Tests\nFocused suites.\n## Manual\nBrowser closeout.'];
    const audit = Array.from({ length: 10 }, (_, index) =>
        `Gate ${index + 1} checks dependency order, exact sources and focused validation in this fixture.`);
    let stages = 0;
    const models = model(async (request, turn) => {
        if (turn < 2) {
            await request.projectTools!.execute('read_file', { path: 'src/feature.js', offset: 0, maxBytes: 4096 });
            return;
        }
        let sequence = 1;
        for (let index = 1; index <= 10; index++) {
            const target = `step-${index}`;
            await stage(request, 'prompt', sequence++, target, 0, { kind: 'work', id: target,
                title: `Implement feature ${index}`, objective: `Implement verified feature ${index}`,
                tier: index === 10 ? 'T2' : 'T1',
                dependsOn: index === 1 ? [] : [`step-${index - 1}`],
                workingSet: ['src/feature.js'], requirements: [`Inspect source for feature ${index}`],
                acceptanceCriteria: [`Feature ${index} passes on verified source`],
                validationTargets: [`Run test/unit/feature-${index}.test.ts`],
                ...(index === 10 ? { integrationChecks: ['Run focused integration tests'] } : {}) }, false);
            await stage(request, 'prompt', sequence++, target, 1, { kind: 'section',
                heading: `Detailed feature ${index} procedure`,
                text: Array.from({ length: 90 }, (_, line) =>
                    `- Verify feature ${index} condition ${line + 1} against observed source and its test.`).join('\n') }, true);
        }
        await stage(request, 'prompt', sequence++, 'closeout', 0, {
            kind: 'closeout', title: 'Manual integration closeout', objective: 'Inspect all features in browser',
            manualReason: 'Human interaction requires observation', browserRequired: true,
            acceptanceCriteria: ['Observe all ten features'], efficiencyAudit: audit }, true);
        stages = sequence - 1;
        const status = JSON.parse(await request.projectTools!.execute('proposal_status', { version: 1 }));
        assert.equal(status.targets.length, 11);
        assert.ok(JSON.stringify(status).length < 4000, 'status excludes growing candidate text');
        const sealed = JSON.parse(await request.projectTools!.execute('proposal_finish',
            { finalMessage: 'The ten prompt stack is ready for review.' }));
        assert.equal(sealed.state, 'ready-for-review', JSON.stringify(sealed));
    });
    const composer = { compose: async () => ({ messages: [{ role: 'user', content: 'saved Chat context' }],
        refs: [], diagnostics: [], usedTokens: 10, budgetTokens: 16384 }) };
    const backend = new ChatBackend(repo, { notifyChatEvent() {} }, models as never,
        composer as never, undefined, new ChatProjectGrounder({} as never));
    try {
        const owner = await chat(backend, root);
        for (const content of ['/prompt-ass', '/prompt-plan']) await owner.turn(content);
        await owner.turn('/prompt-write c13-cross-skill-fixture');
        const message = (await backend.get(owner.projectHandle, owner.chatId))!.messages.at(-1);
        assert.equal(message?.role, 'assistant');
        const proposal = message?.role === 'assistant' ? message.planningActivity?.promptStackProposal : undefined;
        assert.ok(proposal);
        assert.equal(message?.role === 'assistant' && message.content, 'The ten prompt stack is ready for review.');
        assert.equal(proposal.files.length, 14);
        assert.equal(stages, 21);
        assert.deepEqual(proposal.files.map(file => hash(file.after)), proposal.files.map(file => file.afterHash));
        assert.equal(proposal.files.slice(3).filter(file => /Browser required: yes/u.test(file.after)).length, 1);
        assert.match(proposal.files[3].after, /condition 90/);
        assert.equal((await importPhaseStack(proposal.folder, proposal.files.slice(3).map(file =>
            ({ filename: file.path.split('/').at(-1)!, text: file.after })))).entries.length, 11);
        await assert.rejects(stat(join(root, 'docs/tasks/c13-cross-skill-fixture')), /ENOENT/);
        assert.equal((await discoverRoadmapTaskStacks(root)).some(item => item.folderName === proposal.folder), false);
        assert.equal((await backend.inspectPromptStack(owner.projectHandle, owner.chatId,
            owner.lease.token, proposal.id, proposal.digest)).status, 'applicable');
        await assert.rejects(backend.publishPromptStack(owner.projectHandle, owner.chatId,
            owner.lease.token, proposal.id, '0'.repeat(64)), /Exact/);
        const published = await backend.publishPromptStack(owner.projectHandle, owner.chatId,
            owner.lease.token, proposal.id, proposal.digest);
        assert.equal(published.status, 'published');
        for (const file of proposal.files)
            assert.equal(await readFile(join(root, file.path), 'utf8'), file.after);
        const discovered = (await discoverRoadmapTaskStacks(root)).find(item => item.folderName === proposal.folder);
        assert.equal(discovered?.prompts.length, 11);
        assert.equal(discovered?.executable, false, 'publication does not grant or run Work');
        await assert.rejects(backend.publishPromptStack(owner.projectHandle, owner.chatId,
            owner.lease.token, proposal.id, proposal.digest), /Pending prompt proposal required/);
    } finally { backend.dispose(); await rm(temporary, { recursive: true, force: true,
        maxRetries: 5, retryDelay: 50 }); }
});
