import assert from 'node:assert/strict';
import test from 'node:test';
import {
  architectureProposalSchema, parseArchitectureProposal, parseArchitectureProposalJson, validateArchitectureEvidencePacket,
} from '../../packages/software-map/lib/index.js';
import type { ArchitectureEvidencePacket, ArchitectureProposal, SoftwareMapInitializationState } from '../../packages/software-map/lib/index.js';

const packet: ArchitectureEvidencePacket = {
  schemaVersion: 1, inputFingerprint: 'source@1', items: [
    { id: 'package', kind: 'topology', path: 'package.json', sourceEvidenceIds: [], scope: 'package', name: 'app' },
    { id: 'entry', kind: 'entrypoint', path: 'src/main.ts', sourceEvidenceIds: ['semantic:main'], role: 'server' },
  ],
};
const proposal: ArchitectureProposal = {
  schemaVersion: 1, summary: 'One application', needsMoreEvidence: false,
  nodes: [
    { proposalKey: 'proposal:a', kind: 'system', name: 'App', purpose: 'Serve users', parentProposalKey: null, confidence: 0,
      rationale: 'The package groups one app', evidenceRefs: ['package'], evidence: ['One package manifest'] },
    { proposalKey: 'proposal:b', kind: 'subsystem', name: 'Server', purpose: 'Serve requests', parentProposalKey: 'proposal:a', confidence: 1,
      rationale: 'The entrypoint starts a server', evidenceRefs: ['entry'], evidence: ['Server entrypoint'] },
    { proposalKey: 'proposal:c', kind: 'component', name: 'Main', purpose: 'Start server', parentProposalKey: 'proposal:b', confidence: 0.5,
      rationale: 'The file is an entrypoint', evidenceRefs: ['entry'], evidence: ['Main source file'] },
  ],
  unassignedEvidenceRefs: [], openQuestions: [], evidenceRequests: [],
};
const changed = (edit: (value: any) => void): unknown => { const value = structuredClone(proposal); edit(value); return value; };

test('schema and valid proposal retain temporary identities and confidence endpoints', () => {
  assert.equal(architectureProposalSchema.additionalProperties, false);
  assert.equal(architectureProposalSchema.properties.nodes.items.additionalProperties, false);
  assert.equal(architectureProposalSchema.properties.nodes.items.properties.confidence.minimum, 0);
  assert.equal(architectureProposalSchema.properties.nodes.items.properties.confidence.maximum, 1);
  assert.equal(architectureProposalSchema.properties.evidenceRequests.maxItems, 5);
  assert.deepEqual(parseArchitectureProposalJson(JSON.stringify(proposal), packet), proposal);
  assert.deepEqual(parseArchitectureProposal(proposal, packet), proposal);
  assert.equal('id' in proposal.nodes[0], false); // canonical identity is not model output
  assert.throws(() => parseArchitectureProposal(changed(p => { p.nodes[0].proposalKey = 'app'; }), packet));
  const states: SoftwareMapInitializationState[] = ['uninitialized', 'analyzing', 'review_required', 'initialized'];
  assert.deepEqual(states, ['uninitialized', 'analyzing', 'review_required', 'initialized']);
});

test('schema rejects malformed, unsupported, missing and extra fields', () => {
  assert.throws(() => parseArchitectureProposalJson('{', packet), /malformed JSON/);
  for (const value of [
    changed(p => { p.schemaVersion = 2; }), changed(p => { p.extra = true; }),
    changed(p => { delete p.summary; }), changed(p => { p.nodes[0].canonicalId = 'app'; }),
    changed(p => { delete p.nodes[0].rationale; }), changed(p => { p.evidenceRequests = [{ kind: 'topology', targets: ['src'], reason: 'Why', extra: true }]; p.needsMoreEvidence = true; }),
  ]) assert.throws(() => parseArchitectureProposal(value, packet));
});

test('hierarchy requires unique keys and exact System -> Subsystem -> Component parenting in any order', () => {
  assert.deepEqual(parseArchitectureProposal(changed(p => p.nodes.reverse()), packet).nodes.map(n => n.proposalKey), ['proposal:c', 'proposal:b', 'proposal:a']);
  for (const value of [
    changed(p => { p.nodes[1].proposalKey = 'proposal:a'; }),
    changed(p => { p.nodes[0].kind = 'code'; }),
    changed(p => { p.nodes[1].parentProposalKey = 'proposal:missing'; }),
    changed(p => { p.nodes[1].parentProposalKey = 'proposal:c'; }), // cycle and invalid parent kind
    changed(p => { p.nodes[0].parentProposalKey = 'proposal:a'; }),
    changed(p => { p.nodes[2].parentProposalKey = 'proposal:a'; }),
    changed(p => { p.nodes[2].parentProposalKey = 'proposal:c'; }),
  ]) assert.throws(() => parseArchitectureProposal(value, packet));
});

test('confidence is finite numeric 0..1 and never canonical authority', () => {
  for (const confidence of [-0.01, 1.01, NaN, Infinity, -Infinity, '0.5', null]) {
    assert.throws(() => parseArchitectureProposal(changed(p => { p.nodes[0].confidence = confidence; }), packet));
  }
  assert.equal(parseArchitectureProposal(changed(p => { p.nodes[0].confidence = 0.25; }), packet).nodes[0].confidence, 0.25);
});

test('hard refs resolve only against the exact packet; prose cannot replace them', () => {
  for (const value of [
    changed(p => { p.nodes[0].evidenceRefs = []; }),
    changed(p => { delete p.nodes[0].evidenceRefs; }),
    changed(p => { p.nodes[0].evidenceRefs = ['made-up']; p.nodes[0].evidence = ['This is source-backed']; }),
    changed(p => { p.nodes[0].evidenceRefs = ['package', 'package']; }),
    changed(p => { p.unassignedEvidenceRefs = ['made-up']; }),
    changed(p => { p.nodes[0].evidenceIds = ['made-up']; }),
  ]) assert.throws(() => parseArchitectureProposal(value, packet));
  assert.throws(() => parseArchitectureProposal(proposal, { ...packet, items: [packet.items[1]] }), /unknown/);
  assert.throws(() => validateArchitectureEvidencePacket({ ...packet, items: [packet.items[0], packet.items[0]] }), /duplicate/);
  assert.throws(() => validateArchitectureEvidencePacket({ ...packet, items: [{ ...packet.items[0], path: '../outside' }] }), /path/);
  assert.throws(() => validateArchitectureEvidencePacket({ ...packet, schemaVersion: 2 as 1 }), /packet/);
});

test('evidence requests are bounded, typed and path targeted', () => {
  const request = { kind: 'dependency', targets: ['src/main.ts'], reason: 'Inspect imports' };
  const valid = changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [request]; });
  assert.deepEqual(parseArchitectureProposal(valid, packet).evidenceRequests, [request]);
  for (const value of [
    changed(p => { p.evidenceRequests = [request]; }),
    changed(p => { p.needsMoreEvidence = true; }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = Array(6).fill(request); }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [{ ...request, kind: 'filesystem' }]; }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [{ ...request, targets: [] }]; }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [{ ...request, targets: Array(6).fill('src/main.ts') }]; }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [{ ...request, targets: ['../outside'] }]; }),
    changed(p => { p.needsMoreEvidence = true; p.evidenceRequests = [{ ...request, reason: '' }]; }),
  ]) assert.throws(() => parseArchitectureProposal(value, packet));
});
