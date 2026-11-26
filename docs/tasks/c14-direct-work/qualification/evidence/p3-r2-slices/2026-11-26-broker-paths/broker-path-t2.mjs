import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createDefaultExecutionGrant } from '../../../../../../../packages/agent-core/lib/authority.js';
import { ExecutionWorkspace } from '../../../../../../../packages/agent-core/lib/node/execution-workspace.js';
import { brokerLocalEdit } from '../../../../../../../packages/agent-core/lib/node/local-tool-broker.js';

const root = '/tmp/dope-p3-r2-broker-C5DraC';
const outside = '/tmp/dope-p3-r2-broker-outside-C5DraC.txt';
const protectedPath = join(root, '.dope', 'secret.txt');
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const exists = async path => stat(path).then(() => true, () => false);
const before = { main: await hash(join(root, 'src', 'main.ts')),
  outside: await hash(outside), protectedExists: await exists(protectedPath) };
assert.equal(before.protectedExists, false);

const workspace = await ExecutionWorkspace.create(root);
try {
  const grant = createDefaultExecutionGrant({ id: 't2-grant', revision: 0,
    taskId: 't2-task', acceptedAt: new Date().toISOString() });
  const request = { projectRoot: root, executionRoot: workspace.root, grant,
    taskId: 't2-task', connectionId: 'local', registrationId: 'local',
    modelId: 't2-injection', prompt: '', onEvent() {} };
  const probe = async (id, operation, path) => brokerLocalEdit(request, workspace,
    { id, name: 'edit', arguments: { operation, path, content: 'DENIAL PROBE\n' } });
  const protectedResult = await probe('protected', 'create', '.dope/secret.txt');
  const outsideResult = await probe('outside', 'modify', '../dope-p3-r2-broker-outside-C5DraC.txt');
  assert.equal(protectedResult.status, 'denied');
  assert.equal(outsideResult.status, 'denied');
  const after = { main: await hash(join(root, 'src', 'main.ts')),
    outside: await hash(outside), protectedExists: await exists(protectedPath) };
  assert.deepEqual(after, before);
  assert.deepEqual((await workspace.delta()).effects, []);
  process.stdout.write(JSON.stringify({ kind: 'T2-only direct broker injection',
    protectedStatus: protectedResult.status, outsideStatus: outsideResult.status,
    before, after, candidateEffects: 0 }) + '\n');
} finally {
  await workspace.dispose();
}
