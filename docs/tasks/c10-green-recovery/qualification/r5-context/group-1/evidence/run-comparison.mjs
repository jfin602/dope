// Disposable R5 Group 1 harness. Operates real Dope stores, Chat backend and LM Studio;
// writes only sanitized measurements under this evidence directory and /tmp.
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const repo = process.cwd();
const base = join(repo, 'docs/tasks/c10-green-recovery/qualification/r5-context/group-1/evidence');
const root = '/tmp/dope-r5-group1-q4';
const modelId = 'qwen3-coder-30b-a3b-instruct@q4_k_m';
const sha = value => createHash('sha256').update(value).digest('hex');
const mod = async path => import(pathToFileURL(join(repo, path)).href);
const { RoadmapStore } = await mod('packages/project-intelligence/lib/node/roadmap-store.js');
const { previewRoadmapImport } = await mod('packages/project-intelligence/lib/node/roadmap-import.js');
const { ChatRepository } = await mod('packages/chat/lib/node/index.js');
const { ChatContextComposer } = await mod('packages/theia-extension/lib/node/chat-context-composer.js');
const { ChatBackend } = await mod('packages/theia-extension/lib/node/chat-backend.js');
const { LocalConversationalProvider } = await mod('packages/theia-extension/lib/node/conversational-providers.js');
const { roadmapLocalBudget } = await mod('packages/theia-extension/lib/node/roadmap-local-model.js');
const { createRoadmapActionRuntime } = await mod('packages/theia-extension/lib/node/roadmap-action-runtime.js');

const inventory = async () => {
  const ps = JSON.parse(execFileSync('lms', ['ps', '--json'], { encoding: 'utf8' }));
  const loaded = ps.filter(x => x.identifier === modelId);
  if (ps.length !== 1 || loaded.length !== 1 || loaded[0].status !== 'idle' || loaded[0].queued !== 0)
    throw new Error('Model inventory changed or is in use; do not interrupt it');
  const api = await (await fetch('http://127.0.0.1:1234/api/v1/models')).json();
  const entry = api.models.find(x => x.key === modelId);
  const inst = entry?.loaded_instances?.find(x => x.id === modelId);
  if (!entry || entry.quantization?.name !== 'Q4_K_M' || !inst ||
      inst.config.context_length !== loaded[0].contextLength || inst.config.parallel !== 4)
    throw new Error('Actual Q4 model/config mismatch');
  const artifact = join(process.env.HOME, '.lmstudio/models', loaded[0].path);
  return { context: loaded[0].contextLength, parallel: loaded[0].parallel, status: loaded[0].status,
    key: modelId, format: entry.format, quantization: entry.quantization.name,
    artifact: loaded[0].path, artifactBytes: (await stat(artifact)).size,
    offload: 'CPU-only (verified in active llama-server process by operator)', endpoint: 'http://127.0.0.1:1234/v1' };
};

const roadmap = new RoadmapStore();
const repository = new ChatRepository();
const composer = new ChatContextComposer({} , {}, {}, repository, roadmap);
const line = (i, title) => `### Decision record ${String(i).padStart(2, '0')} — ${title}\n` +
  `Owner review revision ${1 + Math.floor(i / 9)}. Interface contract: stage ${i} must expose a deterministic readiness signal, a rollback owner, and a reproducible verification note. ` +
  `Workstream ${i} holds a distinct risk: ${['schema compatibility', 'credential rollover', 'cache invalidation', 'queue drain', 'audit retention', 'regional cutover'][i % 6]}. ` +
  `The review checks producer output, consumer assumption, failure recovery and whether the checkpoint can be considered ready. ` +
  `Evidence record R${i} captures the staging result, responsible reviewer and a follow-up action; it does not by itself authorize deployment.\n\n`;

