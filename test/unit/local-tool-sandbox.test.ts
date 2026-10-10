import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchLocalSandboxedTool, preflightLocalToolSandbox } from
    '../../packages/agent-core/lib/node/local-tool-sandbox.js';

test('real Linux namespace preflight proves all denial canaries and workspace write', async () => {
    const prior = process.env.DOPE_PRIVATE_TOKEN;
    process.env.DOPE_PRIVATE_TOKEN = 'must-not-enter-sandbox';
    try {
        const result = await preflightLocalToolSandbox();
        assert.equal(result.available, true, result.reason);
        assert.match(result.evidence ?? '', /all-denials-and-workspace-write-proved/);
    } finally {
        if (prior === undefined) delete process.env.DOPE_PRIVATE_TOKEN;
        else process.env.DOPE_PRIVATE_TOKEN = prior;
    }
});

test('missing executable and malformed policy fail closed', async () => {
    const missing = await preflightLocalToolSandbox({ bwrapExecutable: '/missing-dope-bwrap' });
    assert.equal(missing.available, false);
    assert.match(missing.reason ?? '', /missing/);
    const parent = await mkdtemp(join(tmpdir(), 'dope-local-malformed-'));
    try {
        const work = join(parent, 'work');
        await mkdir(join(work, '.git'), { recursive: true });
        await mkdir(join(work, '.dope'));
        await assert.rejects(launchLocalSandboxedTool({ workspaceRoot: 'relative' }, ['/bin/true']),
            /malformed policy/);
        await assert.rejects(launchLocalSandboxedTool({ workspaceRoot: work }, []),
            /malformed policy/);
        await assert.rejects(launchLocalSandboxedTool({ workspaceRoot: work,
            unshareExecutable: '/missing-dope-unshare' }, ['/bin/true']), /missing/);
        await assert.rejects(launchLocalSandboxedTool({ workspaceRoot: work,
            bwrapExecutable: '/bin/true' }, ['/bin/true']), /malformed executable policy/);
    } finally { await rm(parent, { recursive: true, force: true }); }
});
