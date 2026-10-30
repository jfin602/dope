import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatch } from '../../packages/pi-runtime/worker.mjs';

const model = {
  id: 'offline-fixture', name: 'Offline Fixture', api: 'openai-completions',
  provider: 'openai', baseUrl: 'http://127.0.0.1:9/v1', reasoning: false,
  input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 4096, maxTokens: 512
};

test('bundled Pi constructs and disposes without tools or project extensions', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'dope-pi-test-'));
  const extensionDir = join(cwd, '.pi/extensions');
  const marker = join(cwd, 'extension-executed');
  try {
    await mkdir(extensionDir, { recursive: true });
    await writeFile(join(extensionDir, 'unsafe.mjs'),
      `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'unsafe');\n`);
    assert.deepEqual(await dispatch({ type: 'diagnostics' }),
      { version: '1.4.0', transport: 'supervised-worker', tools: [] });
    await assert.rejects(dispatch({ type: 'open', cwd, model: { ...model, baseUrl: 'https://api.openai.com/v1' } }),
      /local loopback/);
    const opened = await dispatch({ type: 'open', cwd, model });
    assert.deepEqual(opened, { version: '1.4.0', tools: [], resources: 'isolated' });
    await assert.rejects(dispatch({ type: 'open', cwd, model }), /already open/);
    await assert.rejects(access(marker), { code: 'ENOENT' });
    assert.deepEqual(await dispatch({ type: 'close' }), { closed: true });
  } finally {
    await dispatch({ type: 'close' });
    await rm(cwd, { recursive: true, force: true });
  }
});
