import assert from 'node:assert/strict';
import test from 'node:test';
import { criterionHash, isRoadmapGateSchemaShape, parseRoadmapGateIndex } from '../../packages/project-intelligence/lib/node/roadmap-gate-domain.js';

const hash = 'a'.repeat(64);
const source = { projectId: 'project-1', revision: 3, sha256: hash, path: 'src/main.ts' };
const states = { implementationStatus: 'implemented', qualificationStatus: 'unknown', draftAcceptance: 'accepted' };
const phase = (id: string, order: number, dependencies: string[] = []) => ({
    id, projectId: 'project-1', title: id, objective: 'Deliver an outcome', order, dependencies,
    ...states, gateSetCoverage: { status: 'unreviewed' },
});
const gate = (id: string, parentPhaseId: string, order: number, dependencies: string[] = []) => ({
    id, projectId: 'project-1', parentPhaseId, designation: `G${order + 1}`, title: id,
    purpose: 'Verify the outcome', order, dependencies, ...states,
    criteria: [{ id: `${id}-criterion`, projectId: 'project-1', title: 'Observed response',
        expectedResult: 'Response contains the expected value', order: 0,
        evidence: [{ id: `${id}-evidence`, projectId: 'project-1', criterionId: `${id}-criterion`,
            result: 'pass', kind: 'test', summary: 'Focused assertion passed', verifiedBy: 'owner',
            observedAt: '2026-10-29T12:00:00Z', source,
            criterionHash: criterionHash({ title: 'Observed response', expectedResult: 'Response contains the expected value' }),
            review: { status: 'proposed' } }] }],
});
const fixture = () => ({
    schemaVersion: 2, projectId: 'project-1', projectRoot: '/tmp/roadmap-1', revision: 3,
    phases: [phase('phase-1', 0), phase('phase-2', 1, ['phase-1'])],
    gates: [gate('gate-1', 'phase-1', 0), gate('gate-2', 'phase-2', 0, ['gate-1'])],
    corrections: [{ id: 'correction-1', projectId: 'project-1', parent: { kind: 'gate', id: 'gate-1' },
        criterionId: 'gate-1-criterion', title: 'Repair', objective: 'Fix the failed behavior', order: 0, ...states }],
    linkedDocument: { projectId: 'project-1', projectRoot: '/tmp/roadmap-1', path: 'docs/roadmap.md',
        sourceHash: hash, syncState: 'synced', sections: [
            { sectionKey: 'p1', kind: 'phase', id: 'phase-1' },
            { sectionKey: 'g1', kind: 'gate', id: 'gate-1' },
        ] },
});
const parse = (value: unknown) => parseRoadmapGateIndex(value, '/tmp/roadmap-1', 'project-1');
const copy = <T>(value: T): T => structuredClone(value);

test('schema 2 selector and strict parser accept explicit same-project hierarchy', () => {
    const value = fixture();
    assert.equal(isRoadmapGateSchemaShape(value), true);
    assert.equal(parse(value), value);
    assert.equal(isRoadmapGateSchemaShape({ schemaVersion: 1, checkpoints: [] }), false);
    assert.throws(() => parse({ schemaVersion: 1, checkpoints: [] }), /schema 2 shape/);
});

test('empty phases are valid, while an accepted gate needs at least one criterion', () => {
    const empty = fixture();
    empty.phases = []; empty.gates = []; empty.corrections = []; empty.linkedDocument.sections = [];
    assert.equal(parse(empty), empty);
    const invalid = fixture();
    invalid.gates[0].criteria = [];
    assert.throws(() => parse(invalid), /gate fields/);
});

test('rejects malformed fields, duplicate identities, orders and local designations', () => {
    const bad = [
        (v: ReturnType<typeof fixture>) => { v.gates[0].parentPhaseId = ''; },
        (v: ReturnType<typeof fixture>) => { v.gates[1].id = 'phase-1'; },
        (v: ReturnType<typeof fixture>) => { v.gates[1].parentPhaseId = 'phase-1'; v.gates[1].order = 0; },
        (v: ReturnType<typeof fixture>) => { v.gates[1].parentPhaseId = 'phase-1'; v.gates[1].designation = 'G1'; },
        (v: ReturnType<typeof fixture>) => { v.phases[1].order = 0; },
        (v: ReturnType<typeof fixture>) => { (v.gates[0] as object as Record<string, unknown>).extra = true; },
        (v: ReturnType<typeof fixture>) => { v.gates[0].criteria[0].expectedResult = ''; },
    ];
    for (const mutate of bad) { const v = fixture(); mutate(v); assert.throws(() => parse(v)); }
});

test('rejects absent or wrong-kind parents, dangling references and dependency cycles', () => {
    const bad = [
        (v: ReturnType<typeof fixture>) => { v.gates[0].parentPhaseId = 'missing'; },
        (v: ReturnType<typeof fixture>) => { v.corrections[0].parent = { kind: 'gate', id: 'phase-1' }; },
        (v: ReturnType<typeof fixture>) => { v.corrections[0].criterionId = 'gate-2-criterion'; },
        (v: ReturnType<typeof fixture>) => { v.gates[0].dependencies = ['foreign-gate']; },
        (v: ReturnType<typeof fixture>) => { v.phases[0].dependencies = ['phase-2']; },
        (v: ReturnType<typeof fixture>) => { v.gates[0].dependencies = ['gate-2']; },
        (v: ReturnType<typeof fixture>) => { v.linkedDocument.sections[0].id = 'missing'; },
    ];
    for (const mutate of bad) { const v = fixture(); mutate(v); assert.throws(() => parse(v)); }
});

test('rejects foreign project identity, malformed evidence, source drift metadata and size limits', () => {
    const bad = [
        (v: ReturnType<typeof fixture>) => { v.gates[0].projectId = 'other-project'; },
        (v: ReturnType<typeof fixture>) => { v.gates[0].criteria[0].evidence[0].criterionId = 'gate-2-criterion'; },
        (v: ReturnType<typeof fixture>) => { v.gates[0].criteria[0].evidence[0].source = { ...source, projectId: 'other-project' }; },
        (v: ReturnType<typeof fixture>) => { v.gates[0].criteria[0].evidence[0].source = { ...source, sha256: 'bad' }; },
        (v: ReturnType<typeof fixture>) => { v.gates[0].criteria[0].evidence[0].observedAt = 'yesterday'; },
        (v: ReturnType<typeof fixture>) => { v.linkedDocument.path = '../elsewhere.md'; },
        (v: ReturnType<typeof fixture>) => { v.gates[0].criteria[0].evidence = Array.from({ length: 129 }, (_, i) =>
            ({ ...copy(v.gates[0].criteria[0].evidence[0]), id: `e-${i}` })); },
    ];
    for (const mutate of bad) { const v = fixture(); mutate(v); assert.throws(() => parse(v)); }
    assert.throws(() => parseRoadmapGateIndex(fixture(), '/tmp/other', 'project-1'), /project or index fields/);
    assert.throws(() => parseRoadmapGateIndex(fixture(), '/tmp/roadmap-1', 'other-project'), /project or index fields/);
    const oversized = fixture();
    oversized.phases = Array.from({ length: 4096 }, (_, i) => ({ ...phase(`phase-${i}`, i), objective: 'x'.repeat(1024) }));
    oversized.gates = []; oversized.corrections = []; oversized.linkedDocument.sections = [];
    assert.throws(() => parse(oversized), /size limit/);
});
