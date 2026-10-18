import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { acceptInitialization, readInitialization } from '../../packages/code-analysis/lib/node/smap-initialization-file.js';
import { suggestWorkItems } from '../../packages/visual-planning/lib/index.js';
import { acceptSuggestion } from '../../packages/visual-planning/lib/work.js';
import { RoadmapPlanningLinks } from '../../packages/theia-extension/lib/node/roadmap-planning-links.js';
import { VisualPlanningBackend } from '../../packages/theia-extension/lib/node/visual-planning-backend.js';
import { BridgeLocalProposal } from '../../packages/theia-extension/lib/node/bridge-local-proposal.js';
import { RoadmapInspectorModel } from '../../packages/theia-extension/src/browser/roadmap-inspector-model.ts';
import { PlanningBridgeApprovals } from '../../packages/theia-extension/lib/node/planning-bridge-approvals.js';
import { PlanningStackPublication } from '../../packages/theia-extension/lib/node/planning-stack-publication.js';
import { composePhaseStackDraft } from '../../packages/agent-core/lib/phase-stack-composer.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import { buildPlan } from '../../scripts/codex-phase-core.mjs';
import { composeAffectedCorrectionDraft, planCorrectionRework } from '../../packages/theia-extension/lib/node/planning-correction.js';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';
import type { RoadmapService } from '../../packages/theia-extension/src/roadmap-service.ts';

