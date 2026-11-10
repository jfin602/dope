import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { newPromptDraftIdentity, validatedPlan } from '../../packages/theia-extension/lib/node/prompt-authoring-stage.js';
import { PromptDraftStore } from '../../packages/theia-extension/lib/node/prompt-draft-store.js';
import { IncrementalAssessment } from '../../packages/theia-extension/lib/node/incremental-assessment.js';
import { capturePromptSourceEvidence } from '../../packages/theia-extension/lib/node/prompt-stack-proposal.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const execute = promisify(execFile);
const basis = { head: 'a'.repeat(40), packageVersion: '0.13.11', worktreeFingerprint: 'b'.repeat(64) };

async function fixture(run: (value: Awaited<ReturnType<typeof setup>>) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'dope-named-stage-'));
    try { await run(await setup(root)); }
    finally { await rm(root, { recursive: true, force: true }); }
}
async function setup(root: string) {
    const repo = new ChatRepository(), grounder = new ChatProjectGrounder({} as never);
    const chatId = randomUUID(), userMessageId = randomUUID();
    const created = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
    const lease = await repo.claim(root, chatId, 'owner');
    if (!lease.acquired) throw new Error('No Chat lease');
    const identity = newPromptDraftIdentity('safe-task', root, chatId, userMessageId, lease.token,
        basis.head, basis.packageVersion, basis.worktreeFingerprint);
    await repo.mutate(root, created.revision, { type: 'append-user', chatId, message: {
        schemaVersion: 1, id: userMessageId, role: 'user', createdAt: new Date().toISOString(),
        content: '/prompt-ass safe-task Check README', contextRefs: [], promptDraft: identity
    } }, lease.token);
    await writeFile(join(root, 'README.md'), 'source one\n');
    const page = await grounder.readFile(root, 'README.md');
    const refs = [{ id: 'README.md', sourceHash: page.blocks[0].ref.sourceHash,
        contentHash: page.blocks[0].ref.contentHash, projectId: hash(root) }];
    let current = basis;
    const sourceEvidence = async () => current;
    const store = new PromptDraftStore(repo, grounder, sourceEvidence);
    return { root, repo, grounder, chatId, lease: lease.token, identity, refs, store,
        changeBasis: () => { current = { ...basis, worktreeFingerprint: 'c'.repeat(64) }; },
        restoreBasis: () => { current = basis; } };
}

test('wireframe Assessment persists one relevant read, stable count and checked source claims', () => fixture(async v => {
    const controller = new IncrementalAssessment(v.repo, v.grounder, v.root, v.identity,
        v.lease, '/prompt-ass safe-task Build 2 work prompts for README.md', v.store);
    await controller.begin();
    const page = await v.grounder.readFileRange(v.root, 'README.md', 0, 4096);
    await controller.readPage(page);
    const refs = [{ kind: 'file', id: 'README.md', origin: 'tool', projectId: hash(v.root),
        sourceHash: page.sourceHash, start: page.offset, end: page.endOffset }] as never;
    const evidence = [{ path: 'README.md', start: page.offset, end: page.endOffset,
        sourceHash: page.sourceHash, text: page.text }];
    const base = { kind: 'wireframe', objective: 'Improve the documented feature', count: 2,
        rationale: 'The source change and integration check have distinct boundaries',
        work: [{ id: 'step-1', title: 'Implement behavior', objective: 'Change the feature',
            boundary: 'Source behavior', dependsOn: [] },
            { id: 'step-2', title: 'Integrate behavior', objective: 'Check the feature path',
                boundary: 'Integration', dependsOn: ['step-1'] }],
        constraints: ['Preserve source identity'], deferrals: ['Detailed checks belong in Plan'],
        closeout: { title: 'Manual closeout', objective: 'Observe the feature',
            manualReason: 'Human review is separate' },
        sourceClaims: [{ claim: 'README has source one', path: 'README.md', quote: 'source one' }] };
    await assert.rejects(controller.stage({ ...base, count: 1 }, refs, evidence), /COUNT/);
    await assert.rejects(controller.stage({ ...base, sourceClaims: [{ ...base.sourceClaims[0],
        quote: 'invented' }] }, refs, evidence), /UNSUPPORTED_SOURCE/);
    await assert.rejects(controller.stage({ ...base, work: [base.work[1], base.work[0]] }, refs,
        evidence), /STEP/);
    assert.equal((await controller.stage(base, refs, evidence)).idempotent, false);
    assert.equal((await controller.stage(base, refs, evidence)).idempotent, true);
    await assert.rejects(controller.stage({ ...base, rationale: 'Different division' }, refs,
        evidence), /CONFLICTING_REPLAY/);
    const completed = await controller.finish();
    assert.equal(completed.record.count, 2);
    assert.equal((await controller.status()).finishReady, true);
    assert.match(await v.store.assessmentView(v.root, v.identity, v.lease), /Work prompts \(2\)/);
    await assert.rejects(lstat(join(v.root, 'docs', 'tasks', 'safe-task')), /ENOENT/);
    await assert.rejects(controller.stage(base, refs, evidence), /STAGE_SEALED/);
    await writeFile(join(v.root, 'README.md'), 'changed source');
    await assert.rejects(controller.status(), /SOURCE_DRIFT|source changed/i);
}));

