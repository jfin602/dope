import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentExecutionRequest } from '@dope/agent-core/lib/execution';
import type { LocalToolRequest } from '@dope/agent-core/lib/node/local-tool-contracts';
import type { LocalTurnLoopBroker } from './local-agent-turn-loop';

const MAX_INSTRUCTIONS_BYTES = 24_000;

/** The isolated Pi loader returns no AGENTS files. Read only applicable files through the
 * same candidate broker and grant as a model read; never infer loading from file existence. */
export class WorkAgentsRouting {
    private readonly checked = new Set<string>();
    private readonly supplied = new Set<string>();
    private bytes = 0;

    constructor(private readonly request: AgentExecutionRequest, private readonly broker: LocalTurnLoopBroker) {}

    invalidate(path: string): void {
        if (path === 'AGENTS.md' || path.endsWith('/AGENTS.md')) {
            this.checked.delete(path);
            this.supplied.delete(path);
        }
    }

    private scopes(path: string, directory: boolean): string[] {
        if (path === '.') return ['AGENTS.md'];
        const parts = path.split('/');
        if (parts.some(part => !part || part === '.' || part === '..'))
            throw new Error('AGENTS routing requires a safe working path');
        const directories = directory ? parts : parts.slice(0, -1);
        return ['AGENTS.md', ...directories.map((_, index) =>
            `${directories.slice(0, index + 1).join('/')}/AGENTS.md`)];
    }

    async route(path: string, context: string, signal: AbortSignal, directory = false): Promise<string> {
        const additions: string[] = [];
        for (const file of this.scopes(path, directory)) {
            if (this.checked.has(file)) continue;
            await this.broker.assertActive();
            let stat;
            try { stat = await lstat(join(this.request.executionRoot, file)); }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                    this.checked.add(file);
                    continue;
                }
                throw new Error(`Applicable ${file} cannot be inspected`);
            }
            if (!stat.isFile() || stat.isSymbolicLink())
                throw new Error(`Applicable ${file} is not a regular file`);
            if (stat.size > MAX_INSTRUCTIONS_BYTES - this.bytes)
                throw new Error(`Applicable ${file} exceeds the bounded AGENTS instruction budget`);
            let offset = 0;
            let hash: string | undefined;
            let body = '';
            do {
                const call: LocalToolRequest = { id: 'agents-route', name: 'read', arguments: {
                    path: file, maxBytes: 4096, offset,
                    ...(hash ? { expectedSourceHash: hash } : {}) } };
                const result = await this.broker.execute(call, signal);
                if (result.status !== 'completed')
                    throw new Error(`Applicable ${file} could not be read through the authorized Work broker (${result.status})`);
                const page = JSON.parse(result.output) as { text: string; sourceHash: string;
                    nextOffset: number | null; fileBytes: number };
                if (!/^[a-f0-9]{64}$/u.test(page.sourceHash) || hash && hash !== page.sourceHash ||
                    page.fileBytes > MAX_INSTRUCTIONS_BYTES - this.bytes ||
                    page.nextOffset !== null && page.nextOffset <= offset)
                    throw new Error(`Applicable ${file} changed or exceeded the bounded AGENTS instruction budget`);
                hash = page.sourceHash;
                body += page.text;
                offset = page.nextOffset ?? page.fileBytes;
                if (page.nextOffset === null) break;
            } while (true);
            this.checked.add(file);
            this.bytes += Buffer.byteLength(body, 'utf8');
            const alreadyPresent = body.length === 0 || context.includes(body) || this.supplied.has(file);
            this.request.onEvent({ kind: 'provider-event',
                summary: `AGENTS ${file}: ${alreadyPresent ? 'verified already present' : 'Dope brokered read'}; source ${hash}; routing bytes ${Buffer.byteLength(body, 'utf8')}` });
            if (!alreadyPresent) {
                additions.push(`Applicable project instructions (${file}; scope ${file === 'AGENTS.md' ? 'project root' : file.slice(0, -'/AGENTS.md'.length)}; broker source ${hash}):\n${body}`);
                this.supplied.add(file);
            }
        }
        return additions.join('\n\n');
    }
}