const execute = promisify(execFile);
test('accepted Roadmap and Planning owners require three approvals before a validated, non-running Work handoff', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'dope-bridge-integrated-'));
  const root = join(temporary, 'project');
  try {
    await execute('git', ['clone', '-q', '--local', '--no-hardlinks', '--no-checkout', process.cwd(), root]);
    await mkdir(join(root, 'docs/tasks'), { recursive: true });
    await writeFile(join(root, 'package.json'), '{"version":"0.11.8"}\n');
    const roadmaps = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(roadmaps);
    const { handle } = await greenfield.begin(root);
    const phase = greenfield.edit(handle, 0, { type: 'create-phase', title: 'Bridge', objective: 'Plan scoped change' });
    greenfield.edit(handle, 1, { type: 'create-checkpoint', phaseId: phase.phases[0].id,
      title: 'Implement', objective: 'Implement scoped change' });
    const created = greenfield.preview(handle, 'ROADMAP.md');
    let roadmap = await greenfield.accept(handle, created, true);
    const markdown = created.markdown;
    const checkpoint = roadmap.checkpoints.find(item => item.kind === 'milestone')!;
    assert.ok(checkpoint?.source);
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src/base.ts'), 'export const base = true;\n');
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ include: ['src/**/*.ts'] }));
    await writeFile(join(root, '.dope/architecture.json'), JSON.stringify({ schemaVersion: 1, systems: [
      { id: 'base', name: 'Base', purpose: 'Existing', subsystems: [{ id: 'sub', name: 'Sub',
        purpose: 'Existing source', roots: ['src'], components: [] }] }] }));
    await acceptInitialization(root, (await readInitialization(root)).declarationFingerprint);
    const physical = new SoftwareMapIndex(new TypeScriptAnalyzer());
    await physical.analyze(root);
    await physical.analyze(root);
    const observed = physical.snapshot(root)!.metadata;
    const basis = { architectureRevision: 0, architectureFingerprint: (await readInitialization(root)).declarationFingerprint,
      physicalInputFingerprint: observed.inputFingerprint, physicalGeneration: observed.generation };
    const maps = new PlanningStore();
    const planning = new VisualPlanningBackend(maps, physical, roadmaps);
    const planningHandle = (await planning.attach(pathToFileURL(root).href)).projectHandle;
    let collection = await planning.mutate({ projectHandle: planningHandle, expectedRevision: 0,
      operation: { type: 'create', id: 'plan', title: 'Bridge target', objective: 'Implement scoped change', basis } });
    collection = await planning.mutate({ projectHandle: planningHandle, expectedRevision: collection.revision,
      operation: { type: 'put-transformation', mapId: 'plan', transformation: { id: 'change', kind: 'add',
        currentIds: [], futureNodes: [{ id: 'core', kind: 'system', name: 'Core',
          purpose: 'Implement scoped change', roots: ['src/core.ts'] }], dependsOn: [] } } });
    const suggestion = suggestWorkItems(collection.maps[0])[0];
    assert.deepEqual(suggestion.workingSet, ['src/core.ts']);
    const proposed = acceptSuggestion(collection.maps[0], suggestion, 'work');
    collection = await planning.mutate({ projectHandle: planningHandle, expectedRevision: collection.revision,
      operation: { type: 'put-work-item', mapId: 'plan', workItem: proposed } });
    const workItem = { ...proposed, status: 'ready' as const };
    collection = await planning.mutate({ projectHandle: planningHandle, expectedRevision: collection.revision,
      operation: { type: 'put-work-item', mapId: 'plan', workItem } });
    const actions = new ProjectPlanningActions(roadmaps, undefined, new RoadmapPlanningLinks(root, planning));
    const attached = await actions.attach(root);
    const link = { owner: 'planning-map' as const, targetId: 'plan', ownerProjectId: collection.projectId,
      ownerRevision: collection.maps[0].revision, basis };
    const request = { projectHandle: attached.projectHandle, ownerId: roadmap.projectId,
      expectedRevision: roadmap.revision, sourceHashes: { [checkpoint.id]: checkpoint.source!.sha256 },
      actions: [{ type: 'link' as const, id: checkpoint.id, link }] };
    const linked = await actions.preview(request);
    roadmap = await actions.apply(request, linked.token);
    assert.equal(roadmap.checkpoints.find(item => item.id === checkpoint.id)?.links[0].targetId, 'plan');
    assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), markdown);
    let handoff: { checkpointId: string; mapId?: string; mapRevision?: number } | undefined;
    const inspector = new RoadmapInspectorModel({ read: async () => roadmaps.read(root),
      previewDocumentSync: async () => roadmaps.previewDocumentSync(root) } as RoadmapService,
    async () => {}, async selection => { handoff = selection; });
    inspector.setSnapshot(pathToFileURL(root).href, roadmap);
    inspector.select(checkpoint.id);
    assert.equal(inspector.prepareWorkBlockedReason, undefined);
    await inspector.prepareWork();
    assert.equal(handoff?.checkpointId, checkpoint.id);
    assert.equal(handoff?.mapId, 'plan');
    assert.equal(handoff?.mapRevision, collection.maps[0].revision);
    const impact = await planning.currentSoftwareImpact({ projectHandle: planningHandle, projectId: roadmap.projectId,
      checkpointId: checkpoint.id, expectedRoadmapRevision: roadmap.revision, branchIds: ['base'] });
    assert.equal(impact.status, 'ready');
    assert.equal(impact.sources.some(source => source.path === 'src/base.ts'), true);
    const selection = { projectId: roadmap.projectId, checkpointId: checkpoint.id, roadmapRevision: roadmap.revision,
      mapId: 'plan', mapRevision: collection.maps[0].revision, branchIds: ['base'] };
    const proposal = await BridgeLocalProposal.prepare(planning, root, selection);
    assert.equal(await proposal.validate({ type: 'bridge-proposal', projectId: roadmap.projectId,
      checkpointId: checkpoint.id, roadmapRevision: roadmap.revision, mapId: 'plan',
      mapRevision: collection.maps[0].revision, basis,
      suggestion: { kind: 'target', transformationId: 'bad', command: { kind: 'remove', id: 'foreign' } },
      questions: [] }), false);
    let stack: { path: string; fingerprint: string } | undefined;
    const owners = async () => ({ roadmap: await roadmaps.read(root), basis,
      planning: { projectId: (await maps.read(root)).projectId,
        collectionRevision: (await maps.read(root)).revision, map: (await maps.read(root)).maps[0] }, stack });
    const approvals = new PlanningBridgeApprovals(owners);
    const publication = new PlanningStackPublication(owners);
    const draft = await composePhaseStackDraft({ folderName: 'c11-integrated', version: '0.11.8', sourceVersion: '0.11.8',
      work: [{ workItem, tier: 'T2', model: 'GPT-6 Sol High', estimatedMinutes: 7,
        integrationChecks: ['Inspect Roadmap, Planning, and Work together'] }],
      closeout: { title: 'Manual closeout', objective: 'Observe actual execution and evidence',
        manualReason: 'Browser and native evidence', acceptanceCriteria: ['Owner reviews actual results'],
        model: 'GPT-6 Sol High', browserRequired: true } });
    await assert.rejects(publication.preview(root, checkpoint.id, draft), /scope and target approvals/);
    await approvals.approve(root, (await approvals.preview(root, checkpoint.id, 'scope')).token, true);
    assert.equal(await approvals.approved(root, checkpoint.id, 'target'), false);
    await assert.rejects(publication.preview(root, checkpoint.id, draft), /scope and target approvals/);
    await approvals.approve(root, (await approvals.preview(root, checkpoint.id, 'target')).token, true);
    const preview = await publication.preview(root, checkpoint.id, draft);
    await assert.rejects(publication.publish(root, preview.token, false), /Explicit developer/);
    const accepted = await publication.preview(root, checkpoint.id, draft);
    assert.equal((await publication.publish(root, accepted.token, true)).status, 'published');
    const discovered = (await discoverRoadmapTaskStacks(root)).find(item => item.path === draft.sourcePath);
    assert.ok(discovered?.fingerprint && !discovered.diagnostic);
    stack = { path: discovered.path, fingerprint: discovered.fingerprint };
    assert.equal(await approvals.approved(root, checkpoint.id, 'stack'), false);
    await approvals.approve(root, (await approvals.preview(root, checkpoint.id, 'stack')).token, true);
    assert.equal(await new PlanningBridgeApprovals(owners).approved(root, checkpoint.id, 'stack'), true);
    const sources = await Promise.all(draft.files.map(async file => ({ filename: file.filename,
      text: await readFile(join(root, file.path), 'utf8') })));
    const imported = await importPhaseStack(draft.folderName, sources, draft.sourcePath);
    assert.deepEqual(imported.entries.map(entry => entry.execution), ['agent-task', 'manual-gate']);
    assert.equal(buildPlan(sources, draft.folderName).prompts.length, 2);
    const work = new AgentRuntimeBackend(new AgentStore(), { notifyAgentStateChanged() {} });
    try {
      const workHandle = (await work.attach(pathToFileURL(root).href)).projectHandle;
      const opened = await work.openTaskStack(workHandle, 'docs/tasks', draft.folderName);
      assert.equal(opened.kind, 'opened');
      if (opened.kind === 'opened') {
        assert.deepEqual(opened.sequence.stack.entries.map(entry => entry.execution), ['agent-task', 'manual-gate']);
        assert.equal(opened.sequence.runIds?.length ?? 0, 0);
      }
    } finally { work.dispose(); }
    assert.equal((await maps.read(root)).maps[0].status, 'draft');
    assert.equal((await roadmaps.read(root)).checkpoints[0].status, checkpoint.status);
    const correction = planCorrectionRework((await maps.read(root)).maps[0], ['change']);
    assert.deepEqual(correction.affectedWorkItemIds, ['work']);
    assert.equal(correction.requiresNewDraft, true);
    const repair = await composeAffectedCorrectionDraft((await maps.read(root)).maps[0], ['change'],
      { folderName: 'c11-integrated-repair', version: '0.11.8', sourceVersion: '0.11.8',
        work: [{ workItem, tier: 'T2', model: 'GPT-6 Sol High', estimatedMinutes: 7,
          integrationChecks: ['Recheck affected owner links'] }],
        closeout: { title: 'Manual closeout', objective: 'Review correction evidence',
          manualReason: 'Real owner qualification', acceptanceCriteria: ['Review source-bound result'],
          model: 'GPT-6 Sol High', browserRequired: true } }, draft.sourcePath);
    assert.deepEqual((await importPhaseStack(repair.folderName,
      repair.files.map(file => ({ filename: file.filename, text: file.text })), repair.sourcePath))
      .entries.map(entry => entry.execution), ['agent-task', 'manual-gate']);
    assert.equal((await discoverRoadmapTaskStacks(root)).some(item => item.path === repair.sourcePath), false);
    collection = await planning.mutate({ projectHandle: planningHandle, expectedRevision: collection.revision,
      operation: { type: 'transition', mapId: 'plan', status: 'active' } });
    await writeFile(join(root, 'src/core.ts'), 'export const implementation = true;\n');
    await physical.analyze(root);
    await physical.analyze(root);
    collection = await planning.mutate({ projectHandle: planningHandle, expectedRevision: collection.revision,
      operation: { type: 'reconcile', mapId: 'plan', expectedMapRevision: collection.maps[0].revision } });
    assert.equal(collection.maps[0].reconciliation?.results.some(item => item.outcome === 'not-implemented'), true);
    assert.equal(collection.maps[0].status, 'active');
    assert.equal(await approvals.approved(root, checkpoint.id, 'stack'), false);
    await writeFile(join(root, 'ROADMAP.md'), `${markdown}\nExternal edit\n`);
    assert.equal(await approvals.approved(root, checkpoint.id, 'stack'), false);
    assert.equal(await approvals.approved(root, checkpoint.id, 'scope'), false);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
