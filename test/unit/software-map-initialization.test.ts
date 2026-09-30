import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';
import { acceptInitialization, readInitialization } from '../../packages/code-analysis/lib/node/smap-initialization-file.js';
import { SoftwareMapBackend } from '../../packages/theia-extension/lib/node/software-map-backend.js';
import type { SynthesisProvider, SynthesisStageRequest, SoftwareMapClient, AnalysisProgressEvent } from '../../packages/software-map/lib/index.js';

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
const stageResult = (request: SynthesisStageRequest, fields: object) => ({ schemaVersion: 1, stageVersion: 2,
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
      return execution(request, { systemKey: request.context.subjectSystemKey, nodes: [{ candidateKey: 'candidate:api',
        kind: 'subsystem', parentCandidateKey: 'candidate:app', name: 'API', responsibility: 'API', confidence: .8, ambiguityCodes: [], evidenceRefs: [ref], ownershipEvidenceRefs: [ref] }],
        subdivisionAssessment: { confidence: .8, ambiguityCodes: [] } });
    }
    if (request.stage === 'reconciliation') return execution(request, { findings: [], unresolved: [] });
    return execution(request, { findings: [] });
  },
});
const backend = (index: SoftwareMapIndex, provider?: SynthesisProvider, client: SoftwareMapClient = { notifySoftwareMapChanged() {} }) =>
  new SoftwareMapBackend(index, client, provider);
const attach = async (service: SoftwareMapBackend, root: string) => (await service.attach(pathToFileURL(root).href)).projectHandle;

