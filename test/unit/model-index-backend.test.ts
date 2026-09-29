import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { canonicalLocalRoot, readArchitecture } from '../../packages/code-analysis/lib/node/architecture-file.js';
import { ModelIndex } from '../../packages/code-analysis/lib/node/model-index.js';
import { SoftwareModelBackend } from '../../packages/theia-extension/lib/node/software-model-backend.js';

const declaration = {
  schemaVersion: 1, systems: [{ id: 'app', name: 'App', purpose: 'Application', subsystems: [
    { id: 'api', name: 'API', purpose: 'Endpoint', roots: ['src/api'], allowedDependencies: ['core'], forbiddenDependencies: ['secret'],
      components: [{ id: 'handler', name: 'Handler', purpose: 'Request handling', roots: ['src/api/a.ts'] }] },
    { id: 'core', name: 'Core', purpose: 'Domain', roots: ['src/core'], components: [
      { id: 'core-unit', name: 'Core unit', purpose: 'Domain unit', roots: ['src/core/c.ts'] },
    ] },
    { id: 'secret', name: 'Secret', purpose: 'Private', roots: ['src/secret'] },
  ] }],
};
const emptyResult = { projects: [], nodes: [], relationships: [], evidence: [], status: { completeness: 'complete' as const, errors: [] } };
const snapshotData = (index: ModelIndex, root: string) => {
  const snapshot = structuredClone(index.snapshot(root)!);
  snapshot.metadata.generation = 0;
  return snapshot;
};
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dope-model-'));
  await mkdir(join(root, 'src/api'), { recursive: true });
  await mkdir(join(root, 'src/core'), { recursive: true });
  await mkdir(join(root, 'src/secret'), { recursive: true });
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'CommonJS', strict: true }, include: ['src/**/*.ts'] }));
  await writeFile(join(root, 'src/api/a.ts'), "import { core } from '../core/c';\nimport { secret } from '../secret/s';\nexport const run = () => core() + secret();\n");
  await writeFile(join(root, 'src/core/c.ts'), 'export const core = () => 1;\n');
  await writeFile(join(root, 'src/secret/s.ts'), 'export const secret = () => 2;\n');
  return root;
}
async function architecture(root: string, data: unknown = declaration) {
  await mkdir(join(root, '.dope'), { recursive: true });
  await writeFile(join(root, '.dope/architecture.json'), JSON.stringify(data));
}

test('declaration read is local, strict, read-only and rejects unsafe paths', async () => {
  const root = await fixture();
  const other = await fixture();
  try {
    assert.equal(await canonicalLocalRoot(pathToFileURL(root).href), root);
    await assert.rejects(canonicalLocalRoot('https://example.com/x'), /local/);
    assert.deepEqual((await readArchitecture(root)).architecture.systems, []);
    await architecture(root);
    assert.deepEqual((await readArchitecture(root)).architecture.systems[0].id, 'app');
    const file = join(root, '.dope/architecture.json');
    for (const text of ['{', JSON.stringify({ ...declaration, schemaVersion: 2 }), JSON.stringify({ ...declaration, systems: [{ ...declaration.systems[0], subsystems: [{ ...declaration.systems[0].subsystems[0], roots: ['../escape'] }] }] })]) {
      await writeFile(file, text);
      await assert.rejects(readArchitecture(root));
      assert.equal(await readFile(file, 'utf8'), text);
    }
    await rm(file);
    await symlink(join(other, 'tsconfig.json'), file);
    await assert.rejects(readArchitecture(root), /Unsafe/);
    await rm(file);
    await rm(join(root, '.dope'), { recursive: true });
    await symlink(other, join(root, '.dope'));
    await assert.rejects(readArchitecture(root), /Unsafe/);
  } finally { await rm(root, { recursive: true, force: true }); await rm(other, { recursive: true, force: true }); }
});

