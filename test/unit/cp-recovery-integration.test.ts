import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { ChatBackend, requestsImplementationPlan } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { planningOutcome } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';

// Verbatim user wording from the immutable c11-conversational-planning P8 closeout.
const prompt = 'Plan a visual Git history for this project. Reuse the existing read-only diff editor in src/diffEditor.js; put branch checkout and commits in the toolbar; keep checkout and commit permissions explicit. Please inspect the relevant files and give me a complete ordered implementation plan with tests before changing anything.';
const files = {
    'src/history.js': 'export function history() { return ["main"]; }\n',
    'src/diffEditor.js': 'export function readOnlyDiff(left, right) { return { left, right }; }\n',
    'src/toolbar.js': 'export const toolbar = ["history"];\n',
    'src/permissions.js': 'export function mayCheckout() { return false; }\n',
    'test/history.test.js': 'import { history } from "../src/history.js";\n',
    'README.md': '# Git history fixture\n'
};
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

test('P8 wording crosses source read, normal Chat plan route, review, saved revision and safe Roadmap projection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-cp-recovery-'));
    const repository = new ChatRepository(), store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
    const grounder = new ChatProjectGrounder({ status: () => ({ state: 'idle', generation: 0 }),
        snapshot: () => undefined, inputsCurrent: async () => false } as never);
    const plan = { type: 'implementation-plan', objective: 'Visual Git history',
        successCriteria: ['Visual Git history shows commits and reuses the read-only diff editor',
            'Branch checkout and commit toolbar controls require explicit permission'],
        constraints: ['Explicit checkout and commit permissions'], assumptions: ['Git provider needs inspection'],
        steps: [
            { title: 'Inspect history and diff', detail: 'Read current Git history and reuse the read-only diff editor',
                deliverables: ['Read-only diff editor integration map'], dependsOn: [],
                reuse: [{ path: 'src/diffEditor.js', reason: 'Existing read-only diff renderer' }] },
            { title: 'Add visual Git history navigation', detail: 'Show commits and branches in the visual Git history view',
                deliverables: ['Visual Git history view'], dependsOn: [1],
                reuse: [{ path: 'src/history.js', reason: 'History owner' }] },
            { title: 'Guard branch and commit actions',
                detail: 'Call checkoutBranch and invoke repository commit creation from toolbar controls after explicit permission checks; handle failure, verify the new commit identifier and implement tests',
                deliverables: ['Functional branch checkout and commit creation toolbar controls with explicit permissions and tests'],
                dependsOn: [2], reuse: [] }],
        tests: ['Unit visual Git history, diff editor reuse, branch checkout and commit permission checks'],
        guiQualification: 'Review history, diff, checkout and commit in browser',
        risks: ['Stale branch state'], alternatives: ['Start with read-only history'], question: '' };
    let output = JSON.stringify(plan), calls = 0;
    const selected = { connectionId: 'local', modelId: 'chosen-q4' };
    const models = { list: async () => ({ connections: [
        { id: 'local', ready: true, providerId: 'local', models: [{ id: 'chosen-q4', label: 'Chosen local fixture',
            usable: true, capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 8192 } }] },
        { id: 'hosted', ready: true, providerId: 'gemini', models: [{ id: 'remote', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 8192 } }] }
    ] }), async *generate(target: { connectionId: string }, request: { messages: { content: string }[] }) {
        assert.equal(target.connectionId, selected.connectionId, 'no hosted fallback');
        const sent = request.messages.map(item => item.content).join('\n');
        assert.doesNotMatch(sent, /TOP_SECRET_FIXTURE_VALUE/);
        if (calls === 0) assert.match(sent, /readOnlyDiff/);
        calls++;
        yield { type: 'complete' as const, text: output, actualModelId: selected.modelId };
    } };
    const composer = { compose: async (_root: unknown, _chat: unknown, _content: unknown,
        _context: unknown, _capabilities: unknown, grounding: { blocks: { text: string; ref: unknown }[];
            diagnostics: unknown[] }) => ({ messages: [{ role: 'user' as const,
        content: grounding.blocks.map(block => block.text).join('\n') }],
        refs: grounding.blocks.map(block => block.ref), diagnostics: grounding.diagnostics,
        usedTokens: 30, budgetTokens: 1000 }) };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never,
        undefined, grounder, undefined, greenfield);
    try {
        for (const [path, content] of Object.entries(files)) {
            await mkdir(join(root, path.substring(0, path.lastIndexOf('/')) || '.'), { recursive: true });
            await writeFile(join(root, path), content);
        }
        await writeFile(join(root, '.env'), 'TOP_SECRET_FIXTURE_VALUE');
        assert.equal(requestsImplementationPlan(prompt), true);
        for (const ordinary of ['What is the plan?', 'Plan with Chat help', 'Plan a trip',
            'Plan a checkpoint and inspect the Roadmap']) assert.equal(requestsImplementationPlan(ordinary), false);
        const named = await grounder.ground(root, prompt);
        const file = named.blocks.find(block => block.ref.kind === 'file' && block.ref.id === 'src/diffEditor.js');
        assert.equal(file?.ref.sourceHash, sha(files['src/diffEditor.js']));
        assert.equal(file?.ref.contentHash, file?.ref.sourceHash);
        assert.equal(named.blocks.some(block => block.ref.id === 'src/diffEditor.js;' || block.ref.kind === 'directory' &&
            block.ref.id === 'src/diffEditor.js'), false);
        const investigated = await grounder.investigateIdea(root, prompt);
        assert.equal(investigated.blocks.find(block => block.ref.kind === 'file')?.ref.sourceHash, file?.ref.sourceHash);
        const missing = await grounder.investigateIdea(root, 'read src/missing.js');
        assert.equal(missing.blocks.some(block => block.ref.kind === 'file' && block.ref.sourceHash), false);
        assert.ok(missing.diagnostics.some(item => item.kind === 'unavailable'));
        await assert.rejects(grounder.investigate(root, { projectId: 'foreign', queries: [] }), /Foreign/);
        await assert.rejects(grounder.investigate(root, { queries: [{ kind: 'read', path: '../secret' }] }), /path|Invalid|Unsafe/i);

        const { projectHandle } = await backend.attach(pathToFileURL(root).href), chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'P8-tab' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) throw new Error('Chat lease required');
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'hosted', modelId: 'remote' }, hostedProjectDataAuthorized: true,
            content: prompt }), /selected local model/);
        assert.equal(calls, 0);
        const before = await store.read(root);
        const first = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: selected, content: prompt });
        assert.equal(calls, 1);
        assert.equal(first.proposal?.action.type, 'implementation-plan', JSON.stringify(first.planPreview ?? first.proposalError));
        assert.equal(first.proposal?.changedIds.length, 3);
        assert.match(first.proposal?.summary ?? '', /Guard branch and commit actions/);
        assert.match(first.proposal?.summary ?? '', /explicit permission checks/);
        assert.equal(first.refs.find(ref => ref.kind === 'file')?.sourceHash, sha(files['src/diffEditor.js']));
        const binding = greenfield.chatImplementationPlan(root, chatId);
        assert.equal(binding?.planOnly, true);
        assert.deepEqual(greenfield.read(binding!.handle).phases, [], 'empty legacy draft is never a plan');
        assert.equal(greenfield.readImplementationPlan(binding!.handle), undefined);
        const pending = (await backend.get(projectHandle, chatId))!.messages.at(-1)!;
        assert.equal(pending.role === 'assistant' && pending.planningActivity?.status, 'pending');
        assert.ok(pending.role === 'assistant' && planningOutcome(pending));
        assert.deepEqual(await store.read(root), before);
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, first.proposal!.id, true);
        const accepted = greenfield.readImplementationPlan(binding!.handle)!;
        assert.equal(accepted.revision, 1);
        assert.deepEqual(accepted.evidence.map(item => [item.path, item.sha256]),
            [['src/diffEditor.js', sha(files['src/diffEditor.js'])],
                ['src/history.js', sha(files['src/history.js'])]].slice(0, accepted.evidence.length));
        assert.deepEqual(await store.read(root), before);
        const revision = { type: 'implementation-plan-revision', baseRevision: 1,
            edits: [{ type: 'update', step: 2, detail: 'Navigate commits with the existing history owner' }],
            constraintsAdd: [], decisionsAdd: [], question: '' };
        output = JSON.stringify(revision);
        const rejected = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: selected, content: 'Refine history navigation' });
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, rejected.proposal!.id, false);
        assert.equal(greenfield.readImplementationPlan(binding!.handle)?.revision, 1);
        const changed = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: selected, content: 'Refine history navigation' });
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, changed.proposal!.id, true);
        assert.equal(greenfield.readImplementationPlan(binding!.handle)?.revision, 2);
        assert.equal(await backend.undoPlanningRevision(projectHandle, chatId, lease.token, 2), 3);
        assert.deepEqual(greenfield.readImplementationPlan(binding!.handle)?.steps, accepted.steps);
        await assert.rejects(backend.undoPlanningRevision(projectHandle, chatId, lease.token, 2), /Stale/);
        output = '{"type":"implementation-plan-revision","baseRevision":3';
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: selected, content: 'Revise again' }), /JSON|completion|invalid|incomplete/i);
        assert.equal(greenfield.readImplementationPlan(binding!.handle)?.revision, 3);
        assert.equal((await new ChatRepository().read(root)).chats[0].messages.some(message =>
            message.role === 'assistant' && message.planningActivity?.status === 'applied'), true);
        const restored = new RoadmapGreenfield(new RoadmapStore());
        await restored.ensureRestored(root);
        assert.equal(restored.chatImplementationPlan(root, chatId)?.plan?.revision, 3);
        assert.equal(restored.readImplementationPlan(binding!.handle)?.steps.length, 3);
        const reopened = new ChatBackend(new ChatRepository(), { notifyChatEvent() {} }, models as never,
            composer as never, undefined, grounder, undefined, restored);
        try {
            const nextHandle = (await reopened.attach(pathToFileURL(root).href)).projectHandle;
            assert.equal((await reopened.claim({ projectHandle: nextHandle, chatId, ownerId: 'other-tab' })).acquired, false);
            backend.dispose(); // a same-tab reload closes the old transport and its lease
            const next = await reopened.claim({ projectHandle: nextHandle, chatId, ownerId: 'P8-tab' });
            assert.equal(next.acquired, true);
            if (!next.acquired) throw new Error('Reloaded Chat lease missing');
            assert.equal((await reopened.get(nextHandle, chatId))?.messages.some(message =>
                message.role === 'assistant' && message.planningActivity?.status === 'applied'), true);
            await reopened.release(nextHandle, chatId, next.token);
        } finally { reopened.dispose(); }
        assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
        await writeFile(join(root, 'src/diffEditor.js'), 'changed source\n');
        await assert.rejects(restored.previewImplementationPlanProjection(root, binding!.handle), /source changed/i);
        await writeFile(join(root, 'src/diffEditor.js'), files['src/diffEditor.js']);
        const projection = await restored.previewImplementationPlanProjection(root, binding!.handle);
        await assert.rejects(restored.applyImplementationPlanProjection(root, projection, false), /approval/);
        assert.deepEqual(await store.read(root), before);
        const projected = await restored.applyImplementationPlanProjection(root, projection, true);
        assert.equal(projected.phases.length, 3);
        assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
        for (const [path, content] of Object.entries(files)) assert.equal(await readFile(join(root, path), 'utf8'), content);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});
