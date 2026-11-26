import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

const git = promisify(execFile);

test('Work previews dirty files, rejects stale approval, and commits only the reviewed snapshot', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-work-start-'));
    const root = join(parent, 'project');
    let accepted: unknown;
    const execution = { async reconcile() {}, activeRunId() { return undefined; },
        registerEditorGuard() { return () => {}; },
        async start(_root: string, _uri: string, _task: string, _grant: unknown, _hosted: boolean, dirty: unknown) {
            accepted = dirty; return { id: 'run' }; } };
    const backend = new AgentRuntimeBackend(new AgentStore(), { notifyAgentStateChanged() {} }, execution as any);
    try {
        await mkdir(root);
        await git('git', ['init', '--quiet', root]);
        await git('git', ['-C', root, 'config', 'user.name', 'Dope Test']);
        await git('git', ['-C', root, 'config', 'user.email', 'dope@example.invalid']);
        await writeFile(join(root, 'source.txt'), 'original\n');
        await git('git', ['-C', root, 'add', 'source.txt']);
        await git('git', ['-C', root, 'commit', '--quiet', '-m', 'baseline']);
        const uri = pathToFileURL(root).href;
        const handle = (await backend.attach(uri)).projectHandle;
        assert.equal((await backend.previewWorktree(handle)).clean, true);
        await writeFile(join(root, 'source.txt'), 'first draft\n');
        const first = await backend.previewWorktree(handle);
        assert.deepEqual(first.paths, ['source.txt']);
        await assert.rejects(backend.start(handle, uri, 'task', {} as any, false), /Review changed/);
        await writeFile(join(root, 'source.txt'), 'second draft\n');
        await assert.rejects(backend.start(handle, uri, 'task', {} as any, false, first.fingerprint), /Review changed/);
        const second = await backend.previewWorktree(handle);
        await backend.start(handle, uri, 'task', {} as any, false, second.fingerprint);
        assert.deepEqual((accepted as { paths: { path: string }[] }).paths.map(path => path.path), ['source.txt']);
        await assert.rejects(backend.commitWorktree(handle, first.fingerprint, 'Checkpoint before Work'), /changed/);
        await backend.commitWorktree(handle, second.fingerprint, 'Checkpoint before Work');
        assert.equal((await backend.previewWorktree(handle)).clean, true);
        assert.equal((await readFile(join(root, 'source.txt'), 'utf8')), 'second draft\n');
        assert.match((await git('git', ['-C', root, 'log', '-1', '--pretty=%s'])).stdout, /Checkpoint before Work/);
    } finally { backend.dispose(); await rm(parent, { recursive: true, force: true }); }
});
