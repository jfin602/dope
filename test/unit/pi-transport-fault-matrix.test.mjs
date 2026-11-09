import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHash, randomUUID } from 'node:crypto';
import { PiRuntimeHost, PiWorkerFailure } from '../../packages/theia-extension/lib/node/pi-runtime-host.js';
import { classifyPiFailure } from '../../packages/theia-extension/lib/node/pi-conversation-runtime.js';
import { parseChatMessage } from '../../packages/chat/lib/index.js';
import { dispatch } from '../../packages/pi-runtime/worker.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
const sha256 = text => createHash('sha256').update(text).digest('hex');
function finishTurn(host, id, text = 'Done.') {
  host.acceptOutput(JSON.stringify({ id, event: { type: 'result_chunk', sequence: 1,
    offset: 0, text } }) + '\n');
  host.acceptOutput(JSON.stringify({ id, event: { type: 'result_end', sequence: 2,
    bytes: Buffer.byteLength(text, 'utf8'), sha256: sha256(text) } }) + '\n');
  host.acceptOutput(JSON.stringify({ id, ok: true, data: { text: '', segmentIndex: 1,
    modelId: 'fixture', finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' } } }) + '\n');
}

function fixture(ack = frame => ({ received: true, requestId: frame.requestId, toolId: frame.toolId })) {
  const host = new PiRuntimeHost('/unused');
  const frames = [];
  const child = { exitCode: null, killed: false, kill() { this.killed = true; },
    stdin: { writableLength: 0, write(line, callback) {
      const frame = JSON.parse(line);
      frames.push(frame);
      if (frame.type === 'tool-result' && ack) queueMicrotask(() => host.acceptOutput(JSON.stringify({
        id: frame.id, ok: true, data: ack(frame)
      }) + '\n'));
      callback?.();
      return true;
    } } };
  host.child = child;
  const turn = (broker = async () => ({ status: 'completed', output: 'ok' })) =>
    host.request({ type: 'turn' }, undefined, broker);
  const offer = (requestId, toolId, name = 'read_file', args = {}) =>
    host.acceptOutput(JSON.stringify({ id: requestId,
      tool: { id: toolId, name, arguments: args } }) + '\n');
  return { host, frames, child, turn, offer };
}

test('healthy consecutive replies, independent host sessions, and reversed broker completion keep exact IDs', async () => {
  const first = fixture();
  const second = fixture();
  try {
    let firstEffect = 0;
    const a = first.turn(async () => { firstEffect++; return { status: 'completed', output: 'ok' }; });
    const aId = first.frames[0].id;
    first.offer(aId, 1);
    await tick();
    first.offer(aId, 2, 'search_paths');
    await tick();
    assert.equal(firstEffect, 2);
    assert.deepEqual(first.frames.filter(frame => frame.type === 'tool-result').map(frame =>
      [frame.requestId, frame.toolId]), [[aId, 1], [aId, 2]]);
    assert.deepEqual([first.host.lastConfirmed.requestId, first.host.lastConfirmed.toolId], [aId, 2]);

    const b = second.turn();
    const bId = second.frames[0].id;
    second.offer(bId, 1);
    await tick();
    assert.deepEqual([second.host.lastConfirmed.requestId, second.host.lastConfirmed.toolId], [bId, 1]);
    assert.equal(first.host.lastConfirmed.toolId, 2);

    // Two broker promises resolve in reverse order, without swapping their receipts.
    const deferred = new Map();
    const ordered = fixture();
    try {
      const c = ordered.turn(call => new Promise(resolve => deferred.set(call.id, resolve)));
      const cId = ordered.frames[0].id;
      ordered.offer(cId, 1);
      ordered.offer(cId, 2);
      deferred.get(2)({ status: 'completed', output: 'two' });
      await tick();
      deferred.get(1)({ status: 'completed', output: 'one' });
      await tick();
      assert.deepEqual(ordered.frames.filter(frame => frame.type === 'tool-result').map(frame => frame.toolId), [2, 1]);
      assert.equal(ordered.host.activeTools.size, 0);
      finishTurn(ordered.host, cId);
      await c;
    } finally { ordered.host.dispose(); }
    finishTurn(first.host, aId);
    finishTurn(second.host, bId);
    await Promise.all([a, b]);
  } finally { first.host.dispose(); second.host.dispose(); }
});

test('two bundled Pi workers accept overlapping tool IDs without cross-session replay', async () => {
  const provider = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const messages = JSON.parse(body).messages ?? [];
    const afterTool = messages.some(item => item.role === 'tool');
    const base = { id: 'offline-fixture', object: 'chat.completion.chunk',
      created: 1, model: 'offline-fixture' };
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = choice => response.write(`data: ${JSON.stringify({ ...base, choices: [choice] })}\n\n`);
    if (afterTool) {
      send({ index: 0, delta: { role: 'assistant', content: 'Done.' }, finish_reason: null });
      send({ index: 0, delta: {}, finish_reason: 'stop' });
    } else {
      send({ index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0,
        id: 'call_local_1', type: 'function', function: { name: 'read_file',
          arguments: '{"path":"src/sample.js"}' } }] }, finish_reason: null });
      send({ index: 0, delta: {}, finish_reason: 'tool_calls' });
    }
    response.end('data: [DONE]\n\n');
  });
  provider.listen(0, '127.0.0.1');
  await once(provider, 'listening');
  const endpoint = `http://127.0.0.1:${provider.address().port}/v1`;
  const model = { id: 'offline-fixture', name: 'Offline Fixture', api: 'openai-completions',
    provider: 'dope-local', baseUrl: endpoint, reasoning: false, input: ['text'],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 4096, maxTokens: 512 };
  const hosts = [new PiRuntimeHost(), new PiRuntimeHost()];
  try {
    await Promise.all(hosts.map(host => host.start()));
    await Promise.all(hosts.map(host => host.openChatToolsSession(model, '/tmp')));
    const effects = [0, 0];
    const outcomes = await Promise.all(hosts.map((host, index) => Array.fromAsync(host.streamTurn([
      { role: 'user', content: 'Read the fixture source.' }
    ], 512, undefined, async call => {
      assert.equal(call.id, 1);
      assert.equal(call.name, 'read_file');
      effects[index]++;
      return { status: 'completed', output: 'fixture' };
    }))));
    assert.deepEqual(effects, [1, 1]);
    assert.deepEqual(hosts.map(host => host.lastConfirmed?.toolId), [1, 1]);
    assert.deepEqual(outcomes.map(events => events.at(-1)?.type), ['complete', 'complete']);
  } finally {
    hosts.forEach(host => host.dispose());
    provider.close();
  }
});

