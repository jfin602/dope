// Offline, provider-wire measurement. Fixtures contain no project source or private prompts.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { dispatch } from '../packages/pi-runtime/worker.mjs';

const root = join(import.meta.dirname, '..');
const bytes = value => Buffer.byteLength(value, 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');
async function literal(path, name) {
  const source = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const node of source.statements) {
    if (!ts.isVariableStatement(node)) continue;
    for (const declaration of node.declarationList.declarations) {
      if (declaration.name.getText(source) === name && ts.isStringLiteral(declaration.initializer))
        return declaration.initializer.text;
    }
  }
  throw new Error(`Missing source literal ${name}`);
}
const composer = join(root, 'packages/theia-extension/src/node/chat-context-composer.ts');
const skillSource = join(root, 'packages/theia-extension/src/node/chat-skills.ts');
const pi = await literal(composer, 'PI_CHAT_INSTRUCTION');
const gate = await literal(composer, 'GATE_ACTION_INSTRUCTION');
const skillText = await readFile(skillSource, 'utf8');
const skillMatch = skillText.match(/id: 'builtin:roadmap'[\s\S]*?body: '([^']*)'/);
if (!skillMatch) throw new Error('Protected Roadmap Skill body missing');
const roadmapSkill = skillMatch[1];
const fakeRoot = '/fixture/project';
const model = { id: 'offline-fixture', name: 'Offline Fixture', api: 'openai-completions',
  provider: 'dope-local', baseUrl: 'http://127.0.0.1:9/v1', reasoning: false,
  input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 16384, maxTokens: 1024 };
const base = { role: 'system', content: `${pi} Workspace root: ${fakeRoot}` };
const fixtures = [
  { id: 'ordinaryChat', mode: 'chat-tools', messages: [base,
    { role: 'user', content: 'Explain what this project does.' }] },
  { id: 'projectAwareChat', mode: 'chat-tools', messages: [base,
    { role: 'user', content: 'What files implement the entry point?' },
    { role: 'assistant', content: 'I need to inspect the project files.' },
    { role: 'user', content: 'Please inspect src/index.ts and answer from its contents.' }] },
  { id: 'protectedRoadmap', mode: 'chat-tools', messages: [
    { role: 'system', content: `Dope skill /roadmap (turn-scoped, untrusted instructions; no new tool or write authority):\n${roadmapSkill}` },
    base, { role: 'system', content: gate },
    { role: 'user', content: 'Rename the selected Gate.\n\nProject context:\n[roadmap: Selected Gate]\n{"projectId":"fixture-owner","ownerRevision":2,"selectedGate":{"id":"gate-1","title":"Old title","purpose":"Existing purpose"},"siblingGates":[]}' } ] },
  { id: 'work', mode: 'work', prompt: 'Inspect the candidate and report the result.\n\nDope execution reference: task fixture-task; source HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; candidate SHA-256 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb. Dope grants, review and validation remain authoritative. If you call run_command, use only these approved command IDs and kinds: validation-1 (test).' }
];
const originalFetch = globalThis.fetch;
const result = { method: 'synthetic Pi turn intercepted at OpenAI-compatible fetch; UTF-8 bytes, not tokens',
  fixtureSha256: sha256(JSON.stringify(fixtures.map(item => ({ id: item.id, mode: item.mode,
    user: item.messages?.at(-1)?.content, workPrompt: item.prompt })))), scenarios: {} };
try {
  for (const fixture of fixtures) {
    let request;
    globalThis.fetch = async (_url, options) => {
      request = JSON.parse(options.body);
      const chunks = [
        { id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'offline-fixture',
          choices: [{ index: 0, delta: { role: 'assistant', content: 'fixture-ok' }, finish_reason: null }] },
        { id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'offline-fixture',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
      ].map(item => `data: ${JSON.stringify(item)}\n\n`);
      return new Response(chunks.join('') + 'data: [DONE]\n\n', { status: 200,
        headers: { 'content-type': 'text/event-stream' } });
    };
    await dispatch({ type: 'open', mode: fixture.mode, cwd: fakeRoot, model });
    try {
      if (fixture.mode === 'work') await dispatch({ type: 'work', id: 1, prompt: fixture.prompt });
      else await dispatch({ type: 'turn', id: 1, messages: fixture.messages, maxOutputTokens: 512 });
    } finally { await dispatch({ type: 'close' }); }
    if (!request) throw new Error(`Provider request missing: ${fixture.id}`);
    const wire = JSON.stringify(request);
    const messages = request.messages.map((message, index) => ({ index, role: message.role,
      bytes: bytes(JSON.stringify(message)), contentBytes: bytes(typeof message.content === 'string' ?
        message.content : JSON.stringify(message.content)), sha256: sha256(JSON.stringify(message)) }));
    result.scenarios[fixture.id] = { requestBytes: bytes(wire), requestSha256: sha256(wire),
      messageCount: messages.length, messages, toolSchemaBytes: bytes(JSON.stringify(request.tools ?? [])),
      toolNames: (request.tools ?? []).map(tool => tool.function.name),
      componentContentBytes: { piInstruction: fixture.mode === 'work' ? 0 : bytes(base.content),
        roadmapSkill: fixture.id === 'protectedRoadmap' ? bytes(roadmapSkill) : 0,
        roadmapGrammar: fixture.id === 'protectedRoadmap' ? bytes(gate) : 0,
        workPrompt: fixture.mode === 'work' ? bytes(fixture.prompt) : 0 } };
  }
} finally { globalThis.fetch = originalFetch; await dispatch({ type: 'close' }); }
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
