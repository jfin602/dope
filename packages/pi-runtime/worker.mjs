import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAgentSession, createExtensionRuntime, ModelRuntime, SessionManager, SettingsManager
} from '@earendil-works/pi-coding-agent';

const version = JSON.parse(readFileSync(new URL('./node_modules/@earendil-works/pi-coding-agent/package.json', import.meta.url), 'utf8')).version;
if (version !== '1.4.0') throw new Error('Bundled Pi version mismatch');
let session;
let isolatedDir;

const emptyResources = Object.freeze({
  getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
  getSkills: () => ({ skills: [], diagnostics: [] }),
  getPrompts: () => ({ prompts: [], diagnostics: [] }),
  getThemes: () => ({ themes: [], diagnostics: [] }),
  getAgentsFiles: () => ({ agentsFiles: [] }),
  getSystemPrompt: () => 'You are an assistant operating under Dope authority.',
  getSystemPromptSource: () => undefined,
  getAppendSystemPrompt: () => [],
  getAppendSystemPromptSources: () => [],
  extendResources: () => { throw new Error('Pi resource discovery is disabled'); },
  reload: async () => {}
});

function assertLocalModel(model) {
  if (!model || typeof model !== 'object' || typeof model.baseUrl !== 'string')
    throw new Error('Explicit local Pi model required');
  const endpoint = new URL(model.baseUrl);
  if (!['http:', 'https:'].includes(endpoint.protocol) ||
      !['127.0.0.1', '::1', '[::1]', 'localhost'].includes(endpoint.hostname) ||
      endpoint.username || endpoint.password)
    throw new Error('Pi model endpoint must be local loopback');
}

async function dispose() {
  session?.dispose();
  session = undefined;
  if (isolatedDir) {
    await rm(isolatedDir, { recursive: true, force: true });
    isolatedDir = undefined;
  }
}

export async function dispatch(message) {
  switch (message.type) {
    case 'diagnostics':
      return { version, transport: 'supervised-worker', tools: [] };
    case 'open': {
      if (session) throw new Error('Pi session already open');
      assertLocalModel(message.model);
      if (typeof message.cwd !== 'string' || !message.cwd.startsWith('/'))
        throw new Error('Explicit absolute Pi working directory required');
      isolatedDir = await mkdtemp(join(tmpdir(), 'dope-pi-'));
      try {
        const modelRuntime = await ModelRuntime.create({
          authPath: join(isolatedDir, 'auth.json'), modelsPath: join(isolatedDir, 'models.json')
        });
        const result = await createAgentSession({
          cwd: message.cwd, agentDir: isolatedDir, model: message.model, modelRuntime,
          sessionManager: SessionManager.inMemory(message.cwd),
          settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
          resourceLoader: emptyResources, tools: [], noTools: 'all', customTools: []
        });
        session = result.session;
        const tools = session.getActiveToolNames();
        if (tools.length) throw new Error('Pi opened with unexpected tools');
        return { version, tools, resources: 'isolated' };
      } catch (error) {
        await dispose();
        throw error;
      }
    }
    case 'close':
      await dispose();
      return { closed: true };
    default:
      throw new Error('Unsupported Pi runtime command');
  }
}

async function accept(line) {
  let id;
  try {
    const message = JSON.parse(line);
    id = message.id;
    const data = await dispatch(message);
    process.stdout.write(`${JSON.stringify({ id, ok: true, data })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ id, ok: false, error: String(error?.message ?? error) })}\n`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.on('uncaughtException', error => { process.stderr.write(`Pi worker failure: ${error.message}\n`); process.exit(1); });
  process.on('unhandledRejection', error => { process.stderr.write(`Pi worker failure: ${String(error)}\n`); process.exit(1); });
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 1_000_000) throw new Error('Pi worker input limit exceeded');
    let newline;
    while ((newline = input.indexOf('\n')) >= 0) {
      const line = input.slice(0, newline);
      input = input.slice(newline + 1);
      await accept(line);
    }
  }
  await dispose();
}
