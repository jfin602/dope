import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverRoadmapTaskStacks } from '@dope/agent-core/lib/node/roadmap-task-discovery.js';

/** Resolve a discovered prompt again at navigation time. This never executes a task. */
export async function resolveRoadmapPromptSource(root: string, path: string, fingerprint: string,
    discover: typeof discoverRoadmapTaskStacks = discoverRoadmapTaskStacks): Promise<string> {
    const broken = () => new Error('Prompt source changed or is unavailable. Refresh the Roadmap and relink the task source.');
    if (!isAbsolute(root) || resolve(root) !== root || await realpath(root).catch(() => '') !== root ||
        !/^docs\/tasks\/[a-z0-9-]+\/P[1-9]\d*-[a-z0-9]+(?:-[a-z0-9]+)*\.txt$/u.test(path) ||
        !/^[a-f0-9]{64}$/u.test(fingerprint)) throw broken();
    const absolute = join(root, path);
    if (!absolute.startsWith(`${root}${sep}`)) throw broken();
    let current = root;
    for (const part of path.split('/')) {
        current = join(current, part);
        const info = await lstat(current).catch(() => { throw broken(); });
        if (info.isSymbolicLink() || await realpath(current) !== current) throw broken();
        if (current === absolute ? !info.isFile() || info.size > 1_000_000 : !info.isDirectory()) throw broken();
    }
    const stackPath = path.slice(0, path.lastIndexOf('/'));
    const stacks = await discover(root).catch(() => { throw broken(); });
    const prompt = stacks.find(stack => stack.path === stackPath && !stack.diagnostic)?.prompts.find(item => item.path === path);
    if (!prompt || prompt.fingerprint !== fingerprint) throw broken();
    const bytes = await readFile(absolute).catch(() => { throw broken(); });
    if (createHash('sha256').update(bytes).digest('hex') !== fingerprint || await realpath(absolute) !== absolute) throw broken();
    return pathToFileURL(absolute).toString();
}
