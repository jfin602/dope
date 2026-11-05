import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { ChatDocumentationProposal } from '@dope/chat';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';

const digest = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const maxFile = 16_384;
const maxSet = 12_000;

async function worktreeIdentity(root: string): Promise<string> {
    const directory = await stat(root);
    let control = 'none';
    try {
        const git = await lstat(join(root, '.git'));
        if (git.isSymbolicLink() || !(git.isDirectory() || git.isFile())) throw new Error('Unsafe Git worktree control');
        control = `${git.dev}:${git.ino}:${git.isDirectory() ? 'directory' : 'file'}`;
    } catch (error) { if (!absent(error)) throw error; }
    return digest(`${root}\n${directory.dev}:${directory.ino}\n${control}`);
}

export interface DocumentationReviewChange { path: string; after: string }
export interface DocumentationReviewRequest {
    root: string; chatId: string; messageId: string; ownerId: string; leaseToken: string;
    changes: DocumentationReviewChange[];
}

export function eligibleDocumentationPath(path: string): void {
    if (!path || path.length > 512 || isAbsolute(path) || path.includes('\\') || path.includes(':') ||
        /[\p{Cc}\p{Cf}]/u.test(path) || !/\.(?:md|txt)$/iu.test(path) ||
        path.split('/').some(part => !part || part === '.' || part === '..' || part.trim() !== part || part.endsWith('.')) ||
        path.split('/').some(part => ['.git', '.dope', 'node_modules', 'dist', 'build', 'out', 'lib', 'coverage',
            'generated', 'qualification', 'archive', 'draft', 'drafts', 'vendor', '.next', '.cache'].includes(part.toLowerCase()) ||
            part.startsWith('.') || /^(?:secrets?|credentials?|private)(?:[._-]|$)/iu.test(part) ||
            /(?:^|[._-])(?:generated|draft|archive)(?:[._-]|$)/iu.test(part)) ||
        /(?:^|\/)(?:AGENTS|BOOT|SKILL)\.md$/iu.test(path) ||
        /(?:^|\/)(?:P\d+(?:-[^/]*)?\.txt|.*(?:report|closeout|evidence)\.md)$/iu.test(path) ||
        path.toLowerCase().startsWith('docs/tasks/')) throw new Error('Documentation target is protected or ineligible');
}
const eligible = eligibleDocumentationPath;

function textBytes(value: string, label: string): Buffer {
    if (typeof value !== 'string' || !value || /\x00/u.test(value) || /[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(value))
        throw new Error(`${label} is empty or not supported text`);
    const bytes = Buffer.from(value, 'utf8');
    if (bytes.toString('utf8') !== value) throw new Error(`${label} is not lossless UTF-8 text`);
    if (bytes.length > maxFile) throw new Error(`${label} exceeds the review limit`);
    return bytes;
}

function reviewDiff(path: string, before: string | null, after: string): string {
    return `--- a/${path}\n+++ b/${path}\n` +
        `@@ reviewed full text @@\n${(before ?? '').split('\n').map(line => `-${line}`).join('\n')}\n` +
        `${after.split('\n').map(line => `+${line}`).join('\n')}\n`;
}

/** Inspect without making a destination or its parent. Apply must repeat all checks. */
export async function readDocumentationBasis(root: string, path: string): Promise<{ before: string | null; beforeHash: string | null }> {
    await checkedDocumentationParent(root, path);
    const file = join(root, path);
    let info;
    try { info = await lstat(file); }
    catch (error) { if (absent(error)) return { before: null, beforeHash: null }; throw error; }
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > maxFile)
        throw new Error('Unsafe documentation source');
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino || opened.size > maxFile)
            throw new Error('Documentation source changed during review');
        const bytes = await handle.readFile();
        const atPath = await lstat(file);
        if (atPath.dev !== info.dev || atPath.ino !== info.ino || bytes.length > maxFile)
            throw new Error('Documentation source changed during review');
        const before = bytes.toString('utf8');
        if (Buffer.compare(Buffer.from(before, 'utf8'), bytes) || /\x00/u.test(before) ||
            /[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(before)) throw new Error('Binary documentation source');
        return { before, beforeHash: digest(bytes) };
    } finally { await handle.close(); }
}

export async function checkedDocumentationParent(root: string, path: string): Promise<string> {
    eligible(path);
    if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
        throw new Error('Documentation project root changed');
    let parent = root;
    for (const part of path.split('/').slice(0, -1)) {
        parent = join(parent, part);
        const info = await lstat(parent);
        if (!info.isDirectory() || info.isSymbolicLink() || await realpath(parent) !== parent)
            throw new Error('Unsafe documentation parent');
    }
    return parent;
}

