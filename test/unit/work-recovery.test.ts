import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { verifyRecoveryReads, workRecoveryContext } from '../../packages/theia-extension/lib/node/work-recovery.js';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const head = 'a'.repeat(40);
const firstGrant = createDefaultExecutionGrant({ id: 'old-grant', revision: 0,
    taskId: 'old-task', acceptedAt: '2026-11-05T12:00:00Z' });
const nextGrant = createDefaultExecutionGrant({ id: 'new-grant', revision: 0,
    taskId: 'new-task', acceptedAt: '2026-11-05T13:00:00Z' });
const contract = { taskId: 'old-task', taskHash: digest('task'), objective: 'Implement parser',
    instructionsHash: digest('instructions'), acceptance: ['parser accepts valid input'],
    validation: [{ kind: 'test', label: 'parser suite', command: 'npm test' }],
    planning: 'unknown', roadmap: 'unknown', sourceHead: head,
    grant: { id: firstGrant.id, revision: firstGrant.revision, acceptedAt: firstGrant.acceptedAt,
        permissionsHash: digest('permissions') } } as const;

test('recovery uses owner fields and observed effects without inventing findings or GREEN', () => {
    const read = { path: 'docs/parser.md', question: 'parser rule', sourceHash: digest('old-workspace'),
        contentHash: digest('parser requirement\n'), offset: 0, endOffset: 19, fileBytes: 19 };
    const prior = { id: 'old-run', taskId: 'old-task', status: 'cancelled', basis: { head },
        taskContract: contract, candidateFingerprint: digest('candidate'),
        candidateDelta: { effects: [{ kind: 'modify', path: 'src/parser.ts' }] },
        validationResults: [{ owner: 'dope', label: 'parser suite', status: 'failed' }],
        commandEvidence: [{ commandSummary: 'parser suite', result: 'failed' }],
        documentReads: [read], outcome: { summary: 'cancelled after edit' } } as any;
    const current = { ...contract, taskId: 'new-task', grant: { ...contract.grant,
        id: nextGrant.id, acceptedAt: nextGrant.acceptedAt } } as any;
    const result = workRecoveryContext(current, prior);
    assert.deepEqual(result.reads, [read]);
    assert.match(result.text, /Original accepted objective: Implement parser/);
    assert.match(result.text, /Actual candidate effects: modify src\/parser.ts/);
    assert.match(result.text, /parser suite failed/);
    assert.match(result.text, /Document meaning\/findings: unknown/);
    assert.match(result.text, /Do not replay old mutations or infer GREEN/);
    assert.throws(() => workRecoveryContext({ ...current, acceptance: ['changed'] }, prior), /basis changed/);
    assert.throws(() => workRecoveryContext(current, { ...prior, taskContract: undefined }), /checkpoint missing/);
});

test('a restored read needs unchanged bytes and a fresh read grant', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-work-recovery-'));
    const value = 'parser requirement\n';
    const read = { path: 'docs/parser.md', question: 'parser rule', sourceHash: digest('old-workspace'),
        contentHash: digest(value), offset: 0, endOffset: Buffer.byteLength(value), fileBytes: Buffer.byteLength(value) };
    try {
        await mkdir(join(root, 'docs'));
        await writeFile(join(root, read.path), value);
        assert.deepEqual(await verifyRecoveryReads(root, nextGrant, [read]), [read]);
        await assert.rejects(verifyRecoveryReads(root, nextGrant, [{ ...read, contentHash: undefined }]), /identity unavailable/);
        await writeFile(join(root, read.path), 'changed requirement\n');
        await assert.rejects(verifyRecoveryReads(root, nextGrant, [read]), /source changed/);
        await rm(join(root, 'docs'), { recursive: true });
        await symlink(root, join(root, 'docs'));
        await assert.rejects(verifyRecoveryReads(root, nextGrant, [read]), /path changed/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
