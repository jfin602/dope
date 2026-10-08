import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Container } from '@theia/core/shared/inversify/index.js';
import { AgentRuntimeService } from '../../packages/contracts/lib/agent-runtime-service.js';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';
import { bindSharedAgentRuntime } from '../../packages/theia-extension/lib/browser/agent-runtime-connection.js';

test('renderer binding shares one real runtime service, fans out notifications, and rotates project handles', async () => {
    const first = await mkdtemp(join(tmpdir(), 'dope-runtime-first-'));
    const second = await mkdtemp(join(tmpdir(), 'dope-runtime-second-'));
    const store = new AgentStore();
    const container = new Container();
    let channels = 0;
    let backend: AgentRuntimeBackend | undefined;
    const notified = [0, 0];
    try {
        bindSharedAgentRuntime(container.bind.bind(container), (_container, client) => {
            channels++;
            backend = new AgentRuntimeBackend(store, client);
            return backend;
        }, () => { notified[0]++; notified[1]++; });
        const left = container.get<AgentRuntimeService>(AgentRuntimeService);
        const right = container.get<AgentRuntimeService>(AgentRuntimeService);
        assert.equal(left, right);
        assert.equal(channels, 1);
        const firstUri = pathToFileURL(first).toString();
        const [leftAttachment, rightAttachment] = await Promise.all([left.attach(firstUri), right.attach(firstUri)]);
        const leftHandle = leftAttachment.projectHandle;
        const rightHandle = rightAttachment.projectHandle;
        assert.equal(leftHandle, rightHandle);
        await left.createTask(leftHandle, { version: 1, id: 'task-a', createdAt: '2026-10-08T00:00:00Z',
            objective: 'Inspect shared channel', instructions: 'Read a project', projectRoot: '.',
            modelPolicy: { kind: 'follow-coding-agent' }, controls: {}, authority: { profile: 'phase-8b-project' },
            completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' } });
        assert.deepEqual(notified, [1, 1]);
        assert.equal((await right.listTasks(rightHandle)).length, 1);
        const nextHandle = (await right.attach(pathToFileURL(second).toString())).projectHandle;
        assert.notEqual(nextHandle, leftHandle);
        assert.throws(() => left.listTasks(leftHandle), /Invalid or detached/);
        assert.deepEqual(await left.listTasks(nextHandle), []);
        await store.createTask(first, { version: 1, id: 'old-project-task', createdAt: '2026-10-08T00:00:01Z',
            objective: 'Old project', instructions: 'Observe only', projectRoot: '.',
            modelPolicy: { kind: 'follow-coding-agent' }, controls: {}, authority: { profile: 'phase-8b-project' },
            completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' } });
        assert.deepEqual(notified, [1, 1]);
        assert.equal((await left.attach(firstUri)).projectHandle === nextHandle, false);
        assert.equal(channels, 1);
        backend?.dispose();
    } finally {
        await rm(first, { recursive: true, force: true });
        await rm(second, { recursive: true, force: true });
    }
});
