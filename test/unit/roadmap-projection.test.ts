import assert from 'node:assert/strict';
import test from 'node:test';
import { projectRoadmap } from '../../packages/project-intelligence/lib/roadmap-projection.js';
import type { RoadmapIndex, RoadmapCheckpoint } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import type { RoadmapOwnerRecord } from '../../packages/project-intelligence/lib/node/roadmap-owner-links.js';

const citation = { path: 'docs/gate.md', sha256: 'a'.repeat(64), line: 1,
    text: 'Not Green; sequencing waiver', status: 'not-green' as const, statusText: 'Not Green' };
const checkpoint = (id: string, kind: RoadmapCheckpoint['kind'], order: number,
    dependencies: string[] = [], status: RoadmapCheckpoint['status'] = 'unknown'): RoadmapCheckpoint => ({
    id, kind, title: id, objective: '', order, dependencies, links: [], status,
    readOnly: false, evidence: status === 'not-green' ? [citation] : [],
});
const index = (projectId: string, checkpoints: RoadmapCheckpoint[]): RoadmapIndex => ({
    schemaVersion: 1, projectId, projectRoot: '/example', revision: 5, checkpoints,
});

test('stable phase path, explicit milestone/correction branches and status evidence', () => {
    const phase1 = checkpoint('p1', 'phase', 1, [], 'green');
    const phase2 = checkpoint('p2', 'phase', 2, ['p1'], 'not-green');
    const correction = checkpoint('c1', 'correction', 3, ['p1'], 'waived');
    const milestone = checkpoint('m1', 'milestone', 4, ['p2'], 'unknown');
    const first = projectRoadmap(index('a', [milestone, phase2, correction, phase1]));
    const second = projectRoadmap(index('a', [phase1, correction, milestone, phase2]), [],
        { viewport: { x: 8, y: 9, zoom: 2 }, placements: { p1: { x: 100, y: 200 } }, colors: { p2: 'green' } });
    assert.deepEqual(first, second);
    assert.deepEqual(first.nodes.map(node => node.id), ['p1', 'p2', 'c1', 'm1']);
    assert.deepEqual(first.edges.map(edge => [edge.from, edge.to, edge.kind]),
        [['p1', 'c1', 'branch'], ['p1', 'p2', 'dependency'], ['p2', 'm1', 'branch']]);
    assert.equal(first.nodes[1].statusLabel, 'Not Green');
    assert.deepEqual(first.nodes[1].evidence, [citation]);
    assert.equal(first.nodes[2].statusLabel, 'Waived');
    assert.equal(first.nodes[3].statusLabel, 'Unknown');
});

test('missing references remain diagnostics and detached pools preserve owner truth', () => {
    const phase = checkpoint('p', 'phase', 0, ['missing']);
    phase.links = [{ owner: 'project-mind', targetId: 'lost', ownerRevision: 1 }];
    const owners = [
        { owner: 'issue', targetId: 'ABCD', sourceHash: 'b'.repeat(64), title: 'Issue', status: 'Open',
            body: 'Original', readOnly: true },
        { owner: 'project-mind', targetId: 'idea-1', ownerRevision: 3, title: 'Idea', status: 'parked',
            artifact: { type: 'idea' }, readOnly: false },
    ] as RoadmapOwnerRecord[];
    const result = projectRoadmap(index('a', [phase]), owners);
    assert.deepEqual(result.edges, []);
    assert.deepEqual(result.diagnostics, [
        'Missing dependency: p -> missing', 'Missing project-mind reference: p -> lost',
    ]);
    assert.deepEqual(result.pools.ideas.map(item => [item.title, item.status, item.ownerRevision]), [['Idea', 'parked', 3]]);
    assert.deepEqual(result.pools.issues.map(item => [item.title, item.status, item.readOnly]), [['Issue', 'Open', true]]);
    phase.links.push({ owner: 'issue', targetId: 'ABCD', sourceHash: 'b'.repeat(64) });
    assert.deepEqual(projectRoadmap(index('a', [phase]), owners).pools.issues, []);
});

test('selection payload is bounded and project switches do not carry a stale selection', () => {
    const center = checkpoint('center', 'phase', 0);
    center.links = Array.from({ length: 20 }, (_, n) => ({ owner: 'document' as const, targetId: `doc-${n}` }));
    const related = Array.from({ length: 20 }, (_, n) => checkpoint(`n${n}`, 'phase', n + 1, ['center']));
    const selected = projectRoadmap(index('first', [center, ...related]), [], { selectedId: 'center' });
    assert.equal(selected.selection?.neighbors.length, 16);
    assert.equal(selected.selection?.omittedNeighbors, 4);
    assert.equal(selected.selection?.links.length, 16);
    assert.equal(selected.selection?.omittedLinks, 4);
    const switched = projectRoadmap(index('second', [checkpoint('center', 'phase', 0)]), [],
        { projectId: 'first', selectedId: 'center' });
    assert.equal(switched.projectId, 'second');
    assert.equal(switched.selection, undefined);
});
