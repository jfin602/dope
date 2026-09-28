import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNote } from '../../packages/contracts/src/note.ts';
import type { Artifact, ProjectMind } from '../../packages/contracts/src/project-mind.ts';
import { addArtifact, archive, createProjectMind, linkArtifact, parseArtifact, parseProjectMind, queryArtifacts, replaceArtifact, supersede, transition, unlinkArtifact } from '../../packages/project-intelligence/lib/index.js';

const now = '2026-09-28T12:00:00.000Z';
const later = '2026-09-28T13:00:00.000Z';
const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'];
const base = { schemaVersion: 2 as const, title: 'Same', createdAt: now, updatedAt: now, provenance: 'developer' as const, archivedAt: null, links: [] };
const note: Artifact = { ...base, id: ids[0], type: 'note', status: 'active', body: 'One' };
const idea: Artifact = { ...base, id: ids[1], type: 'idea', status: 'captured', body: 'Two' };
const question: Artifact = { ...base, id: ids[2], type: 'question', status: 'open', body: 'Three' };
const decision: Artifact = { ...base, id: ids[3], type: 'decision', status: 'proposed', decision: '', context: '', rationale: '', consequences: 'unknown', alternatives: 'unknown', revisitConditions: 'unknown' };
const replacement: Artifact = { ...decision, id: ids[4], decision: 'Choose', context: 'Scope', rationale: 'Evidence' };
const empty: ProjectMind = { schemaVersion: 2, projectId: ids[4], revision: 1, artifacts: [] };
const withAll = [note, idea, question, decision, replacement].reduce(addArtifact, empty);

test('strict schema and all four types, including honest legacy dates', () => {
    assert.equal(createProjectMind(ids[4], note).revision, 1);
    assert.throws(() => parseProjectMind({ ...empty, revision: 0 }));
    assert.equal(withAll.revision, 6);
    assert.deepEqual(parseProjectMind(withAll), withAll);
    for (const artifact of withAll.artifacts) assert.equal(parseArtifact(artifact), artifact);
    assert.throws(() => parseProjectMind({ ...empty, schemaVersion: 3 }));
    assert.throws(() => parseProjectMind({ ...empty, artifacts: [note, note] }));
    assert.throws(() => parseProjectMind({ ...empty, artifacts: [{ ...decision, status: 'superseded' }] }));
    assert.throws(() => parseArtifact({ ...note, unknown: true }));
    assert.throws(() => parseArtifact(Object.assign(Object.create({ id: ids[0] }), (({ id, ...rest }) => rest)(note))));
    assert.throws(() => parseArtifact({ ...note, createdAt: null }));
    assert.throws(() => parseArtifact({ ...note, createdAt: 'yesterday' }));
    assert.throws(() => parseArtifact({ ...note, body: '<b>unsafe</b>', status: 'parked' }));
    assert.equal(parseArtifact({ ...note, body: '<b>unsafe</b>' }).body, '<b>unsafe</b>');
    assert.equal(parseArtifact({ ...note, createdAt: null, updatedAt: null, migration: { sourcePath: '.dope/note.json', sourceSchemaVersion: 1, migratedAt: now } }).createdAt, null);
    assert.equal(parseNote({ schemaVersion: 1, id: ids[0], type: 'note', title: 'Legacy', body: 'Still valid', provenance: 'developer' }).body, 'Still valid');
});

test('explicit lifecycle, answer and acceptance requirements', () => {
    assert.throws(() => transition(withAll, ids[0], 'parked', later));
    assert.equal(transition(transition(withAll, ids[1], 'parked', later), ids[1], 'captured', later).artifacts[1].status, 'captured');
    assert.throws(() => transition(withAll, ids[1], 'accepted', later));
    assert.throws(() => addArtifact(withAll, { ...replacement, id: '00000000-0000-4000-8000-000000000099', status: 'accepted' }));
    assert.throws(() => transition(withAll, ids[2], 'answered', later));
    const answered = transition(withAll, ids[2], 'answered', later, 'Because');
    assert.equal(transition(answered, ids[2], 'open', later).artifacts[2].answer, 'Because');
    assert.throws(() => transition(withAll, ids[3], 'accepted', later));
    assert.equal(transition(transition(withAll, ids[3], 'rejected', later), ids[3], 'proposed', later).artifacts[3].status, 'proposed');
    assert.throws(() => transition(withAll, ids[3], 'superseded', later));
});

