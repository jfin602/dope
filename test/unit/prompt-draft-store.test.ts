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
import { newPromptDraftIdentity } from '../../packages/theia-extension/lib/node/prompt-authoring-stage.js';
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

test('incremental assessment persists five-file coverage, exact findings and justified empty dependencies', () => fixture(async v => {
    await mkdir(join(v.root, 'src')); await mkdir(join(v.root, 'test')); await mkdir(join(v.root, 'docs'));
    const files = {
        'src/clamp.js': 'export function clamp(value) { return value; }\n',
        'test/clamp.test.js': 'assert.equal(clamp(2), 2);\n',
        'package.json': '{"name":"fixture","dependencies":{}}\n',
        'docs/late-guide.md': `${'early section\n'.repeat(350)}late section requires finite values\n`,
        'RELEASE_NOTES.md': 'Existing scalar clamp remains available.\n'
    };
    for (const [path, content] of Object.entries(files)) await writeFile(join(v.root, path), content);
    const requested = '/prompt-ass safe-task Inspect src/clamp.js test/clamp.test.js package.json docs/late-guide.md including the late section and RELEASE_NOTES.md';
    const controller = new IncrementalAssessment(v.repo, v.grounder, v.root, v.identity,
        v.lease, requested, v.store);
    await controller.begin();
    const refs = [] as never[];
    const evidence = [] as never[];
    const read = async (path: string, all = true) => {
        let offset = 0, expected: string | undefined;
        do {
            const page = await v.grounder.readFileRange(v.root, path, offset, 4096, expected);
            await controller.readPage(page);
            refs.push({ schemaVersion: 1, kind: 'file', id: path, origin: 'tool',
                projectId: hash(v.root), sourceHash: page.sourceHash,
                start: page.offset, end: page.endOffset } as never);
            evidence.push({ path, start: page.offset, end: page.endOffset,
                sourceHash: page.sourceHash, text: page.text } as never);
            expected = page.sourceHash;
            if (!all || page.nextOffset === null) break;
            offset = page.nextOffset;
        } while (true);
    };
    await read('src/clamp.js'); await read('test/clamp.test.js');
    assert.equal((await controller.status()).sources, '2/5 inspected');
    await writeFile(join(v.root, 'src/clamp.js'), 'changed source\n');
    await assert.rejects(controller.status(), /ASSESSMENT_SOURCE_DRIFT/);
    await writeFile(join(v.root, 'src/clamp.js'), files['src/clamp.js']);
    const invalid = controller.stage({ category: 'observations', claim: 'Invented',
        path: 'src/clamp.js', quote: 'not in source' }, refs, evidence);
    await assert.rejects(invalid, /ASSESSMENT_UNSUPPORTED_SOURCE/);
    const finding = { category: 'observations', claim: 'Clamp source exports a function',
        path: 'src/clamp.js', quote: 'export function clamp' };
    await controller.stage(finding, refs, evidence);
    await controller.stage(finding, refs, evidence);
    await assert.rejects(controller.stage({ ...finding, quote: 'clamp' }, refs, evidence),
        /ASSESSMENT_CONFLICTING_REPLAY/);
    await assert.rejects(controller.stage({ category: 'scope', text: 'x'.repeat(1001) },
        refs, evidence), /ASSESSMENT_SCOPE/);
    assert.equal((await controller.status()).findings, 1);
    await assert.rejects(controller.finish(), /ASSESSMENT_SOURCE_COVERAGE/);
    await read('package.json'); await read('docs/late-guide.md', false);
    assert.equal((await controller.status()).sources, '3/5 inspected');
    assert.equal((await controller.status()).required.find(item =>
        item.path === 'docs/late-guide.md')?.state, 'partially inspected');
    await assert.rejects(controller.stage({ category: 'dependencies', reason: 'No dependencies' },
        refs, evidence), /ASSESSMENT_DEPENDENCIES_EMPTY/);
    await read('docs/late-guide.md'); await read('RELEASE_NOTES.md');
    assert.equal((await controller.status()).sources, '5/5 inspected');
    await v.repo.release(v.root, v.chatId, v.lease);
    const claimed = await new ChatRepository().claim(v.root, v.chatId, 'owner-after-restart');
    if (!claimed.acquired) throw new Error('Reclaimed lease missing');
    await assert.rejects(controller.status(), /lease/);
    const reopened = new IncrementalAssessment(new ChatRepository(), v.grounder, v.root,
        v.identity, claimed.token, requested, new PromptDraftStore(new ChatRepository(), v.grounder,
            async () => basis));
    assert.equal((await reopened.status()).findings, 1);
    await assert.rejects(reopened.finish(), /ASSESSMENT_CATEGORY_INCOMPLETE/);
    await reopened.stage({ category: 'preservation', claim: 'Scalar API remains',
        path: 'RELEASE_NOTES.md', quote: 'Existing scalar clamp' }, refs, evidence);
    await reopened.stage({ category: 'risks', claim: 'Late finite-value contract needs tests',
        path: 'docs/late-guide.md', quote: 'late section requires finite values' }, refs, evidence);
    await reopened.stage({ category: 'dependencies', reason: 'Inspected package declares no external dependencies' },
        refs, evidence);
    await reopened.stage({ category: 'scope', text: 'Review clamp behavior and late contract' }, refs, evidence);
    await reopened.stage({ category: 'tiers', T1: 'Focused source unit tests',
        T2: 'Cross-boundary integration checks', T3: 'Independent manual browser qualification' }, refs, evidence);
    const completed = await reopened.finish();
    assert.equal((await reopened.finish()).revision, completed.revision);
    assert.equal(completed.record.omittedRequestedFiles.length, 0);
    assert.equal(completed.record.dependencies.length, 0);
    assert.match(completed.record.emptyReasons?.dependencies ?? '', /no external dependencies/);
    assert.equal((await v.store.read(v.root, v.identity, claimed.token)).assessment?.revision, 1);
    assert.match(await v.store.assessmentView(v.root, v.identity, claimed.token),
        /None: Inspected package declares no external dependencies/);
    await assert.rejects(lstat(join(v.root, 'docs', 'tasks', 'safe-task')), /ENOENT/);
}));