test('duplicate offer and conflicting replay never invoke the broker twice', async () => {
  for (const replayArgs of [{}, { changed: 'content' }]) {
    const f = fixture();
    try {
      let effects = 0;
      const pending = f.turn(async () => { effects++; return { status: 'completed', output: 'ok' }; });
      const id = f.frames[0].id;
      f.offer(id, 1);
      f.offer(id, 1, 'read_file', replayArgs);
      await assert.rejects(pending, error => error.code === 'tool_reply_duplicate' &&
        error.toolFailure?.brokerResultAcknowledged === false);
      assert.equal(effects, 1);
      assert.equal(f.host.activeTools.size, 0);
    } finally { f.host.dispose(); }
  }
});

test('wrong request, wrong acknowledgement tool, unmatched result and duplicate result fail closed', async () => {
  const wrongRequest = fixture();
  try {
    const turn = wrongRequest.turn();
    wrongRequest.offer(wrongRequest.frames[0].id + 100, 1);
    await assert.rejects(turn, error => error.code === 'tool_reply_unmatched');
  } finally { wrongRequest.host.dispose(); }
  const wrongTool = fixture(frame => ({ received: true, requestId: frame.requestId, toolId: frame.toolId + 1 }));
  try {
    const turn = wrongTool.turn();
    wrongTool.offer(wrongTool.frames[0].id, 1);
    await assert.rejects(turn, error => error.code === 'tool_reply_invalid' &&
      error.toolFailure?.brokerResultAcknowledged === false && !error.toolFailure?.lastConfirmed);
  } finally { wrongTool.host.dispose(); }
  await assert.rejects(dispatch({ type: 'tool-result', requestId: 999, toolId: 999,
    result: { status: 'completed', output: 'secret-source' } }),
  error => error.code === 'tool_reply_unmatched' && !String(error).includes('secret-source'));
  const duplicate = fixture();
  try {
    const turn = duplicate.turn();
    const id = duplicate.frames[0].id;
    duplicate.offer(id, 1);
    await tick();
    const replyId = duplicate.frames.find(frame => frame.type === 'tool-result').id;
    duplicate.host.acceptOutput(JSON.stringify({ id: replyId, ok: true, data: {} }) + '\n');
    await assert.rejects(turn, error => error.code === 'tool_reply_duplicate');
  } finally { duplicate.host.dispose(); }
});

