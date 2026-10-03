import type { GoogleGenAI } from '@google/genai';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';

const DEFAULT_LOCAL_ENDPOINT = 'http://127.0.0.1:1234/v1';
export function normalizeSynthesisEndpoint(value = DEFAULT_LOCAL_ENDPOINT): string {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('Invalid synthesis endpoint'); }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password ||
        url.search || url.hash || !['/', '/v1', '/v1/'].includes(url.pathname)) throw new Error('Invalid synthesis endpoint');
    return `${url.origin}/v1`;
}

export function localModelIds(data: unknown): string[] {
    if (!data || typeof data !== 'object' || !Array.isArray((data as { data?: unknown }).data))
        throw new Error('Invalid synthesis model list');
    const ids = (data as { data: unknown[] }).data.map(entry => {
        const id = (entry as { id?: unknown } | null)?.id;
        if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid synthesis model list');
        return id;
    });
    return [...new Set(ids)];
}

export function count(value: unknown): number | undefined {
    return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : undefined;
}

export function sanitizedGeminiFailure(error: unknown, aborted: boolean, purpose = 'synthesis'): Error {
    if (aborted || (error as { name?: unknown } | null)?.name === 'AbortError' ||
        (error as { name?: unknown } | null)?.name === 'TimeoutError')
        return new ModelRuntimeFailure(`Gemini ${purpose} cancelled or timed out`, 'cancelled');
    const status = (error as { status?: unknown } | null)?.status;
    if (error instanceof Error && ['Invalid model capacity', 'Invalid readiness response'].includes(error.message)) return error;
    if (status === 401 || status === 403)
        return new ModelRuntimeFailure(`Gemini authentication failed (HTTP ${status})`, 'authentication');
    if (status === 429) return new ModelRuntimeFailure('Gemini quota or rate limit exceeded (HTTP 429)', 'nonretryable-provider');
    if (typeof status === 'number' && status >= 500 && status <= 599)
        return new ModelRuntimeFailure(`Gemini upstream service failed (HTTP ${status})`, 'transient-upstream');
    if (typeof status === 'number' && status >= 400)
        return new ModelRuntimeFailure(`Gemini request rejected (HTTP ${status})`, 'nonretryable-provider');
    if (error instanceof TypeError) return new ModelRuntimeFailure('Gemini SDK or transport type error', 'transient-transport');
    if (error instanceof SyntaxError) return new ModelRuntimeFailure('Gemini response JSON error', 'invalid-json');
    return new ModelRuntimeFailure(`Gemini ${purpose} request failed`, 'nonretryable-provider');
}

export async function discoverGeminiModels(client: GoogleGenAI, timeoutMs: number): Promise<string[]> {
    const pager = await client.models.list({ config: { httpOptions: { timeout: timeoutMs } } });
    const models: string[] = [];
    for await (const item of pager) {
        const id = item.name?.replace(/^models\//, '');
        if (id && /^gemini-/i.test(id) && !/(?:embedding|image|audio|tts|live|robotics|computer-use)/i.test(id) &&
            item.supportedActions?.includes('generateContent')) models.push(id);
    }
    return [...new Set(models)].sort();
}
