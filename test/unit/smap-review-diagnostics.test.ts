import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { reviewDiagnostics, reviewDeclaration, parseArchitecture } = require('../../packages/software-map/lib/index.js');
const node = (proposalKey: string, kind: string, id: string, parentProposalKey: string | null, roots: string[]) =>
  ({ proposalKey, kind, id, name: proposalKey, purpose: proposalKey, parentProposalKey, roots });

test('review diagnostics report combined blockers, every root claimant and stable order', () => {
  const draft = [
    node('system', 'system', 'bad id', null, ['shared']),
    node('sub-a', 'subsystem', 'same', 'system', ['shared', '../unsafe']),
    node('sub-b', 'subsystem', 'same', 'system', ['shared', 'shared']),
    node('orphan', 'component', '', 'missing', []),
  ];
  draft[0].purpose = ' ';
  draft[1].name = '';
  draft[2].roots.push(' ');
  const issues = reviewDiagnostics(draft);
  assert.deepEqual(issues, reviewDiagnostics(structuredClone(draft)));
  assert.deepEqual(issues, reviewDiagnostics([...draft].reverse()));
  assert.deepEqual(issues.map((issue: any) => issue.code), [...issues.map((issue: any) => issue.code)].sort());
  for (const code of ['invalid_id', 'duplicate_id', 'missing_parent', 'roots_required', 'unsafe_root', 'malformed_root',
    'duplicate_root', 'ambiguous_root', 'invalid_name', 'invalid_purpose'])
    assert.ok(issues.some((issue: any) => issue.code === code), code);
  const conflict = issues.find((issue: any) => issue.code === 'ambiguous_root');
  assert.deepEqual(conflict.proposalKeys, ['sub-a', 'sub-b', 'system']);
  assert.deepEqual(conflict.canonicalIds, ['bad id', 'same']);
  assert.deepEqual(conflict.paths, ['shared']);
  assert.throws(() => parseArchitecture(reviewDeclaration(draft)));
});

test('review diagnostics preserve strict acceptance for valid draft and schema requirements', () => {
  const valid = [node('system', 'system', 'app', null, []), node('sub', 'subsystem', 'core', 'system', ['src'])];
  assert.deepEqual(reviewDiagnostics(valid), []);
  assert.deepEqual(parseArchitecture(reviewDeclaration(valid)).systems[0].subsystems[0].id, 'core');
  assert.ok(reviewDiagnostics([valid[0]]).some((issue: any) => issue.code === 'subsystems_required'));
  assert.ok(reviewDiagnostics([]).some((issue: any) => issue.code === 'systems_required'));
});
