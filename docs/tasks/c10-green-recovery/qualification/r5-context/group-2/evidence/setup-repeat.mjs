// Prepare two equivalent disposable linked Roadmap projects for browser Chat repeats.
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = process.cwd();
const source = '/tmp/dope-r5-group2-q4';
const { RoadmapStore } = await import(pathToFileURL(join(repo, 'packages/project-intelligence/lib/node/roadmap-store.js')).href);
const { previewRoadmapImport } = await import(pathToFileURL(join(repo, 'packages/project-intelligence/lib/node/roadmap-import.js')).href);
const store = new RoadmapStore();
for (const label of ['a', 'b']) {
  const root = `/tmp/dope-r5-group2-repeat-${label}`;
  await mkdir(join(root, 'docs'), { recursive: true });
  for (const name of ['roadmap.md', 'planning-brief.md', 'current-decision.md']) {
    // The roadmap source is the original fixture, prior to the saved-Chat edit.
    const from = name === 'roadmap.md'
      ? join(repo, 'docs/tasks/c10-green-recovery/qualification/r5-context/group-1/evidence/roadmap.md')
      : join(source, 'docs', name);
    await copyFile(from, join(root, 'docs', name));
  }
  const preview = await previewRoadmapImport(root, 'docs/roadmap.md');
  let owner = await store.acceptImport(root, 0, preview);
  const find = suffix => owner.checkpoints.find(x => x.id.endsWith(suffix));
  const integration = find('#milestone-integration-gate');
  const rotation = find('#milestone-key-rotation');
  const release = find('#milestone-release-candidate');
  if (!integration || !rotation || !release) throw new Error('Missing fixture checkpoint');
  owner = await store.mutate(root, owner.revision, { type: 'update', id: integration.id,
    title: integration.title, objective: integration.objective, order: integration.order,
    dependencies: [rotation.id], links: [] }, owner.projectId);
  owner = await store.mutate(root, owner.revision, { type: 'update', id: release.id,
    title: release.title, objective: release.objective, order: release.order,
    dependencies: [integration.id], links: [] }, owner.projectId);
  console.log(JSON.stringify({ label, root, projectId: owner.projectId,
    revision: owner.revision, checkpoints: owner.checkpoints.length,
    sourceBytes: (await readFile(join(root, 'docs/roadmap.md'))).length }));
}
