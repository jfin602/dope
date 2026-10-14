import { RoadmapStore } from '/home/jfin/dev/dope/packages/project-intelligence/lib/node/roadmap-store.js';
import { ProjectPlanningActions } from '/home/jfin/dev/dope/packages/project-intelligence/lib/node/project-planning-actions.js';
const root = '/tmp/dope-c10-p9-SwltPi';
const store = new RoadmapStore();
const index = await store.read(root);
const item = index.checkpoints.find(entry => entry.id.endsWith('#phase-10'));
const actions = new ProjectPlanningActions(store);
const { projectHandle } = await actions.attach(root);
const request = { projectHandle, ownerId: index.projectId, expectedRevision: index.revision,
  sourceHashes: { [item.id]: item.source.sha256 },
  actions: [{ type: 'document-edit', id: item.id, objective: 'Pending transaction target.' }] };
const preview = await actions.preview(request);
console.log('before', index.revision, item.id, item.objective, preview.requiresApproval);
const original = store.replace.bind(store);
let writes = 0;
store.replace = async (...args) => {
  const result = await original(...args);
  if (++writes === 1) throw new Error('P9 injected interruption after durable pending owner write');
  return result;
};
try { await actions.apply(request, preview.token, true); }
catch (error) { console.log('interrupted', String(error)); }
const pending = await new RoadmapStore().read(root);
console.log('after', pending.revision, pending.linkedDocument.syncState, pending.linkedDocument.pending?.outcome,
  pending.checkpoints.find(entry => entry.id === item.id).objective);
