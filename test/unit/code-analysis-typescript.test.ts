import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { derivedId } from '../../packages/software-map/lib/index.js';

const fixture = new URL('../fixtures/code-analysis/', import.meta.url).pathname;
const analyzer = new TypeScriptAnalyzer();

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
