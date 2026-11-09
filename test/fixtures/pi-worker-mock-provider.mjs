// Isolated worker fixture: no listener, network, prompt logging or model dependency.
export const mockProvider = (stopAfter, completeAt, batchBoundary) => async (_url, options) => {
  const messages = JSON.parse(String(options?.body)).messages ?? [];
  const acknowledged = messages.filter(item => item.role === 'tool').length;
  if (stopAfter === 6 && acknowledged >= 6)
    return new Response('offline fixture', { status: 503 });
  if (completeAt !== undefined && acknowledged >= completeAt) {
    const base = { id: 'offline-assessment', object: 'chat.completion.chunk',
      created: 1, model: 'offline-assessment' };
    const choices = [{ index: 0, delta: { role: 'assistant', content: 'done' }, finish_reason: null },
      { index: 0, delta: {}, finish_reason: 'stop' }];
    return new Response(choices.map(choice => `data: ${JSON.stringify({ ...base, choices: [choice] })}\n\n`).join('') +
      'data: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }
  const next = acknowledged + 1;
  const boundary = batchBoundary ?? (stopAfter === 129 ? 128 : undefined);
  const batch = boundary === undefined ? 1 : Math.max(1, Math.min(5, boundary - acknowledged));
  const operations = Array.from({ length: batch }, (_, index) => {
    const ordinal = next + index;
    return stopAfter === 6 && ordinal === 2 ?
      { name: 'list_files', arguments: { path: '.' } } :
      stopAfter === 6 && ordinal === 3 ?
        { name: 'search_paths', arguments: { query: 'page' } } :
        { name: 'read_file', arguments: { path: `src/page-${ordinal}.js`, offset: 0 } };
  });
  const base = { id: 'offline-assessment', object: 'chat.completion.chunk',
    created: 1, model: 'offline-assessment' };
  const choices = [
    { index: 0, delta: { role: 'assistant', tool_calls: operations.map((operation, index) => ({ index,
      id: `call_local_${next + index}`, type: 'function', function: { name: operation.name,
        arguments: JSON.stringify(operation.arguments) } })) }, finish_reason: null },
    { index: 0, delta: {}, finish_reason: 'tool_calls' }
  ];
  const body = choices.map(choice => `data: ${JSON.stringify({ ...base, choices: [choice] })}\n\n`).join('') +
    'data: [DONE]\n\n';
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
};
if (process.env.DOPE_PI_TEST_STOP_AFTER)
  globalThis.fetch = mockProvider(Number(process.env.DOPE_PI_TEST_STOP_AFTER));
