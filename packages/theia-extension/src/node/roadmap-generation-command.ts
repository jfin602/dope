export type RoadmapGenerationCommand = { kind: 'none' | 'usage' } |
    { kind: 'ready'; body: string; origin: 'trusted-user-chat' };

/** Call only for a fresh user-authored Chat submission, before any inference. */
export function roadmapGenerationCommand(content: string): RoadmapGenerationCommand {
    const text = content.trim();
    if (text === '/gen-roadmap') return { kind: 'usage' };
    if (!text.startsWith('/gen-roadmap')) return { kind: 'none' };
    const separator = text['/gen-roadmap'.length];
    if (!separator || !/\s/u.test(separator)) return { kind: 'none' };
    const body = text.slice('/gen-roadmap'.length).trim();
    return body ? { kind: 'ready', body, origin: 'trusted-user-chat' } : { kind: 'usage' };
}
