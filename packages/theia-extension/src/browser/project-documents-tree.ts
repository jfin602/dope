import URI from '@theia/core/lib/common/uri';
import type { FileStat } from '@theia/filesystem/lib/common/files';

export const DOCUMENTS_FOLDER_LIMIT = 300;
const excluded = new Set(['.git', '.dope', '.theia', 'node_modules', 'dist', 'build', 'out', 'lib',
    'coverage', 'generated', 'vendor', '.next', '.cache', 'target']);

export interface ProjectDocumentEntry {
    path: string;
    name: string;
    directory: boolean;
}

export interface ProjectDocumentListing {
    entries: ProjectDocumentEntry[];
    excluded: number;
    truncated: boolean;
}

export interface DocumentFileLister {
    resolve(resource: URI): Promise<FileStat>;
}

/** Listing only. No document contents are read and no file operation is authorized here. */
export class ProjectDocumentsTree {
    constructor(private readonly files: DocumentFileLister, readonly root: URI) {
        if (root.scheme !== 'file' || !root.path.isAbsolute || root.path.toString().includes('\\'))
            throw new Error('Documents require one local project root');
    }

    async list(parent = ''): Promise<ProjectDocumentListing> {
        if (parent && !parent.split('/').every(safeSegment)) throw new Error('Unsafe document path');
        let current = this.root;
        const root = await this.files.resolve(current);
        if (!root.isDirectory || root.isSymbolicLink || root.resource.toString() !== current.toString())
            throw new Error('Project root is unavailable or linked');
        for (const segment of parent ? parent.split('/') : []) {
            current = current.resolve(segment);
            if (!withinRoot(this.root, current)) throw new Error('Document path escaped the project');
            const part = await this.files.resolve(current);
            if (!part.isDirectory || part.isSymbolicLink || part.resource.toString() !== current.toString())
                throw new Error('Document folder is unavailable or linked');
        }
        const stat = parent ? await this.files.resolve(current) : root;
        if (!stat.isDirectory || stat.isSymbolicLink || !stat.children)
            throw new Error('Document folder could not be listed');
        const entries: ProjectDocumentEntry[] = [];
        let excludedCount = 0;
        let truncated = false;
        for (const child of [...stat.children].sort((a, b) =>
            Number(b.isDirectory) - Number(a.isDirectory) || a.resource.path.base.localeCompare(b.resource.path.base))) {
            const name = child.resource.path.base;
            const path = parent ? `${parent}/${name}` : name;
            if (!safeSegment(name) || excluded.has(name) || name.startsWith('.') || child.isSymbolicLink ||
                !withinRoot(this.root, child.resource) || child.resource.toString() !== current.resolve(name).toString() ||
                !child.isDirectory && !(child.isFile && /\.(?:md|txt)$/iu.test(name))) {
                excludedCount++;
                continue;
            }
            if (entries.length === DOCUMENTS_FOLDER_LIMIT) { truncated = true; break; }
            entries.push({ path, name, directory: child.isDirectory });
        }
        return { entries, excluded: excludedCount, truncated };
    }
}

function safeSegment(name: string): boolean {
    return !!name && name !== '.' && name !== '..' && !/[\\/\p{Cc}\p{Cf}]/u.test(name);
}

function withinRoot(root: URI, target: URI): boolean {
    const base = root.path.toString().replace(/\/$/u, '');
    const path = target.path.toString();
    return target.scheme === root.scheme && target.authority === root.authority &&
        (path === base || path.startsWith(`${base}/`));
}