async function setup() {
  await mkdir(join(root, 'docs'), { recursive: true });
  const markdown = `# Delivery Roadmap\n\n## Product Phase 1 — Foundation\nStatus: **GREEN**\nObjective: Establish the source and review boundaries.\n\n` +
    `## Milestone Integration Gate\nStatus: **ACTIVE**\nObjective: Integrate verified components before release.\n\n` +
    `## Milestone Key Rotation\nStatus: **NOT GREEN**\nObjective: Repair credential rollover and complete verification before cutover.\n\n` +
    `## Milestone Release Candidate\nStatus: **ACTIVE**\nObjective: Decide whether to start the release canary after all dependencies are green.\n`;
  await writeFile(join(root, 'docs/roadmap.md'), markdown);
  const preview = await previewRoadmapImport(root, 'docs/roadmap.md');
  if (preview.checkpoints.length !== 4 || preview.checkpoints.some(x => x.readOnly))
    throw new Error(`Import fixture invalid: ${JSON.stringify(preview.diagnostics)}`);
  let owner = await roadmap.acceptImport(root, 0, preview);
  const find = suffix => owner.checkpoints.find(x => x.id.endsWith(suffix));
  const integration = find('#milestone-integration-gate');
  const rotation = find('#milestone-key-rotation');
  const release = find('#milestone-release-candidate');
  if (!integration || !rotation || !release || rotation.status !== 'not-green')
    throw new Error('Checkpoint identities/status missing');
  owner = await roadmap.mutate(root, owner.revision, { type: 'update', id: integration.id,
    title: integration.title, objective: integration.objective, order: integration.order,
    dependencies: [rotation.id], links: [] }, owner.projectId);
  owner = await roadmap.mutate(root, owner.revision, { type: 'update', id: release.id,
    title: release.title, objective: release.objective, order: release.order,
    dependencies: [integration.id], links: [] }, owner.projectId);
  const records = Array.from({ length: 34 }, (_, i) => line(i + 1,
    ['Foundation API', 'Worker coordination', 'Operational checks', 'Recovery rehearsal'][i % 4]));
  const lateFact = `### Decision update at source revision 4 — mandatory release dependency\n` +
    `Integration Gate depends transitively on Key Rotation. Key Rotation is NOT GREEN at source revision 4 because credential rollover verification failed. ` +
    `Release Candidate must remain blocked: do not start the canary. The earlier provisional go note in revision 2 is superseded. ` +
    `Correct next action: repair Key Rotation, obtain a Green verification record, then reassess Integration Gate and Release Candidate.\n\n`;
  const brief = `# Release planning brief\nSource revisions 1–4 are represented below. Revision 2 provisionally allowed a canary once Integration Gate was ready; later decisions override it.\n\n` +
    records.slice(0, 29).join('') + lateFact + records.slice(29).join('') +
    `## Revision ledger\nRevision 1: initial interface scope. Revision 2: provisional go subject to dependencies. ` +
    `Revision 3: integration evidence requested. Revision 4: final Key Rotation dependency and status decision.\n`;
  await writeFile(join(root, 'docs/planning-brief.md'), brief);
  const meta = { root, ownerProjectId: owner.projectId, ownerRevision: owner.revision,
    checkpointId: release.id, integrationId: integration.id, rotationId: rotation.id,
    rotationStatus: rotation.status, roadmapHash: sha(markdown), ownerHash: sha(await readFile(join(root, '.dope/roadmap.json'))),
    briefHash: sha(brief), briefBytes: Buffer.byteLength(brief), lateFact,
    lateFactByteOffset: Buffer.byteLength(brief.slice(0, brief.indexOf(lateFact))),
    expected: 'Do not start release canary; Key Rotation is NOT GREEN at source revision 4, blocking Integration Gate and Release Candidate.' };
  await writeFile(join(base, 'fixture.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(JSON.stringify({ setup: 'complete', ownerRevision: owner.revision, briefBytes: meta.briefBytes,
    lateFactByteOffset: meta.lateFactByteOffset, fixtureHash: meta.briefHash }));
}

