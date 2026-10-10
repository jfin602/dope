import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { captureGitBasis, captureGitFinal } from '../../packages/agent-core/lib/node/git-evidence.js';

const execute = promisify(execFile);
const source = resolve(import.meta.dirname, '../..');
async function fixture(work: (root: string) => Promise<void>) {
    const parent = await mkdtemp(join(tmpdir(), 'dope-agent-git-'));
    const root = join(parent, 'project');
    try {
        // Clone only existing committed source. The test never creates a commit or moves source HEAD.
        await execute('git', ['clone', '--quiet', '--shared', source, root]);
        await work(root);
    } finally { await rm(parent, { recursive: true, force: true }); }
}

test('clean basis precedes run metadata; metadata remains visible but is excluded from task changes', async () => fixture(async root => {
    const basis = await captureGitBasis(root);
    assert.equal(basis.clean, true);
    assert.match(basis.head!, /^[a-f0-9]{40}$/);
    await mkdir(join(root, '.dope/agent/runs/run-1'), { recursive: true });
    await writeFile(join(root, '.dope/agent/runs/run-1/run.json'), '{}');
    await writeFile(join(root, '.dope/architecture.json'), '{}');
    await writeFile(join(root, '.dope/smap.json'), '{}');
    await writeFile(join(root, '.dope/planning-maps.json'), '{}');
    assert.equal((await captureGitBasis(root)).clean, true);
    const final = await captureGitFinal(root, basis);
    assert.equal(final.final.clean, true);
    assert.equal(final.final.metadataChanged, true);
    assert.equal(final.final.headChanged, false);
    assert.deepEqual(final.changedFiles, []);
    assert.equal(final.changeSummary.filesChanged, 0);
}));

test('tracked edits, deletion, rename and new files use Git/filesystem truth', async () => fixture(async root => {
    const basis = await captureGitBasis(root);
    await writeFile(join(root, 'BOOT.md'), `${await readFile(join(root, 'BOOT.md'), 'utf8')}\nAgent test edit\n`);
    await rm(join(root, 'AGENTS.md'));
    await rename(join(root, 'docs/VISION.md'), join(root, 'docs/VISION-renamed.md'));
    await writeFile(join(root, 'new.txt'), 'one\ntwo\n');
    const result = await captureGitFinal(root, basis);
    for (const path of ['BOOT.md', 'AGENTS.md', 'docs/VISION.md', 'docs/VISION-renamed.md', 'new.txt'])
        assert.ok(result.changedFiles.includes(path), path);
    assert.equal(result.final.headChanged, false);
    assert.equal(result.final.clean, false);
    assert.ok(result.changeSummary.insertions >= 3);
    assert.ok(result.changeSummary.deletions > 0);
    assert.equal(result.changeSummary.filesChanged, result.changedFiles.length);
}));

test('dirty preflight, bounded untracked summary and observed basis mismatch', async () => fixture(async root => {
    await writeFile(join(root, 'large.txt'), 'x'.repeat(70_000));
    const basis = await captureGitBasis(root);
    assert.equal(basis.clean, false);
    const result = await captureGitFinal(root, { head: null, clean: true });
    assert.equal(result.final.headChanged, true);
    assert.equal(result.changeSummary.truncated, true);
    assert.ok(result.changeSummary.summary.length <= 2000);
}));

test('Git path evidence rejects symlink escape', async () => fixture(async root => {
    const outside = await mkdtemp(join(tmpdir(), 'dope-agent-git-outside-'));
    try {
        await symlink(outside, join(root, 'outside-link'));
        await assert.rejects(captureGitBasis(root), /symlink/);
    } finally { await rm(outside, { recursive: true, force: true }); }
}));
