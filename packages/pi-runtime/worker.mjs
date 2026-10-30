import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Type } from 'typebox';
import {
  createAgentSession, createExtensionRuntime, ModelRuntime, SessionManager, SettingsManager
} from '@earendil-works/pi-coding-agent';

const version = JSON.parse(readFileSync(new URL('./node_modules/@earendil-works/pi-coding-agent/package.json', import.meta.url), 'utf8')).version;
if (version !== '1.4.0') throw new Error('Bundled Pi version mismatch');
let session;
let isolatedDir;
let workMode = false;
let workRequestId;
let nextToolId = 0;
const pendingTools = new Map();
const WORK_TOOLS = {
  dope_read: { path: Type.String(), maxBytes: Type.Integer() },
  dope_list: { path: Type.String(), maxEntries: Type.Integer() },
  dope_edit: { operation: Type.Union([Type.Literal('create'), Type.Literal('modify')]),
    path: Type.String(), content: Type.String() },
  dope_process: { kind: Type.Union([Type.Literal('test'), Type.Literal('build')]), commandId: Type.String() }
};
function workTools() {
  return Object.entries(WORK_TOOLS).map(([name, properties]) => ({
    name, label: name, description: 'Dope-authorized candidate operation. Paths are relative to the candidate root.',
    parameters: Type.Object(properties, { additionalProperties: false }),
    async execute(_toolCallId, params, signal) {
      if (!workMode || signal?.aborted) throw new Error('Dope Work tool unavailable');
      const id = ++nextToolId;
      const answer = new Promise((resolve, reject) => pendingTools.set(id, { resolve, reject }));
      const onAbort = () => { pendingTools.get(id)?.reject(new Error('Dope Work tool cancelled')); pendingTools.delete(id); };
      signal?.addEventListener('abort', onAbort, { once: true });
      process.stdout.write(`${JSON.stringify({ id: workRequestId, tool: { id, name, arguments: params } })}\n`);
      try {
        const result = await answer;
        if (result.status !== 'completed') throw new Error(`Dope Work tool ${result.status}`);
        return { content: [{ type: 'text', text: result.output || result.status }] };
      } finally { signal?.removeEventListener('abort', onAbort); pendingTools.delete(id); }
    }
  }));
}

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
  if (!model || typeof model !== 'object' || typeof model.baseUrl !== 'string' ||
      Object.keys(model).some(key => !['id', 'name', 'provider', 'api', 'baseUrl', 'reasoning',
        'input', 'cost', 'contextWindow', 'maxTokens'].includes(key)) ||
      model.provider !== 'dope-local' || model.api !== 'openai-completions' ||
      typeof model.id !== 'string' || !model.id.trim() ||
      typeof model.name !== 'string' || !model.name.trim() || model.reasoning !== false ||
      !Array.isArray(model.input) || model.input.length !== 1 || model.input[0] !== 'text' ||
      !model.cost || Object.values(model.cost).some(value => value !== 0) ||
      !Number.isSafeInteger(model.contextWindow) || model.contextWindow < 2048 ||
      !Number.isSafeInteger(model.maxTokens) || model.maxTokens < 1 ||
      model.maxTokens > model.contextWindow - 1536)
    throw new Error('Explicit local Pi model required');
  const endpoint = new URL(model.baseUrl);
  if (endpoint.protocol !== 'http:' || !['/', '/v1', '/v1/'].includes(endpoint.pathname) ||
      !['127.0.0.1', '::1', '[::1]', 'localhost'].includes(endpoint.hostname) ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
    throw new Error('Pi model endpoint must be local loopback');
}

