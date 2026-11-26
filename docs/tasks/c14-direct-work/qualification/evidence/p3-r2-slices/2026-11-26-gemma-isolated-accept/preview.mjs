import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
const file = '/tmp/dope-p3-r2-gemma-isolated-1lSbRF/fixture/src/main.ts';
createServer((_request, response) => {
  const source = readFileSync(file, 'utf8');
  const headline = source.match(/^export const headline = '([A-Za-z ]+)';\n$/)?.[1] ?? 'INVALID HEADLINE';
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(`<!doctype html><title>Isolated fixture</title><h1>${headline}</h1>`);
}).listen(5178, '127.0.0.1');