test('source-neutral wireframe seals without a token read while source basis stays pinned', () => fixture(async v => {
    const controller = new IncrementalAssessment(v.repo, v.grounder, v.root, v.identity,
        v.lease, '/prompt-ass safe-task Use one work prompt to clarify a process', v.store);
    await controller.begin();
    const wireframe = { kind: 'wireframe', objective: 'Clarify the process', count: 1,
        rationale: 'One bounded writing task is sufficient',
        work: [{ id: 'step-1', title: 'Clarify process', objective: 'Write concise guidance',
            boundary: 'Process wording', dependsOn: [] }], constraints: [], deferrals: [],
        closeout: { title: 'Manual closeout', objective: 'Review the guidance',
            manualReason: 'Human review is distinct' }, sourceClaims: [] };
    assert.equal((await controller.stage(wireframe, [], [])).accepted, true);
    const sealed = await controller.finish();
    assert.equal(sealed.refs.length, 0);
    assert.equal((await v.store.read(v.root, v.identity, v.lease)).assessment?.sourceRefs.length, 0);
    v.changeBasis();
    await assert.rejects(controller.status(), /source changed/i);
}));

test('reviewed Assessment candidate preserves the old Plan until Accept, then invalidates it atomically', () => fixture(async v => {
    const outline = (count: number) => ({ kind: 'wireframe' as const, objective: 'Improve feature', count,
        rationale: 'Split by independent responsibilities',
        work: Array.from({ length: count }, (_, index) => ({ id: `step-${index + 1}`,
            title: `Task ${index + 1}`, objective: `Implement task ${index + 1}`,
            boundary: `Boundary ${index + 1}`, dependsOn: index ? [`step-${index}`] : [] })),
        constraints: [], deferrals: [], closeout: { title: 'Manual closeout',
            objective: 'Observe behavior', manualReason: 'Human check' }, sourceClaims: [] });
    await v.store.begin(v.root, v.identity, v.lease);
    const v1 = await v.store.stage(v.root, v.identity, v.lease, 'assessment', 0, outline(3), []);
    const planned = await v.store.stage(v.root, v.identity, v.lease, 'plan', v1.revision,
        { work: [{ id: 'step-1' }] }, v.refs);
    const messageId = randomUUID();
    const candidate = await v.store.proposeAssessment(v.root, v.identity, v.lease, 1,
        messageId, outline(4), []);
    assert.equal((candidate.assessment?.record as { count: number }).count, 3);
    assert.equal(candidate.plan?.contentHash, planned.plan?.contentHash);
    assert.equal((candidate.pendingAssessment?.value.record as { count: number }).count, 4);
    await assert.rejects(v.store.proposeAssessment(v.root, v.identity, v.lease, 1,
        randomUUID(), outline(4), []), /STAGE_STALE/);
    await assert.rejects(v.store.decideAssessment(v.root, v.identity, v.lease, messageId,
        '0'.repeat(64), 'accept'), /STAGE_STALE/);
    const rejected = await v.store.decideAssessment(v.root, v.identity, v.lease, messageId,
        candidate.pendingAssessment!.value.contentHash, 'reject');
    assert.equal(rejected.plan?.contentHash, planned.plan?.contentHash);
    assert.equal(rejected.assessment?.revision, 1);
    const nextId = randomUUID();
    const next = await v.store.proposeAssessment(v.root, v.identity, v.lease, 1,
        nextId, outline(4), []);
    v.changeBasis();
    await assert.rejects(v.store.decideAssessment(v.root, v.identity, v.lease, nextId,
        next.pendingAssessment!.value.contentHash, 'accept'), /source changed/i);
    v.restoreBasis();
    const accepted = await v.store.decideAssessment(v.root, v.identity, v.lease, nextId,
        next.pendingAssessment!.value.contentHash, 'accept');
    assert.equal(accepted.identity.id, v.identity.id);
    assert.equal(accepted.identity.slug, v.identity.slug);
    assert.equal(accepted.assessment?.revision, 2);
    assert.equal((accepted.assessment?.record as { count: number }).count, 4);
    assert.equal(accepted.plan, undefined);
    assert.equal(accepted.history.find(item => item.stage === 'assessment')?.value.contentHash,
        v1.assessment?.contentHash);
    assert.equal(accepted.history.find(item => item.stage === 'plan')?.value.contentHash,
        planned.plan?.contentHash);
    await assert.rejects(v.store.decideAssessment(v.root, v.identity, v.lease, nextId,
        next.pendingAssessment!.value.contentHash, 'accept'), /STAGE_STALE/);
    await assert.rejects(lstat(join(v.root, 'docs', 'tasks', v.identity.slug)), /ENOENT/);
}));

