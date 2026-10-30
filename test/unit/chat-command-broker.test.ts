import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runChatInvestigationCommand } from '../../packages/theia-extension/lib/node/chat-command-broker.js';

test('real Chat sandbox permits investigation while OS denies canonical, private and network effects', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-chat-command-'));
    const work = join(parent, 'work');
    try {
        await mkdir(join(work, '.git'), { recursive: true });
        await mkdir(join(work, '.dope'));
        await writeFile(join(work, 'source.txt'), 'project-source');
        await writeFile(join(work, 'sample.test.js'),
            "const { test } = require('node:test'); test('sample', () => {});\n");
        await writeFile(join(work, '.env'), 'credential-canary');
        await writeFile(join(work, 'private-notes.txt'), 'private-canary');
        await writeFile(join(work, '.git', 'secret'), 'git-canary');
        await writeFile(join(parent, 'outside'), 'outside-canary');
        await symlink(join(parent, 'outside'), join(work, 'escape'));
        const run = (command: string, signal?: AbortSignal) =>
            runChatInvestigationCommand(work, command, signal);
        const read = await run('grep project-source source.txt');
        assert.equal(read.executed, true, read.output);
        assert.equal(read.succeeded, true);
        assert.match(read.output, /project-source/);
        const check = await run('node --test sample.test.js');
        assert.equal(check.executed, true, check.output);
        assert.match(check.output, /exited 0/);
        const write = await run('printf changed > source.txt');
        assert.equal(write.executed, true, write.output);
        assert.equal(write.succeeded, false);
        assert.match(write.output, /exited [1-9]/);
        assert.equal(await readFile(join(work, 'source.txt'), 'utf8'), 'project-source');
        const privateRead = await run('cat .env .git/secret private-notes.txt');
        assert.doesNotMatch(privateRead.output, /credential-canary|git-canary|private-canary/);
        const outside = await run(`cat ${join(parent, 'outside')} escape`);
        assert.doesNotMatch(outside.output, /outside-canary/);
        const home = await run('test ! -e /home/jfin/.ssh && test -z "$DOPE_PRIVATE_TOKEN"');
        assert.match(home.output, /exited 0/);
        const remount = await run('mount -o remount,rw /work');
        assert.match(remount.output, /exited [1-9]/);
        const network = await run("python3 -c 'import socket; socket.socket()'");
        assert.match(network.output, /exited [1-9]/);
        assert.match(network.output, /Operation not permitted/);
        const processLimit = await run("python3 -c 'import subprocess; p=[subprocess.Popen([\"sleep\",\"2\"]) for _ in range(80)]; print(len(p))'");
        assert.match(processLimit.output, /exited [1-9]/);
        assert.match(processLimit.output, /Resource temporarily unavailable/);
        const host = await run(`sh -c 'printf changed > ${join(parent, 'outside')}'`);
        assert.match(host.output, /exited [1-9]/);
        assert.equal(await readFile(join(parent, 'outside'), 'utf8'), 'outside-canary');
        const abort = new AbortController();
        const cancelled = run('sleep 10', abort.signal);
        setTimeout(() => abort.abort(), 100);
        assert.match((await cancelled).output, /cancelled/);
    } finally { await rm(parent, { recursive: true, force: true }); }
});

test('Chat investigation works for a project without Git metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-chat-plain-'));
    try {
        await writeFile(join(root, 'source.txt'), 'plain-project');
        const result = await runChatInvestigationCommand(root, 'grep plain-project source.txt');
        assert.equal(result.executed, true, result.output);
        assert.match(result.output, /plain-project/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
