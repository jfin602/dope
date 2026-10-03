import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';
import { acceptInitialization, readInitialization } from '../../packages/code-analysis/lib/node/smap-initialization-file.js';
import { readSynthesisRun } from '../../packages/code-analysis/lib/node/smap-analysis-file.js';
import { SoftwareMapBackend } from '../../packages/theia-extension/lib/node/software-map-backend.js';
import type { SynthesisProvider, SynthesisStageRequest, SoftwareMapClient, AnalysisProgressEvent } from '../../packages/software-map/lib/index.js';
import { branchFingerprint, isDirectSystemResponsibilityEvidence, parseArchitecture, SynthesisProviderFailure } from '../../packages/software-map/lib/index.js';

const declaration = { schemaVersion: 1 as const, systems: [{ id: 'app', name: 'App', purpose: 'App', subsystems: [
  { id: 'api', name: 'API', purpose: 'API', roots: ['src/api'], forbiddenDependencies: ['secret'] },
  { id: 'secret', name: 'Secret', purpose: 'Secret', roots: ['src/secret'] },
] }] };
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dope-init-'));
  await mkdir(join(root, 'src/api'), { recursive: true });
  await mkdir(join(root, 'src/secret'), { recursive: true });
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'CommonJS' }, include: ['src/**/*.ts'] }));
  await writeFile(join(root, 'src/api/a.ts'), "import { secret } from '../secret/s'; export const run = secret;\n");
  await writeFile(join(root, 'src/secret/s.ts'), 'export const secret = 1;\n');
  return root;
}
const stageResult = (request: SynthesisStageRequest, fields: object) => ({ schemaVersion: 1, stageVersion: 3,
  stage: request.stage, parentPacketFingerprint: request.parentPacketFingerprint, viewId: request.view.viewId, ...fields });
const execution = (request: SynthesisStageRequest, fields: object) => ({ output: stageResult(request, fields),
  usage: { providerKind: 'local' as const, modelLabel: 'fixture-model', requestBytes: 1, outputBytes: 1,
    tokenMeasurement: 'unavailable' as const } });
const fakeProvider = (observe?: (request: SynthesisStageRequest) => Promise<void> | void): SynthesisProvider => ({
  kind: 'local',
  capabilities: async () => ({ modelLabel: 'fixture-model', contextWindowTokens: 100000, maxInputTokens: 90000,
    reservedInstructionTokens: 1000, reservedOutputTokens: 2000, reservedOverheadTokens: 1000, tokenEstimate: 'conservative' }),
  estimateTokens: async text => text.length,
  runStage: async request => {
    await observe?.(request);
    if (request.stage === 'system-discovery') {
      const ref = request.view.items.find(item => item.kind === 'semantic' && item.sourceEvidenceIds.length)?.id ??
        request.view.items.find(item => item.kind === 'entrypoint' && item.sourceEvidenceIds.length)?.id;
      assert.ok(ref);
      return execution(request, { systems: [{ candidateKey: 'candidate:app', kind: 'system', name: 'App', responsibility: 'App',
        confidence: .8, ambiguityCodes: [], evidenceRefs: [ref] }] });
    }
    if (request.stage === 'system-challenge') return execution(request, { decisions: [{ action: 'keep',
      sourceKeys: ['candidate:app'], systems: request.context.systems, evidenceRefs: request.context.systems[0].evidenceRefs }] });
    if (request.stage === 'subsystem-discovery') {
      const ref = request.context.systems[0].evidenceRefs[0];
      return execution(request, { systemKey: request.context.subjectSystemKey, subsystems: [{ candidateKey: 'candidate:api',
        kind: 'subsystem', parentCandidateKey: 'candidate:app', name: 'API', responsibility: 'API', confidence: .8, ambiguityCodes: [], evidenceRefs: [ref], ownershipEvidenceRefs: [ref] }],
        });
    }
    if (request.stage === 'subsystem-challenge') return execution(request, { systemKey: request.context.subjectSystemKey,
      decisions: request.context.subsystems.map(node => ({ action: 'keep', sourceKeys: [node.candidateKey],
        subsystems: [node], evidenceRefs: node.evidenceRefs })) });
    if (request.stage === 'component-discovery') return execution(request, { systemKey: request.context.subjectSystemKey,
      subsystemKey: request.context.subjectSubsystemKey, components: [],
      disposition: { kind: 'leaf-responsibility', systemKey: request.context.subjectSystemKey,
        subsystemKey: request.context.subjectSubsystemKey, evidenceRefs: request.context.subsystems.find(node =>
          node.candidateKey === request.context.subjectSubsystemKey)!.ownershipEvidenceRefs.slice(0, 1),
        parentPacketFingerprint: request.parentPacketFingerprint, viewId: request.view.viewId } });
    if (request.stage === 'reconciliation') return execution(request, { findings: [], unresolved: [] });
    return execution(request, { findings: [] });
  },
});
const backend = (index: SoftwareMapIndex, provider?: SynthesisProvider, client: SoftwareMapClient = { notifySoftwareMapChanged() {} }) =>
  new SoftwareMapBackend(index, client, provider);
const attach = async (service: SoftwareMapBackend, root: string) => (await service.attach(pathToFileURL(root).href)).projectHandle;
async function projectBytes(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const walk = async (dir: string, prefix = ''): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await walk(join(dir, entry.name), `${name}/`);
      else if (entry.isFile()) result[name] = (await readFile(join(dir, entry.name))).toString('hex');
    }
  };
  await walk(root);
  return result;
}

test('generation dry run reads fresh, failed and review work without provider or project writes', async () => {
  for (const state of ['fresh', 'failed', 'review_required'] as const) {
    const root = await fixture();
    let calls = 0;
    const source = fakeProvider();
    const generating = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), { ...source, runStage: async request => {
      if (state === 'failed' && request.stage === 'subsystem-discovery') throw new Error('private provider detail');
      return source.runStage(request);
    } });
    let reader: SoftwareMapBackend | undefined;
    try {
      const firstHandle = await attach(generating, root);
      if (state === 'failed') await assert.rejects(generating.startInitialization(firstHandle));
      if (state === 'review_required') await generating.startInitialization(firstHandle);
      generating.dispose();
      const before = await projectBytes(root);
      reader = new SoftwareMapBackend(new SoftwareMapIndex(new TypeScriptAnalyzer()), { notifySoftwareMapChanged() {} },
        { ...source, capabilities: async () => { calls++; throw new Error('provider used'); },
          estimateTokens: async () => { calls++; throw new Error('counter used'); },
          runStage: async () => { calls++; throw new Error('model used'); } },
        () => { calls++; throw new Error('Gemini used'); },
        { getPassword: async () => { calls++; throw new Error('credentials used'); },
          setPassword: async () => { calls++; throw new Error('credentials used'); } });
      const handle = await attach(reader, root);
      const report = await reader.dryRunSynthesis(handle);
      assert.match(report.inputFingerprint ?? '', /^[a-f0-9]{64}$/);
      assert.ok(report.evidence.length);
      assert.match(report.untested.join(' '), /Model-dependent stages and output quality/);
      assert.equal(report.savedRun?.state, state === 'fresh' ? undefined : state);
      if (state === 'failed') {
        assert.ok(report.savedRun?.completed.length);
        assert.equal(report.savedRun?.failed?.stage, 'subsystem-discovery');
        assert.deepEqual(report.savedRun?.pending.map(item => item.stage), ['subsystem-discovery']);
      }
      if (state === 'review_required') assert.deepEqual(report.savedRun?.pending, []);
      assert.equal(calls, 0);
      assert.deepEqual(await projectBytes(root), before);
    } finally { generating.dispose(); reader?.dispose(); await rm(root, { recursive: true, force: true }); }
  }
});