test('historical partial category drafts remain stored but cannot seal as new wireframes', () => fixture(async v => {
    const controller = new IncrementalAssessment(v.repo, v.grounder, v.root, v.identity,
        v.lease, '/prompt-ass safe-task Inspect README.md', v.store);
    await controller.begin();
    await v.store.updatePartialAssessment(v.root, v.identity, v.lease, 0, {
        requested: ['README.md'], pages: [], blocked: {}, findings: {
            observations: [], preservation: [], dependencies: [], risks: [] },
        emptyReasons: {}, scope: 'Historical scope' });
    await assert.rejects(controller.stage({ kind: 'wireframe' }, [], []), /LEGACY_DRAFT/);
    await assert.rejects(controller.finish(), /WIREFRAME_INCOMPLETE/);
    assert.equal((await v.store.read(v.root, v.identity, v.lease)).partialAssessment?.scope,
        'Historical scope');
}));

test('named stages persist atomically with revisions, broker hashes and dependency invalidation', () => fixture(async v => {
    const first = await v.store.begin(v.root, v.identity, v.lease);
    assert.equal(first.revision, 0);
    await assert.rejects(v.store.begin(v.root, v.identity, v.lease), /already started/);
    const assessment = await v.store.stage(v.root, v.identity, v.lease, 'assessment', 0,
        { scope: 'Source checked', count: 2 }, v.refs);
    assert.equal(assessment.assessment?.contentHash, hash('{"count":2,"scope":"Source checked"}'));
    await assert.rejects(v.store.stage(v.root, v.identity, v.lease, 'plan', 1,
        { details: 'x'.repeat(129_000) }, v.refs), /oversized/);
    assert.equal((await v.store.read(v.root, v.identity, v.lease)).revision, 1);
    assert.equal((await new PromptDraftStore(new ChatRepository(), new ChatProjectGrounder({} as never),
        async () => basis).read(v.root, v.identity, v.lease)).revision, 1);
    const plan = await v.store.stage(v.root, v.identity, v.lease, 'plan', 1,
        { steps: [{ id: 'one' }] }, v.refs);
    assert.equal(plan.plan?.dependencyHash, assessment.assessment?.contentHash);
    await assert.rejects(v.store.stage(v.root, v.identity, v.lease, 'plan', 1, { steps: [] }, v.refs), /Stale/);
    const revised = await v.store.stage(v.root, v.identity, v.lease, 'assessment', 2,
        { scope: 'Revised' }, v.refs);
    assert.equal(revised.plan, undefined);
    assert.equal(revised.history.length, 2);
    assert.equal((await v.store.read(v.root, v.identity, v.lease)).assessment?.revision, 2);
    assert.equal((await readFile(join(v.root, 'README.md'), 'utf8')), 'source one\n');
    await assert.rejects(lstat(join(v.root, 'docs', 'tasks', 'safe-task')), /ENOENT/);
    assert.deepEqual((await v.repo.read(v.root)).chats[0].messages.map(item => item.role), ['user']);
}));

