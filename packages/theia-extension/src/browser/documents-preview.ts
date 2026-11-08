import URI from '@theia/core/lib/common/uri';
import { BinaryBuffer } from '@theia/core/lib/common/buffer';
import type { FileStatWithMetadata, ReadFileOptions } from '@theia/filesystem/lib/common/files';
import { renderUntrustedMessageMarkdown } from './untrusted-message-markdown';

export const DOCUMENT_PREVIEW_MAX_BYTES = 1_000_000;
export type DocumentFormat = 'md' | 'txt';

export interface DocumentPreviewFiles {
    resolve(uri: URI, options: { resolveMetadata: true }): Promise<FileStatWithMetadata>;
    readFile(uri: URI, options: ReadFileOptions): Promise<{ value: BinaryBuffer }>;
}

export function documentFormat(path: string): DocumentFormat | undefined {
    return /\.md$/iu.test(path) ? 'md' : /\.txt$/iu.test(path) ? 'txt' : undefined;
}

/** Relative and privileged URLs are never made live from project documents. */
export function safeDocumentLink(href: string): boolean {
    try {
        const url = new URL(href);
        return (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') &&
            !url.username && !url.password;
    } catch { return false; }
}

/** Read an exact project file, checking every segment again at selection time. */
export async function readDocumentPreview(files: DocumentPreviewFiles, root: URI, path: string): Promise<string> {
    const parts = path.split('/');
    if (root.scheme !== 'file' || !root.path.isAbsolute || !documentFormat(path) ||
        !parts.every(part => !!part && part !== '.' && part !== '..' &&
            !part.startsWith('.') && !/[\\/\p{Cc}\p{Cf}]/u.test(part)))
        throw new Error('Unsafe document path.');
    let current = root;
    const rootStat = await files.resolve(current, { resolveMetadata: true });
    if (!rootStat.isDirectory || rootStat.isSymbolicLink || rootStat.resource.toString() !== current.toString())
        throw new Error('Project folder unavailable or linked.');
    for (const [index, part] of parts.entries()) {
        current = current.resolve(part);
        const stat = await files.resolve(current, { resolveMetadata: true });
        if (stat.resource.toString() !== current.toString() || stat.isSymbolicLink ||
            (index === parts.length - 1 ? !stat.isFile : !stat.isDirectory))
            throw new Error('Document unavailable or linked.');
        if (index === parts.length - 1 && stat.size > DOCUMENT_PREVIEW_MAX_BYTES)
            throw new Error('Document is too large to preview.');
    }
    const result = await files.readFile(current, { limits: { size: DOCUMENT_PREVIEW_MAX_BYTES + 1 } });
    if (result.value.byteLength > DOCUMENT_PREVIEW_MAX_BYTES)
        throw new Error('Document is too large to preview.');
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(result.value.buffer); }
    catch { throw new Error('Document is not valid UTF-8 text.'); }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text))
        throw new Error('Document contains binary or control data.');
    return text;
}

export function renderDocumentPreview(format: DocumentFormat, text: string): HTMLElement {
    if (format === 'txt') {
        const pre = document.createElement('pre');
        pre.className = 'dope-documents-literal';
        pre.textContent = text;
        return pre;
    }
    const rendered = renderUntrustedMessageMarkdown(undefined!, text);
    rendered.classList.add('dope-documents-markdown');
    for (const link of rendered.querySelectorAll('a[href]')) {
        if (!safeDocumentLink(link.getAttribute('href')!)) link.removeAttribute('href');
    }
    return rendered;
}

export function renderDocumentSource(text: string): HTMLElement {
    const pre = document.createElement('pre');
    pre.className = 'dope-documents-source';
    pre.textContent = text;
    return pre;
}