test('generation dry run rejects active analysis and safely reports malformed saved work', async () => {
  const root = await fixture();
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  const source = fakeProvider();
  const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), { ...source, runStage: async request => {
    started(); await wait; return source.runStage(request);
  } });
  try {
    const handle = await attach(service, root);
    const running = service.startInitialization(handle);
    await entered;
    await assert.rejects(service.dryRunSynthesis(handle), /unavailable while analysis is active/);
    release(); await running;
    const path = join(root, '.dope/smap-analysis.json');
    await writeFile(path, '{"secret":"must not surface"');
    const bytes = await projectBytes(root);
    const report = await service.dryRunSynthesis(handle);
    assert.match(report.diagnostics.join(' '), /could not be safely read/);
    assert.doesNotMatch(JSON.stringify(report), /secret/);
    assert.deepEqual(await projectBytes(root), bytes);
  } finally { release(); service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('Gemini progress distinguishes an automatic retry from terminal exhaustion', async () => {
  for (const recover of [true, false]) {
    const root = await fixture();
    const events: AnalysisProgressEvent[] = [];
    const base = fakeProvider();
    let calls = 0;
    const provider: SynthesisProvider = { ...base, kind: 'gemini', runStage: async request => {
      if (request.stage === 'system-discovery' && (++calls === 1 || !recover))
        throw new SynthesisProviderFailure('safe upstream failure', 'transient-upstream');
      return base.runStage(request);
    } };
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), provider,
      { notifySoftwareMapChanged() {}, notifySoftwareMapAnalysisProgress(_handle, event) { events.push(event); } });
    try {
      const handle = await attach(service, root);
      if (recover) await service.startInitialization(handle);
      else await assert.rejects(service.startInitialization(handle));
      const callsForStage = events.filter(event => event.stage === 'system-discovery' && event.callPurpose === 'system-discovery');
      assert.deepEqual(callsForStage.filter(event => event.callDurationMs !== undefined).map(event => event.status),
        recover ? ['retrying', 'started'] : ['retrying', 'retrying', 'failed']);
      assert.ok(callsForStage.some(event => event.status === 'started' && event.attempt === 2 && event.callDurationMs === undefined));
      assert.equal(events.some(event => event.stage === 'failed'), !recover);
      assert.equal((await service.synthesisAttempts(handle)).filter(item => item.stage === 'system-discovery').length, recover ? 2 : 3);
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  }
});

