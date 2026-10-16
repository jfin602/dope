// Qualification-only metadata probe for the owned backend's loopback model request.
// It records source markers and message sizes, never prompt or response bodies.
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
    const body = JSON.parse(init.body);
    const messages = body.messages.map((message, index) => {
        const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        return {
            index,
            role: message.role,
            chars: content.length,
            currentOwnerRevision: /(?:ownerRevision|owner revision)(?:["\s:]+)21\b/i.test(content),
            decisionRevision4: content.includes('Revision 4: final Key Rotation dependency and status decision.'),
            releaseCandidate: content.includes('Milestone Release Candidate'),
            integrationGate: content.includes('Milestone Integration Gate'),
            keyRotation: content.includes('Key Rotation'),
            blockedCanary: content.toLowerCase().includes('do not start the canary'),
            currentReleaseObjective: content.includes('Hold the release canary until Key Rotation credential rollover verification is Green'),
            fullBrief: content.includes('Source revisions 1–4 are represented below.')
                && content.includes('Revision 4: final Key Rotation dependency and status decision.'),
        };
    });
    write({ event: 'request', messages, maxTokens: body.max_tokens ?? body.max_completion_tokens });
    try {
        const response = await original(input, init);
        write({ event: 'response', status: response.status });
        return response;
    } catch (error) {
        write({ event: 'transport-error', name: error?.name ?? 'unknown' });
        throw error;
    }
};