async function run() {
  const fixture = JSON.parse(await readFile(join(base, 'fixture.json'), 'utf8'));
  const info = await inventory();
  if (![16384, 32768].includes(info.context)) throw new Error('Wrong loaded profile');
  const provider = new LocalConversationalProvider({ endpoint: 'http://127.0.0.1:1234' });
  const available = await provider.discoverModels();
  const discovered = available.find(x => x.id === modelId);
  if (discovered?.capabilities.contextWindowTokens !== info.context)
    throw new Error('Dope discovery capacity mismatch');
  const connectionId = 'r5-local-qualification';
  const selectedModel = { connectionId, modelId };
  const calls = [];
  const runtime = createRoadmapActionRuntime(roadmap, () => ({
    attach: async () => { throw new Error('No Planning Map in this fixture'); },
    read: async () => { throw new Error('No Planning Map in this fixture'); }
  }));
  const resources = async () => {
    let rssKiB = null;
    for (const pid of await readdir('/proc')) {
      if (!/^\d+$/.test(pid)) continue;
      try {
        const cmd = await readFile(`/proc/${pid}/comm`, 'utf8');
        if (cmd.trim() !== 'llama-server') continue;
        const status = await readFile(`/proc/${pid}/status`, 'utf8');
        rssKiB = Number(/VmRSS:\s+(\d+) kB/.exec(status)?.[1] ?? 0);
      } catch { /* process exited */ }
    }
    const memory = await readFile('/proc/meminfo', 'utf8');
    const psi = await readFile('/proc/pressure/cpu', 'utf8');
    return { at: Date.now(), rssKiB, availableKiB: Number(/MemAvailable:\s+(\d+) kB/.exec(memory)?.[1]),
      cpuSomeAvg10: Number(/some avg10=([\d.]+)/.exec(psi)?.[1]),
      cpuFullAvg10: Number(/full avg10=([\d.]+)/.exec(psi)?.[1]) };
  };
  const models = {
    list: async () => ({ connections: [{ id: connectionId, label: 'LM Studio loopback', ready: true,
      providerId: 'local', models: [{ id: modelId, label: modelId, usable: true,
        capabilities: discovered.capabilities }] }] }),
    async *generate(selection, request) {
      if (selection.connectionId !== connectionId || selection.modelId !== modelId)
        throw new Error('Unexpected model route');
      const mark = { start: Date.now(), firstDelta: null, complete: null, usage: null,
        inputBytes: Buffer.byteLength(JSON.stringify(request.messages), 'utf8'),
        includesLateFact: JSON.stringify(request.messages).includes('Key Rotation is NOT GREEN at source revision 4'),
        maxOutputTokens: request.maxOutputTokens };
      calls.push(mark);
      for await (const event of provider.generateConversation({ ...request, modelId })) {
        if (event.type === 'delta' && mark.firstDelta === null) mark.firstDelta = Date.now();
        if (event.type === 'complete') { mark.complete = Date.now(); mark.usage = event.usage;
          mark.finishReason = event.finishReason; }
        yield event;
      }
    }
  };
  const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models, composer,
    undefined, undefined, runtime.actions);
  const { projectHandle } = await backend.attach(pathToFileURL(root).href);
  const owner = await roadmap.read(root);
  if (owner.projectId !== fixture.ownerProjectId || owner.revision !== fixture.ownerRevision ||
      sha(await readFile(join(root, 'docs/roadmap.md'))) !== fixture.roadmapHash ||
      sha(await readFile(join(root, 'docs/planning-brief.md'))) !== fixture.briefHash)
    throw new Error('Fixture changed');
  const context = [{ kind: 'roadmap-checkpoint', id: fixture.checkpointId,
    projectId: owner.projectId, ownerRevision: owner.revision, sourceHash: owner.linkedDocument.sourceHash }];
  let state = await backend.read(projectHandle);
  const chatId = randomUUID();
  state = await backend.mutate({ projectHandle, expectedRevision: state.revision,
    operation: { type: 'create-chat', id: chatId, folderPath: '', title: `R5 ${info.context} qualification` } });
  const settings = structuredClone(state.chats.find(x => x.id === chatId).settings);
  settings.modelPolicy = { type: 'exact', model: selectedModel };
  settings.context = { maxInputTokens: 25000, reservedOutputTokens: 1024, history: 'none',
    savedChatSearch: false, allowedSources: ['roadmap-checkpoint', 'file'] };
  state = await backend.mutate({ projectHandle, expectedRevision: state.revision,
    operation: { type: 'set-settings', chatId, settings } });
  const lease = await backend.claim({ projectHandle, chatId, ownerId: `r5-${info.context}` });
  if (!lease.acquired) throw new Error('Could not claim saved Chat');
  const scenarios = [
    { name: 'narrow-fact', prompt: 'Read only the selected Release Candidate checkpoint. What is its current status and its directly listed dependency? Do not recommend an edit; return no-action with the facts.', refs: context },
    { name: 'narrow', prompt: 'At the selected Release Candidate checkpoint, is a canary authorized now? Answer from visible source and state uncertainty if dependencies are unresolved.', refs: context },
    { name: 'heavy-1', prompt: 'Use the selected checkpoint and the attached planning brief. Decide whether to start the release canary. Cite the governing source revision, exact blocking dependency and next safe action. Do not invent missing facts.', refs: [...context, { kind: 'file', id: 'docs/planning-brief.md' }] },
    { name: 'heavy-2', prompt: 'From the selected checkpoint and planning brief, give the current go/no-go decision, the dependency chain, the latest source revision and the next safe action. Treat later decisions as controlling.', refs: [...context, { kind: 'file', id: 'docs/planning-brief.md' }] }
  ];
  const results = [];
  for (const scenario of scenarios.filter(x => !process.argv[4] || x.name === process.argv[4])) {
    const preview = await backend.previewContext({ projectHandle, chatId, selectedModel,
      content: scenario.prompt, context: scenario.refs });
    const sourceChat = (await repository.read(root)).chats.find(x => x.id === chatId);
    const budget = roadmapLocalBudget(info.context, settings.context.reservedOutputTokens, discovered.capabilities);
    const composed = await composer.compose(root, sourceChat, scenario.prompt, scenario.refs,
      { ...discovered.capabilities, maxInputTokens: budget.composerInputTokens });
    const sent = JSON.stringify(composed.messages);
    const lateIncluded = sent.includes('Key Rotation is NOT GREEN at source revision 4');
    const samples = [await resources()];
    const sampler = setInterval(() => { void resources().then(x => samples.push(x)); }, 500);
    const start = Date.now();
    let result, error;
    try { result = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
      selectedModel, content: scenario.prompt, context: scenario.refs }); }
    catch (e) { error = String(e); }
    const finish = Date.now();
    clearInterval(sampler);
    samples.push(await resources());
    const saved = (await repository.read(root)).chats.find(x => x.id === chatId).messages;
    const answer = saved.at(-1);
    results.push({ scenario: scenario.name, profile: info.context, startedAt: new Date(start).toISOString(),
      completedAt: new Date(finish).toISOString(), elapsedMs: finish - start,
      preview, composed: { usedTokens: composed.usedTokens, budgetTokens: composed.budgetTokens,
        inputBytes: Buffer.byteLength(sent, 'utf8'), lateFactIncluded: lateIncluded,
        refs: composed.refs, diagnostics: composed.diagnostics },
      calls: calls.splice(0), resources: { initial: samples[0], final: samples.at(-1),
        peakRssKiB: Math.max(...samples.map(x => x.rssKiB ?? 0)),
        minAvailableKiB: Math.min(...samples.map(x => x.availableKiB)),
        maxCpuSomeAvg10: Math.max(...samples.map(x => x.cpuSomeAvg10)),
        samples: samples.length }, error, saved: { status: answer?.execution?.status,
        actualModel: answer?.execution?.actualModel, failure: answer?.execution?.failure,
        content: answer?.content, planningActivity: answer?.planningActivity },
      proposal: result?.proposal ? { type: result.proposal.type } : undefined });
    console.log(JSON.stringify({ scenario: scenario.name, profile: info.context,
      elapsedMs: finish - start, lateIncluded, status: answer?.execution?.status,
      answer: answer?.content, error }));
  }
  await backend.release(projectHandle, chatId, lease.token);
  backend.dispose();
  const suffix = process.argv[3] ? `-${process.argv[3]}` : '';
  await writeFile(join(base, `profile-${info.context}${suffix}.json`), JSON.stringify({ info, fixture: {
    briefHash: fixture.briefHash, roadmapHash: fixture.roadmapHash, ownerRevision: fixture.ownerRevision,
    checkpointId: fixture.checkpointId, lateFactByteOffset: fixture.lateFactByteOffset,
    expected: fixture.expected }, chatId, results }, null, 2) + '\n');
}

await mkdir(base, { recursive: true });
if (process.argv[2] === 'setup') await setup();
else if (process.argv[2] === 'run') await run();
else throw new Error('Pass setup or run');
