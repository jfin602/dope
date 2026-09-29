import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';
import { parseArchitectureProposal, validateArchitectureEvidencePacket } from '../../packages/software-map/lib/index.js';

const source = new URL('../fixtures/code-analysis/', import.meta.url).pathname;
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dope-packet-'));
  await cp(source, root, { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'packet-root', version: '1.0.0',
    workspaces: ['packages/app', 'packages/lib'], scripts: { start: 'node app.js' }, dependencies: { alpha: '^1.0.0' } }));
  await writeFile(join(root, 'packages/app/package.json'), JSON.stringify({ name: 'packet-app', main: 'src/index.ts' }));
  return root;
}

test('packet is deterministic, inspectable, source-backed, and collection does not publish a map', async () => {
  const root = await fixture();
  try {
    const index = new SoftwareMapIndex(new TypeScriptAnalyzer());
    const first = await index.collectEvidence(root);
    const second = await index.collectEvidence(root);
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    validateArchitectureEvidencePacket(first);
    assert.equal(index.snapshot(root), undefined);
    assert.equal(index.status(root).state, 'idle');
    assert.equal(index.status(root).generation, 0);
    assert.deepEqual(first.items.map(item => item.id), [...first.items.map(item => item.id)].sort());
    assert.ok(first.items.some(item => item.kind === 'topology' && item.scope === 'workspace' && item.workspaces?.includes('packages/app')));
    assert.ok(first.items.some(item => item.kind === 'topology' && item.scope === 'package' && item.name === 'packet-app'));
    assert.ok(first.items.some(item => item.kind === 'configuration' && item.signal === 'dependencies:alpha@^1.0.0'));
    assert.ok(first.items.some(item => item.kind === 'configuration' && item.sourcePaths?.includes('src/child.ts')));
    assert.ok(first.items.some(item => item.kind === 'entrypoint' && item.role === 'main:src/index.ts'));
    assert.ok(first.items.some(item => item.kind === 'semantic' && item.relation.endsWith(':exported')));
    assert.ok(first.items.some(item => item.kind === 'dependency' && item.relationshipIds.length));
    assert.ok(!first.items.some(item => item.kind === 'framework')); // fixture has no framework wiring
    const analysis = new TypeScriptAnalyzer().analyze(root);
    const exported = analysis.relationships.find(edge => edge.kind === 'exports' && analysis.nodes.some(node => node.id === edge.targetId && node.codeKind === 'symbol'))!;
    assert.ok(first.items.some(item => item.kind === 'semantic' && item.sourceEvidenceIds.some(id => exported.evidenceIds.includes(id))));
    const evidence = new Map(analysis.evidence.map(item => [item.id, item]));
    const relationships = new Set(analysis.relationships.map(item => item.id));
    for (const item of first.items) {
      assert.ok((await readFile(join(root, item.path))).length > 0);
      for (const id of item.sourceEvidenceIds) {
        const origin = evidence.get(id);
        assert.ok(origin?.path);
        assert.ok(origin?.span);
        assert.ok(origin!.span!.start + origin!.span!.length <= (await readFile(join(root, origin!.path!))).length);
      }
      if (item.kind === 'dependency') for (const id of item.relationshipIds) assert.ok(relationships.has(id));
    }
    const hardRef = first.items.find(item => item.kind === 'semantic')!.id;
    assert.equal(parseArchitectureProposal({ schemaVersion: 1, summary: 'Source-backed candidate', needsMoreEvidence: false,
      nodes: [{ proposalKey: 'proposal:one', kind: 'system', name: 'Candidate', purpose: 'Test', parentProposalKey: null,
        confidence: 0.5, rationale: 'Exported symbol', evidenceRefs: [hardRef], evidence: ['Source export'] }],
      unassignedEvidenceRefs: [], openQuestions: [], evidenceRequests: [] }, first).nodes[0].evidenceRefs[0], hardRef);
    await index.analyze(root);
    assert.ok(index.snapshot(root)); // initialized/ordinary analysis behavior remains available
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Theia/Inversify facts are source-backed, stable, refinable, and exclude unrelated same-name APIs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-framework-'));
  try {
    await mkdir(join(root, 'src'));
    await symlink(join(process.cwd(), 'node_modules'), join(root, 'node_modules'), 'dir');
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'commonjs',
      moduleResolution: 'node', skipLibCheck: true }, include: ['src/**/*.ts'] }));
    await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'framework-fixture', dependencies: { '@theia/core': '1.75.0' },
      theiaExtensions: [{ frontend: 'lib/src/frontend', backend: 'lib/src/backend' }] }));
    await writeFile(join(root, 'src/frontend.ts'), `
import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, WidgetFactory, AbstractViewContribution } from '@theia/core/lib/browser';
import { bindViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
export const path = '/fixture/service';
class Service {} class Impl {} class Widget {}
export class View extends AbstractViewContribution<Widget> implements FrontendApplicationContribution {
  constructor() { super({ widgetId: 'fixture-view', widgetName: 'Fixture', defaultWidgetOptions: { area: 'left' } }); }
}
export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
  bindViewContribution(bind, View);
  bind(FrontendApplicationContribution).toService(View);
  bind(Service).to(Impl);
  rebind(Service).to(Impl);
  bind(WidgetFactory).toDynamicValue(() => ({ id: 'fixture-view', createWidget: () => new Widget() }));
  bind(Service).toDynamicValue(context => ServiceConnectionProvider.createProxy(context.container, path));
});
`);
    await writeFile(join(root, 'src/backend.ts'), `
import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { path } from './frontend';
export default new ContainerModule(bind => {
  bind(ConnectionHandler).toDynamicValue(() => new RpcConnectionHandler(path, () => ({})));
});
`);
    await writeFile(join(root, 'src/unrelated.ts'), `
import { ContainerModule, RpcConnectionHandler, bindViewContribution, AbstractViewContribution, ServiceConnectionProvider } from './unrelated-api';
class Service {} class Impl {} class Widget {}
class View extends AbstractViewContribution { constructor() { super({ widgetId: 'fake', defaultWidgetOptions: { area: 'right' } }); } }
new ContainerModule(bind => { bind(Service).to(Impl); bindViewContribution(bind, View);
  new RpcConnectionHandler('/fake'); ServiceConnectionProvider.createProxy('/fake'); });
`);
    await writeFile(join(root, 'src/unrelated-api.ts'), `
export class ContainerModule { constructor(callback: (bind: any) => void) {} }
export class RpcConnectionHandler { constructor(path: string) {} }
export class AbstractViewContribution { constructor(options: any) {} }
export const bindViewContribution = (...args: any[]) => {};
export const ServiceConnectionProvider = { createProxy: (...args: any[]) => ({}) };
`);
    await writeFile(join(root, 'src/shadow.ts'), `
import { ContainerModule } from '@theia/core/shared/inversify';
export function unrelated(ContainerModule: any) {
  return new ContainerModule((bind: any) => bind('Fake').to('Fake'));
}
`);
    const analyzer = new TypeScriptAnalyzer();
    const index = new SoftwareMapIndex(analyzer);
    const packet = await index.collectEvidence(root);
    assert.deepEqual(await index.collectEvidence(root), packet);
    validateArchitectureEvidencePacket(packet);
    assert.equal(index.snapshot(root), undefined);
    assert.equal(index.status(root).state, 'idle');
    assert.deepEqual(packet.items.map(item => item.id), [...packet.items.map(item => item.id)].sort());
    const facts = packet.items.filter(item => item.kind === 'framework');
    assert.ok(facts.length >= 12);
    assert.ok(facts.every(item => !['src/unrelated.ts', 'src/unrelated-api.ts', 'src/shadow.ts'].includes(item.path)));
    assert.ok(facts.some(item => item.concept === 'manifest-extension' && item.role === 'frontend' && item.path === 'package.json'));
    assert.ok(facts.some(item => item.concept === 'manifest-extension' && item.role === 'backend' && item.path === 'package.json'));
    assert.ok(facts.some(item => item.concept === 'di-registration' && item.name === 'Service' && item.target === 'Impl' && item.role === 'bind'));
    assert.ok(facts.some(item => item.concept === 'di-registration' && item.name === 'Service' && item.role === 'rebind'));
    assert.ok(facts.some(item => item.concept === 'rpc-handler' && item.servicePath === '/fixture/service'));
    assert.ok(facts.some(item => item.concept === 'frontend-proxy' && item.servicePath === '/fixture/service'));
    assert.ok(facts.some(item => item.concept === 'widget-factory' && item.name === 'fixture-view' && item.target === 'Widget'));
    assert.ok(facts.some(item => item.concept === 'view' && item.name === 'View' && item.widgetArea === 'left'));
    assert.ok(facts.some(item => item.concept === 'frontend-application-contribution'));
    const result = analyzer.analyze(root);
    assert.ok(result.nodes.every(node => node.kind === 'code'));
    const evidence = new Map(result.evidence.map(item => [item.id, item]));
    for (const fact of facts) if (fact.concept !== 'manifest-extension') {
      assert.ok(fact.sourceEvidenceIds.length);
      for (const id of fact.sourceEvidenceIds) {
        const source = evidence.get(id)!;
        assert.equal(source.class, 'framework');
        assert.equal(source.path, fact.path);
        assert.equal(source.producer, fact.producer);
        assert.equal(source.producerVersion, fact.producerVersion);
        assert.ok(source.span?.length);
        assert.ok(source.span!.start + source.span!.length <= (await readFile(join(root, fact.path))).length);
      }
    }
    const ref = facts.find(item => item.concept === 'container-module' && item.path === 'src/frontend.ts')!;
    const expanded = await index.refineEvidence(root, packet, [{ kind: 'framework', targets: [ref.id], reason: 'Inspect imports' }]);
    assert.deepEqual(expanded, await index.refineEvidence(root, packet, [{ kind: 'framework', targets: [ref.id], reason: 'Inspect imports' }]));
    assert.ok(expanded.items.some(item => item.kind === 'framework' && item.concept === 'import' && item.path === 'src/frontend.ts'));
    assert.ok(!expanded.items.some(item => item.kind === 'framework' && item.concept === 'import' && item.path === 'src/backend.ts'));
    assert.ok(expanded.items.length - packet.items.length <= 100);
    await mkdir(join(root, '.dope'));
    await writeFile(join(root, '.dope/architecture.json'), '{broken');
    assert.deepEqual(await index.collectEvidence(root), packet);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('declarations are excluded; source, config and manifest changes invalidate packet inputs', async () => {
  const root = await fixture();
  try {
    const index = new SoftwareMapIndex(new TypeScriptAnalyzer());
    const base = await index.collectEvidence(root);
    await mkdir(join(root, '.dope'));
    await writeFile(join(root, '.dope/architecture.json'), '{ invalid declaration bytes');
    assert.deepEqual(await index.collectEvidence(root), base);
    await rm(join(root, '.dope/architecture.json'));
    assert.deepEqual(await index.collectEvidence(root), base);
    await writeFile(join(root, 'src/child.ts'), `${await readFile(join(root, 'src/child.ts'), 'utf8')}\nexport const added = 1;\n`);
    const changedSource = await index.collectEvidence(root);
    assert.notEqual(changedSource.sourceFingerprint, base.sourceFingerprint);
    assert.ok(changedSource.items.some(item => item.kind === 'semantic' && item.symbol === 'added'));
    await writeFile(join(root, 'tsconfig.json'), `${await readFile(join(root, 'tsconfig.json'), 'utf8')} `);
    const changedConfig = await index.collectEvidence(root);
    assert.notEqual(changedConfig.sourceFingerprint, changedSource.sourceFingerprint);
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    manifest.dependencies.beta = '^2.0.0';
    await writeFile(join(root, 'package.json'), JSON.stringify(manifest));
    const changedManifest = await index.collectEvidence(root);
    assert.notEqual(changedManifest.sourceFingerprint, changedConfig.sourceFingerprint);
    assert.ok(changedManifest.items.some(item => item.kind === 'configuration' && item.signal === 'dependencies:beta@^2.0.0'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('refinement accepts only packet targets, stays bounded, and rejects stale or unsafe inputs', async () => {
  const root = await fixture();
  const outside = await mkdtemp(join(tmpdir(), 'dope-packet-outside-'));
  try {
    const index = new SoftwareMapIndex(new TypeScriptAnalyzer());
    const packet = await index.collectEvidence(root);
    const target = packet.items.find(item => item.path === 'src/child.ts')!;
    const request = [{ kind: 'semantic' as const, targets: [target.id], reason: 'Inspect local symbols' }];
    const expanded = await index.refineEvidence(root, packet, request);
    assert.deepEqual(expanded, await index.refineEvidence(root, packet, request));
    assert.equal(expanded.sourceFingerprint, packet.sourceFingerprint);
    assert.ok(expanded.items.length >= packet.items.length);
    assert.ok(expanded.items.length - packet.items.length <= 100);
    assert.deepEqual(expanded.items.map(item => item.id), [...expanded.items.map(item => item.id)].sort());
    assert.ok((await index.refineEvidence(root, packet, [{ ...request[0], targets: ['src/missing.ts'] }])).items.length >= packet.items.length);
    await assert.rejects(index.refineEvidence(root, packet, [{ ...request[0], targets: ['../outside'] }]), /Unknown/);
    await assert.rejects(index.refineEvidence(root, packet, [{ ...request[0], targets: ['package.json/../../outside'] }]), /Unknown/);
    await assert.rejects(index.refineEvidence(root, packet, Array(6).fill(request[0])), /Invalid/);
    await writeFile(join(root, 'src/child.ts'), `${await readFile(join(root, 'src/child.ts'), 'utf8')}\nexport const stale = 1;\n`);
    await assert.rejects(index.refineEvidence(root, packet, request), /Stale/);
    await rm(join(root, 'src/child.ts'));
    await writeFile(join(outside, 'escape.ts'), 'export const escaped = 1;\n');
    await symlink(join(outside, 'escape.ts'), join(root, 'src/child.ts'));
    await assert.rejects(index.collectEvidence(root), /Unsafe architecture evidence input/);
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});
