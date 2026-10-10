import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { preflightLocalToolSandbox } from '../../packages/agent-core/lib/node/local-tool-sandbox.js';
import { LocalAgentCapabilityProbe } from '../../packages/theia-extension/lib/node/local-agent-capability.js';
import { LocalAgentExecutionAdapter } from '../../packages/theia-extension/lib/node/local-agent-execution.js';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

const git = promisify(execFile);
const connection: any = { version: 1, id: 'local', alias: 'Local', lifecycle: 'enabled',
    config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' } };
const hosted: any = { version: 1, id: 'hosted', alias: 'Hosted', lifecycle: 'enabled',
    config: { type: 'codex', runtime: 'app-server' }, codexAccount: {
        accountId: 'hosted-account', status: 'signed-in', planUsage: 'available'
    } };
const contextWindowTokens = 65536;
function inventory(eligible: boolean): any {
    return { registry: { version: 1, revision: 1, connections: [connection, hosted], models: [{
        connectionId: 'local', providerModelKey: 'fixture-model', enabled: true, state: 'ready', locality: 'local',
        capabilities: { agentExecution: eligible ? { source: 'adapter-known', value: true } : { source: 'unknown' } }
    }, { connectionId: 'hosted', providerModelKey: 'hosted-model', enabled: true, state: 'ready',
        locality: 'hosted', capabilities: { agentExecution: { source: 'adapter-known', value: true } }
    }] }, observations: [{ connectionId: 'local', health: 'ready' }, { connectionId: 'hosted', health: 'ready' }],
    loadedLocalModels: [{ connectionId: 'local', providerModelKey: 'fixture-model', contextWindowTokens }] };
}

test('synthetic Local probe gates exact routing; real broker edit reaches Dope validation and direct promotion',
    { timeout: 120_000 }, async () => {
        const sandbox = await preflightLocalToolSandbox();
        assert.equal(sandbox.available, true, `P14 Not Green: Local OS isolation unavailable: ${sandbox.reason}`);
        const parent = await mkdtemp(join(tmpdir(), 'dope-local-p13-'));
        const root = join(parent, 'project');
        const source = resolve(import.meta.dirname, '../..');
        const store = new AgentStore();
        let eligible = false;
        let target: 'local' | 'hosted' = 'local';
        let hostedStarts = 0;
        let runtime!: AgentExecutionRuntime;
        let toolCalls = 0;
        let projectDataInProbe = false;
        const transport = { async turn(request: any): Promise<any> {
            const messages = request.messages as { role: string; content: string }[];
            if (messages[0].content.includes('synthetic tool protocol check')) {
                projectDataInProbe ||= JSON.stringify(request).includes(root);
                if (!messages.some(message => message.role === 'tool')) return { kind: 'tools', calls: [{
                    id: 'probe', name: 'read', arguments: { path: 'dope-synthetic-capability-probe.txt', maxBytes: 128 }
                }] };
                return { kind: 'final', text: JSON.parse(messages.at(-1)!.content).output };
            }
            if (!messages.some(message => message.role === 'tool')) {
                toolCalls++;
                return { kind: 'tools', calls: [{ id: 'edit-one', name: 'edit', arguments: {
                    operation: 'create', path: 'local-p13.txt', content: 'changed\n'
                } }] };
            }
            assert.equal(JSON.parse(messages.at(-1)!.content).status, 'completed');
            return { kind: 'final', text: 'Candidate ready for Dope validation.' };
        } };
        const adapter = new LocalAgentExecutionAdapter({ inventory: async () => inventory(eligible),
            workspace: async request => runtime.localWorkspace(request),
            commands: request => runtime.localCommands(request), transport });
        const routing = { async resolve() { return { resolution: { policyRevision: 7,
            candidates: [{ target: target === 'local' ? { connectionId: 'local', modelId: 'fixture-model' } :
                { connectionId: 'hosted', modelId: 'hosted-model' } }] } }; } };
        const hostedAdapter: any = { id: 'hosted-fixture', async start() { hostedStarts++;
            throw new Error('Hosted execution must not start'); }, dispose() {} };
        runtime = new AgentExecutionRuntime(store, routing as any,
            { inventory: async () => inventory(eligible) } as any,
            new Map([['local', adapter], ['codex', hostedAdapter]]));
        const backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} }, runtime);
        try {
            await git('git', ['clone', '--quiet', '--shared', source, root]);
            const uri = pathToFileURL(root).href;
            const handle = (await backend.attach(uri)).projectHandle;
            const createdAt = new Date(Date.now() - 2000).toISOString();
            const taskId = 'local-p13';
            await backend.createTask(handle, { version: 1, id: taskId, createdAt,
                objective: 'Create local-p13.txt', instructions: 'Use the edit tool to write changed',
                projectRoot: '.', modelPolicy: { kind: 'follow-coding-agent' }, controls: {},
                authority: { profile: 'phase-8b-project' }, origin: { kind: 'direct' },
                completion: { validation: [{ kind: 'test', label: 'candidate contents',
                    command: 'test "$(cat local-p13.txt)" = changed && ! python3 -c "import socket; socket.socket()"' }],
                requireValidationPass: true } } as any);
            const grant = createDefaultExecutionGrant({ id: 'accepted-p13', revision: 0, taskId,
                acceptedAt: new Date().toISOString() });
            await assert.rejects(backend.start(handle, uri, taskId, grant, false), /ineligible/);
            assert.deepEqual(await backend.listRuns(handle), []);
            assert.equal(hostedStarts, 0, 'ineligible Local target did not fall back to hosted');
            const probe = new LocalAgentCapabilityProbe(transport as any);
            assert.equal(await probe.probe(connection, 'fixture-model', async () => inventory(false)), 'supported');
            assert.equal(projectDataInProbe, false);
            eligible = true;
            target = 'hosted';
            await assert.rejects(backend.start(handle, uri, taskId, grant, false), /Hosted project-data authorization/);
            assert.equal(hostedStarts, 0);
            target = 'local';
            const started = await backend.start(handle, uri, taskId, grant, false);
            assert.equal(started.provenance?.connectionId, 'local');
            assert.equal(started.provenance?.modelId, 'fixture-model');
            assert.equal(started.provenance?.runtimeKind, 'local');
            assert.equal(started.provenance?.adapterId, 'local-lm-studio');
            const done = await runtime.waitForRun(root, started.id);
            assert.equal(done.status, 'completed', JSON.stringify({ outcome: done.outcome, validation: done.validationResults }));
            assert.equal(toolCalls, 1);
            assert.equal(done.validationResults[0].owner, 'dope');
            assert.equal(done.validationResults[0].status, 'passed');
            assert.equal(done.validationResults[0].candidateFingerprint, done.candidateFingerprint);
            assert.deepEqual(done.appliedFiles, ['local-p13.txt']);
            assert.equal(await readFile(join(root, 'local-p13.txt'), 'utf8'), 'changed\n');
            await runtime.reconcile(root);
            assert.equal((await new AgentStore().readRun(root, started.id))?.status, 'completed');
        } finally {
            await runtime.dispose(); backend.dispose(); await rm(parent, { recursive: true, force: true });
        }
    });
