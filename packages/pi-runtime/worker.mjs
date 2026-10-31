import { mkdtemp, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
let chatToolsMode = false;
let workRequestId;
let nextToolId = 0;
let activeRequest = false;
let sessionConsumed = false;
let compactionRecord;
let compactionRejected = false;
const pendingTools = new Map();
const continuationTrace = process.env.DOPE_PI_CONTINUATION_TRACE === '1';
let traceCount = 0;
const trace = (stage, detail = {}) => {
  if (!continuationTrace || ++traceCount > 128) return;
  process.stderr.write(`[dope-pi-continuation] ${JSON.stringify({ at: new Date().toISOString(),
    stage, modelId: session?.model?.id, requestId: workRequestId, ...detail })}\n`);
};
if (continuationTrace) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const endpoint = String(url);
    if (!endpoint.includes('/chat/completions')) return originalFetch(url, options);
    const started = Date.now();
    let body;
    try { body = JSON.parse(String(options?.body)); } catch { /* No prompt text is logged. */ }
    trace('model-request', { messages: body?.messages?.length, tools: body?.tools?.length,
      maxOutputTokens: body?.max_tokens, bodyBytes: Buffer.byteLength(String(options?.body ?? ''), 'utf8') });
    try {
      const response = await originalFetch(url, options);
      trace('model-response-headers', { status: response.status, elapsedMs: Date.now() - started });
      return response;
    } catch (error) {
      trace('model-request-failed', { elapsedMs: Date.now() - started,
        error: error instanceof Error ? error.name : 'unknown' });
      throw error;
    }
  };
}
const hash = value => createHash('sha256').update(value).digest('hex');
const MAX_COMPACTION_BYTES = 12_000;
function compactExact(event) {
  // Pi's overflow recovery retries the interrupted turn. A Work tool may already
  // have changed the candidate, so the only safe response is to stop the run.
  if (event.willRetry) { compactionRejected = true; return { cancel: true }; }
  const original = JSON.stringify({ previousSummary: event.preparation.previousSummary ?? null,
    messages: [...event.preparation.messagesToSummarize, ...event.preparation.turnPrefixMessages] });
  const messages = JSON.parse(original).messages;
  const unique = [];
  const seen = new Map();
  for (const message of messages) {
    const exact = JSON.stringify(message);
    if (seen.has(exact)) unique.push({ repeatOf: seen.get(exact) });
    else { seen.set(exact, unique.length); unique.push(message); }
  }
  const summary = JSON.stringify({ format: 'dope-pi-exact-v1',
    originalSha256: hash(original), previousSummary: event.preparation.previousSummary ?? null,
    entries: unique });
  const restored = JSON.stringify({ previousSummary: event.preparation.previousSummary ?? null,
    messages: unique.map((entry, index) => entry.repeatOf === undefined ? entry : unique[entry.repeatOf]) });
  if (restored !== original) { compactionRejected = true; return { cancel: true }; }
  if (Buffer.byteLength(summary) > MAX_COMPACTION_BYTES ||
      Buffer.byteLength(summary) + 1024 >= Buffer.byteLength(original)) {
    compactionRejected = true;
    return { cancel: true };
  }
  compactionRecord = { originalSha256: hash(original), compactedSha256: hash(summary),
    tokensBefore: event.preparation.tokensBefore };
  return { compaction: { summary, firstKeptEntryId: event.preparation.firstKeptEntryId,
    tokensBefore: event.preparation.tokensBefore,
    details: { originalSha256: compactionRecord.originalSha256,
      compactedSha256: compactionRecord.compactedSha256 } } };
}
export { compactExact };
function isolatedExtension() {
  const path = 'builtin:dope-exact-compaction';
  return { path, resolvedPath: path, hidden: true,
    sourceInfo: { path, source: 'dope', scope: 'temporary', origin: 'top-level' },
    handlers: new Map([['session_before_compact', [compactExact]]]),
    tools: new Map(), messageRenderers: new Map(), commands: new Map(), flags: new Map(), shortcuts: new Map() };
}
const WORK_TOOLS = {
  read_file: { path: Type.String(), maxBytes: Type.Integer() },
  list_files: { path: Type.String(), maxEntries: Type.Integer() },
  edit_file: { operation: Type.Union([Type.Literal('create'), Type.Literal('modify')]),
    path: Type.String(), content: Type.String() },
  run_command: { kind: Type.Union([Type.Literal('test'), Type.Literal('build')]), commandId: Type.String() }
};
const CHAT_TOOLS = {
  read_file: { path: Type.String() },
  list_files: { path: Type.String() },
  search_paths: { query: Type.String() },
  search_text: { query: Type.String() },
  run_command: { command: Type.String() }
};
function chatTools() {
  return Object.entries(CHAT_TOOLS).map(([name, properties]) => ({
    name, label: name, description: name === 'run_command' ?
      'Run an eligible read-only project investigation command in an isolated Linux sandbox. The project owner may need to approve it. Never claim execution without a tool result.' :
      name === 'list_files' ? 'List one project directory. Start with path "" or "." for the project root; then read real files from that listing. Never use an absolute path.' :
      name === 'read_file' ? 'Read one real project file using a relative path returned by list_files or search_paths. An absent result is not evidence of an empty project.' :
      name === 'search_paths' ? 'Search eligible project file and directory paths by name. Start with list_files on the root before concluding which files exist.' :
      'Search eligible project source contents for a symbol or phrase. Protected entries are excluded.',
    parameters: Type.Object(properties, { additionalProperties: false }),
    async execute(_toolCallId, params, signal) {
      if (!chatToolsMode || signal?.aborted) throw new Error('Dope Chat tool unavailable');
      const id = ++nextToolId;
      const answer = new Promise((resolve, reject) => pendingTools.set(id, { resolve, reject }));
      const onAbort = () => { pendingTools.get(id)?.reject(new Error('Dope Chat tool cancelled')); pendingTools.delete(id); };
      signal?.addEventListener('abort', onAbort, { once: true });
      process.stdout.write(`${JSON.stringify({ id: workRequestId, tool: { id, name, arguments: params } })}\n`);
      trace('tool-request', { toolId: id, toolName: name });
      try {
        const result = await answer;
        trace('tool-result-accepted', { toolId: id, status: result.status,
          outputBytes: Buffer.byteLength(result.output ?? '', 'utf8') });
        if (result.status !== 'completed' || typeof result.output !== 'string' ||
            Buffer.byteLength(result.output, 'utf8') > 12_000)
          throw new Error('Dope Chat tool denied or exceeded output limit');
        return { content: [{ type: 'text', text: result.output }] };
      } finally { signal?.removeEventListener('abort', onAbort); pendingTools.delete(id); }
    }
  }));
}
function workTools() {
  return Object.entries(WORK_TOOLS).map(([name, properties]) => ({
    name, label: name, description: name === 'read_file' ?
      'Read one file from the authorized candidate workspace using a relative path and maximum byte count.' :
      name === 'list_files' ? 'List one directory in the authorized candidate workspace using a relative path and entry limit.' :
      name === 'edit_file' ? 'Create or modify one file in the authorized candidate workspace. Canonical project files are not edited.' :
      'Run an approved test or build command by its granted commandId in the authorized candidate workspace.',
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
        // A failed approved test is feedback for the coding agent, not a provider
        // failure. Denied/cancelled effects still stop at the Dope boundary.
        if (result.status !== 'completed' && result.status !== 'failed')
          throw new Error(`Dope Work tool ${result.status}`);
        return { content: [{ type: 'text', text: `status: ${result.status}\n${result.output || ''}` }] };
      } finally { signal?.removeEventListener('abort', onAbort); pendingTools.delete(id); }
    }
  }));
}