test('failed branch resumes from its pinned evidence after restart and skips successful model calls', async () => {
  const root = await fixture();
  const calls: string[] = [];
  let failFrontend = true;
  const provider = (modelLabel: string): SynthesisProvider => {
    const base = fakeProvider();
    return { ...base, capabilities: async () => ({ ...(await base.capabilities()), modelLabel }),
      runStage: async request => {
        calls.push(`${modelLabel}:${request.stage}:${request.context.subjectSystemKey ?? ''}`);
        if (request.stage === 'subsystem-discovery' && request.context.subjectSystemKey === 'candidate:frontend' && failFrontend) {
          failFrontend = false;
          throw new Error('provider failed');
        }
        if (request.stage === 'system-discovery') {
          const source = (path: string) => request.view.items.find(item => item.path === path &&
            isDirectSystemResponsibilityEvidence(item))?.id;
          const backendRef = source('src/api/a.ts'), frontendRef = source('src/secret/s.ts');
          assert.ok(backendRef && frontendRef);
          return execution(request, { systems: [
            { candidateKey: 'candidate:backend', kind: 'system', name: 'Backend', responsibility: 'Backend work',
              confidence: .8, ambiguityCodes: [], evidenceRefs: [backendRef] },
            { candidateKey: 'candidate:frontend', kind: 'system', name: 'Frontend', responsibility: 'Frontend work',
              confidence: .8, ambiguityCodes: [], evidenceRefs: [frontendRef] }] });
        }
        if (request.stage === 'system-challenge') return execution(request, { decisions: request.context.systems.map(system => ({
          action: 'keep', sourceKeys: [system.candidateKey], systems: [system], evidenceRefs: system.evidenceRefs })) });
        if (request.stage === 'subsystem-discovery') {
          const system = request.context.systems.find(item => item.candidateKey === request.context.subjectSystemKey)!;
          return execution(request, { systemKey: system.candidateKey, subsystems: [{
            candidateKey: `${system.candidateKey}-sub`, kind: 'subsystem', parentCandidateKey: system.candidateKey,
            name: `${system.name} work`, responsibility: `${system.name} work`, confidence: .8, ambiguityCodes: [],
            evidenceRefs: system.evidenceRefs, ownershipEvidenceRefs: system.evidenceRefs }] });
        }
        return base.runStage(request);
      } };
  };
  try {
    const first = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), provider('model-a'));
    const handle = await attach(first, root);
    await assert.rejects(first.startInitialization(handle), /provider failed/);
    const failed = await readSynthesisRun(root);
    assert.equal(failed?.status, 'failed');
    assert.deepEqual(failed?.current, { stage: 'subsystem-discovery', subject: 'candidate:frontend',
      providerKind: 'local', modelLabel: 'model-a' });
    assert.ok(failed?.checkpoints.some(item => item.request.context.subjectSystemKey === 'candidate:backend'));
    assert.ok(!failed?.checkpoints.some(item => item.request.context.subjectSystemKey === 'candidate:frontend'));
    assert.equal((await first.initializationStatus(handle)).resumable?.runId, failed?.runId);
    first.dispose();

    await writeFile(join(root, 'src/secret/s.ts'), 'export const changedAfterFailure = 2;\n');
    const second = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), provider('model-b'));
    const reopenedHandle = await attach(second, root);
    assert.equal((await second.initializationStatus(reopenedHandle)).state, 'failed');
    const before = calls.length;
    const review = await second.retryFailedStage(reopenedHandle);
    const retryCalls = calls.slice(before);
    assert.ok(retryCalls.includes('model-b:subsystem-discovery:candidate:frontend'));
    assert.ok(!retryCalls.some(call => /system-discovery:$|system-challenge:$|:candidate:backend$/.test(call)));
    assert.equal(review.packet.sourceFingerprint, failed?.packet.sourceFingerprint);
    const complete = await readSynthesisRun(root);
    assert.equal(complete?.status, 'review_required');
    assert.equal(complete?.runId, failed?.runId);
    assert.ok(complete?.checkpoints.some(item => item.request.context.subjectSystemKey === 'candidate:backend' && item.modelLabel === 'model-a'));
    assert.ok(complete?.checkpoints.some(item => item.request.context.subjectSystemKey === 'candidate:frontend' && item.modelLabel === 'model-b'));
    assert.equal(complete?.checkpoints.find(item => item.request.context.subjectSystemKey === 'candidate:frontend')?.attempt, 2);
    second.dispose();

    const third = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), provider('model-b'));
    const thirdHandle = await attach(third, root);
    assert.equal((await third.review(thirdHandle))?.reviewId, review.reviewId);
    await third.cancelInitialization(thirdHandle);
    const fresh = await third.startInitialization(thirdHandle);
    assert.notEqual(fresh.packet.sourceFingerprint, failed?.packet.sourceFingerprint);
    assert.notEqual((await readSynthesisRun(root))?.runId, failed?.runId);
    assert.equal(calls.filter(call => call.endsWith('system-discovery:')).length, 2);
    third.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('malformed stage output is never checkpointed and retry starts at that stage', async () => {
  const root = await fixture();
  let malformed = true;
  const calls: string[] = [];
  const base = fakeProvider();
  const provider: SynthesisProvider = { ...base, runStage: async request => {
    calls.push(request.stage);
    if (request.stage === 'system-challenge' && malformed) {
      malformed = false;
      return execution(request, { decisions: [], extra: 'invalid' });
    }
    return base.runStage(request);
  } };
  try {
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), provider);
    const handle = await attach(service, root);
    await assert.rejects(service.startInitialization(handle), /Invalid hierarchical synthesis/);
    const saved = await readSynthesisRun(root);
    assert.deepEqual(saved?.checkpoints.map(item => item.request.stage), ['system-discovery']);
    assert.equal(saved?.failure?.stage, 'system-challenge');
    const before = calls.length;
    await service.retryFailedStage(handle);
    assert.equal(calls.slice(before).includes('system-discovery'), false);
    assert.equal(calls.slice(before)[0], 'system-challenge');
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('attach and cancel leave the project uninitialized; failure stores only resumable analysis', async () => {
  const root = await fixture();
  try {
    let analyses = 0;
    const analyzer = new TypeScriptAnalyzer();
    const index = new SoftwareMapIndex({ analyze: path => { analyses++; return analyzer.analyze(path); }, inputPaths: path => analyzer.inputPaths(path) });
    const service = backend(index, fakeProvider(() => { throw new Error('provider failed'); }));
    const handle = await attach(service, root);
    assert.deepEqual((await service.initializationStatus(handle)).bootstrap, { modules: false, readme: false });
    await writeFile(join(root, 'README.md'), '# Orientation');
    assert.deepEqual((await service.initializationStatus(handle)).bootstrap, { modules: false, readme: true });
    await writeFile(join(root, 'MODULES.md'), '# Architecture intent');
    assert.deepEqual((await service.initializationStatus(handle)).bootstrap, { modules: true, readme: true });
    assert.equal((await service.initializationStatus(handle)).state, 'uninitialized');
    assert.equal(analyses, 0);
    assert.equal(index.snapshot(root), undefined);
    assert.equal((await readdir(root)).includes('.dope'), false);
    await service.cancelInitialization(handle);
    assert.equal(analyses, 0);
    await assert.rejects(service.startInitialization(handle), /provider failed/);
    assert.ok(analyses > 0);
    assert.equal((await service.initializationStatus(handle)).state, 'failed');
    assert.equal(index.snapshot(root), undefined);
    assert.equal((await readdir(root)).includes('.dope'), true);
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('existing declaration is uninitialized until explicit acceptance; restart reads marker and publishes dependencies', async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, '.dope'));
    const bytes = JSON.stringify(declaration);
    await writeFile(join(root, '.dope/architecture.json'), bytes);
    const index = new SoftwareMapIndex(new TypeScriptAnalyzer());
    const service = backend(index);
    const handle = await attach(service, root);
    const status = await service.initializationStatus(handle);
    assert.equal(status.state, 'uninitialized');
    assert.equal(status.declarationPresent, true);
    await assert.rejects(service.analyze(handle), /not initialized/);
    assert.equal((await service.acceptExisting(handle, status.declarationFingerprint)).state, 'ready');
    assert.equal(await readFile(join(root, '.dope/architecture.json'), 'utf8'), bytes);
    assert.equal(index.snapshot(root)!.violations[0].rule, 'forbidden-dependency');
    assert.deepEqual(JSON.parse(await readFile(join(root, '.dope/smap.json'), 'utf8')).schemaVersion, 1);
    const marker = await readFile(join(root, '.dope/smap.json'));
    await rm(join(root, '.dope/smap.json'));
    assert.equal((await service.status(handle)).state, 'idle');
    await assert.rejects(service.hierarchy({ projectHandle: handle }), /not initialized/);
    await writeFile(join(root, '.dope/smap.json'), marker);
    service.dispose();
    const reopened = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()));
    const reopenedHandle = await attach(reopened, root);
    assert.equal((await reopened.initializationStatus(reopenedHandle)).state, 'initialized');
    assert.equal((await reopened.analyze(reopenedHandle)).state, 'ready');
    reopened.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('initialized Architecture read and save use the canonical marker and rerun analysis without edit work files', async () => {
  const root = await fixture();
  try {
    let analyses = 0;
    const analyzer = new TypeScriptAnalyzer();
    const index = new SoftwareMapIndex({ analyze: path => { analyses++; return analyzer.analyze(path); },
      inputPaths: path => analyzer.inputPaths(path) });
    const service = backend(index);
    const handle = await attach(service, root);
    await assert.rejects(service.readArchitecture(handle), /not initialized/);
    await assert.rejects(service.saveArchitecture(handle, 'missing', declaration), /not initialized/);
    await service.acceptManual(handle, declaration, (await service.initializationStatus(handle)).declarationFingerprint);
    const before = await service.readArchitecture(handle);
    assert.deepEqual(before.declaration, parseArchitecture(declaration));
    assert.equal(before.declarationFingerprint, (await readInitialization(root)).declarationFingerprint);
    before.declaration.systems[0].purpose = 'Changed in memory';
    assert.deepEqual((await service.readArchitecture(handle)).declaration, parseArchitecture(declaration));
    const replacement = structuredClone(before.declaration);
    const priorAnalyses = analyses;
    const saved = await service.saveArchitecture(handle, before.declarationFingerprint, replacement);
    assert.equal(saved.committed, true);
    assert.equal(saved.status.state, 'ready');
    assert.ok(analyses > priorAnalyses);
    assert.equal(saved.declarationFingerprint, (await readInitialization(root)).declarationFingerprint);
    assert.equal((await service.readArchitecture(handle)).declaration.systems[0].purpose, 'Changed in memory');
    assert.equal(JSON.parse(await readFile(join(root, '.dope/smap.json'), 'utf8')).architectureFingerprint, saved.declarationFingerprint);
    assert.deepEqual((await readdir(join(root, '.dope'))).sort(), ['architecture.json', 'smap.json']);
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('initialized Architecture save rejects stale, invalid, wrong-handle and cross-project requests without writes', async () => {
  const a = await fixture(); const b = await fixture();
  try {
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()));
    const handleA = await attach(service, a);
    await service.acceptManual(handleA, declaration, (await service.initializationStatus(handleA)).declarationFingerprint);
    const original = await projectBytes(a);
    const current = await service.readArchitecture(handleA);
    await assert.rejects(service.saveArchitecture('wrong', current.declarationFingerprint, current.declaration), /Invalid/);
    await assert.rejects(service.saveArchitecture(handleA, 'stale', current.declaration), /Stale/);
    const invalid = structuredClone(current.declaration);
    invalid.systems[0].subsystems[0].forbiddenDependencies = ['missing'];
    await assert.rejects(service.saveArchitecture(handleA, current.declarationFingerprint, invalid), /unknown dependency target/);
    assert.deepEqual(await projectBytes(a), original);
    const handleB = await attach(service, b);
    await service.acceptManual(handleB, declaration, (await service.initializationStatus(handleB)).declarationFingerprint);
    const otherOriginal = await projectBytes(b);
    await assert.rejects(service.readArchitecture(handleA), /Invalid/);
    await assert.rejects(service.saveArchitecture(handleA, current.declarationFingerprint, current.declaration), /Invalid/);
    await assert.rejects(service.saveArchitecture(handleB, current.declarationFingerprint, invalid), /unknown dependency target/);
    assert.deepEqual(await projectBytes(a), original);
    assert.deepEqual(await projectBytes(b), otherOriginal);
    service.dispose();
  } finally { await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); }
});

test('Architecture save reports committed canonical state when deterministic re-analysis fails', async () => {
  const root = await fixture();
  try {
    let failAnalysis = false;
    const analyzer = new TypeScriptAnalyzer();
    const index = new SoftwareMapIndex({ analyze: path => {
      if (failAnalysis) throw new Error('injected analysis failure');
      return analyzer.analyze(path);
    }, inputPaths: path => analyzer.inputPaths(path) });
    const service = backend(index);
    const handle = await attach(service, root);
    await service.acceptManual(handle, declaration, (await service.initializationStatus(handle)).declarationFingerprint);
    const current = await service.readArchitecture(handle);
    const replacement = structuredClone(current.declaration);
    replacement.systems[0].purpose = 'Committed despite analysis failure';
    failAnalysis = true;
    const saved = await service.saveArchitecture(handle, current.declarationFingerprint, replacement);
    assert.equal(saved.committed, true);
    assert.equal(saved.status.state, 'failed');
    assert.match(saved.status.analysis.errors[0].message, /injected analysis failure/);
    assert.equal((await service.readArchitecture(handle)).declaration.systems[0].purpose, replacement.systems[0].purpose);
    assert.equal((await readInitialization(root)).declarationFingerprint, saved.declarationFingerprint);
    assert.deepEqual((await readdir(join(root, '.dope'))).sort(), ['architecture.json', 'smap.json']);
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('generated review has valid suggested IDs, remains noncanonical, and accepts unchanged', async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, 'src/secret/part.ts'), 'export const part = 1;\n');
    const index = new SoftwareMapIndex(new TypeScriptAnalyzer());
    const base = fakeProvider();
    const provider: SynthesisProvider = { ...base, runStage: async request => {
      if (request.stage !== 'component-discovery') return base.runStage(request);
      const ref = request.view.items.find(item => item.path === 'src/secret/part.ts' && isDirectSystemResponsibilityEvidence(item))?.id;
      assert.ok(ref);
      return execution(request, { systemKey: request.context.subjectSystemKey, subsystemKey: request.context.subjectSubsystemKey,
        components: [{ candidateKey: 'candidate:part', kind: 'component', parentCandidateKey: request.context.subjectSubsystemKey,
          name: 'Part', responsibility: 'Part', confidence: .8, ambiguityCodes: [], evidenceRefs: [ref], ownershipEvidenceRefs: [ref] }] });
    } };
    const service = backend(index, provider);
    const handle = await attach(service, root);
    const review = await service.startInitialization(handle);
    assert.equal((await service.initializationStatus(handle)).state, 'review_required');
    assert.deepEqual((await service.review(handle))?.componentDescents, review.componentDescents);
    const sourceFact = review.packet.items.find((item: any) => item.path === 'src/api/a.ts');
    assert.ok(sourceFact);
    assert.equal((await service.resolveReviewSource(handle, review.reviewId, sourceFact.id))?.path, 'src/api/a.ts');
    assert.equal(await service.resolveReviewSource(handle, 'wrong', sourceFact.id), undefined);
    assert.equal(await service.resolveReviewSource(handle, review.reviewId, 'fabricated'), undefined);
    assert.equal(index.snapshot(root), undefined);
    assert.equal((await readdir(root)).includes('.dope'), true);
    const ids = review.draft.map(node => node.id);
    assert.deepEqual(review.draft.map(node => node.kind), ['system', 'subsystem', 'component']);
    assert.ok(ids.every(id => /^[A-Za-z][A-Za-z0-9._-]*$/.test(id)));
    assert.equal(new Set(ids).size, ids.length);
    assert.doesNotThrow(() => parseArchitecture({ schemaVersion: 1, systems: review.draft.filter(node => node.kind === 'system').map(system => ({
      id: system.id, name: system.name, purpose: system.purpose, ...(system.roots.length ? { roots: system.roots } : {}),
      subsystems: review.draft.filter(node => node.parentProposalKey === system.proposalKey).map(subsystem => ({
        id: subsystem.id, name: subsystem.name, purpose: subsystem.purpose, roots: subsystem.roots,
        components: review.draft.filter(node => node.parentProposalKey === subsystem.proposalKey).map(component => ({
          id: component.id, name: component.name, purpose: component.purpose, roots: component.roots,
        })),
      })),
    })) }));
    await assert.rejects(service.acceptReview(handle, 'wrong', review.draft), /matching/);
    await assert.rejects(service.acceptReview(handle, review.reviewId, review.draft.map(node => ({ ...node, id: '' }))), /review draft|declaration/);
    assert.equal((await service.initializationStatus(handle)).state, 'review_required');
    await writeFile(join(root, '.dope/architecture.json'), JSON.stringify(declaration)).catch(async () => {
      await mkdir(join(root, '.dope')); await writeFile(join(root, '.dope/architecture.json'), JSON.stringify(declaration));
    });
    await assert.rejects(service.acceptReview(handle, review.reviewId, review.draft), /Stale/);
    assert.equal((await service.initializationStatus(handle)).state, 'review_required');
    await rm(join(root, '.dope/architecture.json'));
    assert.equal((await service.acceptReview(handle, review.reviewId, review.draft)).state, 'ready');
    const acceptedArchitecture = await readFile(join(root, '.dope/architecture.json'), 'utf8');
    await writeFile(join(root, 'MODULES.md'), '# Changed architecture intent');
    await service.analyze(handle);
    assert.equal(await readFile(join(root, '.dope/architecture.json'), 'utf8'), acceptedArchitecture);
    assert.equal((await service.initializationStatus(handle)).state, 'initialized');
    assert.equal((await service.review(handle)), undefined);
    assert.equal(await service.resolveReviewSource(handle, review.reviewId, sourceFact.id), undefined);
    assert.equal(index.snapshot(root)!.nodes.some(node => node.id === review.draft.find(node => node.kind === 'subsystem')?.id), true);
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('schema-1 review draft saves invalid work, rejects stale writes, and restores without a provider', async () => {
  const a = await fixture(), b = await fixture();
  try {
    const first = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), fakeProvider());
    const handle = await attach(first, a);
    const review = await first.startInitialization(handle);
    const file = join(a, '.dope/smap-analysis.json');
    const old = JSON.parse(await readFile(file, 'utf8'));
    delete old.review.revision;
    await writeFile(file, JSON.stringify(old));
    first.dispose();

    const restarted = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()));
    const reopenedHandle = await attach(restarted, a);
    assert.equal((await restarted.review(reopenedHandle))?.revision, 0);
    const invalid = structuredClone(review.draft);
    invalid[0].name = 'Edited system'; invalid[0].id = 'renamed-app';
    invalid[0].purpose = 'Changed purpose';
    invalid[0].roots = [...invalid[1].roots];
    invalid.push({ ...invalid[0], proposalKey: 'draft:extra', id: 'extra', name: 'Added', roots: [...invalid[0].roots] });
    assert.equal(await restarted.saveReviewDraft(reopenedHandle, review.reviewId, 0, invalid), 1);
    await assert.rejects(restarted.acceptReview(reopenedHandle, review.reviewId, invalid), /ambiguous_root/);
    await assert.rejects(restarted.saveReviewDraft(reopenedHandle, review.reviewId, 0, review.draft), /Stale/);
    await assert.rejects(restarted.saveReviewDraft(reopenedHandle, 'wrong', 1, review.draft), /matching/);
    await assert.rejects(restarted.saveReviewDraft('wrong', review.reviewId, 1, review.draft), /handle/);
    const secondConnection = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()));
    const secondHandle = await attach(secondConnection, a);
    assert.deepEqual((await secondConnection.review(secondHandle))?.draft, invalid);
    assert.equal((await secondConnection.review(secondHandle))?.revision, 1);
    const refined = invalid.filter(node => node.proposalKey !== 'draft:extra').map(node =>
      node.kind === 'subsystem' ? { ...node, name: 'Accepted refinement' } : node);
    assert.equal(await secondConnection.saveReviewDraft(secondHandle, review.reviewId, 1, refined), 2);
    await assert.rejects(restarted.saveReviewDraft(reopenedHandle, review.reviewId, 1, invalid), /Stale/);
    const third = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()));
    const thirdHandle = await attach(third, a);
    assert.deepEqual((await third.review(thirdHandle))?.draft, refined);
    assert.equal((await third.review(thirdHandle))?.revision, 2);
    const bHandle = await attach(third, b);
    await assert.rejects(third.saveReviewDraft(bHandle, review.reviewId, 2, refined), /matching/);
    assert.deepEqual((await readSynthesisRun(a))?.review?.draft, refined);
    await assert.rejects(third.saveReviewDraft(thirdHandle, review.reviewId, 2, refined), /handle/);
    await secondConnection.cancelInitialization(secondHandle);
    assert.equal(await readSynthesisRun(a), undefined);
    restarted.dispose(); secondConnection.dispose(); third.dispose();
  } finally { await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); }
});

