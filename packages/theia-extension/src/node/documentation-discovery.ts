import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';

const excluded = new Set(['.git', '.dope', '.theia', 'node_modules', 'dist', 'build', 'out', 'lib',
    'coverage', 'generated', 'vendor', '.next', '.cache', 'target']);
const privateName = (name: string) => name.startsWith('.') ||
    /^(?:secrets?|credentials?|private)(?:[._-]|$)/iu.test(name);
const ignore = new Set(['about', 'after', 'before', 'change', 'changes', 'could', 'decision', 'document',
    'documentation', 'docs', 'from', 'have', 'into', 'please', 'project', 'review', 'should', 'that',
    'their', 'there', 'these', 'this', 'with']);

export interface DocumentationDiscovery {
    enumerated: number;
    searched: number;
    omitted: string[];
    candidates: { path: string; line: number; heading: string; historical: boolean; score: number }[];
}

/** Explicit /docs-review only: bounded local inventory/search, never document-body prefill. */
export async function discoverDocumentation(root: string, objective: string): Promise<DocumentationDiscovery> {
    if (await realpath(root) !== root) throw new Error('Documentation project root changed');
    const words = [...new Set((objective.toLowerCase().match(/[a-z][a-z0-9-]{3,}/gu) ?? [])
        .filter(word => !ignore.has(word)))].slice(0, 16);
    const queue = [''];
    const candidates: DocumentationDiscovery['candidates'] = [];
    const omitted: string[] = [];
    let entries = 0, enumerated = 0, searched = 0, scannedBytes = 0;
    while (queue.length && entries < 20_000 && enumerated < 5_000 && scannedBytes < 32 * 1024 * 1024) {
        const parent = queue.shift()!;
        let children;
        try { children = await readdir(join(root, parent), { withFileTypes: true }); }
        catch { omitted.push(`Unreadable directory: ${parent || '.'}`); continue; }
        children.sort((a, b) => a.name.localeCompare(b.name));
        for (const child of children) {
            if (++entries > 20_000) break;
            if (excluded.has(child.name) || privateName(child.name) || child.isSymbolicLink() ||
                /[\p{Cc}\p{Cf}]/u.test(child.name)) continue;
            const path = parent ? `${parent}/${child.name}` : child.name;
            if (child.isDirectory()) { queue.push(path); continue; }
            if (!child.isFile() || !/\.(?:md|txt)$/iu.test(child.name)) continue;
            enumerated++;
            if (enumerated > 5_000) break;
            try {
                const file = join(root, path);
                const info = await lstat(file);
                if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('unsafe file');
                const length = Math.min(info.size, 128 * 1024, 32 * 1024 * 1024 - scannedBytes);
                const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
                let bytes: Buffer;
                try {
                    const opened = await handle.stat();
                    if (opened.dev !== info.dev || opened.ino !== info.ino || opened.size !== info.size)
                        throw new Error('changed file');
                    bytes = Buffer.alloc(length);
                    const read = await handle.read(bytes, 0, length, 0);
                    bytes = bytes.subarray(0, read.bytesRead);
                } finally { await handle.close(); }
                if (bytes.includes(0)) throw new Error('binary file');
                scannedBytes += bytes.length;
                searched++;
                if (info.size > bytes.length) omitted.push(`Search truncated: ${path}`);
                const text = bytes.toString('utf8');
                const lines = text.split(/\r?\n/u);
                const historical = /^(?:docs\/(?:history|archive|archives|tasks)\/|docs\/planning\/.*(?:archive|qualification)|.*(?:report|closeout|evidence)\.md$)/iu.test(path);
                let best = { score: words.filter(word => path.toLowerCase().includes(word)).length * 5,
                    line: 1, heading: lines.find(line => /^#{1,6}\s/u.test(line))?.slice(0, 160) ?? '' };
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const score = words.filter(word => line.toLowerCase().includes(word)).length *
                        (/^#{1,6}\s/u.test(line) ? 3 : 1);
                    if (score > best.score) best = { score, line: i + 1, heading: line.slice(0, 160) };
                }
                if (best.score > 0) candidates.push({ path, line: best.line, heading: best.heading,
                    historical, score: best.score });
            } catch { omitted.push(`Search skipped: ${path}`); }
        }
    }
    if (queue.length || entries >= 20_000 || enumerated >= 5_000 || scannedBytes >= 32 * 1024 * 1024)
        omitted.push('Inventory or search bound reached; remaining project documents were not examined');
    candidates.sort((a, b) => b.score - a.score || Number(a.historical) - Number(b.historical) ||
        a.path.localeCompare(b.path));
    return { enumerated, searched, omitted: omitted.slice(0, 30), candidates: candidates.slice(0, 32) };
}
