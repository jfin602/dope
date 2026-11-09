const { accept } = await import(process.env.DOPE_PI_TEST_WORKER ??
  '../../packages/pi-runtime/worker.mjs');

const originalWrite = process.stdout.write.bind(process.stdout);
const frames = [];
let toolRequests = 0;
process.stdout.write = chunk => {
  const frame = JSON.parse(String(chunk));
  frames.push(frame);
  if (frame.tool) {
    toolRequests++;
    queueMicrotask(() => { void accept(JSON.stringify({ id: 100 + toolRequests,
      type: 'tool-result', requestId: frame.id, toolId: frame.tool.id,
      result: { status: process.env.DOPE_PI_TEST_STOP_AFTER === '6' && toolRequests === 1 ?
        'denied' : 'completed', output: `page ${toolRequests}` } })); });
  }
  return true;
};
const model = { id: 'offline-assessment', name: 'Offline Assessment',
  provider: 'dope-local', api: 'openai-completions', baseUrl: 'http://127.0.0.1:9/v1',
  reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 8192, maxTokens: 512 };
await accept(JSON.stringify({ id: 1, type: 'open', mode: 'chat-tools', assessmentTools: true,
  cwd: '/tmp', model }));
await accept(JSON.stringify({ id: 2, type: 'turn',
  messages: [{ role: 'user', content: 'Inspect Assessment pages.' }], maxOutputTokens: 512 }));
await accept(JSON.stringify({ id: 3, type: 'close' }));
process.stdout.write = originalWrite;
originalWrite(`${JSON.stringify({ frames, toolRequests })}\n`);
