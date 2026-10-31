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
}

const MAX_TEXT_BYTES = 128 * 1024;
const MAX_EVENTS = 512;
const encoder = new TextEncoder();
const kinds: readonly ChatActivityKind[] = ['thinking', 'provisional', 'answer', 'tool', 'truncated'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sensitive = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|AKIA[A-Z0-9]{16})\b|\b(?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|authorization|password|secret|token)\s*[:=]\s*\S+|\bBearer\s+\S+/giu;

export function parseExecutionActivity(value: unknown, chatId: string, messageId: string,
    executionId: string): ChatExecutionActivity {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Chat activity');
    const v = value as Record<string, unknown>;
    if (Object.keys(v).some(key => !['schemaVersion', 'chatId', 'messageId', 'executionId', 'events', 'truncated'].includes(key)) ||
        v.schemaVersion !== 1 || v.chatId !== chatId || v.messageId !== messageId ||
        v.executionId !== executionId || !uuid.test(chatId) || !uuid.test(messageId) || !uuid.test(executionId) ||
        !Array.isArray(v.events) || v.events.length > MAX_EVENTS || typeof v.truncated !== 'boolean')
        throw new Error('Invalid Chat activity identity or bound');
    let bytes = 0;
    const events = v.events.map((item: unknown, index): ChatActivityEvent => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid Chat activity event');
        const event = item as Record<string, unknown>;
        if (Object.keys(event).some(key => !['sequence', 'kind', 'text'].includes(key)) ||
            event.sequence !== index + 1 || !kinds.includes(event.kind as ChatActivityKind) ||
            typeof event.text !== 'string' || encoder.encode(event.text).length > 8192 ||
            (event.kind === 'tool' && !/^(read_file|list_files|search_paths|search_text|run_command|dope_read|dope_list|dope_search_paths|dope_search_text|dope_command): (running|completed|failed|denied)$/.test(event.text)) ||
            (event.kind === 'truncated' && event.text !== '[Activity truncated]'))
            throw new Error('Invalid Chat activity event');
        bytes += encoder.encode(event.text).length;
        return { sequence: index + 1, kind: event.kind as ChatActivityKind, text: event.text as string };
    });
    if (bytes > MAX_TEXT_BYTES || Boolean(events.at(-1)?.kind === 'truncated') !== v.truncated ||
        events.some((event, index) => event.kind === 'truncated' && index !== events.length - 1))
        throw new Error('Invalid Chat activity limit');
    return { schemaVersion: 1, chatId, messageId, executionId, events, truncated: v.truncated };
}

export class ChatActivityRecorder {
    private readonly events: ChatActivityEvent[] = [];
    private bytes = 0;
    private truncated = false;
    private tail = '';
    constructor(private readonly chatId: string, private readonly messageId: string,
        private readonly executionId: string) {}

    eventsSince(index: number): readonly ChatActivityEvent[] { return this.events.slice(index); }

    add(kind: Exclude<ChatActivityKind, 'truncated'>, text: string): void {
        if (this.truncated || !text) return;
        if (kind !== 'tool') {
            const clean = text.replace(sensitive, '[redacted]');
            // A credential may be split across provider deltas. Keep only a short
            // sanitized suffix and suppress the new piece when it completes one.
            const crossed = (this.tail + text).replace(sensitive, '[redacted]') !== this.tail + text;
            text = crossed && clean === text ? '[redacted]' : clean;
            this.tail = (this.tail + text).slice(-256);
        }
        let chunk = '', chunkBytes = 0;
        const push = () => {
            if (!chunk) return;
            this.events.push({ sequence: this.events.length + 1, kind, text: chunk });
            this.bytes += chunkBytes;
            chunk = ''; chunkBytes = 0;
        };
        for (const char of text) {
            const size = encoder.encode(char).length;
            if (chunkBytes + size > 8192) push();
            if (this.events.length >= MAX_EVENTS - 1 ||
                this.bytes + chunkBytes + size + encoder.encode('[Activity truncated]').length > MAX_TEXT_BYTES) {
                push(); this.markTruncated(); return;
            }
            chunk += char; chunkBytes += size;
        }
        push();
    }

    private markTruncated(): void {
        this.truncated = true;
        this.events.push({ sequence: this.events.length + 1, kind: 'truncated', text: '[Activity truncated]' });
    }

    snapshot(): ChatExecutionActivity {
        return parseExecutionActivity({ schemaVersion: 1, chatId: this.chatId, messageId: this.messageId,
            executionId: this.executionId, events: this.events, truncated: this.truncated },
            this.chatId, this.messageId, this.executionId);
    }
}