test('invalid worker frame and invalid broker result have typed failures with no false confirmation', async () => {
  for (const [name, broker, expected] of [
    ['invalid name', undefined, 'model_tool_call_invalid'],
    ['invalid result', async () => ({ status: 'completed', output: { secret: 'source' } }), 'tool_reply_invalid']
  ]) {
    const f = fixture();
    try {
      const turn = f.turn(broker);
      f.offer(f.frames[0].id, 1, name === 'invalid name' ? 'unknown_tool' : 'read_file');
      await assert.rejects(turn, error => error.code === expected &&
        !error.toolFailure?.brokerResultAcknowledged && !String(error).includes('source'));
    } finally { f.host.dispose(); }
  }
});

test('broker denial and broker execution failure retain distinct statuses', async () => {
  for (const status of ['denied', 'failed']) {
    const f = fixture();
    try {
      const turn = f.turn(async () => ({ status, output: '' }));
      const id = f.frames[0].id;
      f.offer(id, 1);
      await tick();
      assert.equal(f.frames.find(frame => frame.type === 'tool-result').result.status, status);
      assert.equal(f.host.lastConfirmed.outcome, status);
      finishTurn(f.host, id);
      await turn;
    } finally { f.host.dispose(); }
  }
});

test('malformed result frames, wrong hash, missing end and mismatched completion fail closed', async () => {
  for (const fault of ['bad-offset', 'bad-hash', 'missing-end', 'wrong-id']) {
    const f = fixture();
    try {
      const turn = f.turn();
      const id = f.frames[0].id;
      f.host.acceptOutput(JSON.stringify({ id, event: { type: 'result_chunk', sequence: 1,
        offset: fault === 'bad-offset' ? 1 : 0, text: 'Done.' } }) + '\n');
      if (fault !== 'missing-end' && fault !== 'bad-offset')
        f.host.acceptOutput(JSON.stringify({ id, event: { type: 'result_end', sequence: 2,
          bytes: 5, sha256: fault === 'bad-hash' ? '0'.repeat(64) : sha256('Done.') } }) + '\n');
      if (fault !== 'bad-offset') f.host.acceptOutput(JSON.stringify({ id: fault === 'wrong-id' ? id + 1 : id,
        ok: true, data: { text: '', segmentIndex: 1, modelId: 'fixture',
          finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' } } }) + '\n');
      await assert.rejects(turn, error => error.code ===
        (fault === 'wrong-id' ? 'tool_reply_unmatched' : 'worker_protocol') &&
        error.toolFailure?.brokerResultAcknowledged === false, fault);
      assert.equal(f.host.lastConfirmed, undefined);
    } finally { f.host.dispose(); }
  }
});

test('offline provider success and seven failure paths retain bounded provenance and prior receipts', async () => {
  for (const scenario of ['success', 'http', 'connection', 'reported-network-error',
    'model-error', 'protocol-error', 'unknown-error',
    'broker-then-model-error']) {
    let calls = 0;
    const provider = createServer(async (request, response) => {
      for await (const _chunk of request) { /* Consume the offline request without storing content. */ }
      calls++;
      if (scenario === 'http') {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end('{"error":"private provider detail"}');
        return;
      }
      if (scenario === 'connection') { response.destroy(); return; }
      const base = { id: 'offline-fixture', object: 'chat.completion.chunk',
        created: 1, model: 'offline-fixture' };
      const send = (choice, usage) => response.write(`data: ${JSON.stringify({ ...base,
        choices: choice ? [choice] : [], ...(usage ? { usage } : {}) })}\n\n`);
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      if (scenario === 'unknown-error') {
        response.end('data: {not-json}\n\n');
      } else if (scenario === 'protocol-error') {
        response.end('data: [DONE]\n\n');
      } else if (scenario === 'broker-then-model-error' && calls === 1) {
        send({ index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0,
          id: 'call_local_1', type: 'function', function: { name: 'read_file',
            arguments: '{"path":"src/sample.js"}' } }] }, finish_reason: null });
        send({ index: 0, delta: {}, finish_reason: 'tool_calls' });
        send(null, { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
      } else {
        send({ index: 0, delta: { role: 'assistant', content: 'Done.' }, finish_reason: null });
        send({ index: 0, delta: {}, finish_reason: scenario === 'success' ? 'stop' :
          scenario === 'reported-network-error' ? 'network_error' : 'error' });
      }
      if (scenario !== 'unknown-error' && scenario !== 'protocol-error')
        response.end('data: [DONE]\n\n');
    });
    provider.listen(0, '127.0.0.1');
    await once(provider, 'listening');
    const model = { id: 'offline-fixture', name: 'Offline Fixture', api: 'openai-completions',
      provider: 'dope-local', baseUrl: `http://127.0.0.1:${provider.address().port}/v1`,
      reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0,
        cacheWrite: 0 }, contextWindow: 4096, maxTokens: 512 };
    const host = new PiRuntimeHost();
    let effects = 0;
    try {
      await host.start();
      await host.openChatToolsSession(model, '/tmp');
      const execute = async () => Array.fromAsync(host.streamTurn([
        { role: 'user', content: 'Inspect the fixture.' }
      ], 512, undefined, async () => { effects++; return { status: 'failed', output: '' }; }));
      if (scenario === 'success') {
        const events = await execute();
        assert.equal(events.at(-1)?.type, 'complete');
        assert.equal(events.at(-1)?.result.text, 'Done.');
      } else {
        await assert.rejects(execute(), error => {
          assert.equal(error.code, scenario === 'http' ? 'provider_http' :
            scenario === 'connection' ? 'provider_connection' : 'model_generation');
          assert.equal(error.toolFailure?.failureOrigin, 'provider_failure');
          assert.equal(error.toolFailure?.providerSubcause, scenario === 'http' ? 'http' :
            scenario === 'connection' || scenario === 'reported-network-error' ? 'connection_or_stream' :
            scenario === 'model-error' || scenario === 'protocol-error' ||
              scenario === 'broker-then-model-error' ?
                'model_response' : 'unknown');
          assert.equal(error.toolFailure?.modelCallStage,
            scenario === 'connection' ? 'request' : 'response_headers');
          assert.equal(error.toolFailure?.lastProviderResponseStatus,
            scenario === 'http' ? 503 : scenario === 'connection' ? undefined : 200);
          assert.equal(error.toolFailure?.httpStatus, scenario === 'http' ? 503 : undefined);
          assert.equal(error.toolFailure?.brokerResultAcknowledged, false);
          if (scenario === 'broker-then-model-error') {
            assert.equal(error.toolFailure.lastConfirmed?.outcome, 'failed');
            assert.equal(error.toolFailure.lastConfirmed?.toolId, 1);
            assert.equal(error.toolFailure.providerUsage?.[0]?.totalTokens, 15);
          } else assert.equal(error.toolFailure?.providerUsage, undefined);
          assert.ok(!JSON.stringify(error.toolFailure).includes('private provider detail'));
          return true;
        });
      }
      assert.equal(effects, scenario === 'broker-then-model-error' ? 1 : 0);
    } finally { host.dispose(); provider.close(); }
  }
});

test('adapter and saved Chat retain only validated provider diagnostics and reported prior usage', () => {
  const detail = { stage: 'model_generation', failureOrigin: 'provider_failure',
    providerSubcause: 'unknown', modelCallStage: 'response_headers',
    lastProviderResponseStatus: 200, brokerResultAcknowledged: false,
    lastConfirmed: { requestId: 2, toolId: 1, toolName: 'read_file', outcome: 'failed' },
    providerUsage: [{ call: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15 }] };
  const failure = classifyPiFailure(new PiWorkerFailure('model_generation', undefined, detail));
  assert.equal(failure.boundaryCode, 'model_generation');
  assert.equal(failure.toolFailure, detail);
  assert.match(failure.message, /underlying cause is unavailable/);
  const message = { schemaVersion: 1, id: randomUUID(), role: 'assistant',
    createdAt: new Date().toISOString(), content: '', execution: { schemaVersion: 1,
      id: randomUUID(), status: 'failed', selectedModel: { connectionId: 'local', modelId: 'fixture' },
      startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), failure: failure.message,
      failureCode: failure.boundaryCode, toolFailure: detail } };
  const saved = parseChatMessage(JSON.parse(JSON.stringify(message)));
  assert.deepEqual(saved.execution.toolFailure, detail);
  assert.equal(saved.execution.tokenUsage, undefined);
  for (const bad of [{ ...detail, providerUsage: [{ call: 1, totalTokens: 0 }] },
    { ...detail, providerSubcause: 'private provider detail' },
    { ...detail, lastProviderResponseStatus: 999 },
    { ...detail, providerUsage: [{ call: 1, totalTokens: 15, responseBody: 'secret' }] }])
    assert.throws(() => parseChatMessage({ ...message, execution: {
      ...message.execution, toolFailure: bad } }));
});

test('worker policy origin and counts survive host failure without upgrading an old ACK', async () => {
  const f = fixture();
  try {
    const turn = f.turn();
    const id = f.frames[0].id;
    f.offer(id, 1);
    await tick();
    f.host.acceptOutput(JSON.stringify({ id, ok: false, errorCode: 'resource_limit',
      failureOrigin: 'tool_budget', toolStarts: 17, toolAcknowledgements: 16,
      failedToolStart: { ordinal: 17, toolName: 'read_file' },
      lastToolReceipt: { requestId: id, toolId: 1, toolName: 'read_file', outcome: 'completed' } }) + '\n');
    await assert.rejects(turn, error => error.code === 'resource_limit' &&
      error.toolFailure?.failureOrigin === 'tool_budget' && error.toolFailure?.toolStarts === 17 &&
      error.toolFailure?.toolAcknowledgements === 16 &&
      error.toolFailure?.failedToolStart?.ordinal === 17 &&
      error.toolFailure?.lastConfirmed?.toolId === 1 &&
      error.toolFailure?.brokerResultAcknowledged === false);
  } finally { f.host.dispose(); }
});

test('worker frame rejects untrusted origin, counters and tool names', async () => {
  const f = fixture();
  try {
    const turn = f.turn();
    const id = f.frames[0].id;
    f.host.acceptOutput(JSON.stringify({ id, ok: false, errorCode: 'resource_limit',
      failureOrigin: 'secret-source', toolStarts: 2, toolAcknowledgements: 3,
      failedToolStart: { ordinal: 3, toolName: 'src/private.js' } }) + '\n');
    await assert.rejects(turn, error => error.code === 'resource_limit' &&
      error.toolFailure?.failureOrigin === undefined &&
      error.toolFailure?.toolAcknowledgements === undefined &&
      error.toolFailure?.failedToolStart === undefined &&
      !JSON.stringify(error.toolFailure).includes('private'));
  } finally { f.host.dispose(); }
});

test('delivery failure, worker exit, cancellation and late frames clean pending state', async () => {
  const delivery = fixture(null);
  try {
    const turn = delivery.turn();
    delivery.offer(delivery.frames[0].id, 1);
    await tick();
    delivery.host.fail(new PiWorkerFailure('tool_reply_delivery_failed'));
    await assert.rejects(turn, error => error.code === 'tool_reply_delivery_failed' &&
      !error.toolFailure?.brokerResultAcknowledged);
    assert.equal(delivery.host.activeTools.size, 0);
  } finally { delivery.host.dispose(); }
  const exit = fixture();
  try {
    const turn = exit.turn(async () => new Promise(() => {}));
    exit.offer(exit.frames[0].id, 1);
    exit.host.fail(new PiWorkerFailure('session_closed_with_pending_tool'));
    await assert.rejects(turn, error => error.code === 'session_closed_with_pending_tool');
    assert.equal(exit.host.activeTools.size, 0);
  } finally { exit.host.dispose(); }
  const cancelled = fixture();
  try {
    let release;
    const turn = cancelled.turn(() => new Promise(resolve => { release = resolve; }));
    const id = cancelled.frames[0].id;
    cancelled.offer(id, 1);
    cancelled.host.dispose();
    await assert.rejects(turn, /disposed/);
    release({ status: 'completed', output: 'late' });
    await tick();
    cancelled.offer(id, 2);
    assert.equal(cancelled.frames.filter(frame => frame.type === 'tool-result').length, 0);
    assert.equal(cancelled.host.activeTools.size, 0);
  } finally { cancelled.host.dispose(); }
});