test('a verified package dependency contradicts an empty dependency category', () => fixture(async v => {
    await writeFile(join(v.root, 'package.json'), '{"dependencies":{"actual-package":"1.0.0"}}\n');
    const controller = new IncrementalAssessment(v.repo, v.grounder, v.root, v.identity,
        v.lease, '/prompt-ass safe-task Inspect README.md and package.json', v.store);
    await controller.begin();
    const refs = [] as never[], evidence = [] as never[];
    for (const path of ['README.md', 'package.json']) {
        const page = await v.grounder.readFileRange(v.root, path, 0, 4096);
        await controller.readPage(page);
        refs.push({ kind: 'file', id: path, origin: 'tool', projectId: hash(v.root),
            sourceHash: page.sourceHash, start: page.offset, end: page.endOffset } as never);
        evidence.push({ path, start: page.offset, end: page.endOffset,
            sourceHash: page.sourceHash, text: page.text } as never);
    }
    for (const category of ['observations', 'preservation', 'risks']) await controller.stage({ category,
        claim: 'Source must remain inspectable', path: 'README.md', quote: 'source one' }, refs, evidence);
    await controller.stage({ category: 'dependencies', reason: 'No external dependencies exist' }, refs, evidence);
    await controller.stage({ category: 'scope', text: 'Review package dependency source' }, refs, evidence);
    await controller.stage({ category: 'tiers', T1: 'Focused source unit tests',
        T2: 'Cross-boundary integration checks', T3: 'Independent manual browser qualification' }, refs, evidence);
    await assert.rejects(controller.finish(), /ASSESSMENT_DEPENDENCIES_EMPTY/);
    assert.equal((await v.store.read(v.root, v.identity, v.lease)).assessment, undefined);
}));

test('an empty requested file is covered by its own brokered zero-byte read', () => fixture(async v => {
    await writeFile(join(v.root, 'EMPTY.md'), '');
    const controller = new IncrementalAssessment(v.repo, v.grounder, v.root, v.identity,
        v.lease, '/prompt-ass safe-task Inspect EMPTY.md and README.md', v.store);
    await controller.begin();
    const empty = await v.grounder.readFileRange(v.root, 'EMPTY.md', 0, 4096);
    assert.equal(empty.fileBytes, 0);
    await controller.readPage(empty);
    assert.equal((await controller.status()).sources, '1/2 inspected');
    assert.equal((await controller.status()).required.find(item => item.path === 'EMPTY.md')?.state,
        'required range inspected');
}));

test('named stages persist atomically with revisions, broker hashes and dependency invalidation', () => fixture(async v => {
    const first = await v.store.begin(v.root, v.identity, v.lease);
    assert.equal(first.revision, 0);
    await assert.rejects(v.store.begin(v.root, v.identity, v.lease), /already started/);
    const assessment = await v.store.stage(v.root, v.identity, v.lease, 'assessment', 0,
        { scope: 'Source checked', count: 2 }, v.refs);
    assert.equal(assessment.assessment?.contentHash, hash('{"count":2,"scope":"Source checked"}'));
    await assert.rejects(v.store.stage(v.root, v.identity, v.lease, 'plan', 1,
        { details: 'x'.repeat(33_000) }, v.refs), /oversized/);
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
