import { launchLocalSandboxedTool, LocalSandboxUnavailable } from '@dope/agent-core/lib/node/local-tool-sandbox';
import { lstat, realpath } from 'node:fs/promises';

const MAX_COMMAND_BYTES = 2048;
const MAX_RESULT_BYTES = 8192;
const READY = 'DOPE_CHAT_SANDBOX_READY\n';

/** Only the trusted root is passed to the launcher. The model text is parsed by a shell
 * after bwrap has installed the read-only mount, private tmpfs and socket filter. */
export interface ChatCommandResult { executed: boolean; output: string; truncated: boolean }
const denied = (output: string): ChatCommandResult => ({ executed: false, output, truncated: false });

export async function runChatInvestigationCommand(root: string, command: string,
    signal?: AbortSignal): Promise<ChatCommandResult> {
    if (signal?.aborted) return denied('Command cancelled; no result is available.');
    if (typeof command !== 'string' || !command.trim() ||
        Buffer.byteLength(command, 'utf8') > MAX_COMMAND_BYTES ||
        /[\x00-\x08\x0b-\x1f\x7f]/u.test(command))
        return denied('Command denied: invalid command text.');
    try {
        if (await realpath(root) !== root || !(await lstat(root)).isDirectory())
            return denied('Command denied: project root changed.');
        const result = await launchLocalSandboxedTool({ workspaceRoot: root, readOnlyWorkspace: true },
            ['/bin/sh', '-c', `printf '${READY.trim()}\\n'; exec /bin/sh -c "$1"`,
                'dope-chat', command], 15_000, signal);
        if (result.cancelled || signal?.aborted) return denied('Command cancelled; no result is available.');
        if (!result.stdout.startsWith(READY)) return denied('Command denied: OS sandbox unavailable.');
        const output = [result.stdout.slice(READY.length), result.stderr].filter(Boolean).join('\n');
        const bytes = Buffer.from(output, 'utf8');
        const truncated = bytes.length > MAX_RESULT_BYTES;
        const bounded = bytes.subarray(0, MAX_RESULT_BYTES).toString('utf8');
        return { executed: true, truncated,
            output: `Sandboxed command exited ${result.exitCode}${result.timedOut ? ' (time limit)' : ''}.` +
                `${truncated ? ' Output truncated.' : ''}\n${bounded}` };
    } catch (error) {
        if (signal?.aborted) return denied('Command cancelled; no result is available.');
        return denied(error instanceof LocalSandboxUnavailable ?
            'Command denied: OS sandbox unavailable.' : 'Command denied: sandbox failed.');
    }
}
