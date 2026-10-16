// Read-only qualification meter for the owned Dope backend. It records no request or response bodies.
import { appendFileSync } from 'node:fs';

const log = process.env.DOPE_R5_REQUEST_LOG;
if (!log) throw new Error('DOPE_R5_REQUEST_LOG is required');
const original = globalThis.fetch;
let sequence = 0;
globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!/^http:\/\/127\.0\.0\.1:1234\/v1\/chat\/completions$/.test(url))
        return original(input, init);
    const id = ++sequence;
    const start = Date.now();
    const write = event => appendFileSync(log, JSON.stringify({ id, pid: process.pid,
        at: new Date().toISOString(), elapsedMs: Date.now() - start, ...event }) + '\n');
    write({ event: 'request' });
    try {
        const response = await original(input, init);
        write({ event: 'response', status: response.status });
        return response;
    } catch (error) {
        write({ event: 'transport-error', name: error?.name ?? 'unknown' });
        throw error;
    }
};
