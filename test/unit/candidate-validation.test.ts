import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CandidateValidationRunner } from '../../packages/agent-core/lib/node/candidate-validation.js';
import { fingerprintCandidate } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { parseValidationResult } from '../../packages/agent-core/lib/index.js';

const execute = promisify(execFile);

async function fixture(work: (root: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'dope-validation-test-'));
    try { await work(root); }
    finally { await rm(root, { recursive: true, force: true }); }
}

async function run(root: string, command: string, controller = new AbortController(),
    runner = new CandidateValidationRunner(), timeoutMs?: number) {
    const candidateFingerprint = await fingerprintCandidate(root);
    let persisted: any;
    const result = await runner.run({ candidateRoot: root, candidateFingerprint,
        target: { kind: 'test', label: 'focused', command }, signal: controller.signal, timeoutMs },
    async evidence => { persisted = parseValidationResult(evidence); });
    assert.deepEqual(result, persisted);
    assert.equal(await fingerprintCandidate(root), candidateFingerprint);
    return result;
}

test('private temp, hard-coded /tmp, loopback and candidate copy are isolated', async () => fixture(async root => {
    const hostSentinel = join(tmpdir(), `dope-host-temp-${process.pid}`);
    const secretPath = join(process.env.HOME!, `dope-private-${process.pid}`);
    const authoritative = join(root, 'authoritative.txt');
    const hostServer = net.createServer((_socket) => {});
    await new Promise<void>(resolve => hostServer.listen(0, '127.0.0.1', resolve));
    const hostPort = (hostServer.address() as net.AddressInfo).port;
    await writeFile(hostSentinel, 'private');
    await writeFile(secretPath, 'private');
    await writeFile(authoritative, 'original');
    try {
        const script = `const fs=require('node:fs'),net=require('node:net'),assert=require('node:assert/strict');
assert.equal(fs.existsSync(${JSON.stringify(hostSentinel)}),false);
assert.equal(fs.existsSync(${JSON.stringify(secretPath)}),false);
assert.equal(fs.existsSync(${JSON.stringify(authoritative)}),false);
assert.equal(process.env.HOME,'/home/validation');
assert.equal(process.env.TMPDIR,'/tmp');
fs.writeFileSync('/tmp/private-file','ok');
fs.writeFileSync(process.env.TMPDIR+'/via-env','ok');
fs.writeFileSync('build-output.txt','disposable');
const connect=(host,port)=>new Promise(ok=>{const s=net.connect({host,port});s.setTimeout(1000);s.on('connect',()=>{ok(true);s.end()});s.on('error',()=>ok(false));s.on('timeout',()=>{s.destroy();ok(false)})});
const server=net.createServer(s=>s.end('ok'));
server.listen(0,'127.0.0.1',async()=>{assert.equal(await connect('127.0.0.1',server.address().port),true);assert.equal(await connect('127.0.0.1',${hostPort}),false);assert.equal(await connect('1.1.1.1',443),false);assert.equal(await connect('192.168.1.1',80),false);server.close()});`;
        await writeFile(join(root, 'probe.cjs'), script);
        const result = await run(root, 'node probe.cjs');
        assert.equal(result.status, 'passed', result.stderr);
        assert.equal(result.exitCode, 0);
        assert.equal(await readFile(authoritative, 'utf8'), 'original');
        await assert.rejects(readFile(join(root, 'build-output.txt')), { code: 'ENOENT' });
        assert.equal(await readFile(hostSentinel, 'utf8'), 'private');
    } finally {
        hostServer.close();
        await rm(hostSentinel, { force: true });
        await rm(secretPath, { force: true });
    }
}));

test('validation records pass/fail, bounded output, cancellation and infrastructure failure', async () => fixture(async root => {
    await writeFile(join(root, 'pass.cjs'), `process.stdout.write('x'.repeat(12000));process.stderr.write('y'.repeat(12000));`);
    const passed = await run(root, 'node pass.cjs');
    assert.equal(passed.status, 'passed');
    assert.ok((passed.stdout?.length ?? 0) <= 8192);
    assert.ok((passed.stderr?.length ?? 0) <= 8192);
    assert.match(passed.stdout ?? '', /truncated/);
    assert.match(passed.stderr ?? '', /truncated/);
    assert.equal(passed.stdoutTruncated, true);
    assert.equal(passed.stderrTruncated, true);
    await writeFile(join(root, 'fail.cjs'), 'process.exit(7)');
    const failed = await run(root, 'node fail.cjs');
    assert.equal(failed.status, 'failed');
    assert.equal(failed.exitCode, 7);
    await writeFile(join(root, 'wait.cjs'), `setInterval(()=>{},1000)`);
    const controller = new AbortController();
    const waiting = run(root, 'node wait.cjs', controller);
    setTimeout(() => controller.abort(), 500);
    const cancelled = await waiting;
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(cancelled.reason, 'Validation cancelled');
    const timedOut = await run(root, 'node wait.cjs', new AbortController(),
        new CandidateValidationRunner(), 1000);
    assert.equal(timedOut.status, 'failed');
    assert.equal(timedOut.reason, 'Validation timed out');
    const unavailable = await run(root, 'node pass.cjs', new AbortController(),
        new CandidateValidationRunner('/missing-bwrap'));
    assert.equal(unavailable.status, 'not-started');
    assert.match(unavailable.reason ?? '', /infrastructure/);
}));

test('cancelling validation reaps a long-lived child process', async () => fixture(async root => {
    const marker = `dope-val-${process.pid}`.slice(0, 15);
    await writeFile(join(root, 'child.cjs'), `const{spawn}=require('node:child_process');spawn('node',['-e',${JSON.stringify(
        `process.title=${JSON.stringify(marker)};setInterval(()=>{},1000)`)}],{stdio:'ignore'});setInterval(()=>{},1000)`);
    const controller = new AbortController();
    const pending = run(root, 'node child.cjs', controller);
    let observed = false;
    for (let attempt = 0; attempt < 50; attempt++) {
        const { stdout } = await execute('ps', ['-eo', 'comm=']);
        if (stdout.split('\n').includes(marker)) { observed = true; break; }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    controller.abort();
    const result = await pending;
    assert.equal(observed, true);
    assert.equal(result.status, 'cancelled');
    const { stdout } = await execute('ps', ['-eo', 'comm=']);
    assert.equal(stdout.split('\n').includes(marker), false);
}));
