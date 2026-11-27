import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection } from '../../packages/agent-core/lib/work-tool-selection.js';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';
import { localWorkspaceBroker } from '../../packages/theia-extension/lib/node/local-agent-turn-loop.js';

const exec = promisify(execFile);
for (const [ownerDirty, providerFails, validationFails, stopAfterWrite] of [[false, false, false, false],
    [true, false, false, false], [false, true, false, false], [false, false, true, false],
    [true, false, false, true]] as const)
test(`runtime Direct mode performs brokered canonical edits with ${ownerDirty ? 'reviewed owner source' : 'clean source'}${providerFails ? ' and a failed provider' : validationFails ? ' and failed validation' : stopAfterWrite ? ' and Stop after the write' : ''}`,
    { timeout: 30_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-direct-runtime-'));
    const store = new AgentStore();
    let runtime!: AgentExecutionRuntime;
    let resultStatus = '';
    let refreshedPath = '';
    let cancelWait: (() => void) | undefined;
    const adapter = { id: 'pi-local-work', dispose() {}, async start(request: any) {
        const workspace = runtime.localWorkspace(request);
        const direct = runtime.localDirect(request);
        const broker = localWorkspaceBroker(request, workspace, [], direct);
        return { result: (async () => {
            await broker.assertActive();
            const edit = { id: 'edit-1', kind: 'write' as const,
                path: 'src/old.txt', content: 'direct\n' };
            request.onEvent({ kind: 'work-observation', toolId: 'pi-1', toolName: 'write', phase: 'requested' });
            const forged = { ...request, grant: { ...request.grant,
                toolSelection: { ...request.grant.toolSelection, tools: [] } } };
            const bypass = localWorkspaceBroker(forged, workspace, [], direct);
            assert.equal((await bypass.executePiFileOperation!(edit, new AbortController().signal)).status, 'denied');
            const reserved = localWorkspaceBroker({ ...request, reservedPaths: ['src/old.txt'] }, workspace, [], direct);
            assert.equal((await reserved.executePiFileOperation!(edit, new AbortController().signal)).status, 'denied');
            assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), ownerDirty ? 'owner before\n' : 'before\n');
            const stop = new AbortController();
            if (!ownerDirty) {
                const journal = direct!.journal as any;
                const write = journal.write.bind(journal);
                journal.write = async (...args: unknown[]) => {
                    const applied = await write(...args);
                    stop.abort(); // Stop after canonical write, before candidate mirror.
                    return applied;
                };
            }
            resultStatus = (await broker.executePiFileOperation!(edit, stop.signal)).status;
            request.onEvent({ kind: 'work-observation', toolId: 'pi-1', toolName: 'write', phase: 'completed',
                brokerInvoked: true, effectExecuted: true });
            if (resultStatus !== 'completed') throw new Error('Direct broker denied selected edit');
            if (providerFails) throw new Error('Provider failed after applied edit');
            if (stopAfterWrite) await new Promise<void>((_resolve, reject) => {
                cancelWait = () => reject(new Error('Stopped after applied Direct write'));
            });
            if (!ownerDirty) {
                assert.equal(stop.signal.aborted, true);
                assert.equal(await readFile(join(workspace.root, 'src', 'old.txt'), 'utf8'), 'direct\n');
            }
        })(), async cancel() { cancelWait?.(); } };
    } };
    const inventory: any = { registry: { version: 1, revision: 1, connections: [{ version: 1,
        id: 'local', alias: 'Local', lifecycle: 'enabled',
        config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1/v1' } }], models: [{
            connectionId: 'local', providerModelKey: 'model', enabled: true, state: 'ready', locality: 'local',
            capabilities: { agentExecution: { source: 'adapter-known', value: true } } }] },
        observations: [{ connectionId: 'local', health: 'ready' }],
        loadedLocalModels: [{ connectionId: 'local', providerModelKey: 'model', contextWindowTokens: 4096 }] };
    runtime = new AgentExecutionRuntime(store, { async resolve() { throw new Error('exact only'); } } as any,
        { async inventory() { return inventory; } } as any, new Map([['local', adapter as any]]),
        0, { async run(input: any, persist: any) {
            const evidence = { version: 1, kind: input.target.kind, label: input.target.label,
                command: input.target.command, owner: 'dope', candidateFingerprint: input.candidateFingerprint,
                workspaceId: 'direct-validation-fixture', durationMs: 1, exitCode: 0,
                stdout: '', stderr: '', stdoutTruncated: false, stderrTruncated: false,
                status: validationFails ? 'failed' : 'passed' };
            await persist(evidence); return evidence;
        } } as any, undefined, async () => ({ available: true }));
    const backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {},
        async hasUnsavedEditor() { return false; },
        async refreshDirectEditor(fileUri) { refreshedPath = fileUri; return true; } }, runtime);
    try {
        await mkdir(join(root, 'src'));
        await writeFile(join(root, 'src', 'old.txt'), 'before\n');
        await exec('git', ['init', '-q', root]);
        await exec('git', ['add', 'src/old.txt'], { cwd: root });
        await exec('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
            'commit', '-qm', 'basis'], { cwd: root });
        if (ownerDirty) {
            await writeFile(join(root, 'src', 'old.txt'), 'owner before\n');
            await writeFile(join(root, 'src', 'owner.txt'), 'untracked owner\n');
        }
        const uri = pathToFileURL(root).href;
        const handle = (await backend.attach(uri)).projectHandle;
        const taskId = 'direct-task';
        await backend.createTask(handle, { version: 1, id: taskId,
            createdAt: new Date(Date.now() - 1000).toISOString(), objective: 'Change source',
            instructions: 'Edit the file', projectRoot: '.', executionMode: 'direct',
            modelPolicy: { kind: 'exact', connectionId: 'local', modelId: 'model' }, controls: {},
            authority: { profile: 'phase-8b-project' }, origin: { kind: 'direct' },
            reviewPolicy: { kind: 'required' }, completion: { validation: [
                { kind: 'test', label: 'unit', command: 'node --test' } ], requireValidationPass: true } });
        const grant = createDefaultExecutionGrant({ id: 'direct-grant', revision: 0, taskId,
            acceptedAt: new Date().toISOString(), toolSelection: makeWorkToolSelection({
                projectUri: uri, taskId, grantRevision: 0, grantId: 'direct-grant',
                executionMode: 'direct', connectionId: 'local', modelId: 'model' },
            ['write', 'edit']) });
        const accepted = ownerDirty ? (await backend.previewWorktree(handle)).fingerprint : undefined;
        const started = await backend.start(handle, uri, taskId, grant, false, accepted);
        if (stopAfterWrite) {
            for (let attempt = 0; !cancelWait && attempt < 300; attempt++)
                await new Promise(resolve => setTimeout(resolve, 10));
            assert.ok(cancelWait);
            await backend.stop(handle, started.id);
        }
        const run = await runtime.waitForRun(root, started.id).catch(async error => {
            throw new Error(`${error instanceof Error ? error.message : String(error)}: ` +
                JSON.stringify({ saved: await store.readRun(root, started.id), resultStatus }));
        });
        assert.equal(resultStatus, 'completed');
        assert.equal(refreshedPath, pathToFileURL(join(root, 'src', 'old.txt')).toString());
        assert.equal(run.executionMode, 'direct');
        assert.equal(run.status, stopAfterWrite ? 'cancelled' : providerFails || validationFails ? 'failed' : 'completed', JSON.stringify({ outcome: run.outcome,
            delta: run.candidateDelta, applied: run.appliedFiles }));
        assert.deepEqual(run.appliedFiles, ['src/old.txt']);
        const transcript = await store.readTranscript(root, run.id, 0, 100);
        assert.equal(transcript.entries.filter(entry => entry.kind === 'work' && entry.toolId === 'pi-1' &&
            ['completed', 'failed', 'denied', 'recoverable', 'cancelled', 'interrupted'].includes(entry.phase)).length, 1);
        assert.equal(transcript.entries.at(-1)?.kind, 'marker');
        assert.doesNotMatch(run.outcome?.summary ?? '', /Candidate promotion|Accept Candidate/u);
        if (providerFails || validationFails || stopAfterWrite) {
            assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'direct\n');
            if (ownerDirty) assert.equal(await readFile(join(root, 'src', 'owner.txt'), 'utf8'), 'untracked owner\n');
            const failedReview = await backend.reviewDirectWork(handle, run.id);
            assert.deepEqual(failedReview.files.map(file => file.path), ['src/old.txt']);
            assert.equal(failedReview.validationCurrent, false);
            if (validationFails) assert.match(run.outcome?.summary ?? '', /required validation did not pass/u);
            return;
        }
        assert.equal(run.validationBasis, 'direct-applied-snapshot');
        assert.deepEqual(run.directApplied?.map(item => [item.path, item.result]), [['src/old.txt', 'applied']]);
        const review = await backend.reviewDirectWork(handle, run.id);
        assert.equal(review.validationCurrent, true);
        assert.deepEqual(review.files.map(item => item.path), ['src/old.txt']);
        assert.match(review.files[0].diff, ownerDirty ? /-owner before\n\+direct/ : /-before\n\+direct/);
        assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'direct\n');
        await writeFile(join(root, 'src', 'new-owner.txt'), 'owner\n');
        assert.equal((await backend.reviewDirectWork(handle, run.id)).validationCurrent, false);
        await rm(join(root, 'src', 'new-owner.txt'));
        const journalPath = join(root, run.directJournal!.path);
        const journal = JSON.parse(await readFile(journalPath, 'utf8'));
        assert.equal(journal.changes[0].result, 'completed');
        assert.equal(Buffer.from(journal.changes[0].beforeBytes, 'base64').toString(),
            ownerDirty ? 'owner before\n' : 'before\n');
        const reverted = await backend.revertDirectWork(handle, run.id, ['src/old.txt']);
        assert.equal(reverted.files[0].reverted, true);
        assert.equal(reverted.validationCurrent, false);
        assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), ownerDirty ? 'owner before\n' : 'before\n');
        if (ownerDirty) assert.equal(await readFile(join(root, 'src', 'owner.txt'), 'utf8'), 'untracked owner\n');
        assert.equal((await backend.readRun(handle, run.id))?.directReverts?.[0].result, 'reverted');
        const interrupted = JSON.parse(await readFile(journalPath, 'utf8'));
        interrupted.changes[0].result = 'prepared';
        await writeFile(journalPath, JSON.stringify(interrupted));
        await runtime.reconcile(root);
        assert.equal(JSON.parse(await readFile(journalPath, 'utf8')).changes[0].result, 'uncertain');
    } finally { backend.dispose(); await runtime.dispose(); await rm(root, { recursive: true, force: true }); }
});