const emptyResources = Object.freeze({
  getExtensions: () => ({ extensions: [isolatedExtension()], errors: [], runtime: createExtensionRuntime() }),
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
  chatToolsMode = false;
  for (const pending of pendingTools.values()) pending.reject(new Error('Pi session closed'));
  pendingTools.clear();
  session?.dispose();
  session = undefined;
  sessionConsumed = false;
  compactionRecord = undefined;
  compactionRejected = false;
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
      if (message.mode !== undefined && !['work', 'chat-tools'].includes(message.mode)) throw new Error('Invalid Pi mode');
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
        chatToolsMode = message.mode === 'chat-tools';
        const chatToolNames = Object.keys(CHAT_TOOLS);
        const result = await createAgentSession({
          cwd: message.cwd, agentDir: isolatedDir, model: message.model, modelRuntime,
          sessionManager: SessionManager.inMemory(message.cwd),
          settingsManager: SettingsManager.inMemory({ compaction: { enabled: true,
            reserveTokens: Math.min(8192, Math.floor(message.model.contextWindow / 4)),
            keepRecentTokens: Math.min(4096, Math.floor(message.model.contextWindow / 8)) },
            retry: { enabled: false } }),
          resourceLoader: emptyResources, tools: workMode ? Object.keys(WORK_TOOLS) :
            chatToolsMode ? chatToolNames : [],
          noTools: 'all', customTools: workMode ? workTools() : chatToolsMode ? chatTools() : [],
          scopedModels: [{ model: message.model }]
        });
        session = result.session;
        sessionConsumed = false;
        const tools = session.getActiveToolNames();
        if (JSON.stringify(tools.slice().sort()) !== JSON.stringify((workMode ? Object.keys(WORK_TOOLS) :
          chatToolsMode ? chatToolNames : []).sort()))
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
      if (sessionConsumed) throw new Error('Pi session turn already consumed');
      if (typeof message.prompt !== 'string' || !message.prompt.trim() ||
          Buffer.byteLength(message.prompt, 'utf8') > 8192)
        throw new Error('Invalid Pi prompt');
      sessionConsumed = true;
      await session.prompt(message.prompt, { expandPromptTemplates: false });
      const assistant = [...session.messages].reverse().find(item => item.role === 'assistant');
      if (!assistant || assistant.stopReason === 'error') throw new Error('Local Pi completion failed');
      return { text: assistant.content.filter(item => item.type === 'text').map(item => item.text).join('') };
    }
    case 'turn': {
      compactionRecord = undefined;
      compactionRejected = false;
      if (workMode || !session || !Array.isArray(message.messages) || !message.messages.length ||
          sessionConsumed ||
          message.messages.at(-1)?.role !== 'user' ||
          message.messages.some(item => !['system', 'user', 'assistant'].includes(item?.role) ||
            typeof item.content !== 'string') ||
          Buffer.byteLength(JSON.stringify(message.messages), 'utf8') > 512 * 1024 ||
          !Number.isSafeInteger(message.maxOutputTokens) || message.maxOutputTokens < 1 ||
          message.maxOutputTokens > session.model.maxTokens)
        throw new Error('Invalid bounded Pi turn');
      sessionConsumed = true;
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
      let toolCount = 0;
      let streamedText = '';
      let resumeAfterTool = false;
      workRequestId = message.id;
      const unsubscribe = session.subscribe(event => {
        if (['turn_start', 'turn_end', 'message_start', 'message_end', 'tool_execution_start',
          'tool_execution_end', 'agent_end', 'agent_settled'].includes(event.type))
          trace(event.type, { toolName: event.toolName,
            stopReason: event.message?.role === 'assistant' ? event.message.stopReason : undefined,
            isError: event.isError });
        if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
          const delta = event.assistantMessageEvent.delta;
          const gap = resumeAfterTool && streamedText.trim() &&
            !streamedText.endsWith('\n') && !delta.startsWith('\n') ? '\n\n' : '';
          const text = gap + delta;
          streamedText += text;
          resumeAfterTool = false;
          message.emit?.({ type: 'delta', text });
        }
        if (!chatToolsMode && (event.type === 'message_update' && event.assistantMessageEvent?.type.startsWith('toolcall_') ||
            event.type === 'tool_execution_start')) {
          attemptedTool = true;
          void session.abort();
        }
        if (chatToolsMode && event.type === 'tool_execution_start' && ++toolCount > 16) {
          attemptedTool = true;
          void session.abort();
        }
        if (chatToolsMode && event.type === 'tool_execution_end') resumeAfterTool = true;
      });
      try {
        await session.prompt(message.messages.at(-1).content, { expandPromptTemplates: false });
        trace('session-prompt-returned', { toolCount });
      } finally { unsubscribe(); workRequestId = undefined; }
      if (compactionRejected) throw new Error('Pi context cannot be compacted safely; shorten the turn');
      const assistant = [...session.messages].reverse().find(item => item.role === 'assistant');
      if (attemptedTool || !assistant || assistant.stopReason === 'error' || assistant.stopReason === 'aborted' ||
          assistant.stopReason === 'toolUse' || assistant.content.some(item => item.type === 'toolCall'))
        throw new Error('Local Pi completion failed or attempted a tool call');
      const text = chatToolsMode && toolCount && streamedText ? streamedText :
        assistant.content.filter(item => item.type === 'text').map(item => item.text).join('');
      if (Buffer.byteLength(text, 'utf8') > 65536) throw new Error('Local Pi output exceeded limit');
      return { text, modelId: assistant.responseModel ?? assistant.model,
        finishReason: assistant.stopReason === 'length' ? 'length' : 'stop',
        usage: { inputTokens: assistant.usage?.input, outputTokens: assistant.usage?.output,
          totalTokens: assistant.usage?.totalTokens,
          tokenMeasurement: assistant.usage?.totalTokens ? 'provider-reported' : 'unavailable' },
        ...(compactionRecord ? { compaction: compactionRecord } : {}) };
    }
    case 'work': {
      compactionRecord = undefined;
      compactionRejected = false;
      if (!session || !workMode || sessionConsumed || typeof message.prompt !== 'string' || !message.prompt.trim() ||
          Buffer.byteLength(message.prompt, 'utf8') > 32_000) throw new Error('Invalid Pi Work turn');
      sessionConsumed = true;
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
      if (compactionRejected) throw new Error('Pi Work context cannot be compacted safely; retry with a shorter task');
      const assistant = [...session.messages].reverse().find(item => item.role === 'assistant');
      if (!assistant || assistant.stopReason === 'error' || assistant.stopReason === 'aborted')
        throw new Error('Pi Work turn failed');
      return { text: assistant.content.filter(item => item.type === 'text').map(item => item.text).join('').slice(0, 8192),
        modelId: assistant.responseModel ?? assistant.model,
        usage: { inputTokens: assistant.usage?.input, outputTokens: assistant.usage?.output,
          totalTokens: assistant.usage?.totalTokens,
          tokenMeasurement: assistant.usage?.totalTokens ? 'provider-reported' : 'unavailable' },
        ...(compactionRecord ? { compaction: compactionRecord } : {}) };
    }
    case 'tool-result': {
      const pending = pendingTools.get(message.toolId);
      if (!pending) throw new Error('Unknown Pi tool result');
      trace('tool-result-received', { toolId: message.toolId, status: message.result?.status,
        outputBytes: Buffer.byteLength(message.result?.output ?? '', 'utf8') });
      pendingTools.delete(message.toolId);
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
  let claimed = false;
  try {
    message = JSON.parse(line);
    id = message.id;
    if (activeRequest && message.type !== 'tool-result') throw new Error('Pi worker busy');
    if (message.type !== 'tool-result') { activeRequest = true; claimed = true; }
    const data = await dispatch({ ...message, emit: event =>
      process.stdout.write(`${JSON.stringify({ id, event })}\n`) });
    process.stdout.write(`${JSON.stringify({ id, ok: true, data })}\n`);
  } catch (error) {
    const safe = /cannot be compacted safely/.test(String(error?.message)) ?
      'Pi context cannot be compacted safely; shorten the task or select a larger loaded Local model' :
      ['open', 'complete', 'turn', 'work'].includes(message?.type) ?
      'Local Pi session failed; check the selected AI Center model and local server' :
      String(error?.message ?? error);
    process.stdout.write(`${JSON.stringify({ id, ok: false, error: safe })}\n`);
  } finally {
    if (claimed) activeRequest = false;
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