export async function prepareDocumentationReview(store: RoadmapStore, request: DocumentationReviewRequest): Promise<ChatDocumentationProposal> {
    const { root, chatId, messageId, ownerId, leaseToken, changes } = request;
    if (typeof ownerId !== 'string' || !ownerId.trim() || ownerId.length > 128 || /[\p{Cc}\p{Cf}]/u.test(ownerId))
        throw new Error('Current documentation owner is invalid');
    if (!Array.isArray(changes) || !changes.length || changes.length > 4 ||
        changes.some(change => !change || typeof change.path !== 'string') ||
        new Set(changes.map(change => change.path)).size !== changes.length)
        throw new Error('Documentation review needs one to four distinct targets');
    const index = await store.read<RoadmapGateIndex>(root);
    if (index.projectRoot !== root || (index.linkedDocument && index.linkedDocument.syncState !== 'synced'))
        throw new Error('Roadmap source is not ready for documentation review');
    const targets: ChatDocumentationProposal['targets'] = [];
    let bytes = 0;
    for (const change of changes) {
        eligible(change.path);
        if (change.path === index.linkedDocument?.path) throw new Error('Linked Roadmap Markdown has a separate writer');
        const afterBytes = textBytes(change.after, 'Proposed document');
        const basis = await readDocumentationBasis(root, change.path);
        if (basis.before === change.after) throw new Error('Documentation proposal has no change');
        bytes += afterBytes.length + Buffer.byteLength(basis.before ?? '', 'utf8');
        if (bytes > maxSet) throw new Error('Documentation review set exceeds the size limit');
        targets.push({ path: change.path, operation: basis.before === null ? 'create' : 'update',
            before: basis.before, beforeHash: basis.beforeHash, after: change.after,
            afterHash: digest(afterBytes), diff: reviewDiff(change.path, basis.before, change.after) });
    }
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    const projectId = index.projectId === 'uninitialized' ? `root:${digest(root)}` : index.projectId;
    const worktreeId = await worktreeIdentity(root);
    const id = randomUUID();
    const leaseDigest = digest(leaseToken);
    const revision = index.revision;
    const proposalDigest = digest(JSON.stringify({ id, root, projectId, worktreeId, ownerId, chatId, messageId,
        leaseDigest, revision, targets, createdAt, expiresAt }));
    return { id, digest: proposalDigest, root, projectId, worktreeId, ownerId, chatId, messageId,
        leaseDigest, roadmapRevision: revision, createdAt, expiresAt, targets };
}

export async function documentationReviewApplicability(store: RoadmapStore, proposal: ChatDocumentationProposal,
    root: string): Promise<'applicable' | 'expired' | 'stale'> {
    if (root !== proposal.root || Date.now() >= Date.parse(proposal.expiresAt)) return 'expired';
    const expectedDigest = digest(JSON.stringify({ id: proposal.id, root: proposal.root,
        projectId: proposal.projectId, worktreeId: proposal.worktreeId, ownerId: proposal.ownerId,
        chatId: proposal.chatId, messageId: proposal.messageId, leaseDigest: proposal.leaseDigest,
        revision: proposal.roadmapRevision, targets: proposal.targets, createdAt: proposal.createdAt,
        expiresAt: proposal.expiresAt }));
    if (expectedDigest !== proposal.digest) return 'stale';
    if (await worktreeIdentity(root) !== proposal.worktreeId) return 'stale';
    if (!proposal.targets.length || proposal.targets.length > 4 ||
        new Set(proposal.targets.map(target => target.path)).size !== proposal.targets.length) return 'stale';
    let size = 0;
    try {
        for (const target of proposal.targets) {
            eligible(target.path);
            const after = textBytes(target.after, 'Proposed document');
            const before = target.before === null ? null : Buffer.from(target.before, 'utf8');
            size += after.length + (before?.length ?? 0);
            if (size > maxSet || digest(after) !== target.afterHash ||
                (before !== null && (before.length > maxFile || before.toString('utf8') !== target.before)) ||
                (before === null ? target.beforeHash !== null || target.operation !== 'create' :
                    digest(before) !== target.beforeHash || target.operation !== 'update') ||
                target.diff !== reviewDiff(target.path, target.before, target.after)) return 'stale';
        }
    } catch { return 'stale'; }
    const index = await store.read<RoadmapGateIndex>(root);
    if (index.projectRoot !== root || index.revision !== proposal.roadmapRevision ||
        (index.projectId === 'uninitialized' ? `root:${digest(root)}` : index.projectId) !== proposal.projectId ||
        (index.linkedDocument && index.linkedDocument.syncState !== 'synced') ||
        proposal.targets.some(target => target.path === index.linkedDocument?.path)) return 'stale';
    for (const target of proposal.targets) {
        const basis = await readDocumentationBasis(root, target.path);
        if (basis.beforeHash !== target.beforeHash) return 'stale';
    }
    return 'applicable';
}