test('attach/status, decline, failure and cancel leave an uninitialized project unwritten and unpublished', async () => {
  const root = await fixture();
  try {
    let analyses = 0;
    const analyzer = new TypeScriptAnalyzer();
    const index = new SoftwareMapIndex({ analyze: path => { analyses++; return analyzer.analyze(path); }, inputPaths: path => analyzer.inputPaths(path) });
    const service = backend(index, fakeProvider(() => { throw new Error('provider failed'); }));
    const handle = await attach(service, root);
    assert.equal((await service.initializationStatus(handle)).state, 'uninitialized');
    assert.equal(analyses, 0);
    assert.equal(index.snapshot(root), undefined);
    assert.equal((await readdir(root)).includes('.dope'), false);
    await service.cancelInitialization(handle);
    assert.equal(analyses, 0);
    await assert.rejects(service.startInitialization(handle), /provider failed/);
    assert.ok(analyses > 0);
    assert.equal((await service.initializationStatus(handle)).state, 'uninitialized');
    assert.equal(index.snapshot(root), undefined);
    assert.equal((await readdir(root)).includes('.dope'), false);
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

test('generated review stays transient, rejects invalid/stale drafts, then accepts canonical IDs', async () => {
  const root = await fixture();
  try {
    const index = new SoftwareMapIndex(new TypeScriptAnalyzer());
    const service = backend(index, fakeProvider());
    const handle = await attach(service, root);
    const review = await service.startInitialization(handle);
    assert.equal((await service.initializationStatus(handle)).state, 'review_required');
    const sourceFact = review.packet.items.find((item: any) => item.path === 'src/api/a.ts');
    assert.ok(sourceFact);
    assert.equal((await service.resolveReviewSource(handle, review.reviewId, sourceFact.id))?.path, 'src/api/a.ts');
    assert.equal(await service.resolveReviewSource(handle, 'wrong', sourceFact.id), undefined);
    assert.equal(await service.resolveReviewSource(handle, review.reviewId, 'fabricated'), undefined);
    assert.equal(index.snapshot(root), undefined);
    assert.equal((await readdir(root)).includes('.dope'), false);
    await assert.rejects(service.acceptReview(handle, 'wrong', review.draft), /matching/);
    await assert.rejects(service.acceptReview(handle, review.reviewId, review.draft), /review draft|declaration/);
    assert.equal((await service.initializationStatus(handle)).state, 'review_required');
    const draft = review.draft.map(node => ({ ...node, id: node.kind === 'system' ? 'app' : 'api', roots: node.kind === 'subsystem' ? ['src/api'] : [] }));
    await writeFile(join(root, '.dope/architecture.json'), JSON.stringify(declaration)).catch(async () => {
      await mkdir(join(root, '.dope')); await writeFile(join(root, '.dope/architecture.json'), JSON.stringify(declaration));
    });
    await assert.rejects(service.acceptReview(handle, review.reviewId, draft), /Stale/);
    assert.equal((await service.initializationStatus(handle)).state, 'review_required');
    await rm(join(root, '.dope/architecture.json'));
    assert.equal((await service.acceptReview(handle, review.reviewId, draft)).state, 'ready');
    assert.equal((await service.initializationStatus(handle)).state, 'initialized');
    assert.equal((await service.review(handle)), undefined);
    assert.equal(await service.resolveReviewSource(handle, review.reviewId, sourceFact.id), undefined);
    assert.equal(index.snapshot(root)!.nodes.some(node => node.id === 'api'), true);
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
    assert.equal((await readdir(a)).includes('.dope'), false);
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
    assert.equal((await readdir(root)).includes('.dope'), false);
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
      'system-challenge', 'subsystem-discovery', 'reconciliation', 'verification', 'preparing-review']);
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
    assert.ok(!JSON.stringify(events).match(/prompt|chain.of.thought|percentage/i));
    assert.equal((await readdir(root)).includes('.dope'), false);
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
    assert.equal((await readdir(root)).includes('.dope'), false);
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
  const provider = { ...fakeProvider(() => { throw new Error('Gemini request rejected (HTTP 400)'); }), kind: 'gemini' as const };
  const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), provider);
  try {
    const handle = await attach(service, root);
    await assert.rejects(service.startInitialization(handle), /Gemini analysis failed: Gemini request rejected \(HTTP 400\)/);
    assert.equal((await readdir(root)).includes('.dope'), false);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('failure can retry; cancel and project switch discard late stage results', async () => {
  const a = await fixture(); const b = await fixture();
  const events: { handle: string; event: AnalysisProgressEvent }[] = [];
  let fail = true;
  let block: Promise<void> | undefined;
  let release = () => {};
  const provider = fakeProvider(async request => {
    if (request.stage !== 'system-discovery') return;
    if (fail) { fail = false; throw new Error('provider failed'); }
    await block;
  });
  const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), provider,
    { notifySoftwareMapChanged() {}, notifySoftwareMapAnalysisProgress(handle, event) { events.push({ handle, event }); } });
  try {
    const handleA = await attach(service, a);
    await assert.rejects(service.startInitialization(handleA), /provider failed/);
    assert.equal(events.at(-1)?.event.stage, 'failed');
    assert.equal((await service.initializationStatus(handleA)).state, 'uninitialized');
    block = new Promise<void>(resolve => { release = resolve; });
    const pending = service.startInitialization(handleA);
    while (events.filter(item => item.handle === handleA && item.event.callPurpose === 'system-discovery').length < 2)
      await new Promise(resolve => setTimeout(resolve, 10));
    await service.cancelInitialization(handleA);
    assert.equal(events.at(-1)?.event.stage, 'cancelled');
    release();
    await assert.rejects(pending, /Superseded/);
    assert.equal(await service.review(handleA), undefined);
    block = new Promise<void>(resolve => { release = resolve; });
    const old = service.startInitialization(handleA);
    while (events.filter(item => item.handle === handleA && item.event.callPurpose === 'system-discovery').length < 3)
      await new Promise(resolve => setTimeout(resolve, 10));
    const handleB = await attach(service, b);
    const count = events.length;
    release();
    await assert.rejects(old, /Invalid|Superseded/);
    assert.equal(events.length, count);
    assert.equal(await service.review(handleB), undefined);
    assert.equal((await readdir(a)).includes('.dope'), false);
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
