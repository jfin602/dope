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
const proposal = (id: string) => ({ schemaVersion: 1, summary: 'Proposal', needsMoreEvidence: false, nodes: [
  { proposalKey: 'proposal:app', kind: 'system', name: 'App', purpose: 'App', parentProposalKey: null, confidence: .8, rationale: 'Evidence', evidenceRefs: [id], evidence: ['Evidence'] },
  { proposalKey: 'proposal:api', kind: 'subsystem', name: 'API', purpose: 'API', parentProposalKey: 'proposal:app', confidence: .8, rationale: 'Evidence', evidenceRefs: [id], evidence: ['Evidence'] },
], unassignedEvidenceRefs: [], openQuestions: [], evidenceRequests: [] });
const backend = (index: SoftwareMapIndex, synthesize?: (packet: any) => Promise<unknown>) => new SoftwareMapBackend(index,
  { notifySoftwareMapChanged() {} }, synthesize ? { synthesize } : undefined);
const attach = async (service: SoftwareMapBackend, root: string) => (await service.attach(pathToFileURL(root).href)).projectHandle;

test('attach/status, decline, failure and cancel leave an uninitialized project unwritten and unpublished', async () => {
  const root = await fixture();
  try {
    let analyses = 0;
    const analyzer = new TypeScriptAnalyzer();
    const index = new SoftwareMapIndex({ analyze: path => { analyses++; return analyzer.analyze(path); }, inputPaths: path => analyzer.inputPaths(path) });
    const service = backend(index, async () => { throw new Error('provider failed'); });
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
    const service = backend(index, async packet => proposal(packet.items[0].id));
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
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), async packet => proposal(packet.items[0].id));
    const handleA = await attach(service, a);
    const reviewA = await service.startInitialization(handleA);
    const handleB = await attach(service, b);
    await assert.rejects(service.acceptReview(handleA, reviewA.reviewId, reviewA.draft), /Invalid/);
    const reviewB = await service.startInitialization(handleB);
    await assert.rejects(service.acceptReview(handleB, reviewA.reviewId, reviewB.draft), /matching/);
    await service.cancelInitialization(handleB);
    assert.equal((await service.initializationStatus(handleB)).state, 'uninitialized');
    assert.equal((await readdir(a)).includes('.dope'), false);
    assert.equal((await readdir(b)).includes('.dope'), false);
    service.dispose();
  } finally { await rm(a, { recursive: true, force: true }); await rm(b, { recursive: true, force: true }); }
});

test('bounded refinement revalidates the exact expanded packet; changed source blocks acceptance', async () => {
  const root = await fixture();
  try {
    let calls = 0;
    const service = backend(new SoftwareMapIndex(new TypeScriptAnalyzer()), async packet => {
      calls++;
      if (calls === 1) return { ...proposal(packet.items[0].id), needsMoreEvidence: true,
        evidenceRequests: [{ kind: 'semantic', targets: [packet.items.find((item: any) => item.kind === 'semantic')!.path], reason: 'Need source detail' }] };
      return proposal(packet.items[0].id);
    });
    const handle = await attach(service, root);
    const review = await service.startInitialization(handle);
    assert.equal(calls, 2);
    assert.equal((await service.initializationStatus(handle)).state, 'review_required');
    const draft = review.draft.map(node => ({ ...node, id: node.kind === 'system' ? 'app' : 'api', roots: node.kind === 'subsystem' ? ['src/api'] : [] }));
    await writeFile(join(root, 'src/api/a.ts'), 'export const changed = 1;\n');
    await assert.rejects(service.acceptReview(handle, review.reviewId, draft), /Stale Software Map evidence/);
    assert.equal((await readdir(root)).includes('.dope'), false);
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
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
