import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { importPhaseStack, parseAgentTaskSequence } from '../../packages/agent-core/lib/sequence.js';
import { expectedSequenceVersion, gitCheckpointPrefix, sequenceBlockReason } from
    '../../packages/agent-core/lib/node/sequence-reconciliation.js';

const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40), empty = 'e'.repeat(64);
const now = '2026-10-06T12:00:00Z';
function prompt(number: number, closeout = false, mode = 'Phase', version = `0.8.${number}`) {
    const title = closeout ? 'Closeout' : `Implement ${number}`;
    return { filename: `P${number}-${closeout ? 'closeout' : 'implement'}.txt`, text: `TASK: ${mode} 8 / P${number} — ${title}\n` +
        '- Recommended configuration: `GPT-6 Sol Medium`.\n- Browser required: no.\n' +
        (mode === 'Phase' ? `The assigned project version is \`${version}\`.\n` :
            `- Required unchanged project version: \`${version}\`.\n`) };
}
async function phase() { return importPhaseStack('p8', [prompt(1), prompt(2), prompt(3, true)]); }
async function correction() { return importPhaseStack('c8-fix', [prompt(1, false, 'Correction', '0.8.13'),
    prompt(2, false, 'Correction', '0.8.13'), prompt(3, true, 'Correction', '0.8.13')]); }
async function sequence() {
    return { version: 1, id: 'sequence-1', createdAt: now, updatedAt: now, status: 'ready',
        currentEntryNumber: 1, stack: await phase(), checkpoints: [],
        basis: { head: a, packageVersion: '0.8.0', worktreeFingerprint: empty } };
}
const evidence = (history: { sha: string; subject: string }[] = [], packageVersion = '0.8.0',
    head = a, clean = true) => ({ history, packageVersion, head, clean, worktreeFingerprint: empty });

test('sequence store is atomic, serialized, strict and portable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-sequence-'));
    try {
        const store = new AgentStore(), initial = await sequence();
        const changes: string[] = [];
        store.onChange((_root, change) => changes.push(`${change.kind}:${change.id}`));
        await store.createSequence(root, initial);
        assert.deepEqual(await store.listSequences(root), [initial]);
        await assert.rejects(store.createSequence(root, initial), /already exists/);
        const next = { ...initial, status: 'running', updatedAt: '2026-10-06T12:00:01Z' };
        const results = await Promise.allSettled([store.updateSequence(root, initial, next),
            store.updateSequence(root, initial, next)]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.deepEqual(await new AgentStore().readSequence(root, initial.id), next);
        assert.deepEqual(changes, ['sequence:sequence-1', 'sequence:sequence-1']);
        const file = join(root, '.dope/agent/sequences/sequence-1.json');
        const copy = join(root, 'copy');
        await mkdir(copy);
        await cp(join(root, '.dope'), join(copy, '.dope'), { recursive: true });
        assert.deepEqual(await new AgentStore().readSequence(copy, initial.id), next);
        const moved = join(root, 'moved');
        await rename(copy, moved);
        assert.deepEqual(await new AgentStore().readSequence(moved, initial.id), next);
        for (const bytes of ['{', JSON.stringify({ ...next, version: 99 })]) {
            await writeFile(file, bytes);
            await assert.rejects(store.readSequence(root, initial.id), /Corrupt or unsupported/);
            await assert.rejects(store.listSequences(root), /Corrupt or unsupported/);
            assert.equal(await readFile(file, 'utf8'), bytes);
        }
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('sequence rejects secret-shaped and private-path prompt fixtures', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-sequence-'));
    try {
        const store = new AgentStore(), initial = await sequence();
        for (const text of ['api_key=super-secret-value', 'OPENAI_API_KEY=super-secret-value',
            'Bearer abcdefghijklmnop', '/home/person/private/file']) {
            const source = prompt(1);
            source.text += text;
            const stack = await importPhaseStack('p8', [source, prompt(2), prompt(3, true)]);
            await assert.rejects(store.createSequence(root, { ...initial, stack }), /credential or private-path/);
        }
        assert.deepEqual(await store.listSequences(root), []);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('verified manual closeout completion persists its external checkpoint', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-sequence-'));
    try {
        const initial = await sequence();
        const completed = { ...initial, status: 'completed', currentEntryNumber: 4,
            checkpoints: [{ entryNumber: 1, sha: b }, { entryNumber: 2, sha: c },
                { entryNumber: 3, sha: 'd'.repeat(40), preGateBasis: {
                    head: c, packageVersion: '0.8.2', worktreeFingerprint: empty } }] };
        assert.equal((await parseAgentTaskSequence(completed)).status, 'completed');
        const history = [{ sha: 'd'.repeat(40), subject: '0.8.3' },
            { sha: c, subject: '0.8.2' }, { sha: b, subject: '0.8.1' }];
        assert.equal(sequenceBlockReason(completed, evidence(history, '0.8.3', 'd'.repeat(40)), false), undefined);
        const store = new AgentStore();
        await store.createSequence(root, completed);
        assert.deepEqual(await new AgentStore().readSequence(root, completed.id), completed);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('reachable Git prefix, version and source/worktree drift block ambiguous resume', async () => {
    const initial = await sequence(), stack = initial.stack;
    assert.equal(expectedSequenceVersion(stack, 0), '0.8.0');
    assert.equal(expectedSequenceVersion(stack, 2), '0.8.2');
    assert.deepEqual(gitCheckpointPrefix(stack, evidence([{ sha: b, subject: '0.8.1' }])),
        [{ entryNumber: 1, sha: b }]);
    assert.throws(() => gitCheckpointPrefix(stack, evidence([{ sha: c, subject: '0.8.2' }])), /missing earlier/);
    assert.equal(sequenceBlockReason(initial, evidence([{ sha: b, subject: '0.8.1' }]), false), 'checkpoint-mismatch');
    assert.equal(sequenceBlockReason(initial, evidence([], '0.8.1'), false), 'version-mismatch');
    assert.equal(sequenceBlockReason(initial, evidence([], '0.8.0', b), false), 'head-drift');
    assert.equal(sequenceBlockReason(initial, evidence([], '0.8.0', a, false), false), 'worktree-drift');
    assert.equal(sequenceBlockReason(initial, evidence(), true), 'source-drift');
    assert.equal(sequenceBlockReason({ ...initial, status: 'running' }, evidence(), false), 'interrupted');
    const progressed = { ...initial, checkpoints: [{ entryNumber: 1, sha: b }], currentEntryNumber: 2 };
    assert.equal(sequenceBlockReason(progressed, evidence([{ sha: b, subject: '0.8.1' }], '0.8.1', b), false), undefined);
    assert.equal(sequenceBlockReason(progressed, evidence([], '0.8.1', b), false), 'checkpoint-mismatch');
    const fix = await correction();
    assert.equal(expectedSequenceVersion(fix, 1), '0.8.13');
    const subject = `c8-fix/P1: ${fix.entries[0].title}`;
    assert.throws(() => gitCheckpointPrefix(fix, evidence([{ sha: b, subject }, { sha: c, subject }])), /Ambiguous/);
    assert.equal(sequenceBlockReason({ ...initial, stack: fix }, evidence([], '0.8.14'), false), 'version-mismatch');
});