test('foreign lease, project, source drift, abort and canonical case collision fail closed', () => fixture(async v => {
    await assert.rejects(v.store.begin(v.root, v.identity, 'foreign'), /lease/);
    await assert.rejects(v.store.begin(v.root, { ...v.identity, projectId: 'f'.repeat(64) }, v.lease),
        /identity|project/);
    await v.store.begin(v.root, v.identity, v.lease);
    v.changeBasis();
    await assert.rejects(v.store.read(v.root, v.identity, v.lease), /source changed/);
    v.restoreBasis();
    await writeFile(join(v.root, 'README.md'), 'changed source\n');
    await assert.rejects(v.store.stage(v.root, v.identity, v.lease, 'assessment', 0,
        { scope: 'stale' }, v.refs), /source changed/);
    await writeFile(join(v.root, 'README.md'), 'source one\n');
    assert.equal((await v.store.abort(v.root, v.identity, v.lease, 0)).state, 'aborted');
    await assert.rejects(v.store.read(v.root, v.identity, v.lease), /aborted/);
    await mkdir(join(v.root, 'docs', 'tasks'), { recursive: true });
    await mkdir(join(v.root, 'docs', 'tasks', 'SAFE-TASK'));
    await assert.rejects(v.store.begin(v.root, v.identity, v.lease), /collides/);
}));

test('same slug cannot be claimed by a second Chat and a late accepted folder blocks stages', () => fixture(async v => {
    const first = await v.store.begin(v.root, v.identity, v.lease);
    const next = await v.repo.mutate(v.root, (await v.repo.read(v.root)).revision,
        { type: 'create-chat', id: randomUUID(), folderPath: '' });
    const second = next.chats[1].id;
    const otherLease = await v.repo.claim(v.root, second, 'competing-owner');
    if (!otherLease.acquired) throw new Error('Competing lease missing');
    const duplicate = newPromptDraftIdentity('safe-task', v.root, second, randomUUID(), otherLease.token,
        basis.head, basis.packageVersion, basis.worktreeFingerprint);
    await assert.rejects(v.repo.mutate(v.root, next.revision, { type: 'append-user', chatId: second,
        message: { schemaVersion: 1, id: duplicate.userMessageId, role: 'user',
            createdAt: new Date().toISOString(), content: '/prompt-ass safe-task duplicate',
            contextRefs: [], promptDraft: duplicate } }, otherLease.token), /already exists/);
    await mkdir(join(v.root, 'docs', 'tasks', 'safe-task'), { recursive: true });
    await assert.rejects(v.store.stage(v.root, v.identity, v.lease, 'assessment', first.revision,
        { scope: 'Too late' }, v.refs), /collides/);
}));

test('a reclaimed Chat lease can explicitly reopen intact stages after restart', () => fixture(async v => {
    await v.store.begin(v.root, v.identity, v.lease);
    await v.store.stage(v.root, v.identity, v.lease, 'assessment', 0, { scope: 'Durable' }, v.refs);
    await v.repo.release(v.root, v.chatId, v.lease);
    const reclaimed = await new ChatRepository().claim(v.root, v.chatId, 'owner-after-restart');
    if (!reclaimed.acquired) throw new Error('Reclaim failed');
    await assert.rejects(v.store.read(v.root, v.identity, v.lease), /lease/);
    const saved = await new PromptDraftStore(new ChatRepository(), new ChatProjectGrounder({} as never),
        async () => basis).read(v.root, v.identity, reclaimed.token);
    assert.equal(saved.assessment?.record.scope, 'Durable');
    assert.equal(saved.revision, 1);
}));

