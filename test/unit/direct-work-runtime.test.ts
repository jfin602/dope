import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection } from '../../packages/agent-core/lib/work-tool-selection.js';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';
import { localWorkspaceBroker } from '../../packages/theia-extension/lib/node/local-agent-turn-loop.js';

const exec = promisify(execFile);
test('runtime Direct mode performs brokered canonical edits and keeps selected-tool denial',
    { timeout: 30_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-direct-runtime-'));
    const store = new AgentStore();
    let runtime!: AgentExecutionRuntime;
    let resultStatus = '';
    const adapter = { id: 'pi-local-work', dispose() {}, async start(request: any) {
        const workspace = runtime.localWorkspace(request);
        const direct = runtime.localDirect(request);
        const broker = localWorkspaceBroker(request, workspace, [], direct);
        return { result: (async () => {
            await broker.assertActive();
            const edit = { id: 'edit-1', name: 'edit' as const,
                arguments: { operation: 'modify' as const, path: 'src/old.txt', content: 'direct\n' } };
            const forged = { ...request, grant: { ...request.grant,
                toolSelection: { ...request.grant.toolSelection, tools: [] } } };
            const bypass = localWorkspaceBroker(forged, workspace, [], direct);
            assert.equal((await bypass.execute(edit, new AbortController().signal)).status, 'denied');
            const reserved = localWorkspaceBroker({ ...request, reservedPaths: ['src/old.txt'] }, workspace, [], direct);
            assert.equal((await reserved.execute(edit, new AbortController().signal)).status, 'denied');
            assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'before\n');
            resultStatus = (await broker.execute(edit, new AbortController().signal)).status;
            if (resultStatus !== 'completed') throw new Error('Direct broker denied selected edit');
        })(), async cancel() {} };
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
                stdout: '', stderr: '', stdoutTruncated: false, stderrTruncated: false, status: 'passed' };
            await persist(evidence); return evidence;
        } } as any, undefined, async () => ({ available: true }));
    const backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {},
        async hasUnsavedEditor() { return false; } }, runtime);
    try {
        await mkdir(join(root, 'src'));
        await writeFile(join(root, 'src', 'old.txt'), 'before\n');
        await exec('git', ['init', '-q', root]);
        await exec('git', ['add', 'src/old.txt'], { cwd: root });
        await exec('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
            'commit', '-qm', 'basis'], { cwd: root });
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
                projectUri: uri, taskId, grantRevision: 0, connectionId: 'local', modelId: 'model' },
            ['edit_file']) });
        const started = await backend.start(handle, uri, taskId, grant, false);
        const run = await runtime.waitForRun(root, started.id).catch(async error => {
            throw new Error(`${error instanceof Error ? error.message : String(error)}: ` +
                JSON.stringify({ saved: await store.readRun(root, started.id), resultStatus }));
        });
        assert.equal(resultStatus, 'completed');
        assert.equal(run.executionMode, 'direct');
        assert.equal(run.status, 'completed', JSON.stringify({ outcome: run.outcome,
            delta: run.candidateDelta, applied: run.appliedFiles }));
        assert.equal(run.validationBasis, 'direct-applied-snapshot');
        assert.deepEqual(run.directApplied?.map(item => [item.path, item.result]), [['src/old.txt', 'applied']]);
        const review = await backend.reviewDirectWork(handle, run.id);
        assert.equal(review.validationCurrent, true);
        assert.deepEqual(review.files.map(item => item.path), ['src/old.txt']);
        assert.match(review.files[0].diff, /-before\n\+direct/);
        assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'direct\n');
        await writeFile(join(root, 'src', 'owner.txt'), 'owner\n');
        assert.equal((await backend.reviewDirectWork(handle, run.id)).validationCurrent, false);
        await rm(join(root, 'src', 'owner.txt'));
        const journalPath = join(root, run.directJournal!.path);
        const journal = JSON.parse(await readFile(journalPath, 'utf8'));
        assert.equal(journal.changes[0].result, 'completed');
        assert.equal(Buffer.from(journal.changes[0].beforeBytes, 'base64').toString(), 'before\n');
        const reverted = await backend.revertDirectWork(handle, run.id, ['src/old.txt']);
        assert.equal(reverted.files[0].reverted, true);
        assert.equal(reverted.validationCurrent, false);
        assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'before\n');
        assert.equal((await backend.readRun(handle, run.id))?.directReverts?.[0].result, 'reverted');
        const interrupted = JSON.parse(await readFile(journalPath, 'utf8'));
        interrupted.changes[0].result = 'prepared';
        await writeFile(journalPath, JSON.stringify(interrupted));
        await runtime.reconcile(root);
        assert.equal(JSON.parse(await readFile(journalPath, 'utf8')).changes[0].result, 'not-applied');
    } finally { backend.dispose(); await runtime.dispose(); await rm(root, { recursive: true, force: true }); }
});