test('supersession is one revision with an incoming link to the historical decision', () => {
    const prepared = replaceArtifact(withAll, { ...decision, decision: 'Old', context: 'Context', rationale: 'Reason', updatedAt: later });
    const accepted = transition(transition(prepared, ids[3], 'accepted', later), ids[4], 'accepted', later);
    const result = supersede(accepted, ids[3], ids[4], later);
    assert.equal(result.revision, accepted.revision + 1);
    assert.equal(result.artifacts[3].status, 'superseded');
    assert.deepEqual(result.artifacts[4].links, [{ relation: 'supersedes', target: { type: 'artifact', id: ids[3] } }]);
    assert.throws(() => supersede(result, ids[3], ids[4], later));
    assert.throws(() => supersede(accepted, ids[3], ids[3], later));
});

test('links validate targets, direction and paths; archive preserves links and identity', () => {
    const related = { relation: 'related' as const, target: { type: 'artifact' as const, id: ids[1] } };
    const linked = linkArtifact(withAll, ids[0], related, later);
    assert.throws(() => linkArtifact(linked, ids[0], related, later));
    assert.deepEqual(unlinkArtifact(linked, ids[0], { target: { id: ids[1], type: 'artifact' }, relation: 'related' }, later).artifacts[0].links, []);
    assert.throws(() => linkArtifact(withAll, ids[0], { ...related, target: { type: 'artifact', id: ids[0] } }, later));
    assert.throws(() => linkArtifact(withAll, ids[0], { ...related, target: { type: 'artifact', id: '00000000-0000-4000-8000-000000000099' } }, later));
    assert.throws(() => linkArtifact(withAll, ids[1], { relation: 'answers', target: { type: 'artifact', id: ids[2] } }, later));
    assert.deepEqual(linkArtifact(withAll, ids[0], { relation: 'answers', target: { type: 'artifact', id: ids[2] } }, later).artifacts[0].links.length, 1);
    for (const path of ['../secret', 'src/../secret', '/etc/passwd', 'C:/secret', 'https://site', 'a\\b', 'a//b', './a']) {
        assert.throws(() => linkArtifact(withAll, ids[0], { relation: 'related', target: { type: 'file', path } }, later), path);
    }
    assert.throws(() => linkArtifact(withAll, ids[0], { relation: 'related', target: { type: 'file', path: 'src/a.ts', line: 0 } }, later));
    const file = linkArtifact(linked, ids[0], { relation: 'related', target: { type: 'file', path: 'src/a.ts', line: 1 } }, later);
    const archived = archive(file, ids[0], true, later);
    assert.equal(archived.artifacts[0].id, note.id);
    assert.equal(archived.artifacts[0].status, note.status);
    assert.deepEqual(archived.artifacts[0].links, file.artifacts[0].links);
    assert.equal(queryArtifacts(archived).length, 4);
    assert.deepEqual(unlinkArtifact(archive(archived, ids[0], false, later), ids[0], related, later).artifacts[0].links.length, 1);
});

test('query is case-insensitive, stable and read-only with filters', () => {
    assert.deepEqual(queryArtifacts(withAll, { text: 'SAME' }).map(artifact => artifact.id), ids);
    assert.deepEqual(queryArtifacts(withAll, { text: 'tHrEe', types: ['question'], statuses: ['open'] }).map(artifact => artifact.id), [ids[2]]);
    assert.deepEqual(queryArtifacts(archive(withAll, ids[1], true, later), { archived: true }).map(artifact => artifact.id), [ids[1]]);
    assert.equal(withAll.revision, 6);
});