test('saved structured assessment renders after restart without model or canonical task files', () => fixture(async v => {
    await v.store.begin(v.root, v.identity, v.lease);
    const finding = { claim: 'The source exists', path: 'README.md', start: 0, end: 6,
        quote: 'source', sourceHash: v.refs[0].sourceHash };
    await v.store.stage(v.root, v.identity, v.lease, 'assessment', 0,
        { scope: 'Review source', observations: [finding], preservation: [finding],
            dependencies: [finding], risks: [finding],
            tiers: { T1: 'Focused unit checks', T2: 'Integration checks',
                T3: 'Independent browser review' }, omittedRequestedFiles: ['AGENTS.md'] },
        v.refs.map(ref => ({ ...ref, start: 0, end: 11 })));
    const reopened = new PromptDraftStore(new ChatRepository(), new ChatProjectGrounder({} as never),
        async () => basis);
    assert.match(await reopened.assessmentView(v.root, v.identity, v.lease), /Requested files not read\nAGENTS\.md/);
    await assert.rejects(lstat(join(v.root, 'docs', 'tasks', 'safe-task')), /ENOENT/);
}));

test('checked plan projection comes from durable noncanonical record', () => fixture(async v => {
    await v.store.begin(v.root, v.identity, v.lease);
    const assessed = await v.store.stage(v.root, v.identity, v.lease, 'assessment', 0,
        { scope: 'Source checked' }, v.refs);
    const record = { work: [{ id: 'step-1', title: 'Implement feature',
        objective: 'Implement source-bound feature', tier: 'T1', dependsOn: [],
        workingSet: ['README.md'], validationTargets: ['Run focused source test'],
        buildNeeds: 'none', acceptanceCriteria: ['Feature behaves as requested'] }],
        closeout: { title: 'Manual closeout', objective: 'Observe feature',
            manualReason: 'Requires human observation', browserRequired: true, tier: 'T3',
            acceptanceCriteria: ['Observe feature'] },
        efficiencyAudit: Array.from({ length: 10 }, (_, index) => `Gate ${index + 1} checked`) };
    await v.store.stage(v.root, v.identity, v.lease, 'plan', assessed.revision, record, v.refs);
    const reopened = new PromptDraftStore(new ChatRepository(), new ChatProjectGrounder({} as never),
        async () => basis);
    assert.match(await reopened.planView(v.root, v.identity, v.lease), /step-1 \(T1\): Implement feature/);
    await assert.rejects(lstat(join(v.root, 'docs', 'tasks', 'safe-task')), /ENOENT/);
}));

