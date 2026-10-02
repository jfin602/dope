import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { anonymousCallableId, createSnapshot, derivedId } from '../../packages/software-map/lib/index.js';

const fixture = new URL('../fixtures/code-analysis/', import.meta.url).pathname;
const analyzer = new TypeScriptAnalyzer();

test('project invocations retain callable identity, call-site proof and deterministic output', () => {
  const first = analyzer.analyze(fixture);
  const repeat = analyzer.analyze(fixture);
  assert.deepEqual(first.flowFacts, repeat.flowFacts);
  const nodes = new Map(first.nodes.map(node => [node.id, node]));
  const evidence = new Map(first.evidence.map(item => [item.id, item]));
  const calls = first.flowFacts.filter(fact => evidence.get(fact.evidenceIds[0])?.path === 'src/invocation.ts');
  const call = (source: string) => calls.find(fact => {
    const proof = evidence.get(fact.evidenceIds[0])!;
    const text = readFileSync(join(fixture, proof.path!), 'utf8');
    return text.slice(proof.span!.start, proof.span!.start + proof.span!.length) === source;
  });
  const alias = calls.find(fact => nodes.get(fact.sourceId)?.name === 'execute' && fact.targetId === call('aliased()')?.targetId &&
    !fact.behavior && evidence.get(fact.evidenceIds[0])?.span?.line === 4)!;
  assert.equal(nodes.get(alias.sourceId)?.name, 'execute');
  assert.equal(nodes.get(alias.targetId)?.name, 'ping');
  assert.equal(nodes.get(call('new Worker().run()')!.targetId)?.name, 'Worker.run');
  assert.equal(nodes.get(call('cycleA()')!.targetId)?.name, 'cycleA');
  assert.ok(first.flowFacts.some(fact => nodes.get(fact.sourceId)?.name === 'cycleA' && nodes.get(fact.targetId)?.name === 'cycleB'));
  assert.ok(first.flowFacts.some(fact => nodes.get(fact.sourceId)?.name === 'cycleB' && nodes.get(fact.targetId)?.name === 'cycleA'));
  assert.ok(first.flowFacts.some(fact => nodes.get(fact.sourceId)?.name === 'recur' && fact.sourceId === fact.targetId));
  const callbacks = calls.filter(fact => nodes.get(fact.sourceId)?.analyzerKind === 'anonymous-callable');
  assert.equal(callbacks.length, 3);
  for (const fact of callbacks) {
    const caller = nodes.get(fact.sourceId)!;
    assert.equal(caller.codeKind, 'other');
    assert.equal(caller.symbol, undefined);
    assert.equal(nodes.get(caller.parentId!)?.name, 'execute');
    const sourceProof = evidence.get(caller.evidenceIds[0])!;
    assert.equal(caller.id, anonymousCallableId(sourceProof.path!, sourceProof.span!.start, sourceProof.span!.length));
    assert.equal(nodes.get(fact.targetId)?.name, 'ping');
  }
  assert.equal(nodes.get(call('arrow()')!.targetId)?.analyzerKind, 'anonymous-callable');
  assert.equal(nodes.get(call('expression()')!.targetId)?.analyzerKind, 'anonymous-callable');
  const awaited = call('aliased()')!;
  assert.ok(calls.some(fact => fact.targetId === awaited.targetId && fact.behavior?.async));
  const asyncFact = calls.find(fact => fact.behavior?.async)!;
  const behaviorProof = evidence.get(asyncFact.behavior!.evidenceIds[0])!;
  const source = readFileSync(join(fixture, behaviorProof.path!), 'utf8');
  assert.equal(source.slice(behaviorProof.span!.start, behaviorProof.span!.start + behaviorProof.span!.length), 'await (aliased())');
  for (const fact of first.flowFacts) {
    const proof = evidence.get(fact.evidenceIds[0])!;
    assert.equal(fact.kind, 'invokes');
    assert.equal(proof.class, 'semantic');
    assert.equal(proof.flowKind, 'invokes');
    assert.ok(proof.path && proof.span && proof.span.length > 0);
    assert.ok(proof.span.start + proof.span.length <= readFileSync(join(fixture, proof.path), 'utf8').length);
    assert.ok(nodes.has(fact.sourceId) && nodes.has(fact.targetId));
    assert.equal(fact.enrichment, undefined);
  }
  assert.ok(!first.flowFacts.some(fact => evidence.get(fact.evidenceIds[0])?.path === 'src/invocation-reference.ts'));
  assert.ok(!calls.some(fact => ['Math.max(1, 2)', 'callback()'].includes(readFileSync(join(fixture, 'src/invocation.ts'), 'utf8').slice(evidence.get(fact.evidenceIds[0])!.span!.start, evidence.get(fact.evidenceIds[0])!.span!.start + evidence.get(fact.evidenceIds[0])!.span!.length))));
  assert.ok(!first.flowFacts.some(fact => evidence.get(fact.evidenceIds[0])?.path === 'src/missing.ts'));
  assert.ok(!first.flowFacts.some(fact => evidence.get(fact.evidenceIds[0])?.path === 'src/legacy.js'));
  assert.ok(first.relationships.some(edge => edge.kind === 'imports' && edge.sourceId === derivedId('module', 'src/invocation.ts') && edge.targetId === derivedId('module', 'src/invoked.ts')));
  const validated = createSnapshot({ projectId: 'project', generation: 1, inputFingerprint: 'fixture', analysis: first.status },
    [{ id: 'project', kind: 'project', name: 'Project', evidenceIds: [] },
      ...first.nodes.map(node => node.codeKind === 'file' ? { ...node, parentId: 'project' } : node)],
    first.relationships, first.evidence, [], first.flowFacts);
  assert.deepEqual(validated.flowFacts.map(fact => fact.id), first.flowFacts.map(fact => fact.id));
});