test('accepted review clears saved draft work', async () => {
  const root = await fixture();
  try {
    const first = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), fakeProvider());
    const handle = await attach(first, root);
    const review = await first.startInitialization(handle);
    const edited = review.draft.map(node => ({ ...node, purpose: `${node.purpose} edited` }));
    assert.equal(await first.saveReviewDraft(handle, review.reviewId, 0, edited), 1);
    assert.equal((await first.acceptReview(handle, review.reviewId, edited)).state, 'ready');
    assert.equal(await readSynthesisRun(root), undefined);
    assert.equal((await readInitialization(root)).initialized, true);
    first.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('offline review checker reports text/JSON blockers and staleness without writes', async () => {
  const root = await fixture();
  try {
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), fakeProvider());
    const handle = await attach(service, root);
    const review = await service.startInitialization(handle);
    service.dispose();
    const script = join(process.cwd(), 'scripts/smap-review-check.mjs');
    const check = (...options: string[]) => spawnSync(process.execPath, [script, root, ...options], { encoding: 'utf8' });
    const file = join(root, '.dope/smap-analysis.json');
    const before = await readFile(file, 'utf8');
    const good = check('--json');
    assert.equal(good.status, 0, good.stderr);
    assert.deepEqual(JSON.parse(good.stdout).blockers, []);
    assert.deepEqual(JSON.parse(good.stdout).stale, []);
    assert.equal(JSON.parse(good.stdout).revision, 0);
    const npmCheck = spawnSync('npm', ['run', 'smap:review:check', '--', root, '--json'], { encoding: 'utf8' });
    assert.equal(npmCheck.status, 0, npmCheck.stderr);
    assert.match(npmCheck.stdout, /"reviewId":"/);
    assert.equal(await readFile(file, 'utf8'), before);

    const changed = JSON.parse(before);
    changed.review.revision = 1;
    changed.review.draft[0].roots = [...changed.review.draft[1].roots];
    changed.review.draft[1].id = changed.review.draft[0].id;
    await writeFile(file, JSON.stringify(changed));
    const invalidBefore = await readFile(file, 'utf8');
    const text = check();
    const machine = check('--json');
    assert.equal(text.status, 1);
    assert.match(text.stdout, /ambiguous_root/);
    assert.match(text.stdout, /duplicate_id/);
    assert.match(text.stdout, /Staleness: none/);
    assert.equal(machine.status, 1);
    assert.equal(JSON.parse(machine.stdout).revision, 1);
    assert.deepEqual(JSON.parse(machine.stdout).blockers.map((issue: any) => issue.code), ['ambiguous_root', 'duplicate_id']);
    assert.equal(await readFile(file, 'utf8'), invalidBefore);

    await writeFile(join(root, 'src/api/a.ts'), 'export const changed = true;\n');
    const stale = JSON.parse(check('--json').stdout);
    assert.deepEqual(stale.stale, ['source_changed']);
    assert.equal(check('--json').status, 1);
    await writeFile(join(root, '.dope/architecture.json'), `${JSON.stringify(declaration)}\n`);
    assert.deepEqual(JSON.parse(check('--json').stdout).stale, ['declaration_changed', 'source_changed']);
    await rm(file);
    assert.equal(check('--json').status, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('targeted backend call uses pending packet and edited branch, validates evidence and records purpose', async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, 'MODULES.md'), '# Original architecture seed');
    await writeFile(join(root, 'README.md'), '# Original orientation');
    let seen: any;
    const provider: SynthesisProvider = { ...fakeProvider(), runRefinement: async request => {
      seen = request;
      const fact = request.view.items.find(isDirectSystemResponsibilityEvidence);
      assert.ok(fact);
      return { output: { schemaVersion: 1, summary: 'Refined target', needsMoreEvidence: false,
        nodes: [{ proposalKey: 'proposal:refined', kind: 'system', name: 'Refined', purpose: 'Refined behavior',
          parentProposalKey: null, confidence: .8, rationale: 'Observed behavior', evidenceRefs: [fact.id], evidence: [fact.path] }],
        unassignedEvidenceRefs: [], openQuestions: [], evidenceRequests: [] },
        usage: { providerKind: 'local', modelLabel: 'fixture-model', requestBytes: 1, outputBytes: 1,
          tokenMeasurement: 'unavailable' } };
    } };
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), provider);
    const handle = await attach(service, root);
    const review = await service.startInitialization(handle);
    const target = review.draft.find(node => node.kind === 'system')!;
    const branch = review.draft.filter(node => node.proposalKey === target.proposalKey || node.parentProposalKey === target.proposalKey)
      .map(node => ({ ...node, name: node.proposalKey === target.proposalKey ? 'Manual rename' : node.name }));
    await writeFile(join(root, 'MODULES.md'), '# Changed after review');
    const input = { reviewId: review.reviewId, targetKey: target.proposalKey, targetKind: 'system' as const,
      parentKey: null, branch, branchFingerprint: branchFingerprint(branch) };
    const result = await service.searchDeeper(handle, input);
    assert.equal(seen.stage, 'target-refinement');
    assert.equal(seen.branch[0].name, 'Manual rename');
    assert.equal(seen.parentPacketFingerprint, review.packet.inputFingerprint);
    assert.equal(seen.documents.find((doc: any) => doc.path === 'MODULES.md').content, '# Original architecture seed');
    assert.equal(result.proposal.nodes[0].name, 'Refined');
    assert.equal((await service.review(handle))?.draft[0].name, review.draft[0].name);
    assert.equal((await service.synthesisAttempts(handle)).at(-1)?.stage, 'target-refinement');
    assert.equal((await service.synthesisAttempts(handle)).at(-1)?.consumed, true);
    const subsystem = review.draft.find(node => node.kind === 'subsystem')!;
    const parentContext = { ...target, name: 'Edited parent' };
    const subBranch = [{ ...subsystem, name: 'Edited Subsystem' }];
    const subInput = { reviewId: review.reviewId, targetKey: subsystem.proposalKey, targetKind: 'subsystem' as const,
      parentKey: target.proposalKey, parentContext, branch: subBranch,
      branchFingerprint: branchFingerprint(subBranch, parentContext) };
    provider.runRefinement = async request => {
      const fact = request.view.items.find(isDirectSystemResponsibilityEvidence)!;
      const node = (key: string, kind: 'system' | 'subsystem', parent: string | null) => ({ proposalKey: key, kind,
        name: key, purpose: key, parentProposalKey: parent, confidence: .8, rationale: fact.path,
        evidenceRefs: [fact.id], evidence: [fact.path] });
      return { output: { schemaVersion: 1, summary: 'Split', needsMoreEvidence: false,
        nodes: [node('proposal:anchor', 'system', null), node('proposal:one', 'subsystem', 'proposal:anchor'),
          node('proposal:two', 'subsystem', 'proposal:anchor')],
        unassignedEvidenceRefs: [], openQuestions: [], evidenceRequests: [] },
        usage: { providerKind: 'local', modelLabel: 'fixture-model', requestBytes: 1, outputBytes: 1,
          tokenMeasurement: 'unavailable' } };
    };
    assert.equal((await service.searchDeeper(handle, subInput)).proposal.nodes.filter(node => node.kind === 'subsystem').length, 2);
    provider.runRefinement = async request => {
      const fact = request.view.items.find(isDirectSystemResponsibilityEvidence)!;
      return { output: { schemaVersion: 1, summary: 'Invalid escape', needsMoreEvidence: false,
        nodes: [{ proposalKey: 'proposal:outside', kind: 'system', name: 'Outside', purpose: 'Outside',
          parentProposalKey: null, confidence: .8, rationale: fact.path, evidenceRefs: [fact.id], evidence: [fact.path] }],
        unassignedEvidenceRefs: [], openQuestions: [], evidenceRequests: [] },
        usage: { providerKind: 'local', modelLabel: 'fixture-model', requestBytes: 1, outputBytes: 1,
          tokenMeasurement: 'unavailable' } };
    };
    await assert.rejects(service.searchDeeper(handle, subInput), /Invalid targeted refinement boundary/);
    assert.equal((await service.synthesisAttempts(handle)).at(-1)?.consumed, false);
    assert.equal((await service.resolveReviewDocument(handle, review.reviewId, 'MODULES.md'))?.path, 'MODULES.md');
    assert.equal(await service.resolveReviewDocument(handle, review.reviewId, 'docs/tasks/answer.md'), undefined);
    await rm(join(root, 'MODULES.md'));
    await symlink('/etc/hosts', join(root, 'MODULES.md'));
    await assert.rejects(service.resolveReviewDocument(handle, review.reviewId, 'MODULES.md'), /Unsafe/);
    await assert.rejects(service.searchDeeper(handle, { ...input, branchFingerprint: 'wrong' }), /Invalid refinement branch/);
    await assert.rejects(service.searchDeeper(handle, { ...input, reviewId: 'wrong' }), /matching/);
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('manual greenfield acceptance needs no provider; malformed marker and symlinks reject without rewriting declaration', async () => {
  const root = await fixture();
  const other = await fixture();
  try {
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()));
    const handle = await attach(service, root);
    await service.acceptManual(handle, declaration, (await service.initializationStatus(handle)).declarationFingerprint);
    const architecture = await readFile(join(root, '.dope/architecture.json'), 'utf8');
    await writeFile(join(root, '.dope/smap.json'), '{bad');
    await assert.rejects(service.initializationStatus(handle), /Invalid Software Map marker/);
    assert.equal(await readFile(join(root, '.dope/architecture.json'), 'utf8'), architecture);
    await rm(join(root, '.dope/smap.json'));
    await symlink(join(other, 'tsconfig.json'), join(root, '.dope/smap.json'));
    await assert.rejects(service.initializationStatus(handle), /Unsafe/);
    await rm(join(root, '.dope/smap.json'));
    assert.equal((await service.initializationStatus(handle)).state, 'uninitialized');
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); await rm(other, { recursive: true, force: true }); }
});

