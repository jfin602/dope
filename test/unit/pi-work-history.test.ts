import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';
import { readHistoryWorkGitMetadata } from '../../packages/theia-extension/lib/node/history-work-git.js';
import { piWorkObservation } from '../../packages/theia-extension/lib/node/pi-work-execution.js';

const git = promisify(execFile);
const now = '2026-10-29T12:00:00Z';
const modelPolicy = { kind: 'exact' as const, connectionId: 'local', modelId: 'fixture-model' };
const connection = { version: 1, id: 'local', alias: 'Local', lifecycle: 'enabled',
    config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' } };
const state = { registry: { version: 1, revision: 1, connections: [connection], models: [{
    connectionId: 'local', providerModelKey: 'fixture-model', enabled: true, state: 'ready', locality: 'local',
    capabilities: { agentExecution: { source: 'adapter-known', value: true } }
}] }, observations: [{ connectionId: 'local', health: 'ready' }],
loadedLocalModels: [{ connectionId: 'local', providerModelKey: 'fixture-model', contextWindowTokens: 8192 }] };

function runtime(store: AgentStore, adapter: any): AgentExecutionRuntime {
    const routing = { async resolve() { throw new Error('Exact model must not use role routing'); } };
    const inventory = { async inventory() { return state; } };
    const validation = { async run(input: any, persist: (value: any) => Promise<void>) {
        const result = { version: 1, kind: input.target.kind, label: input.target.label,
            command: input.target.command, owner: 'dope', candidateFingerprint: input.candidateFingerprint,
            workspaceId: 'fixture', durationMs: 1, exitCode: 0, stdout: '', stderr: '',
            stdoutTruncated: false, stderrTruncated: false, status: 'passed' };
        await persist(result);
        return result;
    } };
    return new AgentExecutionRuntime(store, routing as any, inventory as any,
        new Map([['local', adapter]]), 0, validation as any, undefined,
        async () => ({ available: true }) as any);
}

test('two fresh Pi-mapped Work candidates retain transcript and History identities through restart and review',
    { timeout: 120_000 }, async () => {
        for (const decision of ['reject', 'accept'] as const) {
            const parent = await mkdtemp(join(tmpdir(), `dope-pi-p5-${decision}-`));
            const root = join(parent, 'project');
            const store = new AgentStore();
            const taskId = `task-${decision}`;
            const candidatePath = `candidate-${decision}.txt`;
            const adapter = { id: 'pi-local-work', async start(request: any) {
                const result = Promise.resolve().then(async () => {
                    request.onEvent(piWorkObservation({ type: 'work', sequence: 1, kind: 'agent_start' }));
                    request.onEvent(piWorkObservation({ type: 'work', sequence: 2, kind: 'turn_start' }));
                    request.onEvent({ kind: 'command-started', summary: 'Approved candidate command started',
                        commandId: 'pi-1', command: 'fixture-test', status: 'running' });
                    request.onEvent({ kind: 'command-completed', summary: 'Approved candidate command finished',
                        commandId: 'pi-1', command: 'fixture-test', status: 'failed', exitCode: 1,
                        output: 'test failed safely', outputTruncated: false });
                    request.onEvent(piWorkObservation({ type: 'work', sequence: 3,
                        kind: 'tool_execution_end', toolName: 'run_command', isError: true }));
                    await writeFile(join(request.executionRoot, candidatePath), `${decision} candidate\n`);
                    request.onEvent({ kind: 'file-changed', summary: 'Candidate file changed', path: candidatePath });
                    request.onEvent(piWorkObservation({ type: 'work', sequence: 4, kind: 'agent_end' }));
                });
                return { result, async cancel() {} };
            }, dispose() {} };
            let runRuntime: AgentExecutionRuntime | undefined;
            let restarted: AgentExecutionRuntime | undefined;
            try {
                await git('git', ['clone', '--quiet', '--shared', resolve('.'), root]);
                await store.createTask(root, { version: 1, id: taskId, createdAt: now,
                    objective: 'Prepare one candidate', instructions: 'Change one candidate file', projectRoot: '.',
                    projectId: 'fixture-project', modelPolicy, controls: {}, authority: { profile: 'phase-8b-project' },
                    completion: { validation: [{ kind: 'test', label: 'fixture', command: 'fixture-test' }],
                        requireValidationPass: true }, origin: { kind: 'work-item', projectId: 'fixture-project',
                        planningMapId: 'map', workItemId: `work-${decision}`, mapRevision: 1,
                        basis: { architectureRevision: 1, architectureFingerprint: 'architecture',
                            physicalInputFingerprint: 'physical', physicalGeneration: 1 },
                        scope: { assignment: 'AI', workingSet: [candidatePath],
                            delegablePaths: [candidatePath], humanReservedPaths: [] } },
                    planningMapId: 'map', reviewPolicy: { kind: 'required' } } as any);
                const grant = createDefaultExecutionGrant({ id: `grant-${decision}`, revision: 0,
                    taskId, acceptedAt: now });
                runRuntime = runtime(store, adapter);
                const started = await runRuntime.start(root, new URL(`file://${root}`).href, taskId, grant, false);
                const held = await runRuntime.waitForRun(root, started.id);
                assert.equal(held.status, 'blocked', JSON.stringify(held.outcome));
                assert.equal(held.projectId, 'fixture-project');
                assert.equal(held.provenance?.adapterId, 'pi-local-work');
                assert.equal(held.provenance?.modelId, 'fixture-model');
                assert.equal(held.candidateReview?.state, 'ready');
                assert.equal(held.validationResults[0]?.owner, 'dope');
                await assert.rejects(readFile(join(root, candidatePath)), { code: 'ENOENT' });
                const before = await store.readTranscript(root, held.id, 0, 100);
                assert.deepEqual(before.entries.filter(entry => entry.kind === 'command').map(entry => entry.commandId), ['pi-1']);
                assert.deepEqual(before.entries.filter(entry => entry.kind === 'command').map(entry => entry.status), ['failed']);
                const events = (await store.readEvents(root, held.id, 0, 100)).events;
                assert.ok(events.some(event => event.summary === 'Pi session started'));
                assert.ok(events.some(event => event.summary === 'Pi run_command failed'));
                assert.ok(events.every(event => event.runId === held.id));
                await runRuntime.dispose(); runRuntime = undefined;
                const freshStore = new AgentStore();
                restarted = runtime(freshStore, adapter);
                await restarted.reconcile(root);
                assert.deepEqual((await freshStore.readTranscript(root, held.id, 0, 100)).entries, before.entries);
                const historyBefore = await readHistoryWorkGitMetadata({ projectRoot: root, projectId: 'fixture-project' },
                    new Date().toISOString(), freshStore);
                const entryBefore = historyBefore.entries.find(entry => entry.owner.kind === 'agent-run' && entry.owner.runId === held.id);
                assert.equal((entryBefore?.status as any).review, 'pending');
                const decided = await restarted.decideCandidate(root, held.id, 0,
                    held.candidateReview!.candidateFingerprint, decision, decision === 'accept' ? grant : undefined);
                assert.equal(decided.reviewDecision?.kind, decision);
                assert.equal((await readHistoryWorkGitMetadata({ projectRoot: root, projectId: 'fixture-project' },
                    new Date().toISOString(), freshStore)).entries.find(entry =>
                    entry.owner.kind === 'agent-run' && entry.owner.runId === held.id)?.status?.kind, 'agent-run');
                if (decision === 'reject') {
                    assert.equal(decided.status, 'cancelled');
                    await assert.rejects(readFile(join(root, candidatePath)), { code: 'ENOENT' });
                } else {
                    assert.equal(decided.status, 'completed');
                    assert.deepEqual(decided.appliedFiles, [candidatePath]);
                    assert.equal(await readFile(join(root, candidatePath), 'utf8'), 'accept candidate\n');
                }
            } finally {
                await runRuntime?.dispose();
                await restarted?.dispose();
                await rm(parent, { recursive: true, force: true });
            }
        }
    });