test('configured TS/JS projects, references and semantic edges are deterministic with source evidence', () => {
  const first = analyzer.analyze(fixture);
  const repeat = analyzer.analyze(fixture);
  assert.ok(repeat.reusedSourceFiles! > 0);
  assert.deepEqual({ ...first, reusedSourceFiles: 0 }, { ...repeat, reusedSourceFiles: 0 });
  assert.deepEqual(first.projects.map(project => project.configPath), [
    'packages/app/tsconfig.json', 'packages/lib/tsconfig.json', 'tsconfig.json',
  ]);
  assert.ok(first.projects[2].sourcePaths.includes('src/legacy.js'));
  assert.ok(!first.nodes.some(node => /generated|vendor|node_modules|dist/.test(node.path)));
  assert.ok(first.nodes.some(node => node.analyzerKind === 'method' && node.name === 'Child.speak'));
  const child = derivedId('module', 'src/child.ts');
  const base = derivedId('module', 'src/base.ts');
  const app = derivedId('module', 'packages/app/src/index.ts');
  const lib = derivedId('module', 'packages/lib/src/index.ts');
  const legacy = derivedId('module', 'src/legacy.js');
  assert.ok(first.relationships.some(edge => edge.kind === 'imports' && edge.sourceId === child && edge.targetId === base));
  assert.ok(first.relationships.some(edge => edge.kind === 'imports' && edge.sourceId === app && edge.targetId === lib));
  assert.ok(first.relationships.some(edge => edge.kind === 'imports' && edge.sourceId === legacy && edge.targetId === child));
  assert.ok(first.relationships.some(edge => edge.kind === 'exports' && edge.sourceId === child && edge.targetId.includes('greet')));
  assert.ok(first.relationships.some(edge => edge.kind === 'references' && edge.sourceId === app && edge.targetId.includes('Shared')));
  assert.ok(first.relationships.some(edge => edge.kind === 'references' && edge.sourceId === child && edge.targetId.includes('greet')));
  assert.ok(first.relationships.some(edge => edge.kind === 'extends' && edge.sourceId.includes('Child') && edge.targetId.includes('Base')));
  assert.ok(first.relationships.some(edge => edge.kind === 'implements' && edge.sourceId.includes('Child') && edge.targetId.includes('Named')));
  const byId = new Map(first.evidence.map(item => [item.id, item]));
  for (const edge of first.relationships) for (const id of edge.evidenceIds) {
    const item = byId.get(id)!;
    assert.ok(item.path && item.span && item.span.line! > 0 && item.span.column! > 0, edge.id);
    const source = readFileSync(join(fixture, item.path), 'utf8');
    assert.ok(item.span.start + item.span.length <= source.length, edge.id);
    assert.ok(item.producer && item.producerVersion);
  }
  const importEdge = first.relationships.find(edge => edge.kind === 'imports' && edge.sourceId === child)!;
  const importEvidence = byId.get(importEdge.evidenceIds[0])!;
  assert.equal(readFileSync(join(fixture, importEvidence.path!), 'utf8').slice(importEvidence.span!.start, importEvidence.span!.start + importEvidence.span!.length), "'@lib/base'");
});

