import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { HistoryBackend } from '../../packages/theia-extension/lib/node/history-backend.js';
import { HISTORY_PREVIEW_MAX_BYTES, HISTORY_PREVIEW_MAX_TOKENS } from '../../packages/contracts/lib/history-context-preview.js';
import { historyPreviewDescription } from '../../packages/theia-extension/lib/browser/history-presentation.js';

const source = (path: string) => readFileSync(new URL(`../../packages/theia-extension/src/${path}`, import.meta.url), 'utf8');

test('on-demand preview selects metadata only, reports unknown times and never writes owners', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-history-preview-'));
    const backend = new HistoryBackend();
    try {
        await mkdir(join(root, '.dope'));
        const file = join(root, '.dope/planning-maps.json');
        const secret = 'SECRET_TRANSCRIPT_PROVIDER_PROMPT_CANDIDATE_DIFF';
        const maps = [{ schemaVersion: 1, id: 'map-a', projectId: 'project-a', title: secret,
            objective: secret, status: 'draft', revision: 0, history: [],
            basis: { architectureRevision: 1, architectureFingerprint: 'a', physicalInputFingerprint: 'b', physicalGeneration: 1 },
            transformations: [], workItems: [] }];
        await writeFile(file, JSON.stringify({ schemaVersion: 1, projectId: 'project-a', revision: 1, maps }));
        const before = await readFile(file);
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const snapshot = await backend.read(projectHandle);
        assert.equal(snapshot.entries.length, 1);
        assert.equal(await backend.verifyPreviewBasis(projectHandle, snapshot.evidenceBasis), true);
        const preview = await backend.preview(projectHandle, snapshot.evidenceBasis,
            [{ source: 'planning', sourceId: 'map:map-a' }]);
        assert.equal(preview.items.length, 1);
        assert.equal(preview.items[0].category, 'unknown-or-unavailable');
        assert.equal(preview.items[0].occurredAt, null);
        assert.equal(preview.items[0].ownerKind, 'planning-map');
        assert.match(preview.items[0].fingerprint, /^[a-f0-9]{64}$/);
        assert.equal(preview.bytes <= HISTORY_PREVIEW_MAX_BYTES, true);
        assert.equal(preview.estimatedTokens <= HISTORY_PREVIEW_MAX_TOKENS, true);
        assert.doesNotMatch(JSON.stringify(preview), /SECRET_TRANSCRIPT/);
        assert.match(preview.privacy, /No model call or egress/);
        assert.deepEqual(await readFile(file), before);
        await assert.rejects(backend.preview(projectHandle, snapshot.evidenceBasis, []), /Select 1–8/);
        await assert.rejects(backend.preview(projectHandle, snapshot.evidenceBasis,
            [{ source: 'planning', sourceId: 'map:map-a' }, { source: 'planning', sourceId: 'map:map-a' }]), /Duplicate/);
        await assert.rejects(backend.preview(projectHandle, snapshot.evidenceBasis,
            [{ source: 'chat', sourceId: 'foreign' }]), /unavailable/);
        assert.deepEqual(await readFile(file), before);
        maps[0].title = 'Changed';
        await writeFile(file, JSON.stringify({ schemaVersion: 1, projectId: 'project-a', revision: 1, maps }));
        assert.equal(await backend.verifyPreviewBasis(projectHandle, snapshot.evidenceBasis), false);
        await assert.rejects(backend.preview(projectHandle, snapshot.evidenceBasis,
            [{ source: 'planning', sourceId: 'map:map-a' }]), /evidence changed/);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('panel does not preview on open and has no provider or owner mutation path', () => {
    const widget = source('browser/history-widget.ts');
    const backend = source('node/history-backend.ts');
    assert.match(widget, /action\.onclick = async/);
    assert.match(widget, /Preview selected evidence/);
    assert.match(widget, /this\.connect\(\)\.preview\(handle/);
    assert.match(widget, /historyPreviewDescription\(item\)/);
    assert.match(widget, /Technical evidence details/);
    assert.match(widget, /document\.createElement\('details'\)/);
    assert.doesNotMatch(widget, /details\.open\s*=\s*true/);
    assert.doesNotMatch(backend, /readTranscript|readMessages|candidateDiff|fetch\(|model\.invoke|\.startTask\(/);
});

test('bounded preview metadata reads as activity, status, time and uncertainty without exposing IDs', () => {
    const base = { source: 'git' as const, sourceId: 'private-source-id',
        category: 'git-snapshot' as const, occurredAt: null, observedAt: '2026-10-12T10:00:00.000Z',
        fingerprint: 'f'.repeat(64), summary: 'Current working tree has changes; change time and author are unknown' };
    const dirty = historyPreviewDescription({ ...base, ownerKind: 'git-dirty' });
    assert.equal(dirty.title, 'Working tree changes');
    assert.match(dirty.summary, /uncommitted changes/);
    assert.match(dirty.status, /when observed/);
    assert.match(dirty.time!, /Observed/);
    assert.match(dirty.uncertainty, /exact change time are unknown/);
    assert.doesNotMatch(JSON.stringify(dirty), /private-source-id|fingerprint|[a-f]{64}/);

    const run = historyPreviewDescription({ ...base, source: 'agent', ownerKind: 'agent-run',
        category: 'observation', occurredAt: '2026-10-12T09:00:00.000Z', observedAt: null,
        summary: 'Run completed; validation passed; review pending; promotion not-applied' });
    assert.equal(run.status, 'Run: completed · Validation: passed · Review: pending · Promotion: not applied');
    assert.match(run.uncertainty, /separate/);
    assert.match(run.time!, /Recorded event/);

    const planning = historyPreviewDescription({ ...base, source: 'planning', ownerKind: 'planning-map',
        category: 'unknown-or-unavailable', occurredAt: null, observedAt: null,
        summary: 'planning-map metadata observed' });
    assert.equal(planning.status, 'Metadata observed');
    assert.match(planning.uncertainty, /When this occurred is unknown/);
    assert.doesNotMatch(`${planning.summary} ${planning.status}`, /completed development/);

    const missing = historyPreviewDescription({ ...base, source: 'chat', ownerKind: 'chat',
        category: 'unknown-or-unavailable', occurredAt: null, observedAt: null,
        summary: 'Owner metadata missing' });
    assert.equal(missing.status, 'Metadata missing');
    assert.match(missing.uncertainty, /could not|does not establish/);
});

test('whole evidence package obeys caps and Git dirty evidence remains snapshot only', async () => {
    const { buildHistoryContextPreview } = await import('../../packages/contracts/lib/history-context-preview.js');
    const project = { projectId: 'project-a', projectRoot: '/tmp/project-a' };
    const entries = Array.from({ length: 8 }, (_, index) => ({ ...project, kind: 'snapshot' as const,
        source: 'git' as const, sourceId: `working-${index}-${'x'.repeat(120)}`,
        owner: { kind: 'git-dirty' as const }, title: 'SECRET_TRANSCRIPT',
        status: { kind: 'owner' as const, label: 'snapshot' }, availability: 'available' as const,
        occurredAt: null, observedAt: '2026-10-12T10:00:00.000Z' }));
    const selection = entries.map(entry => ({ source: entry.source, sourceId: entry.sourceId }));
    const preview = buildHistoryContextPreview(project, 'basis', entries, selection, () => 'f'.repeat(64));
    assert.equal(Buffer.byteLength(JSON.stringify(preview)) <= HISTORY_PREVIEW_MAX_BYTES, true);
    assert.equal(Math.ceil(Buffer.byteLength(JSON.stringify(preview)) / 4) <= HISTORY_PREVIEW_MAX_TOKENS, true);
    assert.equal(preview.items.every(item => item.category === 'git-snapshot' && item.occurredAt === null), true);
    assert.doesNotMatch(JSON.stringify(preview), /SECRET_TRANSCRIPT/);
    assert.equal(preview.items.length + preview.omissions.length, 8);
});
