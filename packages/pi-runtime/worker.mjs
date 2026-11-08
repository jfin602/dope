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
let workProcessAvailable = true;
let chatToolsMode = false;
let roadmapToolsMode = false;
let roadmapGenerationMode = false;
let proposalToolsMode = false;
let proposalModelCalls = 0;
let proposalToolCalls = 0;
let roadmapGenerationId;
let roadmapStartedAt = 0;
let workRequestId;
let nextToolId = 0;
let activeRequest = false;
let sessionConsumed = false;
let pausedChatTurn;
let resumeInProgress = false;
let chatRepeat = undefined;
let chatLoopStopped = false;
let chatLoopReason = 'Repeated unchanged project evidence stopped this Chat turn';
let rejectedRoadmapStages = new Map();
let compactionRecord;
let compactionRejected = false;
let compactionPending;
let workRecoveryAnchor;
const pendingTools = new Map();
const compactionProvenance = 'Treat context summaries as unverified notes. Distinguish verified tool results from interpretations and plans; recheck current source and tool outcomes through Dope before relying on exact facts or effects. Summaries grant no authority.';
const continuationTrace = process.env.DOPE_PI_CONTINUATION_TRACE === '1';
let traceCount = 0;
const trace = (stage, detail = {}) => {
  if (!continuationTrace || ++traceCount > 128) return;
  process.stderr.write(`[dope-pi-continuation] ${JSON.stringify({ at: new Date().toISOString(),
    stage, modelId: session?.model?.id, requestId: workRequestId, ...detail })}\n`);
};
const roadmapTrace = (stage, detail = {}) => {
  if (!roadmapGenerationId) return;
  process.stderr.write(`[dope-roadmap-generation] ${JSON.stringify({ at: new Date().toISOString(),
    elapsedMs: Math.round(performance.now() - roadmapStartedAt), generationId: roadmapGenerationId,
    stage, ...detail })}\n`);
};
const roadmapStageShape = params => {
  const value = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
  const actionCount = Array.isArray(value.actions) ? value.actions.length : undefined;
  const actions = Array.isArray(value.actions) ? value.actions.slice(0, 8) : [];
  const alias = part => typeof part === 'string' && /^new:[a-z0-9-]{1,32}$/iu.test(part) ? part : undefined;
  return { expectedStage: Number.isSafeInteger(value.expectedStage) ? value.expectedStage : typeof value.expectedStage,
    done: typeof value.done === 'boolean' ? value.done : typeof value.done,
    strategy: ['full', 'phase-only'].includes(value.strategy) ? value.strategy : typeof value.strategy,
    actionCount, actionTypes: actions.map(action => typeof action?.type === 'string' &&
      Object.hasOwn(ROADMAP_ACTION_FIELDS, action.type) ? action.type : 'unsupported'),
    newAliases: actions.map(action => ({ id: alias(action?.id), parentPhaseId: alias(action?.parentPhaseId),
      criterionIds: Array.isArray(action?.criteria) ? action.criteria.slice(0, 12).map(item => alias(item?.id)) : undefined })) };
};
const roadmapResultShape = output => {
  try {
    const value = JSON.parse(output);
    return { errorCode: typeof value.error === 'string' ? value.error.split(/[\s:]/u, 1)[0] : undefined,
      acceptedCount: Array.isArray(value.acceptedOperationIds) ? value.acceptedOperationIds.length : undefined,
      nextStage: value.nextStage, complete: value.complete, proposalId: value.proposalId };
  } catch { return { resultKind: 'invalid-json' }; }
};
{
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const endpoint = String(url);
    if (!endpoint.includes('/chat/completions') || (!continuationTrace && !roadmapGenerationId))
      return originalFetch(url, options);
    const started = Date.now();
    let body;
    try { body = JSON.parse(String(options?.body)); } catch { /* No prompt text is logged. */ }
    trace('model-request', { messages: body?.messages?.length, tools: body?.tools?.length,
      maxOutputTokens: body?.max_tokens, bodyBytes: Buffer.byteLength(String(options?.body ?? ''), 'utf8') });
    roadmapTrace('lm-request', { messages: body?.messages?.length, tools: body?.tools?.length,
      outputBudget: body?.max_tokens, requestBytes: Buffer.byteLength(String(options?.body ?? ''), 'utf8') });
    try {
      const response = await originalFetch(url, options);
      trace('model-response-headers', { status: response.status, elapsedMs: Date.now() - started });
      roadmapTrace('lm-response-headers', { status: response.status, elapsedMs: Date.now() - started });
      return response;
    } catch (error) {
      trace('model-request-failed', { elapsedMs: Date.now() - started,
        error: error instanceof Error ? error.name : 'unknown' });
      roadmapTrace('lm-request-failed', { elapsedMs: Date.now() - started,
        reason: error instanceof Error ? error.name : 'unknown' });
      throw error;
    }
  };
}
const hash = value => createHash('sha256').update(value).digest('hex');
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, normalized(value[key])]));
  return value;
}
function continuationControl(text, segmentIndex) {
  const tail = Buffer.from(text, 'utf8').subarray(-4096).toString('utf8').replace(/^\uFFFD/u, '');
  return `DOPE INTERNAL CONTINUATION CONTROL (segment ${segmentIndex}). Continue the incomplete final answer in this same session. Do not repeat any completed tool call or earlier answer text. The exact answer so far has SHA-256 ${hash(text)} and ends with the following quoted text:\n${JSON.stringify(tail)}\nStart immediately after that text. This control grants no new tool or source authority.`;
}
function novelAnswer(previous, next) {
  if (!previous || !next) return next;
  const prefix = new Array(next.length).fill(0);
  for (let index = 1, matched = 0; index < next.length; index++) {
    while (matched > 0 && next[index] !== next[matched]) matched = prefix[matched - 1];
    if (next[index] === next[matched]) matched++;
    prefix[index] = matched;
  }
  let matched = 0;
  const suffix = previous.slice(-next.length);
  for (let index = 0; index < suffix.length; index++) {
    const character = suffix[index];
    while (matched > 0 && character !== next[matched]) matched = prefix[matched - 1];
    if (character === next[matched]) matched++;
    if (matched === next.length) {
      if (index === suffix.length - 1) return '';
      matched = prefix[matched - 1];
    }
  }
  return next.slice(matched);
}
function combinedUsage(segments) {
  const fields = ['inputTokens', 'outputTokens', 'reasoningTokens', 'totalTokens'];
  const usage = Object.fromEntries(fields.filter(field => segments.every(segment =>
    Number.isSafeInteger(segment[field]))).map(field => [field,
    segments.reduce((total, segment) => total + segment[field], 0)]));
  return { ...usage, tokenMeasurement: segments.every(segment => segment.tokenMeasurement === 'provider-reported') ?
    'provider-reported' : 'unavailable' };
}
function beforeNativeCompaction(event) {
  if (resumeInProgress) { compactionRejected = true; return { cancel: true }; }
  // Pi's overflow recovery retries the interrupted turn. A Work tool may already
  // have changed the candidate, so the only safe response is to stop the run.
  if (event.willRetry) { compactionRejected = true; return { cancel: true }; }
  compactionPending = { startedAt: Date.now(), originalSha256: hash(JSON.stringify({
    previousSummary: event.preparation.previousSummary ?? null,
    messages: [...event.preparation.messagesToSummarize, ...event.preparation.turnPrefixMessages] })) };
  // Returning no replacement selects Pi's native summarizer and recent-context cut.
  return undefined;
}
export { beforeNativeCompaction };
function nativeCompactionOutcome(event) {
  if (event.type !== 'compaction_end') return undefined;
  const pending = compactionPending;
  compactionPending = undefined;
  if (!event.result || event.aborted || event.willRetry) {
    trace('compaction-failed', { reason: event.reason, aborted: event.aborted === true });
    return { success: false, reason: event.reason };
  }
  const result = event.result;
  if (!pending || typeof result.summary !== 'string' ||
      !Number.isSafeInteger(result.tokensBefore) || result.tokensBefore < 0)
    return { success: false, reason: event.reason };
  compactionRecord = { originalSha256: pending.originalSha256,
    compactedSha256: hash(result.summary), tokensBefore: result.tokensBefore };
  const metadata = { reason: event.reason, durationMs: Date.now() - pending.startedAt,
    tokensBeforeEstimate: result.tokensBefore,
    ...(Number.isSafeInteger(result.estimatedTokensAfter) && result.estimatedTokensAfter >= 0 ?
      { tokensAfterEstimate: result.estimatedTokensAfter } : {}),
    summaryBytes: Buffer.byteLength(result.summary, 'utf8'),
    ...(Number.isSafeInteger(result.usage?.totalTokens) && result.usage.totalTokens > 0 ?
      { summarizationTokensReported: result.usage.totalTokens } : {}) };
  trace('compaction-succeeded', metadata);
  return { success: true, ...metadata };
}
export { nativeCompactionOutcome };
function isolatedExtension() {
  const path = 'builtin:dope-native-compaction-guard';
  return { path, resolvedPath: path, hidden: true,
    sourceInfo: { path, source: 'dope', scope: 'temporary', origin: 'top-level' },
    handlers: new Map([['session_before_compact', [beforeNativeCompaction]],
      ['before_agent_start', [event => workMode && workRecoveryAnchor ?
        { systemPrompt: `${event.systemPrompt}\n\n${workRecoveryAnchor}` } : undefined]]]),
    tools: new Map(), messageRenderers: new Map(), commands: new Map(), flags: new Map(), shortcuts: new Map() };
}
const WORK_TOOLS = {
  read_file: { path: Type.String(), maxBytes: Type.Optional(Type.Integer()), offset: Type.Optional(Type.Integer()),
    expectedSourceHash: Type.Optional(Type.String()) },
  list_files: { path: Type.String(), maxEntries: Type.Integer() },
  edit_file: { operation: Type.Union([Type.Literal('create'), Type.Literal('modify')]),
    path: Type.String(), content: Type.String() },
  run_command: { kind: Type.Union([Type.Literal('test'), Type.Literal('build')]), commandId: Type.String() },
  read_command_output: { handle: Type.String(), offset: Type.Integer(), maxBytes: Type.Integer() }
};
const CHAT_TOOLS = {
  read_file: { path: Type.String(), offset: Type.Optional(Type.Integer()),
    maxBytes: Type.Optional(Type.Integer()), expectedSourceHash: Type.Optional(Type.String()) },
  list_files: { path: Type.String() },
  search_paths: { query: Type.String() },
  search_text: { query: Type.String() },
  run_command: { command: Type.String() }
};
const PROPOSAL_TOOLS = {
  ...Object.fromEntries(Object.entries(CHAT_TOOLS).filter(([name]) => name !== 'run_command')),
  proposal_status: { version: Type.Literal(1) },
  proposal_stage_document: { version: Type.Literal(1), sequence: Type.Integer(),
    expectedRevision: Type.Integer(), idempotencyKey: Type.String(), target: Type.String(),
    chunkIndex: Type.Integer(), content: Type.String(), digest: Type.Optional(Type.String()), complete: Type.Boolean() },
  proposal_stage_prompt: { version: Type.Literal(1), sequence: Type.Integer(),
    expectedRevision: Type.Integer(), idempotencyKey: Type.String(), target: Type.String(),
    chunkIndex: Type.Integer(), content: Type.String(), digest: Type.String(), complete: Type.Boolean() },
  proposal_finish: { finalMessage: Type.String() }
};
// Keep this compact: Pi sees the legal discriminator and required fields, while
// the stage owner remains the authority for identity, source and content checks.
const roadmapField = {
  id: Type.String({ minLength: 1, maxLength: 128 }), gateId: Type.String({ minLength: 1, maxLength: 128 }),
  parentPhaseId: Type.String({ minLength: 1, maxLength: 128 }),
  criterionId: Type.String({ minLength: 1, maxLength: 128 }),
  title: Type.String({ minLength: 1, maxLength: 2048 }),
  objective: Type.String({ minLength: 1, maxLength: 2048 }),
  purpose: Type.String({ minLength: 1, maxLength: 2048 }),
  designation: Type.String({ pattern: '^G[1-9][0-9]*$', maxLength: 2048 }),
  expectedResult: Type.String({ minLength: 1, maxLength: 2048 }),
  order: Type.Integer({ minimum: 0, maximum: 4096 }),
  ids: Type.Array(Type.String({ minLength: 1, maxLength: 128 }), { maxItems: 32 }),
  dependencies: Type.Array(Type.String({ minLength: 1, maxLength: 128 }), { maxItems: 32 }),
  parent: Type.Object({ kind: Type.Union([Type.Literal('phase'), Type.Literal('gate')]),
    id: Type.String({ minLength: 1, maxLength: 128 }) }, { additionalProperties: false }),
  criteria: Type.Array(Type.Object({ id: Type.String({ pattern: '^new:[a-zA-Z0-9-]{1,32}$' }),
    title: Type.String({ minLength: 1, maxLength: 2048 }),
    expectedResult: Type.String({ minLength: 1, maxLength: 2048 }) },
    { additionalProperties: false }), { minItems: 1, maxItems: 12 })
};
export const ROADMAP_ACTION_FIELDS = {
  'phase.create': ['id', 'title', 'objective'], 'phase.edit': ['id', 'title', 'objective'],
  'phase.delete': ['id'], 'phase.reorder': ['ids'], 'phase.dependencies': ['id', 'dependencies'],
  'gate.create': ['id', 'parentPhaseId', 'designation', 'title', 'purpose', 'criteria'],
  'gate.edit': ['id', 'title', 'purpose'], 'gate.delete': ['id'],
  'gate.reparent': ['id', 'parentPhaseId', 'order'], 'gate.reorder': ['parentPhaseId', 'ids'],
  'gate.dependencies': ['id', 'dependencies'], 'criterion.add': ['gateId', 'id', 'title', 'expectedResult'],
  'criterion.edit': ['gateId', 'id', 'title', 'expectedResult'], 'criterion.remove': ['gateId', 'id'],
  'criterion.reorder': ['gateId', 'ids'], 'correction.attach': ['id', 'parent', 'title', 'objective'],
  'correction.edit': ['id', 'title', 'objective'], 'correction.reparent': ['id', 'parent'],
  'correction.delete': ['id']
};
export const roadmapActionSchema = Type.Union(Object.entries(ROADMAP_ACTION_FIELDS).map(([kind, fields]) =>
  Type.Object({ type: Type.Literal(kind), ...Object.fromEntries(fields.map(field =>
    [field, ['phase.create', 'gate.create', 'criterion.add', 'correction.attach'].includes(kind) && field === 'id' ?
      Type.String({ pattern: '^new:[a-zA-Z0-9-]{1,32}$' }) : roadmapField[field]])),
  ...(['correction.attach', 'correction.reparent'].includes(kind) ?
    { criterionId: Type.Optional(roadmapField.criterionId) } : {}) }, { additionalProperties: false })));
