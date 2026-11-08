import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { parsePlanningActivity } from '../../packages/chat/lib/index.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { IncrementalProposalController } from '../../packages/theia-extension/lib/node/incremental-proposal-controller.js';
import { IncrementalPromptStack } from '../../packages/theia-extension/lib/node/incremental-prompt-stack.js';
import { verifyPromptDraftSource } from '../../packages/theia-extension/lib/node/prompt-authoring-stage.js';
import { PlanningStackPublication } from '../../packages/theia-extension/lib/node/planning-stack-publication.js';
import { capturePromptSourceEvidence, validatePromptStackProposal } from '../../packages/theia-extension/lib/node/prompt-stack-proposal.js';

const execute = promisify(execFile);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const stage = (sequence: number, revision: number, target: string, chunkIndex: number,
    content: object, complete = true) => {
    const serialized = JSON.stringify(content);
    return { version: 1, sequence, expectedRevision: revision, idempotencyKey: `step_key_${sequence}`,
        target, chunkIndex, content: serialized, digest: hash(serialized), complete };
};

async function fixture() {
    const temporary = await mkdtemp(join(tmpdir(), 'dope-incremental-stack-'));
    const root = join(temporary, 'project');
    await execute('git', ['clone', '-q', '--local', '--no-hardlinks', '--no-checkout', process.cwd(), root]);
    await execute('git', ['-C', root, 'read-tree', 'HEAD']);
    await execute('git', ['-C', root, 'sparse-checkout', 'init', '--cone']);
    await mkdir(join(root, 'docs/tasks'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{"version":"0.13.11"}\n');
    await writeFile(join(root, 'README.md'), '# Verified source\n');
    const grounder = new ChatProjectGrounder({} as never);
    const read = await grounder.readFile(root, 'README.md');
    const sourceRef = { ...read.blocks[0].ref, kind: 'file' as const };
    const assessment = { id: randomUUID(), content: '# Unpublished prompt assessment\n\nDraft only. This command did not change project files or start Work.\n\nAssessment details.',
        execution: { sourceRefs: [sourceRef] } } as never;
    const plan = { id: randomUUID(), content: '# Unpublished prompt plan\n\nDraft only. This command did not change project files or start Work.\n\nPlan details.',
        execution: { sourceRefs: [sourceRef] } } as never;
    const basis = await capturePromptSourceEvidence(root);
    const repo = new ChatRepository(), chatId = randomUUID(), messageId = randomUUID();
    await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'owner');
    if (!lease.acquired) throw new Error('Fixture lease unavailable');
    const identity = { root, chatId, messageId, leaseToken: lease.token, ownerId: 'owner',
        worktreeId: basis.worktreeFingerprint, sourceBasis: `${basis.head}:${basis.packageVersion}:${basis.worktreeFingerprint}`,
        domain: 'prompt' as const };
    const authority = async () => {
        const current = await capturePromptSourceEvidence(root);
        return { worktreeId: current.worktreeFingerprint,
            sourceBasis: `${current.head}:${current.packageVersion}:${current.worktreeFingerprint}` };
    };
    const handler = new IncrementalPromptStack(root, 'c13-incremental-fixture', '0.13.11',
        { assessment, plan }, grounder, 1, basis);
    const controller = new IncrementalProposalController(repo, identity, authority, handler);
    await controller.begin();
    return { temporary, root, controller, basis, handler, grounder, assessment, plan,
        repo, identity, authority,
        dispose: () => rm(temporary, { recursive: true, force: true }) };
}

function work(index: number, dependency?: string) {
    return { kind: 'work', id: `step-${index}`, title: `Implement verified feature ${index}`,
        objective: `Implement source bound feature ${index} in the inspected project`,
        tier: index === 10 ? 'T2' : 'T1', dependsOn: dependency ? [dependency] : [],
        workingSet: [`src/feature-${index}.ts`],
        requirements: [`Preserve source bound behavior for feature ${index}`],
        constraints: ['Do not run Work before the owner starts the task'],
        acceptanceCriteria: [`Feature ${index} produces its expected result on the inspected source`],
        validationTargets: [`Run test/unit/feature-${index}.test.ts for the changed behavior`],
        ...(index === 10 ? { integrationChecks: ['Run the affected feature integration suite'] } : {}) };
}
const closeout = { kind: 'closeout', title: 'Manual feature closeout',
    objective: 'Inspect the final feature in the real browser', manualReason: 'Human interaction needs observation',
    acceptanceCriteria: ['Observe all ten features in the real browser'], browserRequired: true,
    efficiencyAudit: Array.from({ length: 10 }, (_, index) => `Gate ${index + 1} checks the specific fixture prompts and the verified source basis.`) };

test('ten substantial staged prompts seal exact bytes and remain absent until native guarded publication', async () => {
    const f = await fixture();
    try {
        let sequence = 1, revision = 0;
        for (let index = 1; index <= 10; index++) {
            const id = `step-${index}`;
            const first = stage(sequence++, revision++, id, 0, work(index, index > 1 ? `step-${index - 1}` : undefined), false);
            await f.controller.stage(first, 'prompt');
            if (index === 1) assert.equal((await f.controller.stage(first, 'prompt')).revision, 1);
            const detail = { kind: 'section', heading: `Detailed feature ${index} procedure`,
                text: Array.from({ length: 90 }, (_, line) =>
                    `- Verify feature ${index} condition ${line + 1} against the observed source and focused test.`).join('\n') };
            await f.controller.stage(stage(sequence++, revision++, id, 1, detail), 'prompt');
        }
        await f.controller.stage(stage(sequence++, revision++, 'closeout', 0, closeout), 'prompt');
        const handoff = await f.controller.finish({ finalMessage: 'The complete stack is ready for review.' });
        const proposal = handoff.candidate;
        validatePromptStackProposal(proposal);
        assert.equal(proposal.files.length, 14);
        assert.equal(proposal.revision, 1);
        assert.deepEqual(proposal.files.slice(3).map(file => Number(/\/P(\d+)-/u.exec(file.path)?.[1])),
            Array.from({ length: 11 }, (_, index) => index + 1));
        assert.match(proposal.files[3].after, /condition 90/);
        assert.match(proposal.files.at(-1)!.path, /P11-manual-feature-closeout\.txt$/u);
        assert.deepEqual(proposal.files.map(file => file.afterHash), proposal.files.map(file => hash(file.after)));
        assert.equal(parsePlanningActivity({ schemaVersion: 1, kind: 'prompt-stack-proposal',
            status: 'pending', refs: [], proposalId: proposal.id,
            promptStackProposal: proposal }).promptStackProposal?.digest, proposal.digest);
        assert.match(proposal.files[2].after, /## Prompt Efficiency Gate/);
        await assert.rejects(stat(join(f.root, 'docs/tasks/c13-incremental-fixture')), /ENOENT/);
        const imported = await importPhaseStack('c13-incremental-fixture', proposal.files.slice(3).map(file =>
            ({ filename: file.path.split('/').at(-1)!, text: file.after })));
        assert.equal(imported.entries.length, 11);
        const publisher = new PlanningStackPublication(async () => { throw new Error('Bridge authority must not be used'); });
        assert.equal((await publisher.publishNative(f.root, proposal)).status, 'published');
        for (const file of proposal.files)
            assert.equal(await readFile(join(f.root, file.path), 'utf8'), file.after);
        const discovered = (await discoverRoadmapTaskStacks(f.root)).find(item => item.folderName === proposal.folder);
        assert.equal(discovered?.prompts.length, 11);
        assert.equal(discovered?.executable, false);
    } finally { await f.dispose(); }
});

test('malformed, duplicate, unordered and stale stages fail without publishing a partial stack', async () => {
    const f = await fixture();
    try {
        await assert.rejects(f.controller.stage(stage(1, 0, 'closeout', 0, closeout), 'prompt'), /CLOSEOUT_STAGE/);
        await assert.rejects(f.controller.stage(stage(1, 0, 'step-1', 0, { ...work(1), title: '' }), 'prompt'), /WORK_STAGE/);
        await assert.rejects(f.controller.stage(stage(1, 0, 'step-1', 0, work(1, 'step-2')), 'prompt'), /DEPENDENCY_ORDER/);
        await f.controller.stage(stage(1, 0, 'step-1', 0, work(1)), 'prompt');
        await assert.rejects(f.controller.stage(stage(2, 1, 'step-1', 1, work(1)), 'prompt'), /CHUNK_ORDER/);
        await assert.rejects(f.controller.stage(stage(2, 1, 'closeout', 0,
            { ...closeout, efficiencyAudit: [] }), 'prompt'), /CLOSEOUT_STAGE/);
        await assert.rejects(f.controller.stage(stage(2, 1, 'step-2', 0, work(2, 'step-3')), 'prompt'), /DEPENDENCY_ORDER/);
        await assert.rejects(f.controller.finish({ finalMessage: 'Ready' }), /INCOMPLETE_STACK/);
        await writeFile(join(f.root, 'README.md'), '# Changed source\n');
        await assert.rejects(verifyPromptDraftSource(f.root, f.assessment, f.grounder), /changed/);
        await assert.rejects(verifyPromptDraftSource(f.root, f.plan, f.grounder), /changed/);
        await assert.rejects(f.controller.stage(stage(2, 1, 'step-2', 0, work(2, 'step-1')), 'prompt'), /STALE_SOURCE/);
        await assert.rejects(stat(join(f.root, 'docs/tasks/c13-incremental-fixture')), /ENOENT/);
    } finally { await f.dispose(); }
});

test('failed revision leaves the prior exact candidate intact until a complete replacement seals', async () => {
    const f = await fixture();
    try {
        await f.controller.stage(stage(1, 0, 'step-1', 0, work(1)), 'prompt');
        await f.controller.stage(stage(2, 1, 'step-2', 0, { ...work(2, 'step-1'), tier: 'T2',
            integrationChecks: ['Run the affected feature integration suite'] }), 'prompt');
        await f.controller.stage(stage(3, 2, 'closeout', 0, closeout), 'prompt');
        const first = (await f.controller.finish({ finalMessage: 'First candidate.' })).candidate;
        const nextIdentity = { ...f.identity, messageId: randomUUID() };
        const nextHandler = new IncrementalPromptStack(f.root, 'c13-incremental-fixture', '0.13.11',
            { assessment: f.assessment, plan: f.plan }, f.grounder, 2, f.basis);
        const next = new IncrementalProposalController(f.repo, nextIdentity, f.authority, nextHandler);
        await next.begin();
        await next.stage(stage(1, 0, 'step-1', 0, { ...work(1), title: 'Revised verified feature one' }), 'prompt');
        await assert.rejects(next.finish({ finalMessage: 'Incomplete revision.' }), /INCOMPLETE_STACK/);
        validatePromptStackProposal(first);
        await assert.rejects(stat(join(f.root, 'docs/tasks/c13-incremental-fixture')), /ENOENT/);
        await next.stage(stage(2, 1, 'step-2', 0, { ...work(2, 'step-1'), tier: 'T2',
            integrationChecks: ['Run the affected feature integration suite'] }), 'prompt');
        await next.stage(stage(3, 2, 'closeout', 0, closeout), 'prompt');
        const second = (await next.finish({ finalMessage: 'Replacement candidate.' })).candidate;
        assert.equal(second.revision, 2);
        assert.notEqual(second.digest, first.digest);
        assert.match(second.files[3].after, /Revised verified feature one/);
        assert.doesNotMatch(first.files[3].after, /Revised verified feature one/);
        await assert.rejects(stat(join(f.root, 'docs/tasks/c13-incremental-fixture')), /ENOENT/);
    } finally { await f.dispose(); }
});