test('second-file failure restores exact original bytes and leaves no marker', async () => {
  const root = await fixture();
  try {
    await mkdir(join(root, '.dope'));
    const original = JSON.stringify(declaration);
    await writeFile(join(root, '.dope/architecture.json'), original);
    const before = await readInitialization(root);
    await assert.rejects(acceptInitialization(root, before.declarationFingerprint,
      { ...declaration, systems: [{ ...declaration.systems[0], name: 'Changed' }] }, async () => { throw new Error('injected marker failure'); }), /injected/);
    assert.equal(await readFile(join(root, '.dope/architecture.json'), 'utf8'), original);
    assert.equal((await readInitialization(root)).initialized, false);
    assert.deepEqual((await readdir(join(root, '.dope'))).sort(), ['architecture.json']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('project handle and review token isolate roots', async () => {
  const a = await fixture(); const b = await fixture();
  try {
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), fakeProvider());
    const handleA = await attach(service, a);
    const reviewA = await service.startInitialization(handleA);
    const handleB = await attach(service, b);
    await assert.rejects(service.acceptReview(handleA, reviewA.reviewId, reviewA.draft), /Invalid/);
    await assert.rejects(service.startInitialization(handleB), /not ready/);
    await assert.rejects(service.acceptReview(handleB, reviewA.reviewId, reviewA.draft), /matching/);
    await service.cancelInitialization(handleB);
    assert.equal((await service.initializationStatus(handleB)).state, 'uninitialized');
    assert.equal((await readdir(a)).includes('.dope'), true);
    assert.equal((await readdir(b)).includes('.dope'), false);
    service.dispose();
  } finally { await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); }
});

test('hierarchical review revalidates source before acceptance', async () => {
  const root = await fixture();
  try {
    const calls: string[] = [];
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), fakeProvider(request => { calls.push(request.stage); }));
    const handle = await attach(service, root);
    const review = await service.startInitialization(handle);
    assert.deepEqual(calls.slice(0, 3), ['system-discovery', 'system-challenge', 'subsystem-discovery']);
    assert.equal((await service.initializationStatus(handle)).state, 'review_required');
    const draft = review.draft.map(node => ({ ...node, id: node.kind === 'system' ? 'app' : 'api', roots: node.kind === 'subsystem' ? ['src/api'] : [] }));
    await writeFile(join(root, 'src/api/a.ts'), 'export const changed = 1;\n');
    await assert.rejects(service.acceptReview(handle, review.reviewId, draft), /Stale Software Map evidence/);
    assert.equal((await readdir(root)).includes('.dope'), true);
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('backend reports ordered hierarchy, known counts and measured time before transient review', async () => {
  const root = await fixture();
  const events: AnalysisProgressEvent[] = [];
  const client = { notifySoftwareMapChanged() {}, notifySoftwareMapAnalysisProgress(_handle: string, event: AnalysisProgressEvent) { events.push(event); } };
  try {
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), fakeProvider(), client);
    const handle = await attach(service, root);
    const review = await service.startInitialization(handle);
    assert.ok(review.draft.length > 0);
    const starts = events.filter(event => event.status === 'started' && !event.callPurpose).map(event => event.stage);
    assert.deepEqual([...new Set(starts)], ['collecting-evidence', 'building-skeleton', 'system-discovery',
      'system-challenge', 'subsystem-discovery', 'subsystem-challenge', 'component-discovery',
      'reconciliation', 'verification', 'preparing-review']);
    assert.deepEqual(events.slice(-2).map(event => event.stage), ['preparing-review', 'completed']);
    const subtree = events.filter(event => event.stage === 'subsystem-discovery');
    assert.ok(subtree.some(event => event.subject === 'App' && event.completedUnits === 0 && event.totalUnits === 1));
    assert.ok(subtree.some(event => event.completedUnits === 1 && event.totalUnits === 1));
    assert.ok(events.filter(event => event.stage === 'system-discovery').every(event => event.totalUnits === undefined));
    assert.ok(events.every((event, i) => event.elapsedMs >= 0 && event.stageElapsedMs! >= 0 &&
      (i === 0 || event.elapsedMs >= events[i - 1].elapsedMs)));
    assert.ok(events.some(event => event.callPurpose === 'system-discovery' && event.providerModelLabel === 'fixture-model'));
    assert.ok(events.some(event => event.providerKind === 'local' && event.providerModelLabel === 'fixture-model' &&
      event.usage?.tokenMeasurement === 'unavailable' && event.callDurationMs !== undefined));
    const attempts = await service.synthesisAttempts(handle);
    assert.ok(attempts.length > 0 && attempts.every(item => item.consumed && item.attempt === 1 &&
      item.providerKind === 'local' && item.modelLabel === 'fixture-model'));
    events.length = 0;
    assert.equal((await service.synthesisAttempts(handle)).length, attempts.length);
    assert.ok(!JSON.stringify(events).match(/prompt|chain.of.thought|percentage/i));
    assert.equal((await readdir(root)).includes('.dope'), true);
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Gemini environment and session setup remain in memory, fail closed, and never fall back', async () => {
  const root = await fixture();
  const previous = process.env.GEMINI_API_KEY;
  const keys: string[] = [];
  const calls: string[] = [];
  const events: AnalysisProgressEvent[] = [];
  let service: SoftwareMapBackend;
  let handle: string;
  const makeGemini = (key: string) => {
    keys.push(key);
    let selected = '';
    return { kind: 'gemini', discoverModels: async () => { selected = ''; return ['gemini-3.6-flash', 'gemini-3.8-flash']; },
      selectModel: (id: string) => { selected = id; }, probe: async () => { calls.push(`probe:${selected}`); },
      capabilities: async () => ({ modelLabel: selected, contextWindowTokens: 100000,
        maxInputTokens: 90000, reservedInstructionTokens: 1000, reservedOutputTokens: 2000,
        reservedOverheadTokens: 1000, tokenEstimate: 'conservative' }),
      estimateTokens: async (text: string) => text.length,
      runStage: async () => {
        calls.push(`gemini:${selected}`);
        await assert.rejects(service.selectSynthesisModel(handle, 'gemini-3.8-flash'), /analysis is active/);
        throw new Error(`raw provider error ${key}`);
      } } as any;
  };
  try {
    process.env.GEMINI_API_KEY = 'environment-secret';
    service = new SoftwareMapBackend(new SoftwareMapIndex(new TypeScriptAnalyzer()),
      { notifySoftwareMapChanged() {}, notifySoftwareMapAnalysisProgress(_handle, event) { events.push(event); } },
      undefined, makeGemini);
    handle = await attach(service, root);
    assert.deepEqual(await service.synthesisEnvironment(handle), { geminiKeyAvailable: true });
    assert.deepEqual(await service.configureSynthesis(handle, { kind: 'gemini' }),
      { models: ['gemini-3.6-flash', 'gemini-3.8-flash'] });
    assert.deepEqual(keys, ['environment-secret']);
    assert.equal(await service.synthesisReady(handle), false);
    await service.selectSynthesisModel(handle, 'gemini-3.6-flash');
    await service.probeSynthesis(handle);
    assert.equal(await service.synthesisReady(handle), true);
    await service.selectSynthesisModel(handle, 'gemini-3.8-flash');
    assert.equal(await service.synthesisReady(handle), false);
    await service.selectSynthesisModel(handle, 'gemini-3.6-flash');
    await service.probeSynthesis(handle);
    await assert.rejects(service.startInitialization(handle), /Gemini analysis failed/);
    assert.deepEqual(calls, ['probe:gemini-3.6-flash', 'probe:gemini-3.6-flash', 'gemini:gemini-3.6-flash']);
    assert.ok(JSON.stringify(events).includes('gemini-3.6-flash'));
    assert.equal(JSON.stringify(events).includes('environment-secret'), false);
    assert.equal((await readdir(root)).includes('.dope'), true);
    await service.configureSynthesis(handle, { kind: 'gemini', apiKey: 'session-secret' });
    assert.deepEqual(keys, ['environment-secret', 'session-secret']);
    assert.equal(await service.synthesisReady(handle), false);
    await service.selectSynthesisModel(handle, 'gemini-3.8-flash');
    await service.probeSynthesis(handle);
    assert.equal(await service.synthesisReady(handle), true);
    assert.deepEqual(await service.refreshSynthesisModels(handle), { models: ['gemini-3.6-flash', 'gemini-3.8-flash'] });
    assert.equal(await service.synthesisReady(handle), false);
    assert.equal(JSON.stringify(await service.synthesisEnvironment(handle)).includes('secret'), false);
    assert.equal(JSON.stringify([...((service as any).synthesisCache.results as Map<string, unknown>).keys()]).includes('session-secret'), false);
    ((service as any).synthesisCache.results as Map<string, unknown>).set('retained-provider', { provider: keys });
    await service.clearSynthesis(handle);
    assert.equal(await service.synthesisReady(handle), false);
    assert.equal(((service as any).synthesisCache.results as Map<string, unknown>).size, 0);
    await service.configureSynthesis(handle, { kind: 'gemini' });
    await service.attach(pathToFileURL(root).href);
    assert.equal(await service.synthesisReady(handle), false);
    service.dispose();
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
    await rm(root, { recursive: true, force: true });
  }
});

test('Gemini key survives backend restart in the machine credential store, outside project state', async () => {
  const root = await fixture();
  const stored = new Map<string, string>();
  const keys: string[] = [];
  const credentials = {
    getPassword: async (service: string, account: string) => stored.get(`${service}:${account}`),
    setPassword: async (service: string, account: string, value: string) => { stored.set(`${service}:${account}`, value); }
  };
  const makeGemini = (key: string) => {
    keys.push(key);
    return { discoverModels: async () => ['gemini-3.8-flash'] } as any;
  };
  try {
    const index = new SoftwareMapIndex(new TypeScriptAnalyzer());
    const client = { notifySoftwareMapChanged() {} };
    const first = new SoftwareMapBackend(index, client, undefined, makeGemini, credentials);
    const firstHandle = await attach(first, root);
    assert.deepEqual(await first.synthesisEnvironment(firstHandle), { geminiKeyAvailable: false });
    await first.configureSynthesis(firstHandle, { kind: 'gemini', apiKey: 'saved-fixture-key' });
    assert.deepEqual(await first.synthesisEnvironment(firstHandle), { geminiKeyAvailable: true });
    first.dispose();
    const restarted = new SoftwareMapBackend(index, client, undefined, makeGemini, credentials);
    const restartedHandle = await attach(restarted, root);
    assert.deepEqual(await restarted.configureSynthesis(restartedHandle, { kind: 'gemini' }),
      { models: ['gemini-3.8-flash'] });
    assert.deepEqual(keys, ['saved-fixture-key', 'saved-fixture-key']);
    assert.equal((await readdir(root)).includes('.dope'), false);
    restarted.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Gemini stage exposes only fixed safe failure diagnostics', async () => {
  const root = await fixture();
  const failures = ['Gemini request rejected (HTTP 400)', 'System Discovery produced no Systems to challenge'];
  const provider = { ...fakeProvider(() => { throw new Error(failures.shift()); }), kind: 'gemini' as const };
  const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), provider);
  try {
    const handle = await attach(service, root);
    await assert.rejects(service.startInitialization(handle), /Gemini analysis failed: Gemini request rejected \(HTTP 400\)/);
    await assert.rejects(service.startInitialization(handle), /Gemini analysis failed: System Discovery produced no Systems to challenge/);
    assert.equal((await readdir(root)).includes('.dope'), true);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('failure can retry; cancel and project switch discard late stage results', async () => {
  const a = await fixture(); const b = await fixture();
  const events: { handle: string; event: AnalysisProgressEvent }[] = [];
  let fail = true;
  let entered = 0;
  let block: Promise<void> | undefined;
  let release = () => {};
  const provider = fakeProvider(async request => {
    if (request.stage !== 'system-discovery') return;
    entered++;
    if (fail) { fail = false; throw new Error('provider failed'); }
    await block;
  });
  const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), provider,
    { notifySoftwareMapChanged() {}, notifySoftwareMapAnalysisProgress(handle, event) { events.push({ handle, event }); } });
  try {
    const handleA = await attach(service, a);
    await assert.rejects(service.startInitialization(handleA), /provider failed/);
    assert.equal(events.at(-1)?.event.stage, 'failed');
    assert.equal((await service.initializationStatus(handleA)).state, 'failed');
    block = new Promise<void>(resolve => { release = resolve; });
    const pending = service.startInitialization(handleA);
    while (entered < 2)
      await new Promise(resolve => setTimeout(resolve, 10));
    await service.cancelInitialization(handleA);
    assert.equal(events.at(-1)?.event.stage, 'cancelled');
    release();
    await assert.rejects(pending, /Superseded/);
    assert.equal(await service.review(handleA), undefined);
    assert.ok((await service.synthesisAttempts(handleA)).some(item => item.failureClass === 'cancelled' && !item.consumed));
    block = new Promise<void>(resolve => { release = resolve; });
    const old = service.startInitialization(handleA);
    while (entered < 3)
      await new Promise(resolve => setTimeout(resolve, 10));
    const handleB = await attach(service, b);
    const count = events.length;
    release();
    await assert.rejects(old, /Invalid|Superseded/);
    assert.equal(events.length, count);
    assert.equal(await service.review(handleB), undefined);
    assert.equal((await readdir(a)).includes('.dope'), true);
    assert.equal((await readdir(b)).includes('.dope'), false);
  } finally { service.dispose(); await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); }
});

test('mismatched marker and unsafe directory are never initialized', async () => {
  const root = await fixture(); const other = await fixture();
  try {
    await mkdir(join(root, '.dope'));
    await writeFile(join(root, '.dope/architecture.json'), JSON.stringify(declaration));
    await writeFile(join(root, '.dope/smap.json'), JSON.stringify({ schemaVersion: 1, architectureFingerprint: '0'.repeat(64) }));
    await assert.rejects(readInitialization(root), /does not match/);
    await rm(join(root, '.dope'), { recursive: true });
    await symlink(other, join(root, '.dope'));
    await assert.rejects(readInitialization(root), /Unsafe/);
  } finally { await rm(root, { recursive: true, force: true }); await rm(other, { recursive: true, force: true }); }
});
