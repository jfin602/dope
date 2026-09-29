import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateDependencies, assignOwnership, createSnapshot, derivedId, hierarchy, ownershipForPath,
  parseArchitecture, parseArchitectureJson, relationshipId, relationshipsFor, validateSubsystemDependencies,
} from '../../packages/software-model/lib/index.js';
import type { ArchitectureDeclaration, CodeEntityNode, Evidence, ModelNode, ModelRelationship, SnapshotMetadata } from '../../packages/software-model/lib/index.js';

const declaration: ArchitectureDeclaration = {
  schemaVersion: 1,
  systems: [{ id: 'app', name: 'Application', purpose: 'Serve the application', roots: ['src'], subsystems: [
    { id: 'api', name: 'API', purpose: 'Public API', roots: ['src/api'], allowedDependencies: ['core'], forbiddenDependencies: ['secret'],
      components: [{ id: 'routes', name: 'Routes', purpose: 'Route handlers', roots: ['src/api/routes'] }] },
    { id: 'core', name: 'Core', purpose: 'Domain logic', roots: ['src/core'] },
    { id: 'secret', name: 'Secret', purpose: 'Private implementation', roots: ['src/secret'] },
  ] }],
};
const architecture = parseArchitecture(declaration);
const metadata: SnapshotMetadata = { generation: 2, inputFingerprint: 'source@2', projectId: 'project', analysis: { completeness: 'complete', errors: [] } };
const evidence: Evidence[] = [
  { id: 'decl', class: 'declaration', producer: 'architecture', producerVersion: '1', path: '.dope/architecture.json' },
  { id: 'import-a', class: 'semantic', producer: 'fixture', producerVersion: '1', path: 'src/api/routes/a.ts', span: { start: 4, length: 12, line: 1, column: 5 } },
  { id: 'import-b', class: 'semantic', producer: 'fixture', producerVersion: '1', path: 'src/api/routes/a.ts', span: { start: 24, length: 14 } },
];
const code = (path: string): CodeEntityNode => assignOwnership({
  id: derivedId('file', path), kind: 'code', codeKind: 'file', name: path, path,
  evidenceIds: ['import-a'], ownership: { state: 'unassigned' },
}, architecture, 'project');
const project: ModelNode = { id: 'project', kind: 'project', name: 'Fixture', evidenceIds: [] };
const system: ModelNode = { id: 'app', kind: 'system', name: 'Application', purpose: 'Serve', parentId: 'project', evidenceIds: ['decl'] };
const api: ModelNode = { id: 'api', kind: 'subsystem', name: 'API', purpose: 'Public', parentId: 'app', evidenceIds: ['decl'] };
const core: ModelNode = { id: 'core', kind: 'subsystem', name: 'Core', purpose: 'Logic', parentId: 'app', evidenceIds: ['decl'] };
const secret: ModelNode = { id: 'secret', kind: 'subsystem', name: 'Secret', purpose: 'Private', parentId: 'app', evidenceIds: ['decl'] };
const routes: ModelNode = { id: 'routes', kind: 'component', name: 'Routes', purpose: 'Handlers', parentId: 'api', evidenceIds: ['decl'] };

test('strict declaration parser rejects malformed, future, duplicate and unsafe data', () => {
  assert.deepEqual(parseArchitectureJson(JSON.stringify(declaration)), architecture);
  assert.throws(() => parseArchitectureJson('{'));
  assert.throws(() => parseArchitecture({ ...declaration, schemaVersion: 2 }));
  assert.throws(() => parseArchitecture({ ...declaration, extra: true }));
  assert.throws(() => parseArchitecture({ ...declaration, systems: [{ ...declaration.systems[0], id: 'api' }] }));
  assert.throws(() => parseArchitecture({ ...declaration, systems: [{ ...declaration.systems[0], subsystems: [declaration.systems[0].subsystems[0], declaration.systems[0].subsystems[0]] }] }));
  for (const root of ['/tmp/x', 'C:/x', '../x', 'a/../x', './x', 'a//x', 'a\\x', 'a\0x', 'a/', '']) {
    const changed = structuredClone(declaration);
    changed.systems[0].subsystems[0].roots = [root];
    assert.throws(() => parseArchitecture(changed), root);
  }
  const ambiguous = structuredClone(declaration);
  ambiguous.systems[0].subsystems[1].roots = ['src/api'];
  assert.throws(() => parseArchitecture(ambiguous), /ambiguous/);
  const unknown = structuredClone(declaration);
  unknown.systems[0].subsystems[0].allowedDependencies = ['missing'];
  assert.throws(() => parseArchitecture(unknown), /unknown dependency/);
});

test('explicit longest root owns code; unmatched code stays unassigned', () => {
  assert.deepEqual(ownershipForPath(architecture, 'src/api/routes/a.ts'), {
    state: 'assigned', systemId: 'app', subsystemId: 'api', componentId: 'routes', matchedRoot: 'src/api/routes',
  });
  assert.equal(ownershipForPath(architecture, 'src/api/other.ts').subsystemId, 'api');
  assert.equal(ownershipForPath(architecture, 'src/other.ts').systemId, 'app');
  assert.deepEqual(ownershipForPath(architecture, 'elsewhere/a.ts'), { state: 'unassigned' });
  assert.equal(code('elsewhere/a.ts').parentId, 'project');
  assert.equal(code('src/api/routes/a.ts').parentId, 'routes');
});

