import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { IncrementalPlan } from '../../packages/theia-extension/lib/node/incremental-plan.js';
import { newPromptDraftIdentity, validatedPlan } from '../../packages/theia-extension/lib/node/prompt-authoring-stage.js';
import { PromptDraftStore } from '../../packages/theia-extension/lib/node/prompt-draft-store.js';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const audit = ['Single responsibility keeps each source boundary coherent',
    'Runtime target 8 minutes, soft 10 and hard 15',
    'Test precision names one focused test', 'Build precision avoids unrelated compilation',
    'Evidence distribution reserves browser work for T3',
    'Command deduplication avoids repeated aggregate tests',
    'Model economy defers unrelated changes', 'Runnable traceable grammar retains one closeout',
    'Non-UI design has no theme token change; not applicable',
    'Non-UI human usability has no entry or recovery change; not applicable'];

for (const count of [1, 3, 10]) test(`incremental Plan seals ${count} reviewed steps with bounded records`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-incremental-plan-'));
    try {
        await mkdir(join(root, 'test'));
        await writeFile(join(root, 'README.md'), 'source one\n');
        await writeFile(join(root, 'test', 'feature.test.js'), 'test source\n');
        const repo = new ChatRepository(), grounder = new ChatProjectGrounder({} as never);
        const chatId = randomUUID(), userId = randomUUID();
        const created = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
        const lease = await repo.claim(root, chatId, 'owner');
        assert.equal(lease.acquired, true);
        const identity = newPromptDraftIdentity('safe-plan', root, chatId, userId, lease.token,
            'a'.repeat(40), '0.13.11', 'b'.repeat(64));
        await repo.mutate(root, created.revision, { type: 'append-user', chatId, message: {
            schemaVersion: 1, id: userId, role: 'user', createdAt: new Date().toISOString(),
            content: '/prompt-ass safe-plan Repair feature', contextRefs: [], promptDraft: identity
        } }, lease.token);
        const store = new PromptDraftStore(repo, grounder, async () => ({ head: 'a'.repeat(40),
            packageVersion: '0.13.11', worktreeFingerprint: 'b'.repeat(64) }));
        await store.begin(root, identity, lease.token);
        const assessment = { kind: 'wireframe' as const, objective: 'Repair feature', count,
            rationale: 'Each approved responsibility is separate',
            work: Array.from({ length: count }, (_, i) => ({ id: `step-${i + 1}`,
                title: `Implement feature ${i + 1}`, objective: `Change feature ${i + 1}`,
                boundary: `Source feature ${i + 1}`, dependsOn: i ? [`step-${i}`] : [] })),
            constraints: [], deferrals: [], closeout: { title: 'Manual closeout',
                objective: 'Observe feature in browser', manualReason: 'Human check is separate' },
            sourceClaims: [] };
        await store.stage(root, identity, lease.token, 'assessment', 0, assessment, []);
        const source = await grounder.readFileRange(root, 'README.md');
        const target = await grounder.readFileRange(root, 'test/feature.test.js');
        const refs = [source, target].map(page => ({ schemaVersion: 1, kind: 'file', origin: 'tool',
            id: page.path, label: page.path, projectId: hash(root), sourceHash: page.sourceHash,
            start: page.offset, end: page.endOffset, estimatedTokens: 1 })) as never;
        const reads = [source, target].map(page => ({ path: page.path, start: page.offset,
            end: page.endOffset, sourceHash: page.sourceHash, text: page.text }));
        const controller = new IncrementalPlan(store, grounder, root, identity, lease.token, assessment);
        await assert.rejects(controller.finish(), /PLAN_INCOMPLETE/);
        for (const outline of assessment.work) {
            const step = { id: outline.id, title: outline.title,
                assessmentObjective: outline.objective, boundary: outline.boundary,
                objective: `Implement change for ${outline.id}`, tier: 'T1',
                dependsOn: outline.dependsOn, workingSet: ['README.md'],
                requirements: ['Change README.md feature'], preservedBehavior: ['Keep source one'],
                risks: ['Avoid changing unrelated source'], deferrals: [],
                validationTargets: ['Run test/feature.test.js'], buildNeeds: 'No build needed',
                acceptanceCriteria: ['README.md behavior is documented'],
                sourceClaims: [{ claim: 'Source contains one', path: 'README.md', quote: 'source one' }],
                estimatedMinutes: 6 };
            if (outline.id === 'step-1') {
                await assert.rejects(controller.stageStep({ ...step, workingSet: ['src/invented.js'] },
                    refs, reads), /UNSUPPORTED_SOURCE/);
                await assert.rejects(controller.stageStep({ ...step, dependsOn: ['step-99'] },
                    refs, reads), /INVALID_STEP/);
                await assert.rejects(controller.stageStep({ ...step, requirements: ['x'.repeat(13_000)] },
                    refs, reads), /INVALID_STEP/);
                await assert.rejects(controller.stageStep({ ...step, sourceClaims: [{ ...step.sourceClaims[0],
                    quote: 'invented quote' }] }, refs, reads), /UNSUPPORTED_SOURCE/);
                assert.deepEqual((await controller.status() as { acceptedStepIds: string[] }).acceptedStepIds, []);
            }
            assert.deepEqual(await controller.stageStep(step, refs, reads),
                { accepted: outline.id, idempotent: false,
                    remaining: count - Number(outline.id.slice(5)) });
            assert.deepEqual(await controller.stageStep(step, refs, reads),
                { accepted: outline.id, idempotent: true });
            await assert.rejects(controller.stageStep({ ...step, buildNeeds: 'Different build' }, refs, reads),
                /CONFLICTING_REPLAY/);
            if (outline.id === 'step-1') {
                const status = await controller.status() as { acceptedSteps: { id: string; hash: string }[] };
                const changed = { ...step, buildNeeds: 'No changed-package build needed' };
                await assert.rejects(controller.correctStep({ expectedHash: '0'.repeat(64),
                    step: changed }, refs, reads), /CONFLICTING_REPLAY/);
                await assert.rejects(controller.correctStep({ expectedHash: status.acceptedSteps[0].hash,
                    step: { ...changed, sourceClaims: [{ ...step.sourceClaims[0], quote: 'invented' }] } },
                refs, reads), /UNSUPPORTED_SOURCE/);
                assert.deepEqual(await controller.correctStep({ expectedHash: status.acceptedSteps[0].hash,
                    step: changed }, refs, reads), { accepted: 'step-1', idempotent: false,
                    corrected: true, remaining: count - 1 });
            }
        }
        const reopened = new IncrementalPlan(new PromptDraftStore(new ChatRepository(), grounder,
            async () => ({ head: 'a'.repeat(40), packageVersion: '0.13.11',
                worktreeFingerprint: 'b'.repeat(64) })), grounder, root, identity, lease.token, assessment);
        assert.equal((await reopened.status() as { acceptedStepIds: string[] }).acceptedStepIds.length, count);
        const foreign = new IncrementalPlan(store, grounder, root, identity, 'foreign-lease', assessment);
        await assert.rejects(foreign.status(), /lease/);
        await writeFile(join(root, 'README.md'), 'changed source\n');
        await assert.rejects(reopened.status(), /source changed|unavailable/i);
        await writeFile(join(root, 'README.md'), 'source one\n');
        await assert.rejects(reopened.finish(), /PLAN_INCOMPLETE/);
        await reopened.stageCloseout({ ...assessment.closeout, browserRequired: true, tier: 'T3',
            acceptanceCriteria: ['Observe feature in browser'] });
        for (let i = 0; i < 10; i++) await reopened.stageEfficiency({ index: i + 1, finding: audit[i] });
        assert.equal((await reopened.status() as { finishEligible: boolean }).finishEligible, true);
        const finished = await reopened.finish();
        assert.equal(finished.record.work.length, count);
        assert.equal(finished.saved.plan?.dependencyHash, finished.saved.assessment?.contentHash);
        assert.equal((await reopened.finish()).saved.plan?.contentHash, finished.saved.plan?.contentHash);
        assert.equal((await store.planView(root, identity, lease.token)).includes('Prompt Efficiency Gates:'), true);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('historical malformed final JSON is rejected without a Plan record', () => {
    const assessment = { kind: 'wireframe' as const, objective: 'Repair feature', count: 1,
        rationale: 'One step', work: [{ id: 'step-1', title: 'Implement',
            objective: 'Change feature', boundary: 'Source', dependsOn: [] }],
        constraints: [], deferrals: [], closeout: { title: 'Manual closeout',
            objective: 'Observe feature', manualReason: 'Human check' }, sourceClaims: [] };
    assert.throws(() => validatedPlan('{"work":[{"id":"step-1",}', assessment, [], 1, []),
        /PLAN_JSON/);
});