for (const recordedRequest of [false, true, 'native'] as const) for (const preclassified of [false, true])
test(`restart reconciles a ${preclassified ? 'previously classified' : 'prepared'} Direct call through a killed writer lock with ${recordedRequest === 'native' ? 'native' : recordedRequest ? 'saved legacy' : 'missing'} tool request`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-direct-restart-'));
    const store = new AgentStore();
    const runtime = new AgentExecutionRuntime(store, { async resolve() { throw new Error('unused'); } } as any,
        { async inventory() { throw new Error('unused'); } } as any, new Map());
    try {
        await mkdir(join(root, 'src'));
        await writeFile(join(root, 'src', 'old.txt'), 'before\n');
        await exec('git', ['init', '-q', root]);
        await exec('git', ['add', 'src/old.txt'], { cwd: root });
        await exec('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
            'commit', '-qm', 'basis'], { cwd: root });
        const head = (await exec('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
        const journalId = randomUUID(), runId = 'restart-run', taskId = 'restart-task';
        const journalPath = `.dope/agent/direct-journals/${journalId}.json`;
        const createdAt = new Date(Date.now() - 1000).toISOString(), startedAt = new Date().toISOString();
        await store.createTask(root, { version: 1, id: taskId, createdAt,
            objective: 'Edit source', instructions: 'Edit source', projectRoot: '.', executionMode: 'direct',
            modelPolicy: { kind: 'follow-coding-agent' }, controls: {}, authority: { profile: 'phase-8b-project' },
            origin: { kind: 'direct' }, completion: { validation: [], requireValidationPass: false } } as any);
        const pending: any = { version: 1, id: runId, taskId, status: 'pending', grantId: 'restart-grant',
            grantRevision: 0, requestedPolicy: { kind: 'follow-coding-agent' }, projectRoot: '.', createdAt,
            changedFiles: [], validationResults: [], executionMode: 'direct',
            directJournal: { id: journalId, path: journalPath }, directApplied: [] };
        await store.createRun(root, pending);
        await store.updateRun(root, pending, { ...pending, status: 'running', startedAt });
        await store.appendTranscript(root, runId, { kind: 'marker', at: startedAt, code: 'run-started' });
        if (recordedRequest) await store.appendTranscript(root, runId, { kind: 'work', at: startedAt,
            toolId: 'edit-1', toolName: recordedRequest === 'native' ? 'write' : 'edit_file', phase: 'requested' });
        const digest = (value: string) => createHash('sha256').update(value).digest('hex');
        await mkdir(join(root, '.dope/agent/direct-journals'));
        await writeFile(join(root, journalPath), JSON.stringify({ version: 1, id: journalId, root, head, taskId, runId,
            grantId: 'restart-grant', grantRevision: 0, changes: [{ id: 'change-1', taskId, runId,
                operation: 'modify', path: 'src/old.txt', before: digest('before\n'), after: digest('after\n'),
                beforeBytes: Buffer.from('before\n').toString('base64'),
                afterBytes: Buffer.from('after\n').toString('base64'), at: startedAt,
                result: preclassified ? 'not-applied' : 'prepared' }] }));
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
        assert.ok(child.pid);
        const lock = join(root, `.dope/agent/runs/${runId}/.write.lock`);
        await writeFile(lock, JSON.stringify({ version: 1, pid: child.pid, host: hostname() }));
        child.kill('SIGKILL');
        await new Promise<void>(resolve => child.once('exit', () => resolve()));
        await runtime.reconcile(root);
        assert.equal((await store.readRun(root, runId))?.status, 'interrupted');
        assert.equal(JSON.parse(await readFile(join(root, journalPath), 'utf8')).changes[0].result,
            preclassified ? 'not-applied' : 'uncertain');
        assert.equal(await readFile(join(root, 'src/old.txt'), 'utf8'), 'before\n');
        const transcript = await store.readTranscript(root, runId, 0, 100);
        const edit = transcript.entries.findLast(entry => entry.kind === 'work');
        assert.equal(edit?.phase, 'interrupted');
        assert.equal(edit?.toolId, recordedRequest ? 'edit-1' : 'change-1');
        assert.equal(transcript.entries.filter(entry => entry.kind === 'work' &&
            ['completed', 'failed', 'denied', 'recoverable', 'cancelled', 'interrupted'].includes(entry.phase)).length, 1);
        if (!recordedRequest && edit?.kind === 'work') assert.equal(edit.brokerInvoked, true);
        assert.equal(transcript.entries.at(-1)?.kind, 'marker');
        await assert.rejects(readFile(lock), { code: 'ENOENT' });
        assert.equal((await exec('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root })).stdout.trim(), '?? .dope/');
    } finally { await runtime.dispose(); await rm(root, { recursive: true, force: true }); }
});