async function dispose() {
  workMode = false;
  for (const pending of pendingTools.values()) pending.reject(new Error('Pi session closed'));
  pendingTools.clear();
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
      if (message.mode !== undefined && message.mode !== 'work') throw new Error('Invalid Pi mode');
      if (typeof message.cwd !== 'string' || !message.cwd.startsWith('/'))
        throw new Error('Explicit absolute Pi working directory required');
      isolatedDir = await mkdtemp(join(tmpdir(), 'dope-pi-'));
      try {
        const modelRuntime = await ModelRuntime.create({
          authPath: join(isolatedDir, 'auth.json'), modelsPath: join(isolatedDir, 'models.json')
        });
        if (message.credential !== undefined &&
            (typeof message.credential !== 'string' || !message.credential.trim() || /\s/.test(message.credential)))
          throw new Error('Invalid Local credential');
        modelRuntime.registerProvider('dope-local', {
          name: 'Dope Local', api: 'openai-completions', baseUrl: message.model.baseUrl,
          apiKey: message.credential ?? 'local', models: [{
            id: message.model.id, name: message.model.name, reasoning: false, input: ['text'],
            cost: message.model.cost, contextWindow: message.model.contextWindow,
            maxTokens: message.model.maxTokens
          }]
        });
        workMode = message.mode === 'work';
        const result = await createAgentSession({
          cwd: message.cwd, agentDir: isolatedDir, model: message.model, modelRuntime,
          sessionManager: SessionManager.inMemory(message.cwd),
          settingsManager: SettingsManager.inMemory({ compaction: { enabled: false },
            retry: { enabled: false } }),
          resourceLoader: emptyResources, tools: workMode ? Object.keys(WORK_TOOLS) : [],
          noTools: 'all', customTools: workMode ? workTools() : [],
          scopedModels: [{ model: message.model }]
        });
        session = result.session;
        const tools = session.getActiveToolNames();
        if (JSON.stringify(tools.slice().sort()) !== JSON.stringify((workMode ? Object.keys(WORK_TOOLS) : []).sort()))
          throw new Error('Pi opened with unexpected tools');
        return { version, tools, resources: 'isolated' };
      } catch (error) {
        await dispose();
        throw error;
      }
    }
    case 'close':
      await dispose();
      return { closed: true };
    case 'complete': {
      if (!session) throw new Error('Pi session unavailable');
      if (typeof message.prompt !== 'string' || !message.prompt.trim() ||
          Buffer.byteLength(message.prompt, 'utf8') > 8192)
        throw new Error('Invalid Pi prompt');
      await session.prompt(message.prompt, { expandPromptTemplates: false });
      const assistant = [...session.messages].reverse().find(item => item.role === 'assistant');
      if (!assistant || assistant.stopReason === 'error') throw new Error('Local Pi completion failed');
      return { text: assistant.content.filter(item => item.type === 'text').map(item => item.text).join('') };
    }
    case 'turn': {
      if (workMode || !session || !Array.isArray(message.messages) || !message.messages.length ||
          message.messages.at(-1)?.role !== 'user' ||
          message.messages.some(item => !['system', 'user', 'assistant'].includes(item?.role) ||
            typeof item.content !== 'string') ||
          Buffer.byteLength(JSON.stringify(message.messages), 'utf8') > 512 * 1024 ||
          !Number.isSafeInteger(message.maxOutputTokens) || message.maxOutputTokens < 1 ||
          message.maxOutputTokens > session.model.maxTokens)
        throw new Error('Invalid bounded Pi turn');
      const zeroUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
        totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
      const systems = message.messages.filter(item => item.role === 'system').map(item => item.content).join('\n\n');
      if (systems) session.sessionManager.appendMessage({ role: 'system', content: systems, timestamp: Date.now() });
      for (const item of message.messages.slice(0, -1).filter(item => item.role !== 'system')) {
        session.sessionManager.appendMessage(item.role === 'user' ?
          { role: 'user', content: item.content, timestamp: Date.now() } :
          { role: 'assistant', content: [{ type: 'text', text: item.content }],
            api: 'openai-completions', provider: 'dope-local', model: session.model.id,
            usage: zeroUsage, stopReason: 'stop', timestamp: Date.now() });
      }
      session.refreshContext();
      session.agent.state.model = { ...session.model, maxTokens: message.maxOutputTokens };
      let attemptedTool = false;
      const unsubscribe = session.subscribe(event => {
        if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta')
          message.emit?.({ type: 'delta', text: event.assistantMessageEvent.delta });
        if (event.type === 'message_update' && event.assistantMessageEvent?.type.startsWith('toolcall_') ||
            event.type === 'tool_execution_start') {
          attemptedTool = true;
          void session.abort();
        }
      });
      try {
        await session.prompt(message.messages.at(-1).content, { expandPromptTemplates: false });
      } finally { unsubscribe(); }
      const assistant = [...session.messages].reverse().find(item => item.role === 'assistant');
      if (attemptedTool || !assistant || assistant.stopReason === 'error' || assistant.stopReason === 'aborted' ||
          assistant.stopReason === 'toolUse' || assistant.content.some(item => item.type === 'toolCall'))
        throw new Error('Local Pi completion failed or attempted a tool call');
      const text = assistant.content.filter(item => item.type === 'text').map(item => item.text).join('');
      if (Buffer.byteLength(text, 'utf8') > 65536) throw new Error('Local Pi output exceeded limit');
      return { text, modelId: assistant.responseModel ?? assistant.model,
        finishReason: assistant.stopReason === 'length' ? 'length' : 'stop',
        usage: { inputTokens: assistant.usage?.input, outputTokens: assistant.usage?.output,
          totalTokens: assistant.usage?.totalTokens,
          tokenMeasurement: assistant.usage?.totalTokens ? 'provider-reported' : 'unavailable' } };
    }
    case 'work': {
      if (!session || !workMode || typeof message.prompt !== 'string' || !message.prompt.trim() ||
          Buffer.byteLength(message.prompt, 'utf8') > 32_000) throw new Error('Invalid Pi Work turn');
      workRequestId = message.id;
      let sequence = 0;
      const emitWork = (kind, extra = {}) => {
        if (++sequence > 512) throw new Error('Pi Work event limit exceeded');
        message.emit?.({ type: 'work', sequence, kind, ...extra });
      };
      const unsubscribe = session.subscribe(event => {
        // The pinned SDK emits these structured events. Never forward message text,
        // tool arguments, provider diagnostics or Pi's own session identity.
        if (['agent_start', 'turn_start', 'turn_end', 'agent_end', 'agent_settled'].includes(event.type))
          emitWork(event.type, event.type === 'agent_settled' ? { aborted: event.aborted === true } : {});
        if (event.type === 'tool_execution_start' || event.type === 'tool_execution_end')
          emitWork(event.type, { toolName: event.toolName,
            ...(event.type === 'tool_execution_end' ? { isError: event.isError === true } : {}) });
      });
      try { await session.prompt(message.prompt, { expandPromptTemplates: false }); }
      finally { unsubscribe(); workRequestId = undefined; }
      const assistant = [...session.messages].reverse().find(item => item.role === 'assistant');
      if (!assistant || assistant.stopReason === 'error' || assistant.stopReason === 'aborted')
        throw new Error('Pi Work turn failed');
      return { text: assistant.content.filter(item => item.type === 'text').map(item => item.text).join('').slice(0, 8192),
        modelId: assistant.responseModel ?? assistant.model };
    }
    case 'tool-result': {
      const pending = pendingTools.get(message.toolId);
      if (!pending) throw new Error('Unknown Pi tool result');
      pending.resolve(message.result);
      return { received: true };
    }
    default:
      throw new Error('Unsupported Pi runtime command');
  }
}

async function accept(line) {
  let id;
  let message;
  try {
    message = JSON.parse(line);
    id = message.id;
    const data = await dispatch({ ...message, emit: event =>
      process.stdout.write(`${JSON.stringify({ id, event })}\n`) });
    process.stdout.write(`${JSON.stringify({ id, ok: true, data })}\n`);
  } catch (error) {
    const safe = ['open', 'complete', 'turn', 'work'].includes(message?.type) ?
      'Local Pi session failed; check the selected AI Center model and local server' :
      String(error?.message ?? error);
    process.stdout.write(`${JSON.stringify({ id, ok: false, error: safe })}\n`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.on('uncaughtException', error => { process.stderr.write(`Pi worker failure: ${error.message}\n`); process.exit(1); });
  process.on('unhandledRejection', error => { process.stderr.write(`Pi worker failure: ${String(error)}\n`); process.exit(1); });
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    input += chunk;
    if (input.length > 1_000_000) throw new Error('Pi worker input limit exceeded');
    let newline;
    while ((newline = input.indexOf('\n')) >= 0) {
      const line = input.slice(0, newline);
      input = input.slice(newline + 1);
      void accept(line);
    }
  });
  process.stdin.on('end', () => { void dispose(); });
  process.stdin.resume();
}
