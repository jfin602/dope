import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { assemblePhysicalMap } from '../../packages/software-map/lib/index.js';

const root = new URL('../fixtures/flow-boundaries/', import.meta.url).pathname;
const analyzer = new TypeScriptAnalyzer();

test('semantic HTTP, PostgreSQL and external boundaries survive renamed fixture and snapshot assembly', () => {
  const result = analyzer.analyze(root);
  assert.deepEqual(result.status.errors, []);
  assert.equal(result.status.completeness, 'partial');
  assert.deepEqual(result.flowFacts, analyzer.analyze(root).flowFacts);
  const nodes = new Map(result.nodes.map(node => [node.id, node]));
  const evidence = new Map(result.evidence.map(item => [item.id, item]));
  const facts = (kind: string) => result.flowFacts.filter(fact => fact.kind === kind);
  assert.equal(facts('receives').length, 3);
  assert.equal(facts('responds').length, 3);
  assert.equal(facts('reads').length, 1);
  assert.equal(facts('writes').length, 1);
  assert.equal(facts('calls-external').length, 3);
  for (const fact of facts('receives')) {
    assert.ok(['anonymous-callable', 'function'].includes(nodes.get(fact.targetId)?.analyzerKind ?? ''));
    assert.notEqual(nodes.get(fact.targetId)?.name, 'mount');
    assert.ok(result.flowEndpoints.some(endpoint => endpoint.id === fact.sourceId && endpoint.identity.path?.startsWith('/v9/')));
  }
  for (const fact of facts('responds')) {
    assert.ok(facts('receives').some(input => input.targetId === fact.sourceId &&
      result.flowEndpoints.find(endpoint => endpoint.id === input.sourceId)?.identity.path ===
      result.flowEndpoints.find(endpoint => endpoint.id === fact.targetId)?.identity.path));
  }
  assert.equal(new Set([...facts('reads'), ...facts('writes')].map(fact => fact.targetId)).size, 1);
  assert.deepEqual([...facts('reads'), ...facts('writes')].map(fact => fact.enrichment?.[0]?.label).sort(), ['widgets', 'widgets']);
  assert.ok(result.flowEndpoints.some(endpoint => endpoint.identity.service === 'google-genai'));
  assert.ok(result.flowEndpoints.some(endpoint => endpoint.identity.service === 'example.net'));
  assert.ok(result.flowEndpoints.some(endpoint => endpoint.identity.sourceScope?.startsWith('src/outbound/client.ts:')));
  assert.deepEqual(result.flowDiagnostics.map(item => item.code).sort(), ['unresolved-express-route', 'unresolved-postgres-query']);
  assert.ok(result.flowCoverage.every(item => item.status === 'partial' && item.diagnosticIds.length));
  for (const fact of result.flowFacts) {
    const proof = evidence.get(fact.evidenceIds[0])!;
    assert.equal(proof.flowKind, fact.kind);
    assert.ok(proof.path && proof.span?.length);
    assert.ok(proof.span!.start + proof.span!.length <= readFileSync(join(root, proof.path), 'utf8').length);
  }
  const snapshot = assemblePhysicalMap({ projectId: 'project', generation: 1, inputFingerprint: 'fixture', analysis: result.status },
    { schemaVersion: 1, systems: [] }, result);
  assert.equal(snapshot.flowFacts.length, result.flowFacts.length);
  assert.equal(snapshot.flowCoverage.length, result.flowCoverage.length);
});
