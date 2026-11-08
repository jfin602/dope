import assert from 'node:assert/strict';
import test from 'node:test';
import { documentModelStage, promptModelStage, proposalToolError } from
  '../../packages/theia-extension/lib/node/proposal-model-tools.js';
import { IncrementalPromptStack } from '../../packages/theia-extension/lib/node/incremental-prompt-stack.js';
import { requestedWorkPromptCount } from '../../packages/theia-extension/lib/node/prompt-authoring-stage.js';

test('typed document operations bind a broker read and never accept a model hash or counter', () => {
  const page = { path: 'docs/source.md', text: 'Observed excerpt', fullHash: 'f'.repeat(64),
    sourceHash: 'a'.repeat(64), offset: 0, endOffset: 16, fileBytes: 16 };
  assert.deepEqual(JSON.parse(documentModelStage({ path: page.path, operation: 'replace',
    before: 'Observed excerpt', after: 'New excerpt', complete: true }, [page]).content),
  { operation: 'replace', before: 'Observed excerpt', after: 'New excerpt', sourceHash: page.fullHash });
  assert.throws(() => documentModelStage({ path: page.path, operation: 'replace',
    before: 'Unread', after: 'New', complete: true }, [page]), /BEFORE_UNREAD/);
  assert.throws(() => documentModelStage({ path: page.path, operation: 'replace',
    before: 'Observed excerpt', after: 'New', sourceHash: page.fullHash,
    complete: true }, [page]), /UNSUPPORTED_FIELD:sourceHash/);
  assert.throws(() => documentModelStage({ path: page.path, operation: 'remove',
    complete: true }, [page]), /REMOVE_UNSAVED/);
  assert.throws(() => documentModelStage({ path: page.path, operation: 'create',
    chunk: 'New', sequence: 2, complete: true }, []), /UNSUPPORTED_FIELD:sequence/);
});

test('typed prompt steps derive their ID and require exact fields', () => {
  const stage = promptModelStage({ target: 'step-1', kind: 'work', title: 'Implement source',
    objective: 'Repair source', tier: 'T1', workingSet: ['src/file.ts'],
    acceptanceCriteria: ['Actual behavior'], validationTargets: ['test/unit/file.test.ts'],
    complete: true });
  assert.equal(JSON.parse(stage.content).id, 'step-1');
  assert.throws(() => promptModelStage({ target: 'step-1', kind: 'section',
    heading: 'Details', complete: true }), /REQUIRED_FIELD:text/);
  assert.throws(() => promptModelStage({ target: 'closeout', kind: 'closeout',
    title: 'Closeout', objective: 'Observe', manualReason: 'Browser',
    acceptanceCriteria: ['Observe'], browserRequired: true, efficiencyAudit: [],
    idempotencyKey: 'model-owned', complete: true }), /UNSUPPORTED_FIELD:idempotencyKey/);
  assert.deepEqual(proposalToolError(new Error('PROPOSAL_STAGE_REQUIRED_FIELD:text')),
    { version: 1, error: 'PROPOSAL_STAGE_REQUIRED_FIELD', field: 'text',
      expected: 'Supply the named required field.',
      recovery: 'Check proposal_status, correct the named field or operation, then retry.' });
});

test('ten requested work steps cannot be sealed as six or use closeout as a work step', async () => {
  assert.equal(requestedWorkPromptCount('Prepare ten substantial work prompts plus a manual closeout.'), 10);
  assert.equal(requestedWorkPromptCount('Create 6 prompts.', 'Earlier request for ten steps.'), 6);
  assert.equal(requestedWorkPromptCount('No count was requested.'), undefined);
  const stack = new IncrementalPromptStack('/tmp/unused', 'c13-example', '0.13.11',
    {} as never, {} as never, 1, {} as never, 10);
  const stages = Array.from({ length: 6 }, (_, index) => ({ target: `step-${index + 1}`,
    content: '{}', complete: true }));
  const snapshot = { stages } as never;
  assert.deepEqual(stack.readyForFinish(snapshot),
    { ready: false, nextAction: 'Stage 4 remaining requested work prompts before closeout.' });
  await assert.rejects(stack.validateStage(snapshot, { target: 'closeout', chunkIndex: 0,
    complete: true, content: JSON.stringify({ kind: 'closeout' }) } as never), /PROMPT_WORK_COUNT/);
  const ten = Array.from({ length: 10 }, (_, index) => ({ target: `step-${index + 1}`,
    complete: true, content: JSON.stringify({ kind: 'work', id: `step-${index + 1}`,
      title: 'Work', objective: 'Implement', tier: 'T1', workingSet: ['src/file.ts'],
      acceptanceCriteria: ['Checked behavior'], validationTargets: ['test/unit/file.test.ts'] }) }));
  const closeout = { kind: 'closeout', title: 'Manual closeout', objective: 'Observe browser',
    manualReason: 'Human interaction', acceptanceCriteria: ['Observe behavior'], browserRequired: true,
    efficiencyAudit: Array.from({ length: 10 }, (_, index) =>
      `Gate ${index + 1} checks the same generic outcome without specific evidence.`) };
  await assert.rejects(stack.validateStage({ stages: ten } as never, { target: 'closeout',
    chunkIndex: 0, complete: true, content: JSON.stringify(closeout) } as never), /PROMPT_CLOSEOUT_STAGE/);
  await assert.rejects(stack.validateStage({ stages: ten } as never, { target: 'closeout',
    chunkIndex: 0, complete: true, content: JSON.stringify({ ...closeout,
      efficiencyAudit: Array.from({ length: 10 }, (_, index) =>
        `Specific gate ${index + 1} addresses distinct source condition ${index + 1}.`),
      browserRequired: false }) } as never), /PROMPT_CLOSEOUT_STAGE/);
  await assert.rejects(stack.validateComplete({ stages: [...ten, { target: 'closeout',
    complete: true, content: JSON.stringify(closeout) }] } as never), /PROMPT_T2_GATE/);
});