test('unresolved imports are diagnostics without invented targets; exclusion restores complete status', () => {
  const result = analyzer.analyze(fixture);
  assert.equal(result.status.completeness, 'partial');
  assert.ok(result.status.errors.some(error => error.code === 'unresolved-import' && error.path === 'src/missing.ts'));
  assert.ok(result.status.errors.some(error => error.code === 'TS2304' && error.path === 'src/missing.ts'));
  assert.ok(!result.relationships.some(edge => edge.sourceId === derivedId('module', 'src/missing.ts') && edge.kind === 'imports'));
  assert.ok(!result.nodes.some(node => node.name === 'mystery'));
  const temporary = mkdtempSync(join(tmpdir(), 'dope-analysis-'));
  try {
    cpSync(fixture, temporary, { recursive: true });
    const config = join(temporary, 'tsconfig.json');
    const data = JSON.parse(readFileSync(config, 'utf8'));
    data.exclude.push('src/missing.ts');
    writeFileSync(config, JSON.stringify(data));
    const clean = analyzer.analyze(temporary);
    assert.equal(clean.status.completeness, 'complete');
    assert.ok(!clean.nodes.some(node => node.path === 'src/missing.ts'));
    assert.ok(clean.relationships.some(edge => edge.kind === 'references' && edge.sourceId === derivedId('module', 'packages/app/src/index.ts') && edge.targetId.includes('Shared')));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});

test('configured declarations and ambient or asset imports do not make complete analysis partial', () => {
  const root = mkdtempSync(join(tmpdir(), 'dope-declarations-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext' }, include: ['src/**/*'] }));
    writeFileSync(join(root, 'src/ambient.d.ts'), "interface ImportMeta { env: string }\ndeclare module 'node:example' { export const value: string }\n");
    writeFileSync(join(root, 'src/style.css'), 'body {}\n');
    writeFileSync(join(root, 'src/main.ts'), "import { value } from 'node:example';\nimport './style.css';\nexport const result = import.meta.env + value;\n");
    const originalExecutable = ts.sys.getExecutingFilePath;
    ts.sys.getExecutingFilePath = () => join(root, 'packed-backend.js');
    let result;
    try { result = analyzer.analyze(root); }
    finally { ts.sys.getExecutingFilePath = originalExecutable; }
    assert.equal(result.status.completeness, 'complete');
    assert.deepEqual(result.status.errors, []);
    assert.ok(result.nodes.some(node => node.path === 'src/main.ts'));
    assert.ok(!result.nodes.some(node => node.path === 'src/ambient.d.ts'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Dope state is excluded even when tsconfig names its sources and project reference', () => {
  const root = mkdtempSync(join(tmpdir(), 'dope-input-boundary-'));
  try {
    cpSync(fixture, root, { recursive: true });
    mkdirSync(join(root, '.dope'));
    const config = join(root, 'tsconfig.json');
    const data = JSON.parse(readFileSync(config, 'utf8'));
    data.include.push('.dope/**/*.ts');
    data.files = ['.dope/hidden.ts'];
    data.references = [{ path: '.dope/tsconfig.json' }];
    data.extends = '.dope/tsconfig.json';
    writeFileSync(config, JSON.stringify(data));
    writeFileSync(join(root, '.dope/tsconfig.json'), JSON.stringify({ files: ['hidden.ts'] }));
    writeFileSync(join(root, '.dope/hidden.ts'), 'export const hidden = 1;\n');
    for (const name of ['planning-maps.json', 'project-mind.json', 'smap-analysis.json', 'smap.json'])
      writeFileSync(join(root, '.dope', name), JSON.stringify({ version: 1 }));
    const before = analyzer.inputPaths(root);
    assert.ok(before.sources.some(path => path.endsWith('src/child.ts')));
    assert.ok(before.configs.some(path => path.endsWith('tsconfig.json')));
    assert.ok([...before.sources, ...before.configs].every(path => !path.includes('/.dope/')));
    assert.ok(analyzer.analyze(root).nodes.every(node => !node.path.startsWith('.dope/')));
    writeFileSync(join(root, '.dope/hidden.ts'), 'export const hidden = 2;\n');
    for (const name of ['planning-maps.json', 'project-mind.json', 'smap-analysis.json', 'smap.json'])
      writeFileSync(join(root, '.dope', name), JSON.stringify({ version: 2 }));
    assert.deepEqual(analyzer.inputPaths(root), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
