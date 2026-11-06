/** Diagnostic stream data is deliberately outside conversational message content. */
export type ChatActivityKind = 'thinking' | 'provisional' | 'answer' | 'tool' | 'truncated';
export interface ChatActivityEvent {
    sequence: number;
    kind: ChatActivityKind;
    text: string;
}
export interface ChatExecutionActivity {
    schemaVersion: 1;
    chatId: string;
    messageId: string;
    executionId: string;
    events: ChatActivityEvent[];
    truncated: boolean;
    issue?: 'resource-limit' | 'persistence-failed' | 'interrupted' | 'provider-truncated';
}

const encoder = new TextEncoder();
const kinds: readonly ChatActivityKind[] = ['thinking', 'provisional', 'answer', 'tool', 'truncated'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sensitive = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|AKIA[A-Z0-9]{16})\b|\b(?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|authorization|password|secret|token)\s*[:=]\s*\S+|\bBearer\s+\S+/giu;
export function sanitizeChatDiagnosticText(text: string): string { return text.replace(sensitive, '[redacted]'); }
const toolEvent = /^(read_file|list_files|search_paths|search_text|run_command|dope_read|dope_list|dope_search_paths|dope_search_text|dope_command|roadmap_read|roadmap_stage|roadmap_cancel|roadmap_phase|roadmap_finish): (running|completed|failed|denied)(?: · (.+))?$/u;

/** Only bounded project-relative file paths may accompany diagnostic tool metadata. */
export function safeChatToolPath(value: unknown): string | undefined {
    if (typeof value !== 'string' || !value || value !== value.trim() || value.length > 160 ||
        encoder.encode(value).length > 512 || /^[\\/]|^[A-Za-z]:/u.test(value) ||
        value.includes('\\') || /[\x00-\x1f\x7f]/u.test(value) ||
        value.split('/').some(segment => segment === '..') ||
        value.replace(sensitive, '[redacted]') !== value) return undefined;
    return value;
}

export function parseExecutionActivity(value: unknown, chatId: string, messageId: string,
    executionId: string): ChatExecutionActivity {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Chat activity');
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some(key => !['schemaVersion', 'chatId', 'messageId', 'executionId', 'events', 'truncated', 'issue'].includes(key)) ||
        v.schemaVersion !== 1 || v.chatId !== chatId || v.messageId !== messageId ||
        v.executionId !== executionId || !uuid.test(chatId) || !uuid.test(messageId) || !uuid.test(executionId) ||
        !Array.isArray(v.events) || typeof v.truncated !== 'boolean' ||
        v.issue !== undefined && v.issue !== 'resource-limit' && v.issue !== 'persistence-failed' &&
        v.issue !== 'interrupted' && v.issue !== 'provider-truncated')
        throw new Error('Invalid Chat activity identity or bound');
    const events = v.events.map((item: unknown, index): ChatActivityEvent => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid Chat activity event');
        const event = item as Record<string, unknown>;
        const tool = event.kind === 'tool' && typeof event.text === 'string' ? toolEvent.exec(event.text) : null;
        if (Object.keys(event).some(key => !['sequence', 'kind', 'text'].includes(key)) ||
            event.sequence !== index + 1 || !kinds.includes(event.kind as ChatActivityKind) ||
            typeof event.text !== 'string' || encoder.encode(event.text).length > 8192 ||
            (event.kind === 'tool' && (!tool || tool[3] &&
                (!['read_file', 'list_files', 'dope_read', 'dope_list'].includes(tool[1]) ||
                    safeChatToolPath(tool[3]) !== tool[3]))) ||
            (event.kind === 'truncated' && event.text !== '[Activity truncated]'))
            throw new Error('Invalid Chat activity event');
        return { sequence: index + 1, kind: event.kind as ChatActivityKind, text: event.text as string };
    });
    if (Boolean(events.at(-1)?.kind === 'truncated') !== v.truncated ||
        events.some((event, index) => event.kind === 'truncated' && index !== events.length - 1))
        throw new Error('Invalid Chat activity limit');
    return { schemaVersion: 1, chatId, messageId, executionId, events, truncated: v.truncated,
        ...(v.issue ? { issue: v.issue as ChatExecutionActivity['issue'] } : {}) };
}

export class ChatActivityRecorder {
    private readonly events: ChatActivityEvent[] = [];
    private tail = '';
    constructor(private readonly chatId: string, private readonly messageId: string,
        private readonly executionId: string) {}

    eventsSince(index: number): readonly ChatActivityEvent[] { return this.events.slice(index); }

    add(kind: Exclude<ChatActivityKind, 'truncated'>, text: string): void {
        if (!text) return;
        if (kind !== 'tool') {
            const clean = sanitizeChatDiagnosticText(text);
            // A credential may be split across provider deltas. Keep only a short
            // sanitized suffix and suppress the new piece when it completes one.
            const crossed = sanitizeChatDiagnosticText(this.tail + text) !== this.tail + text;
            text = crossed && clean === text ? '[redacted]' : clean;
            this.tail = (this.tail + text).slice(-256);
        }
        let chunk = '', chunkBytes = 0;
        const push = () => {
            if (!chunk) return;
            this.events.push({ sequence: this.events.length + 1, kind, text: chunk });
            chunk = ''; chunkBytes = 0;
        };
        for (const char of text) {
            const codePoint = char.codePointAt(0)!;
            const size = codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
            if (chunkBytes + size > 8192) push();
            chunk += char; chunkBytes += size;
        }
        push();
    }

    snapshot(issue?: ChatExecutionActivity['issue']): ChatExecutionActivity {
        // Events are append-only. Avoid revalidating/copying the entire stream
        // while the provider is still generating; repository writes validate it.
        return { schemaVersion: 1, chatId: this.chatId, messageId: this.messageId,
            executionId: this.executionId, events: this.events.slice(), truncated: false,
            ...(issue ? { issue } : {}) };
    }
}