const ROADMAP_TOOLS = {
  roadmap_read: { version: Type.Literal(1), ids: Type.Optional(Type.Array(Type.String())),
    offset: Type.Optional(Type.Integer()), limit: Type.Optional(Type.Integer()), stageOffset: Type.Optional(Type.Integer()) },
  roadmap_stage: { version: Type.Literal(1), expectedStage: Type.Integer(),
    strategy: Type.Optional(Type.Union([Type.Literal('full'), Type.Literal('phase-only')])),
    done: Type.Optional(Type.Boolean()), actions: Type.Array(roadmapActionSchema, { minItems: 1, maxItems: 8 }) },
  roadmap_cancel: { version: Type.Literal(1) }
};
const ROADMAP_GENERATION_TOOLS = {
  roadmap_finish: { version: Type.Literal(1),
    unresolved: Type.Array(Type.String({ minLength: 1, maxLength: 300 }), { maxItems: 16 }) },
  roadmap_phase: { version: Type.Literal(1), phase: Type.Integer({ minimum: 1, maximum: 12 }),
    title: Type.String({ minLength: 1, maxLength: 2048 }),
    objective: Type.String({ minLength: 1, maxLength: 2048 }),
    gates: Type.Array(Type.Object({
      title: Type.String({ minLength: 1, maxLength: 2048 }),
      purpose: Type.String({ minLength: 1, maxLength: 2048 }),
      criteria: Type.Array(Type.Object({
        title: Type.String({ minLength: 1, maxLength: 2048 }),
        expectedResult: Type.String({ minLength: 1, maxLength: 2048 })
      }, { additionalProperties: false }), { minItems: 1, maxItems: 12 })
    }, { additionalProperties: false }), { minItems: 1, maxItems: 12 }) }
};
function chatTools() {
  return Object.entries(roadmapGenerationMode ? ROADMAP_GENERATION_TOOLS :
    roadmapToolsMode ? ROADMAP_TOOLS : proposalToolsMode ? PROPOSAL_TOOLS : CHAT_TOOLS).map(([name, properties]) => ({
    name, label: name, description: name === 'run_command' ?
      'Run an eligible read-only project investigation command in an isolated Linux sandbox. The project owner may need to approve it. Never claim execution without a tool result.' :
      name === 'list_files' ? 'List one project directory. Start with path "" or "." for the project root; then read real files from that listing. Never use an absolute path.' :
      name === 'read_file' ? 'Read a project file by relative path. For an exact first page use offset 0 (maxBytes defaults to 4096); the reply supplies sourceHash and nextOffset. For later pages pass nextOffset as offset and sourceHash as expectedSourceHash. A path-only read retains the legacy prefix behavior.' :
      name === 'search_paths' ? 'Search eligible project file and directory paths by name. Start with list_files on the root before concluding which files exist.' :
      name === 'roadmap_read' ? 'Read current typed Roadmap entities and establish this turn\'s trusted staging basis. Omit ids to discover entities; Phase entries include gateIds so you can read their Gates by ID. Results contain up to 20 entries; when nextOffset is not null, pass it as offset in another roadmap_read until all relevant entities are found. Read before staging; Dope retains source and revision preconditions.' :
      name === 'roadmap_phase' ? 'Submit the next Phase with nested Gates and observable Criteria. Wait for the checked noncanonical stage receipt before continuing. This tool cannot apply a Roadmap.' :
      name === 'roadmap_finish' ? 'Signal that no further Phase is proposed, listing unresolved or uncertain requirements. Dope checks the staged draft before review.' :
      name === 'roadmap_stage' ? 'Stage typed Roadmap actions in batches of 1-8 (48 total) after roadmap_read. Dope supplies trusted source and revision preconditions; do not include them. Start expectedStage at 1 and increment per accepted batch. Use new: aliases for created IDs across batches. Gate designations are G1, G2, etc. within each Phase, and every created Gate needs an observable Criterion. Set done true only on the final batch; full requires Gates and Criteria, phase-only is for an intentional Phase draft. This never applies canonical state.' :
      name === 'roadmap_cancel' ? 'Cancel this turn\'s noncanonical Roadmap stage.' :
      name === 'proposal_status' ? 'Read a compact receipt for this protected proposal session and its remaining limits.' :
      name === 'proposal_stage_document' ?
        'Stage one bounded noncanonical document operation. Content is a JSON string: {"operation":"replace","before":"exact observed excerpt","after":"replacement","sourceHash":"fullHash from read_file"} or {"operation":"create","chunk":"new text"}; selected proposal revisions may use {"operation":"remove"} for a saved target. Supply sequence, expectedRevision, chunkIndex and idempotencyKey from status/receipts. Dope calculates digest. Set complete true on the last stage for each target; you may add a later replacement to that target. This tool cannot publish files.' :
      name === 'proposal_stage_prompt' ?
        'Stage one bounded noncanonical chunk in sequence. Supply the SHA-256 digest of content; wait for the checked receipt. This tool cannot publish files.' :
      name === 'proposal_finish' ? 'Request validation and sealing of the staged candidate. The finalMessage is untrusted display prose, not an approval.' :
      'Search eligible project source contents for a symbol or phrase. Protected entries are excluded.',
    parameters: Type.Object(properties, { additionalProperties: false }),
    async execute(_toolCallId, params, signal) {
      if (!chatToolsMode || signal?.aborted) throw new Error('Dope Chat tool unavailable');
      if (proposalToolsMode && ++proposalToolCalls > 512) {
        chatLoopStopped = true;
        chatLoopReason = 'Protected proposal tool-call budget exceeded';
        void session?.abort();
        throw new Error(chatLoopReason);
      }
      const id = ++nextToolId;
      const answer = new Promise((resolve, reject) => pendingTools.set(id, { resolve, reject }));
      const onAbort = () => { pendingTools.get(id)?.reject(new Error('Dope Chat tool cancelled')); pendingTools.delete(id); };
      signal?.addEventListener('abort', onAbort, { once: true });
      process.stdout.write(`${JSON.stringify({ id: workRequestId, tool: { id, name, arguments: params } })}\n`);
      trace('tool-request', { toolId: id, toolName: name });
      if (name === 'roadmap_stage') trace('roadmap-stage-request', { toolId: id, ...roadmapStageShape(params) });
      try {
        const result = await answer;
        trace('tool-result-accepted', { toolId: id, status: result.status,
          outputBytes: Buffer.byteLength(result.output ?? '', 'utf8') });
        if (name === 'roadmap_stage') trace('roadmap-stage-result', {
          toolId: id, status: result.status, ...roadmapResultShape(result.output ?? '') });
        if (result.status !== 'completed') throw new Error('Dope Chat tool denied by project authority');
        if (typeof result.output !== 'string' || Buffer.byteLength(result.output, 'utf8') > 12_000)
          throw new Error('Dope Chat tool output limit exceeded');
        if (roadmapGenerationMode) return { content: [{ type: 'text', text: result.output }] };
        if (name === 'roadmap_stage' && roadmapResultShape(result.output).errorCode === 'ROADMAP_STAGE_ARGUMENTS') {
          const key = hash(JSON.stringify(normalized(params)));
          const repeated = (rejectedRoadmapStages.get(key) ?? 0) + 1;
          rejectedRoadmapStages.set(key, repeated);
          if (repeated >= 2) {
            chatLoopStopped = true;
            chatLoopReason = 'Repeated invalid Roadmap stage arguments stopped this Chat turn';
            void session?.abort();
            throw new Error(chatLoopReason);
          }
        }
        if (name !== 'run_command') {
          const key = hash(JSON.stringify([name, normalized(params)]));
          const evidence = hash(result.output);
          chatRepeat = chatRepeat?.key === key && chatRepeat.evidence === evidence ?
            { key, evidence, count: chatRepeat.count + 1 } : { key, evidence, count: 1 };
          trace('tool-evidence', { toolName: name, argumentSha256: key,
            resultSha256: evidence, repetition: chatRepeat.count });
          if (chatRepeat.count >= 4) {
            chatLoopStopped = true;
            void session?.abort();
            throw new Error('Repeated unchanged project evidence');
          }
          if (chatRepeat.count === 3) return { content: [{ type: 'text',
            text: 'This identical project evidence was already returned twice in this turn. Use the available evidence to answer, or investigate a different source.' }] };
        } else chatRepeat = undefined;
        return { content: [{ type: 'text', text: result.output }] };
      } finally { signal?.removeEventListener('abort', onAbort); pendingTools.delete(id); }
    }
  }));
}
function workTools() {
  return Object.entries(WORK_TOOLS).filter(([name]) => name !== 'run_command' || workProcessAvailable).map(([name, properties]) => ({
    name, label: name, description: name === 'read_file' ?
      'Read an authorized candidate file. On the FIRST read of each file, send path and offset 0; OMIT expectedSourceHash entirely. The reply supplies sourceHash and nextOffset. Only for later pages, send that exact returned sourceHash as expectedSourceHash with nextOffset. A task, Git or candidate hash is NOT a file sourceHash. Path-only reads retain the legacy sanitized prefix.' :
      name === 'list_files' ? 'List one directory in the authorized candidate workspace using a relative path and entry limit.' :
      name === 'edit_file' ? 'Create or modify one file in the authorized candidate workspace. Canonical project files are not edited.' :
      name === 'read_command_output' ? 'Read a retained page of a completed approved command result by handle and UTF-8 byte offset; does not rerun it.' :
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
  getSystemPrompt: () => {
    return chatToolsMode ?
      `You are an assistant operating under Dope authority. Use project tools when evidence is needed. After a tool result, decide whether another tool is needed; when you can answer, give the final answer without a tool call. Do not combine a final answer with a tool call. ${compactionProvenance}` :
      `You are an assistant operating under Dope authority. ${compactionProvenance}`;
  },
  getSystemPromptSource: () => undefined,
  getAppendSystemPrompt: () => [],
  getAppendSystemPromptSources: () => [],
  extendResources: () => { throw new Error('Pi resource discovery is disabled'); },
  reload: async () => {}
});

function assertLocalModel(model) {
  if (!model || typeof model !== 'object' || typeof model.baseUrl !== 'string' ||
      Object.keys(model).some(key => !['id', 'name', 'provider', 'api', 'baseUrl', 'reasoning',
        'input', 'cost', 'contextWindow', 'maxTokens', 'compat'].includes(key)) ||
      model.provider !== 'dope-local' || model.api !== 'openai-completions' ||
      typeof model.id !== 'string' || !model.id.trim() ||
      typeof model.name !== 'string' || !model.name.trim() ||
      (model.reasoning === true ?
        (!model.compat || Object.keys(model.compat).length !== 1 ||
          !(model.compat.thinkingFormat === 'qwen-chat-template' ||
            model.compat.supportsReasoningEffort === true)) :
        (model.reasoning !== false || model.compat !== undefined)) ||
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
  workProcessAvailable = true;
  chatToolsMode = false;
  roadmapToolsMode = false;
  roadmapGenerationMode = false;
  proposalToolsMode = false;
  proposalModelCalls = 0;
  proposalToolCalls = 0;
  roadmapGenerationId = undefined;
  for (const pending of pendingTools.values()) pending.reject(new Error('Pi session closed'));
  pendingTools.clear();
  session?.dispose();
  session = undefined;
  sessionConsumed = false;
  pausedChatTurn = undefined;
  resumeInProgress = false;
  chatRepeat = undefined;
  chatLoopStopped = false;
  chatLoopReason = 'Repeated unchanged project evidence stopped this Chat turn';
  rejectedRoadmapStages = new Map();
  compactionRecord = undefined;
  compactionRejected = false;
  compactionPending = undefined;
  workRecoveryAnchor = undefined;
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
      const thinkingLevel = message.thinkingLevel ?? (message.model.reasoning ? 'medium' : 'off');
      if (!(message.model.reasoning ? ['off', 'low', 'medium', 'high'].includes(thinkingLevel) :
        thinkingLevel === 'off')) throw new Error('Unsupported Pi thinking level');
      if (message.mode !== undefined && !['work', 'chat-tools'].includes(message.mode)) throw new Error('Invalid Pi mode');
      if (message.workProcessAvailable !== undefined &&
          (message.mode !== 'work' || typeof message.workProcessAvailable !== 'boolean'))
        throw new Error('Invalid Pi Work process availability');
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
            id: message.model.id, name: message.model.name, reasoning: message.model.reasoning,
            ...(message.model.compat ? { compat: message.model.compat } : {}), input: ['text'],
            cost: message.model.cost, contextWindow: message.model.contextWindow,
            maxTokens: message.model.maxTokens
          }]
        });
        workMode = message.mode === 'work';
        workProcessAvailable = message.workProcessAvailable !== false;
        chatToolsMode = message.mode === 'chat-tools';
        roadmapToolsMode = chatToolsMode && message.roadmapTools === true;
        roadmapGenerationMode = chatToolsMode && message.roadmapGeneration === true && !roadmapToolsMode;
        proposalToolsMode = chatToolsMode && message.proposalTools === true && !roadmapToolsMode && !roadmapGenerationMode;
        const chatToolNames = Object.keys(roadmapGenerationMode ? ROADMAP_GENERATION_TOOLS :
          roadmapToolsMode ? ROADMAP_TOOLS : proposalToolsMode ? PROPOSAL_TOOLS : CHAT_TOOLS);
        const result = await createAgentSession({
          cwd: message.cwd, agentDir: isolatedDir, model: message.model, modelRuntime,
          thinkingLevel,
          sessionManager: SessionManager.inMemory(message.cwd),
          settingsManager: SettingsManager.inMemory({ compaction: { enabled: true,
            reserveTokens: Math.min(8192, Math.floor(message.model.contextWindow / 4)),
            keepRecentTokens: Math.min(4096, Math.floor(message.model.contextWindow / 8)) },
            retry: { enabled: false } }),
          resourceLoader: emptyResources, tools: workMode ? Object.keys(WORK_TOOLS).filter(name =>
            name !== 'run_command' || workProcessAvailable) :
            chatToolsMode ? chatToolNames : [],
          noTools: 'all', customTools: workMode ? workTools() : chatToolsMode ? chatTools() : [],
          scopedModels: [{ model: message.model }]
        });
        session = result.session;
        sessionConsumed = false;
        const tools = session.getActiveToolNames();
        if (JSON.stringify(tools.slice().sort()) !== JSON.stringify((workMode ? Object.keys(WORK_TOOLS).filter(name =>
          name !== 'run_command' || workProcessAvailable) :
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
    case 'stop': {
      if (!pausedChatTurn || !session || pausedChatTurn.session !== session ||
          message.id !== pausedChatTurn.id || message.segmentIndex !== pausedChatTurn.segmentIndex)
        throw new Error('Pi continuation unavailable or stale');
      const segmentIndex = pausedChatTurn.segmentIndex;
      await dispose();
      return { stopped: true, segmentIndex };
    }
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
    case 'resume':
    case 'turn': {
      const resuming = message.type === 'resume';
      const paused = pausedChatTurn;
      if (resuming) {
        if (!paused || !session || paused.session !== session ||
            roadmapToolsMode || roadmapGenerationMode || workMode ||
            !Number.isSafeInteger(paused.id) || message.id !== paused.id ||
            message.segmentIndex !== paused.segmentIndex + 1 ||
            !Number.isSafeInteger(message.maxOutputTokens) || message.maxOutputTokens < 1 ||
            message.maxOutputTokens > session.model.maxTokens ||
            session.model.id !== paused.modelId || session.model.provider !== paused.provider ||
            session.messages.at(-1) !== paused.lastAssistant ||
            paused.lastAssistant.stopReason !== 'length' ||
            typeof session.prompt !== 'function' || !Array.isArray(session.messages) ||
            message.cancelled === true || message.signal?.aborted)
          throw new Error('Pi same-session continuation unavailable or stale');
        if (paused.segmentIndex >= 4 || paused.usage.outputTokens > 8192)
          throw new Error('Pi continuation segment budget exceeded');
        // Consume the resume decision before any asynchronous work so retries cannot replay effects.
        pausedChatTurn = undefined;
      } else if (pausedChatTurn) throw new Error('Pi output-limit turn requires a decision');
      compactionRecord = undefined;
      compactionRejected = false;
      compactionPending = undefined;
      if (workMode || !session || (!resuming && (!Array.isArray(message.messages) || !message.messages.length ||
          sessionConsumed ||
          message.messages.at(-1)?.role !== 'user' ||
          message.messages.some(item => !['system', 'user', 'assistant'].includes(item?.role) ||
            typeof item.content !== 'string') ||
          Buffer.byteLength(JSON.stringify(message.messages), 'utf8') > 512 * 1024)) ||
          !Number.isSafeInteger(message.maxOutputTokens) || message.maxOutputTokens < 1 ||
          message.maxOutputTokens > session.model.maxTokens)
        throw new Error('Invalid bounded Pi turn');
      sessionConsumed = true;
      if (roadmapGenerationMode && typeof message.generationId === 'string' &&
          /^[a-f0-9-]{36}$/iu.test(message.generationId)) {
        roadmapGenerationId = message.generationId;
        roadmapStartedAt = performance.now();
        roadmapTrace('pi-worker-turn-start');
      }
      if (!resuming) {
        chatRepeat = undefined;
        chatLoopStopped = false;
        chatLoopReason = 'Repeated unchanged project evidence stopped this Chat turn';
        proposalModelCalls = 0;
        proposalToolCalls = 0;
        rejectedRoadmapStages = new Map();
      }
      const zeroUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0,
        totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
      const systems = resuming ? '' : message.messages.filter(item => item.role === 'system').map(item => item.content).join('\n\n');
      if (systems) session.sessionManager.appendMessage({ role: 'system', content: systems, timestamp: Date.now() });
      for (const item of (resuming ? [] : message.messages.slice(0, -1)).filter(item => item.role !== 'system')) {
        session.sessionManager.appendMessage(item.role === 'user' ?
          { role: 'user', content: item.content, timestamp: Date.now() } :
          { role: 'assistant', content: [{ type: 'text', text: item.content }],
            api: 'openai-completions', provider: 'dope-local', model: session.model.id,
            usage: zeroUsage, stopReason: 'stop', timestamp: Date.now() });
      }
      if (!resuming) session.refreshContext();
      session.agent.state.model = { ...session.model, maxTokens: message.maxOutputTokens };
      let attemptedTool = false;
      let toolCount = resuming ? paused.toolCount : 0;
      let reportedInput = 0, reportedOutput = 0, reportedTotal = 0, reportedReasoning = 0;
      let lastCallOutputTokens;
      let usageUnknown = false;
      let modelDrift = false;
      let outputLimitCompactionSuppressed = false;
      let lengthContextOverflow = false;
      let firstProviderOutput = false;
      let lastProviderOutputAt = 0;
      let streamedAnswer = '';
      workRequestId = message.id;
      const unsubscribe = session.subscribe(event => {
        if (proposalToolsMode && event.type === 'turn_start' && ++proposalModelCalls > 256) {
          chatLoopStopped = true;
          chatLoopReason = 'Protected proposal model-call budget exceeded';
          void session.abort();
        }
        nativeCompactionOutcome(event);
        if (event.type === 'turn_end' && event.message?.role === 'assistant' &&
            ((event.message.responseModel ?? event.message.model) !== session.model.id ||
              event.message.provider !== session.model.provider)) {
          modelDrift = true;
          void session.abort();
        }
        if (!roadmapGenerationMode && !roadmapToolsMode && event.type === 'turn_end' &&
            event.message?.role === 'assistant' && event.message.stopReason === 'length') {
          const usage = event.message.usage;
          // Pi 1.4.0 otherwise treats a length stop below the model's original
          // maximum as recoverable and may omit the partial before retrying it.
          // A zero-output response with reported input filling the context is
          // instead Pi's context-overflow case and fails explicitly below.
          lengthContextOverflow = usage?.totalTokens > 0 && usage.output === 0 &&
            usage.input + usage.cacheRead >= session.model.contextWindow * 0.99;
          session.settingsManager.setCompactionEnabled(false);
          outputLimitCompactionSuppressed = true;
        }
        if (roadmapGenerationMode && event.type === 'message_update' &&
            ['thinking_delta', 'text_delta', 'toolcall_delta'].includes(event.assistantMessageEvent?.type) &&
            typeof event.assistantMessageEvent.delta === 'string' &&
            event.assistantMessageEvent.delta.length) {
          if (!firstProviderOutput) {
            firstProviderOutput = true;
            roadmapTrace('first-provider-output', { kind: event.assistantMessageEvent.type });
          }
          lastProviderOutputAt = performance.now();
        }
        if (roadmapGenerationMode && event.type === 'tool_execution_start')
          roadmapTrace('tool-call-start', { toolName: event.toolName });
        if (roadmapGenerationMode && event.type === 'tool_execution_end')
          roadmapTrace('tool-call-complete', { toolName: event.toolName, isError: event.isError === true });
        if (chatToolsMode && event.type === 'turn_end' && event.message?.role === 'assistant') {
          const usage = event.message.usage;
          lastCallOutputTokens = Number.isSafeInteger(usage?.output) && usage.output >= 0 ?
            usage.output : undefined;
          if (Number.isSafeInteger(usage?.totalTokens) && usage.totalTokens > 0) {
            reportedInput += Number.isSafeInteger(usage.input) ? usage.input : 0;
            reportedOutput += Number.isSafeInteger(usage.output) ? usage.output : 0;
            reportedTotal += usage.totalTokens;
            reportedReasoning += Number.isSafeInteger(usage.reasoning) ? usage.reasoning : 0;
            if (reportedTotal > 256_000) {
              chatLoopStopped = true;
              chatLoopReason = 'Roadmap generation reported token budget exceeded';
              void session.abort();
            }
          } else usageUnknown = true;
        }
        if (['turn_start', 'turn_end', 'message_start', 'message_end', 'tool_execution_start',
          'tool_execution_end', 'agent_end', 'agent_settled'].includes(event.type))
          trace(event.type, { toolName: event.toolName,
            stopReason: event.message?.role === 'assistant' ? event.message.stopReason : undefined,
            isError: event.isError });
        if (!resuming && !roadmapToolsMode && !roadmapGenerationMode &&
            event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta' &&
            typeof event.assistantMessageEvent.delta === 'string' && event.assistantMessageEvent.delta) {
          streamedAnswer += event.assistantMessageEvent.delta;
          message.emit?.({ type: 'delta', text: event.assistantMessageEvent.delta });
        }
        // A tool call means the current assistant message was not the final answer.
        // Clear that transient preview before the broker executes the tool.
        if (chatToolsMode && !resuming && event.type === 'tool_execution_start' && streamedAnswer) {
          streamedAnswer = '';
          message.emit?.({ type: 'reset' });
        }
        if (resuming && event.type === 'message_update' &&
            event.assistantMessageEvent?.type === 'text_delta' &&
            typeof event.assistantMessageEvent.delta === 'string' &&
            event.assistantMessageEvent.delta.length)
          message.emit?.({ type: 'activity', kind: 'provisional', text: event.assistantMessageEvent.delta });
        if (event.type === 'message_update' &&
            event.assistantMessageEvent?.type === 'thinking_delta' &&
            typeof event.assistantMessageEvent.delta === 'string')
          message.emit?.({ type: 'activity', kind: 'thinking', text: event.assistantMessageEvent.delta });
        if (roadmapGenerationMode && event.type === 'message_update' &&
            ['text_delta', 'toolcall_delta'].includes(event.assistantMessageEvent?.type) &&
            typeof event.assistantMessageEvent.delta === 'string' &&
            event.assistantMessageEvent.delta.length)
          message.emit?.({ type: 'activity', kind: 'provisional',
            text: event.assistantMessageEvent.type === 'toolcall_delta' ?
              'Roadmap tool arguments streaming' : 'Roadmap model output streaming' });
        if (!chatToolsMode && (event.type === 'message_update' && event.assistantMessageEvent?.type.startsWith('toolcall_') ||
            event.type === 'tool_execution_start')) {
          attemptedTool = true;
          void session.abort();
        }
        if (chatToolsMode && event.type === 'tool_execution_start' && ++toolCount > 16) {
          attemptedTool = true;
          void session.abort();
        }
      });
      try {
        if (resuming) resumeInProgress = true;
        if (resuming) session.settingsManager.setCompactionEnabled(false);
        await session.prompt(resuming ? continuationControl(paused.text, message.segmentIndex) :
          message.messages.at(-1).content, { expandPromptTemplates: false });
        if (resuming && message.signal?.aborted) throw new Error('Pi continuation cancelled');
        trace('session-prompt-returned', { toolCount });
      } catch (error) {
        if (chatLoopStopped) throw new Error(chatLoopReason);
        if (modelDrift) throw new Error('Pi continuation model drift');
        throw error;
      } finally {
        resumeInProgress = false;
        if (outputLimitCompactionSuppressed || resuming) session.settingsManager.setCompactionEnabled(true);
        roadmapTrace('pi-worker-turn-end', { providerOutputSeen: firstProviderOutput,
          lastProviderOutputElapsedMs: lastProviderOutputAt ?
            Math.round(lastProviderOutputAt - roadmapStartedAt) : undefined });
        unsubscribe(); workRequestId = undefined;
        roadmapGenerationId = undefined;
      }
      if (compactionRejected) throw new Error('Pi context cannot be compacted safely; shorten the turn');
      if (modelDrift) throw new Error('Pi continuation model drift');
      if (chatLoopStopped) throw new Error(chatLoopReason);
      if (lengthContextOverflow) throw new Error('Pi context overflow at length stop; shorten the turn');
      const assistant = [...session.messages].reverse().find(item => item.role === 'assistant');
      if (attemptedTool || !assistant || assistant.stopReason === 'error' || assistant.stopReason === 'aborted' ||
          (!['stop', 'length'].includes(assistant.stopReason) ||
            assistant.content.some(item => item.type === 'toolCall')))
        throw new Error('Local Pi completion failed or attempted a tool call');
      const text = assistant.content.filter(item => item.type === 'text').map(item => item.text).join('');
      const modelId = assistant.responseModel ?? assistant.model;
      if (modelId !== session.model.id || assistant.provider !== session.model.provider ||
          (resuming && modelId !== paused.modelId))
        throw new Error('Pi continuation model drift');
      const novelText = resuming ? novelAnswer(paused.text, text) : text;
      const accumulatedText = resuming ? paused.text + novelText : text;
      if (Buffer.byteLength(accumulatedText, 'utf8') > 65536) throw new Error('Local Pi output exceeded limit');
      if (resuming && assistant.stopReason === 'stop' && novelText)
        message.emit?.({ type: 'delta', text: novelText });
      else if (!resuming && !roadmapToolsMode && !roadmapGenerationMode &&
          assistant.stopReason === 'stop' && text !== streamedAnswer) {
        if (!text.startsWith(streamedAnswer)) {
          message.emit?.({ type: 'reset' });
          streamedAnswer = '';
        }
        if (text.slice(streamedAnswer.length))
          message.emit?.({ type: 'delta', text: text.slice(streamedAnswer.length) });
      }
      const measuredTurn = chatToolsMode;
      const segmentUsage = { inputTokens: measuredTurn ? usageUnknown || !reportedTotal ? undefined : reportedInput :
          assistant.usage?.totalTokens ? assistant.usage.input : undefined,
        outputTokens: measuredTurn ? usageUnknown || !reportedTotal ? undefined : reportedOutput :
          assistant.usage?.totalTokens ? assistant.usage.output : undefined,
        ...((measuredTurn ? reportedReasoning : assistant.usage?.reasoning) > 0 ?
          { reasoningTokens: measuredTurn ? reportedReasoning : assistant.usage.reasoning } : {}),
        totalTokens: measuredTurn ? usageUnknown || !reportedTotal ? undefined :
          reportedTotal :
          assistant.usage?.totalTokens || undefined,
        tokenMeasurement: measuredTurn ? usageUnknown || !reportedTotal ? 'unavailable' :
          'provider-reported' : assistant.usage?.totalTokens ? 'provider-reported' : 'unavailable' };
      const segments = resuming ? [...paused.segments, segmentUsage] : [segmentUsage];
      const usage = resuming ? combinedUsage(segments) : segmentUsage;
      if (assistant.stopReason === 'length' && !roadmapToolsMode && !roadmapGenerationMode)
        pausedChatTurn = { session, id: message.id, segmentIndex: resuming ? message.segmentIndex : 1,
          modelId, provider: session.model.provider, text: accumulatedText, usage, toolCount,
          segments, lastAssistant: assistant };
      return { text: accumulatedText, ...(resuming ? { novelText, segmentIndex: message.segmentIndex } :
        { segmentIndex: 1 }), modelId,
        finishReason: assistant.stopReason === 'length' ? 'length' : 'stop',
        ...(lastCallOutputTokens !== undefined ? { lastCallOutputTokens } : {}),
        usage, ...(!roadmapToolsMode && !roadmapGenerationMode ?
          { segmentUsage, usageSegments: segments } : {}),
        ...(compactionRecord ? { compaction: compactionRecord } : {}) };
    }
    case 'work': {
      compactionRecord = undefined;
      compactionRejected = false;
      compactionPending = undefined;
      if (!session || !workMode || sessionConsumed || typeof message.prompt !== 'string' || !message.prompt.trim() ||
          Buffer.byteLength(message.prompt, 'utf8') > 32_000) throw new Error('Invalid Pi Work turn');
      if (message.recoveryContext !== undefined &&
          (typeof message.recoveryContext !== 'string' ||
            !message.recoveryContext.startsWith('DOPE CHECKED TASK RECOVERY') ||
            Buffer.byteLength(message.recoveryContext, 'utf8') > 12_000))
        throw new Error('Invalid checked Work recovery context');
      workRecoveryAnchor = message.recoveryContext;
      sessionConsumed = true;
      workRequestId = message.id;
      let sequence = 0;
      let pendingReasoning = '';
      let reasoningChunks = 0;
      let reasoningOmitted = false;
      const emitWork = (kind, extra = {}) => {
        if (++sequence > 512) throw new Error('Pi Work event limit exceeded');
        message.emit?.({ type: 'work', sequence, kind, ...extra });
      };
      const emitReasoning = text => {
        if (!text || reasoningOmitted) return;
        if (reasoningChunks < 160) {
          reasoningChunks++;
          emitWork('reasoning', { text });
        } else {
          reasoningOmitted = true;
          emitWork('reasoning_omitted');
        }
      };
      const flushReasoning = () => {
        if (pendingReasoning) emitReasoning(pendingReasoning);
        pendingReasoning = '';
      };
      const unsubscribe = session.subscribe(event => {
        const outcome = nativeCompactionOutcome(event);
        if (outcome) {
          flushReasoning();
          emitWork(outcome.success ? 'compaction_succeeded' : 'compaction_failed', {
            reason: outcome.reason,
            ...(outcome.success ? { durationMs: outcome.durationMs,
              tokensBeforeEstimate: outcome.tokensBeforeEstimate,
              ...(outcome.tokensAfterEstimate !== undefined ?
                { tokensAfterEstimate: outcome.tokensAfterEstimate } : {}),
              summaryBytes: outcome.summaryBytes,
              ...(outcome.summarizationTokensReported !== undefined ?
                { summarizationTokensReported: outcome.summarizationTokensReported } : {}) } : {}) });
        }
        // Providers may send one character per delta. Bound captured text in
        // useful chunks, rather than exhausting the observation budget after
        // a few words, and flush before later lifecycle or tool events.
        if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'thinking_delta' &&
            typeof event.assistantMessageEvent.delta === 'string' && event.assistantMessageEvent.delta) {
          if (!reasoningOmitted) {
            pendingReasoning += event.assistantMessageEvent.delta;
            while (pendingReasoning.length >= 512 && !reasoningOmitted) {
              emitReasoning(pendingReasoning.slice(0, 512));
              pendingReasoning = pendingReasoning.slice(512);
            }
          }
        }
        if (['agent_start', 'turn_start', 'turn_end', 'agent_end', 'agent_settled'].includes(event.type)) {
          flushReasoning();
          emitWork(event.type, event.type === 'agent_settled' ? { aborted: event.aborted === true } : {});
        }
        if (event.type === 'tool_execution_start' || event.type === 'tool_execution_end') {
          flushReasoning();
          emitWork(event.type, { toolName: event.toolName,
            ...(event.type === 'tool_execution_end' ? { isError: event.isError === true } : {}) });
        }
      });
      try { await session.prompt(message.prompt, { expandPromptTemplates: false }); }
      finally { flushReasoning(); unsubscribe(); workRequestId = undefined; }
      if (compactionRejected) throw new Error('Pi Work context cannot be compacted safely; retry with a shorter task');
      const assistant = [...session.messages].reverse().find(item => item.role === 'assistant');
      if (!assistant || assistant.stopReason === 'error' || assistant.stopReason === 'aborted')
        throw new Error('Pi Work turn failed');
      const fullText = assistant.content.filter(item => item.type === 'text').map(item => item.text).join('');
      return { text: fullText.slice(0, 65536), textTruncated: fullText.length > 65536,
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

export function* frameStreamEvent(event) {
  if ((event.type !== 'delta' && event.type !== 'activity') || typeof event.text !== 'string') {
    yield event; return;
  }
  // The broker validates individual protocol frames. Split a large provider
  // delta into ordered frames instead of rejecting provider-delivered text.
  let chunk = '';
  let bytes = 0;
  for (const char of event.text) {
    const size = Buffer.byteLength(char, 'utf8');
    if (bytes + size > 8192) {
      yield { ...event, text: chunk };
      chunk = ''; bytes = 0;
    }
    chunk += char; bytes += size;
  }
  if (chunk || !event.text) yield { ...event, text: chunk };
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
    const data = await dispatch({ ...message, emit: event => {
      for (const frame of frameStreamEvent(event))
        process.stdout.write(`${JSON.stringify({ id, event: frame })}\n`);
    } });
    process.stdout.write(`${JSON.stringify({ id, ok: true, data })}\n`);
  } catch (error) {
    const safe = /cannot be compacted safely/.test(String(error?.message)) ?
      'Pi context cannot be compacted safely; shorten the task or select a larger loaded Local model' :
      ['open', 'complete', 'turn', 'resume', 'work'].includes(message?.type) ?
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
