import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { PiRuntimeHost, PiWorkerFailure } from '../../packages/theia-extension/lib/node/pi-runtime-host.js';
import { dispatch } from '../../packages/pi-runtime/worker.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));

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
      ordered.host.acceptOutput(JSON.stringify({ id: cId, ok: true, data: { done: true } }) + '\n');
      await c;
    } finally { ordered.host.dispose(); }
    first.host.acceptOutput(JSON.stringify({ id: aId, ok: true, data: { done: true } }) + '\n');
    second.host.acceptOutput(JSON.stringify({ id: bId, ok: true, data: { done: true } }) + '\n');
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
      f.host.acceptOutput(JSON.stringify({ id, ok: true, data: { done: true } }) + '\n');
      await turn;
    } finally { f.host.dispose(); }
  }
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