test('checked one and three step Plans persist against the exact wireframe hash', () => fixture(async v => {
    await writeFile(join(v.root, 'feature.test.ts'), 'test feature source\n');
    const source = await v.grounder.readFileRange(v.root, 'README.md', 0, 4096);
    const testPage = await v.grounder.readFileRange(v.root, 'feature.test.ts', 0, 4096);
    const refs = [source, testPage].map(page => ({ kind: 'file', origin: 'tool', id: page.path,
        sourceHash: page.sourceHash, projectId: hash(v.root),
        start: page.offset, end: page.endOffset })) as never;
    const evidence = [source, testPage].map(page => ({ path: page.path, start: page.offset,
        end: page.endOffset, sourceHash: page.sourceHash, text: page.text }));
    const audit = ['Single responsibility per step', 'Runtime 8 minutes, soft 10, hard 15',
        'Test precision uses focused feature tests', 'Build precision uses no compiled output',
        'Evidence distribution reserves manual T3', 'Command deduplication avoids repeats',
        'Model economy defers unrelated work', 'Runnable traceable grammar and version',
        'UI design ADR 0016 theme tokens: non-UI not applicable',
        'Human usability ADR 0037 keyboard recovery: non-UI not applicable'];
    for (const count of [1, 3]) {
        const outline = Array.from({ length: count }, (_, index) => ({ id: `step-${index + 1}`,
            title: `Feature step ${index + 1}`, objective: `Implement feature step ${index + 1}`,
            boundary: `Source step ${index + 1}`, dependsOn: index ? [`step-${index}`] : [] }));
        const wireframe = { kind: 'wireframe', objective: 'Improve feature', count,
            rationale: 'Bounded slices', work: outline, constraints: [], deferrals: [],
            closeout: { title: 'Manual closeout', objective: 'Observe feature',
                manualReason: 'Human review' }, sourceClaims: [] };
        const store = count === 1 ? v.store : new PromptDraftStore(v.repo, v.grounder,
            async () => basis);
        if (count === 1) await store.begin(v.root, v.identity, v.lease);
        const current = await store.read(v.root, v.identity, v.lease);
        const assessed = await store.stage(v.root, v.identity, v.lease, 'assessment',
            current.revision, wireframe, refs);
        const candidate = { work: outline.map(step => ({ id: step.id, title: step.title,
            assessmentObjective: step.objective, boundary: step.boundary,
            objective: `Implement bounded feature in ${step.id}`, tier: 'T1',
            dependsOn: step.dependsOn, workingSet: ['README.md'],
            requirements: ['Use source one'], preservedBehavior: ['Keep source one'],
            risks: ['Regression in feature'], deferrals: [],
            validationTargets: ['Run feature.test.ts'], buildNeeds: 'none',
            acceptanceCriteria: ['Feature works'], sourceClaims: [{ claim: 'README has source one',
                path: 'README.md', quote: 'source one' }], estimatedMinutes: 6 })),
            closeout: { title: 'Manual closeout', objective: 'Observe feature',
                manualReason: 'Human review', browserRequired: true, tier: 'T3',
                acceptanceCriteria: ['Observe result'] }, efficiencyAudit: audit };
        const plan = validatedPlan(JSON.stringify(candidate), wireframe as never,
            refs, count, evidence);
        const saved = await store.stage(v.root, v.identity, v.lease, 'plan', assessed.revision,
            plan as never, refs);
        assert.equal(saved.plan?.dependencyHash, saved.assessment?.contentHash);
        assert.equal((saved.plan?.record.work as unknown[]).length, count);
        assert.match(await store.planView(v.root, v.identity, v.lease), /Requirements: Use source one/);
        await assert.rejects(store.stage(v.root, v.identity, v.lease, 'plan', assessed.revision,
            plan as never, refs), /Stale/);
        assert.equal((await store.read(v.root, v.identity, v.lease)).plan?.contentHash,
            saved.plan?.contentHash);
    }
    await assert.rejects(lstat(join(v.root, 'docs', 'tasks', 'safe-task')), /ENOENT/);
}));

test('unsafe task parent and draft staging symlink are rejected without writing outside', () => fixture(async v => {
    await symlink(tmpdir(), join(v.root, 'docs'));
    await assert.rejects(v.store.begin(v.root, v.identity, v.lease), /Unsafe Chat directory/);
    await rm(join(v.root, 'docs'));
    const staging = join(v.root, '.dope', 'chats', '.proposal-staging');
    await symlink(tmpdir(), staging);
    await assert.rejects(v.store.begin(v.root, v.identity, v.lease), /Unsafe Chat directory/);
    assert.equal((await readdir(join(v.root, '.dope', 'chats'))).includes('.drafts'), false);
}));

test('replaced draft file is rejected before update and the saved snapshot can be recovered', () => fixture(async v => {
    await v.store.begin(v.root, v.identity, v.lease);
    const file = join(v.root, '.dope', 'chats', '.proposal-staging',
        `${v.chatId}.${v.identity.userMessageId}.draft.json`);
    const original = await readFile(file);
    await rm(file);
    await symlink(join(v.root, 'README.md'), file);
    await assert.rejects(v.store.stage(v.root, v.identity, v.lease, 'assessment', 0,
        { scope: 'Unsafe' }, v.refs), /Unsafe Chat file/);
    assert.equal(await readFile(join(v.root, 'README.md'), 'utf8'), 'source one\n');
    await rm(file);
    await writeFile(file, original);
    assert.equal((await v.store.read(v.root, v.identity, v.lease)).revision, 0);
}));

