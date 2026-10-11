import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { DeveloperSessionChatPlanningResolver } from '../../packages/theia-extension/lib/node/developer-session-resolver.js';

const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
  physicalInputFingerprint: 'source', physicalGeneration: 1 };
const chatId = () => randomUUID();
const folder = () => mkdtemp(join(tmpdir(), 'dope-session-resolver-'));

function resolver(root: string, current = () => Promise.resolve({ ...basis })) {
  let handle = 'attached';
  return { resolve: new DeveloperSessionChatPlanningResolver(() => ({ root, projectHandle: handle }),
    undefined, undefined, undefined, current), changeHandle: (next: string) => { handle = next; } };
}

test('Chat metadata peek preserves interrupted and legacy bytes and excludes transcripts', async () => {
  const root = await folder(), chats = new ChatRepository(), id = chatId();
  try {
    await chats.mutate(root, 0, { type: 'create-chat', id, folderPath: '', title: 'Linked Chat' });
    const manifestFile = join(root, '.dope/chats/index.json');
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    const chatFile = join(root, '.dope/chats/folders', manifest.entries[0].file);
    const record = JSON.parse(await readFile(chatFile, 'utf8'));
    delete record.color; // Valid legacy record: normal Chat read would migrate it.
    record.messages = [{ schemaVersion: 1, id: chatId(), role: 'user', createdAt: record.createdAt,
      content: 'PRIVATE TRANSCRIPT', contextRefs: [] },
      { schemaVersion: 1, id: chatId(), role: 'assistant', createdAt: record.createdAt, content: '',
        execution: { schemaVersion: 1, id: chatId(), status: 'pending',
          selectedModel: { connectionId: 'local', modelId: 'model' }, startedAt: record.createdAt } }];
    await writeFile(chatFile, `${JSON.stringify(record)}\n`);
    const before = [await readFile(manifestFile), await readFile(chatFile)];
    const result = await resolver(root).resolve.resolve('attached', { kind: 'chat', chatId: id });
    assert.equal(result.availability, 'resolved');
    assert.equal(result.title, 'Linked Chat');
    assert.equal(JSON.stringify(result).includes('PRIVATE TRANSCRIPT'), false);
    assert.deepEqual([await readFile(manifestFile), await readFile(chatFile)], before);
    assert.equal((await resolver(root).resolve.resolve('attached', { kind: 'chat', chatId: chatId() })).availability, 'missing');
    await writeFile(chatFile, '{bad json');
    assert.equal((await resolver(root).resolve.resolve('attached', { kind: 'chat', chatId: id })).availability, 'unavailable');
    await writeFile(chatFile, before[1]);
    await writeFile(manifestFile, '{bad json');
    assert.equal((await resolver(root).resolve.resolve('attached', { kind: 'chat', chatId: id })).availability, 'unavailable');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Planning resolution uses exact composite identity, independent owner project ID and semantic basis', async () => {
  const root = await folder(), planning = new PlanningStore();
  try {
    await planning.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Build', basis });
    const one = await planning.mutate(root, 1, { type: 'put-transformation', mapId: 'plan', transformation: {
      id: 'change', kind: 'add', currentIds: [], dependsOn: [],
      futureNodes: [{ id: 'core', kind: 'system', name: 'Core', purpose: 'Build', roots: [] }],
    } });
    await planning.mutate(root, 2, { type: 'put-work-item', mapId: 'plan', workItem: {
      id: 'work', title: 'Work', objective: 'Build', transformationIds: ['change'], dependsOn: [],
      requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'proposed',
    } });
    assert.match(one.projectId, /^project-/); // Never equated with Session's null Project Mind ID.
    let current = { ...basis, physicalGeneration: 42 };
    const subject = resolver(root, async () => current).resolve;
    const map = await subject.resolve('attached', { kind: 'planning-map', mapId: 'plan' });
    assert.equal(map.availability, 'resolved');
    assert.equal(map.status, 'draft');
    const work = await subject.resolve('attached', { kind: 'work-item', mapId: 'plan', workItemId: 'work' });
    assert.equal(work.availability, 'resolved');
    assert.equal(work.status, 'proposed');
    assert.equal(work.observedRevision, 2);
    assert.equal((await subject.resolve('attached', { kind: 'planning-map', mapId: 'missing' })).availability, 'missing');
    assert.equal((await subject.resolve('attached', { kind: 'work-item', mapId: 'missing', workItemId: 'work' })).availability, 'missing');
    assert.equal((await subject.resolve('attached', { kind: 'work-item', mapId: 'plan', workItemId: 'missing' })).availability, 'missing');
    current = { ...basis, physicalInputFingerprint: 'changed', physicalGeneration: 42 };
    assert.equal((await subject.resolve('attached', { kind: 'planning-map', mapId: 'plan' })).availability, 'stale');
    assert.equal((await subject.resolve('attached', { kind: 'work-item', mapId: 'plan', workItemId: 'work' })).availability, 'stale');
    const noEvidence = resolver(root, async () => undefined).resolve;
    assert.equal((await noEvidence.resolve('attached', { kind: 'planning-map', mapId: 'plan' })).availability, 'unavailable');
    const file = join(root, '.dope/planning-maps.json'), original = await readFile(file);
    await writeFile(file, '{bad json');
    assert.equal((await subject.resolve('attached', { kind: 'planning-map', mapId: 'plan' })).availability, 'unavailable');
    await writeFile(file, original);
    const foreignMap = JSON.parse(original.toString());
    foreignMap.maps[0].projectId = 'foreign-project';
    await writeFile(file, JSON.stringify(foreignMap));
    assert.equal((await subject.resolve('attached', { kind: 'planning-map', mapId: 'plan' })).availability, 'unavailable');
    await writeFile(file, original);
    const attachment = resolver(root);
    await assert.rejects(attachment.resolve.resolve('wrong', { kind: 'planning-map', mapId: 'plan' }), /handle/);
    attachment.changeHandle('replacement');
    await assert.rejects(attachment.resolve.resolve('attached', { kind: 'planning-map', mapId: 'plan' }), /handle/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