test('derived identities, order, dedupe and queries are deterministic', () => {
  const a = code('src/api/routes/a.ts');
  const b = code('src/core/b.ts');
  const unassigned = code('elsewhere/a.ts');
  assert.equal(derivedId('symbol', 'src/a.ts', 'C.method'), derivedId('symbol', 'src/a.ts', 'C.method'));
  assert.notEqual(derivedId('file', 'src/a.ts'), derivedId('module', 'src/a.ts'));
  const id = relationshipId('imports', a.id, b.id, '4');
  const edge: ModelRelationship = { id, kind: 'imports', sourceId: a.id, targetId: b.id, evidenceIds: ['import-a'] };
  const nodes = [core, a, routes, project, b, secret, api, system, unassigned];
  const snapshot = createSnapshot(metadata, nodes, [edge, { ...edge, evidenceIds: ['import-b'] }], evidence);
  const reversed = createSnapshot(metadata, [...nodes].reverse(), [{ ...edge, evidenceIds: ['import-b'] }, edge], [...evidence].reverse());
  assert.deepEqual(snapshot, reversed);
  assert.deepEqual(snapshot.relationships[0].evidenceIds, ['import-a', 'import-b']);
  assert.deepEqual(hierarchy(snapshot, 'api').map(node => node.id), ['routes']);
  assert.deepEqual(hierarchy(snapshot, 'api', true).map(node => node.id), ['routes', a.id].sort());
  assert.deepEqual(relationshipsFor(snapshot, b.id, 'incoming').map(item => item.id), [id]);
  assert.deepEqual(relationshipsFor(snapshot, b.id, 'outgoing'), []);
  assert.equal(snapshot.nodes.find(node => node.id === unassigned.id)?.kind, 'code');
});

test('physical relationships require traceable evidence and valid references', () => {
  const a = code('src/api/routes/a.ts');
  const b = code('src/core/b.ts');
  const nodes = [project, system, api, core, secret, routes, a, b];
  const edge: ModelRelationship = { id: relationshipId('imports', a.id, b.id), kind: 'imports', sourceId: a.id, targetId: b.id, evidenceIds: ['import-a'] };
  assert.throws(() => createSnapshot(metadata, nodes, [{ ...edge, evidenceIds: [] }], evidence));
  assert.throws(() => createSnapshot(metadata, nodes, [{ ...edge, evidenceIds: ['missing'] }], evidence));
  assert.throws(() => createSnapshot(metadata, nodes, [{ ...edge, targetId: 'missing' }], evidence));
  assert.throws(() => createSnapshot(metadata, nodes, [{ ...edge, evidenceIds: ['decl'] }], evidence));
  assert.throws(() => createSnapshot(metadata, [...nodes, a], [edge], evidence));
  assert.throws(() => createSnapshot(metadata, nodes, [edge], [{ ...evidence[1], path: undefined }, evidence[0], evidence[2]]));
  assert.throws(() => createSnapshot(metadata, nodes, [edge], [...evidence, {
    id: 'bad-aggregate', class: 'aggregate', producer: 'core', producerVersion: '1', originRelationshipIds: ['missing'],
  }]));
});

test('aggregation retains concrete origins and forbidden rules take precedence over allow lists', () => {
  const a = code('src/api/routes/a.ts');
  const b = code('src/core/b.ts');
  const c = code('src/secret/c.ts');
  const d = code('src/api/routes/d.ts');
  const edges: ModelRelationship[] = [
    { id: 'e1', kind: 'imports', sourceId: a.id, targetId: b.id, evidenceIds: ['import-a'] },
    { id: 'e2', kind: 'imports', sourceId: a.id, targetId: b.id, evidenceIds: ['import-b'] },
    { id: 'e3', kind: 'references', sourceId: a.id, targetId: c.id, evidenceIds: ['import-b'] },
    { id: 'e4', kind: 'imports', sourceId: a.id, targetId: d.id, evidenceIds: ['import-a'] },
  ];
  const snapshot = createSnapshot(metadata, [project, system, api, core, secret, routes, a, b, c, d], edges, evidence);
  const aggregates = aggregateDependencies(snapshot, 'subsystem');
  assert.equal(aggregates.length, 2);
  assert.deepEqual(aggregates.find(edge => edge.targetId === 'core')?.originRelationshipIds, ['e1', 'e2']);
  assert.deepEqual(aggregates.find(edge => edge.targetId === 'core')?.evidenceIds, ['import-a', 'import-b']);
  const violations = validateSubsystemDependencies(architecture, aggregates);
  assert.deepEqual(violations.map(v => [v.rule, v.targetSubsystemId, v.originRelationshipIds]), [['forbidden-dependency', 'secret', ['e3']]]);
  const allowOnly = structuredClone(architecture);
  allowOnly.systems[0].subsystems[0].forbiddenDependencies = [];
  assert.equal(validateSubsystemDependencies(allowOnly, aggregates)[0].rule, 'unlisted-dependency');
  const noList = structuredClone(architecture);
  delete noList.systems[0].subsystems[0].allowedDependencies;
  delete noList.systems[0].subsystems[0].forbiddenDependencies;
  assert.deepEqual(validateSubsystemDependencies(noList, aggregates), []);
});
