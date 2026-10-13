import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { opendir } from 'node:fs/promises';
import { phaseStackFolder, importPhaseStack } from '../sequence';
import { checkedTasksRoot, readStackSources } from './sequence-reconciliation';

export type TaskDiscoveryIssue = 'malformed' | 'one-off' | 'superseded' | 'missing' |
    'foreign' | 'ambiguous' | 'unsafe';
export interface RoadmapPromptSource {
    number: number; title: string; kind: 'implementation' | 'closeout';
    path: string; fingerprint: string; browserRequired: boolean;
    version: string;
}
export interface RoadmapTaskStack {
    folderName: string; path: string; mode?: 'phase' | 'correction'; phase?: number;
    fingerprint?: string; roadmapFamily?: 'pre-1.0' | 'post-1.0' | 'post-2.0';
    continuationSlice?: string; correctionSlug?: string;
    prompts: RoadmapPromptSource[]; executable: false;
    diagnostic?: { code: TaskDiscoveryIssue; message: string };
}

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const boundedMessage = (error: unknown): string =>
    (error instanceof Error ? error.message : 'Invalid task source').slice(0, 180);
async function boundedEntries(directory: string, limit: number): Promise<Dirent[]> {
    const entries: Dirent[] = [];
    for await (const entry of await opendir(directory)) {
        entries.push(entry);
        if (entries.length > limit) throw new Error('Task directory exceeds discovery limit.');
    }
    return entries;
}

/** Read-only project source inventory. Validity means runner/Work grammar parity, never permission to run. */
export async function discoverRoadmapTaskStacks(root: string, tasksRoot = 'docs/tasks',
    options: { expectedPaths?: readonly string[]; supersededFolders?: readonly string[] } = {}): Promise<RoadmapTaskStack[]> {
    const directory = await checkedTasksRoot(root, tasksRoot);
    const children = (await boundedEntries(directory.absolute, 256))
        .filter(entry => !entry.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    const result: RoadmapTaskStack[] = [];
    const seen = new Set<string>();
    for (const child of children) {
        const path = `${directory.relative}/${child.name}`;
        let info: ReturnType<typeof phaseStackFolder> | undefined;
        try { info = phaseStackFolder(child.name); } catch { /* one-off source or ordinary documentation */ }
        if (!info) {
            if (child.isFile() && child.name.toLowerCase().endsWith('.txt'))
                result.push({ folderName: child.name, path, prompts: [], executable: false,
                    diagnostic: { code: 'one-off', message: 'Loose task file is not a runner stack.' } });
            else if (child.isDirectory()) {
                const entries = (await boundedEntries(`${directory.absolute}/${child.name}`, 256))
                    .map(entry => entry.name);
                if (entries.some(name => /^P\d+.*\.txt$/u.test(name)))
                    result.push({ folderName: child.name, path, prompts: [], executable: false,
                        diagnostic: { code: 'one-off', message: 'Task folder does not use runner stack naming.' } });
            }
            continue;
        }
        seen.add(path);
        const summary: RoadmapTaskStack = { folderName: child.name, path,
            mode: info.mode, phase: info.phase, prompts: [], executable: false };
        if (!child.isDirectory() || child.isSymbolicLink()) {
            summary.diagnostic = { code: 'unsafe', message: 'Stack folder is not a safe directory.' };
        } else {
            try {
                const names = (await boundedEntries(`${directory.absolute}/${child.name}`, 256))
                    .map(entry => entry.name);
                if (!names.some(name => /^P\d+.*\.txt$/u.test(name)) &&
                    names.some(name => name.toLowerCase().endsWith('.txt'))) {
                    summary.diagnostic = { code: 'one-off', message: 'Folder contains one-off task files, not runner prompts.' };
                    result.push(summary);
                    continue;
                }
                if (names.some(name => name.toLowerCase().endsWith('.txt') &&
                    !/^P[1-9]\d*-[a-z0-9]+(?:-[a-z0-9]+)*\.txt$/u.test(name)))
                    throw new Error('Non-runner text file in stack.');
                const sources = await readStackSources(root, child.name, directory.relative);
                // Work's importer owns the same strict TASK, ordering, version and closeout rules as the runner.
                const stack = await importPhaseStack(child.name, sources, path);
                summary.fingerprint = stack.fingerprint;
                summary.roadmapFamily = stack.roadmapFamily;
                summary.continuationSlice = stack.continuationSlice;
                summary.correctionSlug = stack.correctionSlug;
                summary.prompts = stack.entries.map(entry => ({ number: entry.number,
                    title: entry.title, kind: entry.kind, path: `${path}/${entry.filename}`,
                    fingerprint: hash(entry.promptText), browserRequired: entry.browserRequired,
                    version: entry.versionPolicy.version }));
                if (options.supersededFolders?.includes(child.name))
                    summary.diagnostic = { code: 'superseded', message: 'Stack is superseded by project authority.' };
            } catch (error) {
                summary.diagnostic = { code: /unsafe|symbolic|oversized|inside the current project/i.test(boundedMessage(error))
                    ? 'unsafe' : 'malformed', message: boundedMessage(error) };
            }
        }
        result.push(summary);
    }
    if (result.length > 256) throw new Error('Too many task references.');
    for (const expected of options.expectedPaths ?? []) {
        if (seen.has(expected)) continue;
        const inRoot = expected.startsWith(`${directory.relative}/`) &&
            expected.slice(directory.relative.length + 1).match(/^[^/]+$/u);
        result.push({ folderName: expected.split('/').at(-1) ?? expected, path: expected,
            prompts: [], executable: false, diagnostic: { code: inRoot ? 'missing' : 'foreign',
                message: inRoot ? 'Linked stack source is missing.' : 'Linked stack is outside the configured task root.' } });
    }
    // pN and pNa both describe slice A; neither can be silently selected as active authority.
    const byPath = new Map(result.map(item => [item.path, item]));
    for (const item of result) {
        if (!/^p\d+$/u.test(item.folderName)) continue;
        const alias = byPath.get(`${directory.relative}/${item.folderName}a`);
        if (alias && !item.diagnostic && !alias.diagnostic) {
            const diagnostic = { code: 'ambiguous' as const,
                message: 'Base phase and slice A both exist; execution authority is ambiguous.' };
            item.diagnostic = diagnostic;
            alias.diagnostic = diagnostic;
        }
    }
    return result;
}