test('index invalidates source/config/declaration, matches clean rebuild, and retains violation provenance', async () => {
  const root = await fixture();
  try {
    await architecture(root);
    const analyzer = new TypeScriptAnalyzer();
    let resets = 0;
    const index = new ModelIndex({ analyze: path => analyzer.analyze(path), reset: path => { resets++; analyzer.reset(path); }, inputPaths: path => analyzer.inputPaths(path) });
    const clean = async () => { const separate = new ModelIndex(new TypeScriptAnalyzer()); await separate.analyze(root); return snapshotData(separate, root); };
    let status = await index.analyze(root);
    assert.equal(status.state, 'ready');
    assert.deepEqual(snapshotData(index, root), await clean());
    const snapshot = index.snapshot(root)!;
    assert.equal(snapshot.violations.length, 1);
    assert.equal(snapshot.violations[0].rule, 'forbidden-dependency');
    assert.equal(snapshot.violations[0].sourceSubsystemId, 'api');
    assert.equal(snapshot.violations[0].targetSubsystemId, 'secret');
    const subsystemEdge = snapshot.relationships.find(edge => edge.sourceId === 'api' && edge.targetId === 'secret' && edge.originRelationshipIds);
    assert.ok(subsystemEdge);
    assert.deepEqual(subsystemEdge.originRelationshipIds, snapshot.violations[0].originRelationshipIds);
    assert.deepEqual(subsystemEdge.evidenceIds, snapshot.violations[0].evidenceIds);
    for (const id of subsystemEdge.originRelationshipIds!) assert.ok(snapshot.relationships.find(edge => edge.id === id && !edge.originRelationshipIds));
    assert.ok(snapshot.relationships.some(edge => edge.sourceId === 'handler' && edge.targetId === 'core-unit' && edge.originRelationshipIds));
    assert.ok(snapshot.relationships.some(edge => edge.sourceId === 'app' && edge.targetId === 'app') === false);
    assert.ok(snapshot.nodes.some(node => node.kind === 'code' && node.codeKind === 'module' && node.parentId?.startsWith('code:file:')));
    assert.ok(snapshot.nodes.some(node => node.kind === 'code' && node.path === 'src/api/a.ts' && node.ownership.state === 'assigned'));
    const restricted = structuredClone(declaration);
    restricted.systems[0].subsystems[0].allowedDependencies = [];
    restricted.systems[0].subsystems[0].forbiddenDependencies = [];
    await architecture(root, restricted);
    await index.analyze(root);
    assert.deepEqual(index.snapshot(root)!.violations.map(item => [item.rule, item.targetSubsystemId]), [
      ['unlisted-dependency', 'core'], ['unlisted-dependency', 'secret'],
    ]);
    assert.deepEqual(snapshotData(index, root), await clean());
    await architecture(root);
    await index.analyze(root);
    status = await index.analyze(root);
    assert.ok(status.reusedSourceFiles > 0);
    assert.deepEqual(snapshotData(index, root), await clean());
    await writeFile(join(root, 'src/core/c.ts'), 'export const core = () => 3;\n');
    await index.analyze(root);
    assert.deepEqual(snapshotData(index, root), await clean());
    await writeFile(join(root, 'src/core/c.ts'), 'export const renamed = () => 3;\n');
    await index.analyze(root);
    assert.deepEqual(snapshotData(index, root), await clean());
    await writeFile(join(root, 'src/core/c.ts'), 'export const core = () => 3;\n');
    await index.analyze(root);
    assert.deepEqual(snapshotData(index, root), await clean());
    await writeFile(join(root, 'src/api/a.ts'), "import { core } from '../core/c';\nexport const run = () => core();\n");
    status = await index.analyze(root);
    assert.ok(status.reusedSourceFiles > 0);
    assert.deepEqual(index.snapshot(root)!.violations, []);
    assert.deepEqual(snapshotData(index, root), await clean());
    await writeFile(join(root, 'src/api/new.ts'), "import { secret } from '../secret/s'; export const another = secret;\n");
    await index.analyze(root);
    assert.equal(index.snapshot(root)!.violations.length, 1);
    assert.deepEqual(snapshotData(index, root), await clean());
    await rm(join(root, 'src/api/new.ts'));
    await index.analyze(root);
    assert.deepEqual(index.snapshot(root)!.violations, []);
    assert.deepEqual(snapshotData(index, root), await clean());
    const config = join(root, 'tsconfig.json');
    await writeFile(config, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'CommonJS', strict: true }, include: ['src/core/**/*.ts'] }));
    status = await index.analyze(root);
    assert.equal(status.reusedSourceFiles, 0);
    assert.ok(resets > 0);
    assert.deepEqual(snapshotData(index, root), await clean());
    const beforeDeclaration = resets;
    await architecture(root, { ...declaration, systems: [{ ...declaration.systems[0], name: 'Renamed', subsystems: declaration.systems[0].subsystems }] });
    await index.analyze(root);
    assert.equal(resets, beforeDeclaration + 1);
    assert.equal(index.snapshot(root)!.nodes.find(node => node.id === 'app')?.name, 'Renamed');
    assert.deepEqual(snapshotData(index, root), await clean());
    await writeFile(join(root, '.dope/architecture.json'), '{');
    status = await index.analyze(root);
    assert.equal(status.state, 'failed');
    assert.equal(index.snapshot(root), undefined);
    assert.match(status.analysis.errors[0].message, /Invalid architecture declaration/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('newest requested generation publishes even when older analysis finishes later', async () => {
  const root = await fixture();
  try {
    const pending: Array<(result: typeof emptyResult) => void> = [];
    const index = new ModelIndex({ analyze: () => new Promise(resolve => pending.push(resolve)) });
    const first = index.analyze(root);
    const second = index.analyze(root);
    const deadline = Date.now() + 5000;
    while (pending.length < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(pending.length, 2, JSON.stringify(index.status(root)));
    pending[1](emptyResult);
    assert.equal((await second).publishedGeneration, 2);
    pending[0](emptyResult);
    assert.equal((await first).publishedGeneration, 2);
    assert.equal(index.snapshot(root)?.metadata.generation, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('typed backend binds each connection to one root/handle, bounds queries, resolves source and disposes', async () => {
  const firstRoot = await fixture();
  const secondRoot = await fixture();
  try {
    await architecture(firstRoot);
    const index = new ModelIndex(new TypeScriptAnalyzer());
    const updates: number[] = [];
    const a = new SoftwareModelBackend(index, { notifySoftwareModelChanged: event => updates.push(event.generation) });
    const b = new SoftwareModelBackend(index, { notifySoftwareModelChanged: () => {} });
    const first = await a.attach(pathToFileURL(firstRoot).href);
    const second = await b.attach(pathToFileURL(secondRoot).href);
    assert.notEqual(first.projectHandle, second.projectHandle);
    await assert.rejects(a.attach(pathToFileURL(secondRoot).href), /different/);
    await assert.rejects(a.status(second.projectHandle), /Invalid/);
    await assert.rejects(a.analyze(second.projectHandle), /Invalid/);
    await a.analyze(first.projectHandle);
    await b.analyze(second.projectHandle);
    assert.ok(updates.length >= 2);
    assert.equal((await a.violations({ projectHandle: first.projectHandle })).total, 1);
    assert.equal((await b.violations({ projectHandle: second.projectHandle })).total, 0);
    assert.ok((await b.hierarchy({ projectHandle: second.projectHandle, descendants: true })).items.some(node => node.kind === 'code' && node.ownership.state === 'unassigned'));
    const firstPage = await a.hierarchy({ projectHandle: first.projectHandle, limit: 1 });
    assert.equal(firstPage.total, 1);
    assert.equal(firstPage.items[0].id, 'app');
    assert.deepEqual(await a.hierarchy({ projectHandle: first.projectHandle, limit: 1 }), firstPage);
    await assert.rejects(a.hierarchy({ projectHandle: first.projectHandle, limit: 201 }), /page/);
    const dependency = (await a.relationships({ projectHandle: first.projectHandle, nodeId: 'api', direction: 'outgoing', scope: 'aggregated' })).items.find(edge => edge.targetId === 'secret')!;
    assert.ok(dependency.originRelationshipIds?.length);
    const evidence = (await a.evidence({ projectHandle: first.projectHandle, evidenceIds: dependency.evidenceIds })).items;
    assert.deepEqual(evidence.map(item => item.id), [...dependency.evidenceIds].sort());
    const location = await a.resolveSource(first.projectHandle, evidence[0].id);
    assert.equal(location?.path, 'src/api/a.ts');
    assert.ok(location?.uri.startsWith('file:'));
    const source = join(firstRoot, 'src/api/a.ts');
    const original = await readFile(source);
    await rm(source);
    await symlink(join(secondRoot, 'tsconfig.json'), source);
    await assert.rejects(a.resolveSource(first.projectHandle, evidence[0].id), /Unsafe/);
    await rm(source);
    await writeFile(source, original);
    const count = updates.length;
    a.dispose();
    await assert.rejects(a.status(first.projectHandle), /Invalid/);
    await index.analyze(firstRoot);
    assert.equal(updates.length, count);
    b.dispose();
  } finally { await rm(firstRoot, { recursive: true, force: true }); await rm(secondRoot, { recursive: true, force: true }); }
});
