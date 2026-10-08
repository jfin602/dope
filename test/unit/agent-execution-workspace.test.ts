import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createDefaultExecutionGrant, parseCandidateDelta } from '../../packages/agent-core/lib/index.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';

const run = promisify(execFile);
const grant = () => createDefaultExecutionGrant({ id: 'grant-1', revision: 1,
    taskId: 'task-1', acceptedAt: '2026-10-06T00:00:00Z' });
async function fixture(work: (root: string, workspace: ExecutionWorkspace) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'dope-authority-project-'));
    let workspace: ExecutionWorkspace | undefined;
    try {
        await run('git', ['init', '-q', root]);
        await writeFile(join(root, 'a.ts'), 'first\n');
        await writeFile(join(root, 'old.ts'), 'old\n');
        await writeFile(join(root, '.gitignore'), 'node_modules/\ndist/\n.dope/\n');
        await run('git', ['add', 'a.ts', 'old.ts', '.gitignore'], { cwd: root });
        await run('git', ['-c', 'user.name=Dope Test', '-c', 'user.email=dope@test.invalid',
            'commit', '-qm', 'basis'], { cwd: root });
        await mkdir(join(root, 'node_modules/example'), { recursive: true });
        await writeFile(join(root, 'node_modules/example/index.js'), 'module.exports = 1;\n');
        workspace = await ExecutionWorkspace.create(root);
        assert.notEqual(workspace.root, root);
        assert.equal(await readFile(join(workspace.root, 'node_modules/example/index.js'), 'utf8'), 'module.exports = 1;\n');
        await work(root, workspace);
    } finally { await workspace?.dispose(); await rm(root, { recursive: true, force: true }); }
}

test('workspace edits are candidates; create and modify promote without Git writes', async () => fixture(async (root, workspace) => {
    const startingHead = (await run('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
    await writeFile(join(workspace.root, 'a.ts'), 'second\n');
    await writeFile(join(workspace.root, 'new.ts'), 'new\n');
    assert.equal(await readFile(join(root, 'a.ts'), 'utf8'), 'first\n');
    const delta = await workspace.delta();
    assert.deepEqual(delta.effects.map(effect => [effect.kind, effect.path]),
        [['modify', 'a.ts'], ['create', 'new.ts']]);
    const result = await workspace.promote(grant(), delta);
    assert.deepEqual(result.decision, { allowed: true, blocked: [] });
    assert.deepEqual(result.applied, ['a.ts', 'new.ts']);
    assert.equal(await readFile(join(root, 'a.ts'), 'utf8'), 'second\n');
    assert.equal(await readFile(join(root, 'new.ts'), 'utf8'), 'new\n');
    assert.equal((await run('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim(), startingHead);
    assert.match((await run('git', ['status', '--porcelain'], { cwd: root })).stdout, / M a\.ts/);
    assert.equal((await run('git', ['diff', '--cached', '--name-only'], { cwd: root })).stdout, '');
}));

test('ignored build output stays outside the candidate while protected state remains visible', async () => fixture(async (_root, workspace) => {
    await mkdir(join(workspace.root, 'dist'), { recursive: true });
    await writeFile(join(workspace.root, 'dist/index.html'), 'generated');
    await writeFile(join(workspace.root, 'new.ts'), 'source');
    await mkdir(join(workspace.root, '.dope'), { recursive: true });
    await writeFile(join(workspace.root, '.dope/agent.json'), '{}');
    const delta = await workspace.delta();
    assert.deepEqual(delta.effects.map(effect => effect.path), ['.dope/agent.json', 'new.ts']);
}));

test('delete or conservative rename blocks the entire candidate', async () => fixture(async (root, workspace) => {
    await writeFile(join(workspace.root, 'a.ts'), 'would be allowed\n');
    await rm(join(workspace.root, 'old.ts'));
    let delta = await workspace.delta();
    assert.equal(delta.effects.find(effect => effect.path === 'old.ts')?.kind, 'delete');
    let result = await workspace.promote(grant(), delta);
    assert.deepEqual(result.decision.blocked, [{ kind: 'delete', path: 'old.ts' }]);
    assert.deepEqual(result.applied, []);
    assert.equal(await readFile(join(root, 'a.ts'), 'utf8'), 'first\n');
    await rename(join(workspace.root, 'a.ts'), join(workspace.root, 'renamed.ts'));
    delta = await workspace.delta();
    assert.deepEqual(delta.effects.map(effect => [effect.kind, effect.path]),
        [['delete', 'a.ts'], ['delete', 'old.ts'], ['create', 'renamed.ts']]);
    result = await workspace.promote(grant(), delta);
    assert.equal(result.decision.allowed, false);
    assert.deepEqual(result.applied, []);
    assert.equal(await readFile(join(root, 'a.ts'), 'utf8'), 'first\n');
}));

test('basis drift, symlink escape and malformed candidate all fail before apply', async () => fixture(async (root, workspace) => {
    await writeFile(join(workspace.root, 'a.ts'), 'candidate\n');
    const delta = await workspace.delta();
    await writeFile(join(root, 'a.ts'), 'owner edit\n');
    await assert.rejects(workspace.promote(grant(), delta), /basis changed/);
    assert.equal(await readFile(join(root, 'a.ts'), 'utf8'), 'owner edit\n');
    assert.throws(() => parseCandidateDelta({ version: 1, effects: [
        { kind: 'create', path: '../escape', after: 'a'.repeat(64) } ] }), /project path/);
    await symlink(root, join(workspace.root, 'escape'));
    await assert.rejects(workspace.delta(), /Unsafe execution workspace entry/);
}));

test('a substituted authoritative parent path blocks promotion', async () => fixture(async (root, workspace) => {
    await mkdir(join(workspace.root, 'src'));
    await writeFile(join(workspace.root, 'src/new.ts'), 'candidate\n');
    const delta = await workspace.delta();
    await symlink(tmpdir(), join(root, 'src'));
    await assert.rejects(workspace.promote(grant(), delta), /substituted or unsafe/);
}));

test('Dope state is a visible blocked candidate, never an authoritative write', async () => fixture(async (root, workspace) => {
    await mkdir(join(workspace.root, '.dope'));
    await writeFile(join(workspace.root, '.dope/architecture.json'), '{}');
    const result = await workspace.promote(grant(), await workspace.delta());
    assert.equal(result.decision.allowed, false);
    assert.deepEqual(result.decision.blocked, [{ kind: 'create', path: '.dope/architecture.json' }]);
    await assert.rejects(readFile(join(root, '.dope/architecture.json')), { code: 'ENOENT' });
}));