test('two project-bound drafts stay noncanonical across restart, concurrent stage and real source drift', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'dope-draft-chain-'));
    const roots = [join(temporary, 'first'), join(temporary, 'second')];
    try {
        for (const root of roots) {
            await execute('git', ['clone', '-q', '--local', '--no-hardlinks', '--no-checkout', process.cwd(), root]);
            await execute('git', ['-C', root, 'read-tree', 'HEAD']);
            await execute('git', ['-C', root, 'sparse-checkout', 'init', '--cone']);
            await writeFile(join(root, '.gitignore'), await readFile(join(process.cwd(), '.gitignore')));
            await mkdir(join(root, 'src'));
            await writeFile(join(root, 'src', 'feature.js'), 'export const feature = true;\n');
            await writeFile(join(root, 'package.json'), '{"name":"draft-fixture","version":"0.13.11"}\n');
            await mkdir(join(root, 'docs', 'tasks'), { recursive: true });
        }
        const repo = new ChatRepository(), grounder = new ChatProjectGrounder({} as never);
        const drafts = [];
        for (const [index, root] of roots.entries()) {
            const source = await capturePromptSourceEvidence(root);
            const chatId = randomUUID(), userMessageId = randomUUID();
            await repo.mutate(root, (await repo.read(root)).revision,
                { type: 'create-chat', id: chatId, folderPath: '' });
            const lease = await repo.claim(root, chatId, 'owner');
            if (!lease.acquired) throw new Error('Chat lease missing');
            const identity = newPromptDraftIdentity(index ? 'second-task' : 'first-task', root,
                chatId, userMessageId, lease.token, source.head, source.packageVersion,
                source.worktreeFingerprint);
            await repo.mutate(root, (await repo.read(root)).revision, { type: 'append-user', chatId,
                message: { schemaVersion: 1, id: userMessageId, role: 'user',
                    createdAt: new Date().toISOString(), content: `/prompt-ass ${identity.slug} Review source`,
                    contextRefs: [], promptDraft: identity } }, lease.token);
            const page = await grounder.readFile(root, 'src/feature.js');
            const refs = [{ id: 'src/feature.js', sourceHash: page.blocks[0].ref.sourceHash,
                contentHash: page.blocks[0].ref.contentHash, projectId: hash(root) }];
            const store = new PromptDraftStore(repo, grounder);
            await store.begin(root, identity, lease.token);
            drafts.push({ root, identity, lease: lease.token, refs, store, source });
        }
        const first = drafts[0], second = drafts[1];
        const competing = await Promise.allSettled([
            first.store.stage(first.root, first.identity, first.lease, 'assessment', 0,
                { scope: 'First accepted' }, first.refs),
            first.store.stage(first.root, first.identity, first.lease, 'assessment', 0,
                { scope: 'Competing revision' }, first.refs)
        ]);
        assert.deepEqual(competing.map(result => result.status).sort(), ['fulfilled', 'rejected']);
        assert.equal((await second.store.stage(second.root, second.identity, second.lease,
            'assessment', 0, { scope: 'Second project' }, second.refs)).revision, 1);
        assert.equal((await capturePromptSourceEvidence(first.root)).worktreeFingerprint,
            first.source.worktreeFingerprint);
        const status = (await execute('git', ['-C', first.root, 'status', '--porcelain=v1',
            '--untracked-files=all'])).stdout;
        assert.doesNotMatch(status, /\.dope|first-task/u);
        assert.equal((await discoverRoadmapTaskStacks(first.root)).length, 0);
        assert.doesNotMatch((await grounder.listDirectory(first.root, 'docs/tasks')).blocks
            .map(block => block.text).join('\n'), /first-task|\.dope/u);
        const reopened = new PromptDraftStore(new ChatRepository(), new ChatProjectGrounder({} as never));
        assert.equal((await reopened.read(first.root, first.identity, first.lease)).revision, 1);
        await assert.rejects(reopened.read(second.root, first.identity, first.lease), /project|identity|lease/u);
        await writeFile(join(first.root, 'src', 'feature.js'), 'export const feature = false;\n');
        assert.notEqual((await capturePromptSourceEvidence(first.root)).worktreeFingerprint,
            first.source.worktreeFingerprint);
        await assert.rejects(reopened.read(first.root, first.identity, first.lease), /source changed/u);
        assert.equal((await reopened.read(second.root, second.identity, second.lease)).revision, 1);
    } finally { await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }); }
});
