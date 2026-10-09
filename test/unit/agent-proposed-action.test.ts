import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBlockedProposedAction, createDefaultExecutionGrant, decideProposedAction,
    parseExecutionGrant, parseProposedAction } from '../../packages/agent-core/lib/index.js';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';

const at = '2026-10-09T12:00:00Z';
const later = '2026-10-09T12:01:00Z';
const grant = createDefaultExecutionGrant({ id: 'grant-1', revision: 0, taskId: 'task-1', acceptedAt: at });
const source = { version: 1, id: 'task-1', createdAt: at, objective: 'Edit one file',
    instructions: 'Edit src/a.ts', projectRoot: '.', modelPolicy: { kind: 'follow-coding-agent' },
    controls: {}, authority: { profile: 'phase-8b-project' },
    completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' } };
const run = { version: 1, id: 'run-1', taskId: 'task-1', status: 'pending', grantId: 'grant-1',
    grantRevision: 0, requestedPolicy: { kind: 'follow-coding-agent' }, projectRoot: '.',
    createdAt: at, changedFiles: [], validationResults: [] };
const action = (kind: string, path?: string) => createBlockedProposedAction({
    id: `action-${kind}`, taskId: 'task-1', runId: 'run-1', createdAt: at,
    effect: { kind, scope: 'project', ...(path ? { path } : {}) } as never,
    rationale: 'Requested effect exceeds the fixed grant', grant });

test('only blocked effects produce ProposedActions; acknowledgement never expands authority', () => {
    for (const kind of ['project-delete', 'project-rename', 'git-write', 'git-history',
        'network', 'secrets', 'outside-root', 'destructive', 'system', 'package-admin']) {
        const blocked = action(kind, kind.startsWith('project-') ? 'src/a.ts' : undefined);
        assert.equal(blocked.requiredAuthority, 'expanded-grant');
        assert.equal(blocked.revision, 0);
        assert.equal(Object.isFrozen(blocked), true);
        const acknowledged = decideProposedAction(blocked, 'acknowledged', later, 0);
        assert.equal(acknowledged.decision?.kind, 'acknowledged');
        assert.equal(acknowledged.revision, 1);
        assert.equal(grant.permissions[kind as keyof typeof grant.permissions], false);
        assert.throws(() => decideProposedAction(acknowledged, 'rejected', later, 1), /already decided/);
        assert.throws(() => decideProposedAction(blocked, 'rejected', later, 1), /Stale/);
    }
    assert.throws(() => action('project-modify', 'src/a.ts'), /Routine in-grant/);
    const reserved = createBlockedProposedAction({ id: 'reserved', taskId: 'task-1', runId: 'run-1',
        createdAt: at, effect: { kind: 'project-modify', scope: 'project', path: 'src/human.ts' },
        rationale: 'Human-reserved path', grant, scopeBlock: 'human-reserved-scope' });
    assert.equal(reserved.requiredAuthority, 'human-reserved-scope');
    assert.throws(() => parseExecutionGrant({ ...grant,
        permissions: { ...grant.permissions, 'project-delete': true } }), /Unsupported/);
});

test('parser rejects executable approvals, private targets and untrusted decision fields', () => {
    const blocked = action('project-delete', 'src/a.ts');
    for (const change of [{ version: 2 }, { revision: 1 }, { approval: true },
        { effect: { kind: 'project-modify', scope: 'project', path: 'src/a.ts' } },
        { effect: { kind: 'project-delete', scope: 'project', path: '/private/file' } },
        { effect: { kind: 'outside-root', scope: 'outside-root', path: '/private/file' } },
        { decision: { kind: 'approved', at: later, by: 'developer' } },
        { decision: { kind: 'acknowledged', at: later, by: 'model' } },
        { rationale: 'x'.repeat(1001) }])
        assert.throws(() => parseProposedAction({ ...blocked, ...change }));
});

test('project-local action survives restart and decision is revision checked', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-proposed-action-'));
    try {
        await mkdir(join(root, 'src'));
        const store = new AgentStore();
        await store.createTask(root, source as never);
        await store.createRun(root, run as never);
        const blocked = action('project-delete', 'src/a.ts');
        await store.createAction(root, blocked);
        await assert.rejects(store.createAction(root, blocked), /already exists/);
        assert.deepEqual(await new AgentStore().listActions(root, 'task-1'), [blocked]);
        const acknowledged = decideProposedAction(blocked, 'acknowledged', later, 0);
        await store.decideAction(root, blocked, acknowledged);
        await assert.rejects(store.decideAction(root, blocked,
            decideProposedAction(blocked, 'rejected', later, 0)), /Stale/);
        assert.deepEqual(await new AgentStore().readAction(root, blocked.id), acknowledged);
        assert.match(await readFile(join(root, '.dope/agent/actions/action-project-delete.json'), 'utf8'),
            /"acknowledged"/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
