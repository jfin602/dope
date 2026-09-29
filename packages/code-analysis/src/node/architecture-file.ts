import { constants } from 'node:fs';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArchitectureJson } from '@dope/software-map';
import type { ArchitectureDeclaration } from '@dope/software-map';

const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

export async function canonicalLocalRoot(uri: string): Promise<string> {
    if (typeof uri !== 'string') throw new Error('Software Map requires a local folder');
    let url: URL;
    try { url = new URL(uri); } catch { throw new Error('Software Map requires a local folder'); }
    if (url.protocol !== 'file:' || url.host) throw new Error('Software Map requires a local folder');
    const root = await realpath(fileURLToPath(url));
    if (!(await stat(root)).isDirectory()) throw new Error('Software Map requires a folder');
    return root;
}

/** Read only: ordinary editing and Git own this canonical declaration. */
export async function readArchitecture(root: string): Promise<{ architecture: ArchitectureDeclaration; text?: string }> {
    const directory = join(root, '.dope');
    try {
        const info = await lstat(directory);
        if (info.isSymbolicLink() || !info.isDirectory() || await realpath(directory) !== directory) throw new Error(`Unsafe architecture directory: ${directory}`);
    } catch (error) {
        if (missing(error)) return { architecture: { schemaVersion: 1, systems: [] } };
        throw error;
    }
    const path = join(directory, 'architecture.json');
    try {
        const info = await lstat(path);
        if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Unsafe architecture file: ${path}`);
    } catch (error) {
        if (missing(error)) return { architecture: { schemaVersion: 1, systems: [] } };
        throw error;
    }
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        if (!(await handle.stat()).isFile()) throw new Error(`Unsafe architecture file: ${path}`);
        const text = await handle.readFile({ encoding: 'utf8' });
        if (await realpath(directory) !== directory) throw new Error(`Unsafe architecture directory: ${directory}`);
        return { architecture: parseArchitectureJson(text), text };
    } finally { await handle.close(); }
}
