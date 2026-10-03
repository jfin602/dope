import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { architectureDraft, reviewDiagnostics, reviewDeclaration, parseArchitecture } = require('../../packages/software-map/lib/index.js');
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

test('canonical Architecture round-trips through stable editor keys with dependency constraints', () => {
  const declaration = parseArchitecture({ schemaVersion: 1, systems: [{ id: 'app', name: 'App', purpose: 'App', roots: ['src'], subsystems: [
    { id: 'api', name: 'API', purpose: 'API', roots: ['src/api'], allowedDependencies: ['core'], forbiddenDependencies: [],
      components: [{ id: 'handler', name: 'Handler', purpose: 'Handler', roots: ['src/api/handler.ts'] }] },
    { id: 'core', name: 'Core', purpose: 'Core', roots: ['src/core'] },
  ] }] });
  const first = architectureDraft(declaration);
  assert.deepEqual(first, architectureDraft(declaration));
  assert.deepEqual(reviewDiagnostics(first), []);
  assert.deepEqual(parseArchitecture(reviewDeclaration(first)), declaration);
  const key = first.find((item: any) => item.id === 'api').proposalKey;
  first.find((item: any) => item.id === 'api').id = 'api-renamed';
  assert.equal(first.find((item: any) => item.id === 'api-renamed').proposalKey, key);
  first.find((item: any) => item.id === 'api-renamed').allowedDependencies = ['missing'];
  assert.ok(reviewDiagnostics(first).some((issue: any) => issue.code === 'invalid_dependency_target'));
  first.find((item: any) => item.id === 'api-renamed').allowedDependencies = ['core'];
  first.find((item: any) => item.id === 'api-renamed').forbiddenDependencies = ['core'];
  assert.ok(reviewDiagnostics(first).some((issue: any) => issue.code === 'conflicting_dependency_target'));
});
