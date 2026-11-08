import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { lstat, realpath, readlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ChatPromptStackProposal } from '@dope/chat';
import type { DraftStack } from '@dope/agent-core/lib/phase-stack-composer';
import { phaseStackFolder } from '@dope/agent-core/lib/sequence';
import { captureSequenceEvidence } from '@dope/agent-core/lib/node/sequence-reconciliation';
import { versionCoherent } from '@dope/agent-core/lib/node/sequence-checkpoint';

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const execute = promisify(execFile);

/** Prompt source excludes Dope's own saved Chat/journals, while retaining all project edits. */
export async function capturePromptSourceEvidence(root: string, excludeStackFolder?: string): Promise<{
    head: string; packageVersion: string; worktreeFingerprint: string }> {
    const git = await captureSequenceEvidence(root);
    const args = ['-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=all',
        '--', '.', ':(exclude).dope', ':(exclude).dope/**',
        ...(excludeStackFolder ? [`:(exclude)docs/tasks/${excludeStackFolder}`,
            `:(exclude)docs/tasks/${excludeStackFolder}/**`] : [])];
    const { stdout } = await execute('git', args, { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
    const fields = (stdout as Buffer).toString('utf8').split('\0');
    if (fields.pop() !== '' || fields.length > 4000) throw new Error('Prompt source status is invalid or too large');
    const material: string[] = [];
    for (let index = 0; index < fields.length; index++) {
        const field = fields[index];
        if (field.length < 4 || field[2] !== ' ') throw new Error('Invalid prompt source status');
        const previous = /[RC]/u.test(field.slice(0, 2)) ? fields[++index] : undefined;
        if (/[RC]/u.test(field.slice(0, 2)) && previous === undefined)
            throw new Error('Invalid prompt source rename');
        material.push(field, ...(previous ? [previous] : []));
        const target = join(root, field.slice(3));
        try {
            const info = await lstat(target);
            material.push(String(info.mode), String(info.size));
            if (info.isSymbolicLink()) material.push(await readlink(target));
            else if (info.isFile()) {
                const digest = createHash('sha256');
                for await (const chunk of createReadStream(target)) digest.update(chunk as Buffer);
                material.push(digest.digest('hex'));
            } else material.push('non-file');
        } catch (error) {
            if (!missing(error)) throw error;
            material.push('missing');
        }
    }
    const index = await execute('git', ['-C', root, 'diff', '--cached', '--raw', '-z', 'HEAD',
        '--', '.', ':(exclude).dope', ':(exclude).dope/**',
        ...(excludeStackFolder ? [`:(exclude)docs/tasks/${excludeStackFolder}`,
            `:(exclude)docs/tasks/${excludeStackFolder}/**`] : [])],
        { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 });
    const worktreeFingerprint = createHash('sha256').update(material.join('\0'))
        .update(index.stdout as Buffer).digest('hex');
    return { head: git.head, packageVersion: git.packageVersion, worktreeFingerprint };
}

/** A hash of every immutable field, independent of a UI approval or saved Chat status. */
export function promptProposalDigest(proposal: Omit<ChatPromptStackProposal, 'digest'>): string {
    return hash(JSON.stringify(proposal));
}

export async function createPromptStackProposal(root: string, chatId: string, messageId: string,
    ownerId: string, leaseToken: string, draft: DraftStack,
    supportingFiles: { path: string; text: string }[], assessmentMessageId: string,
    planMessageId: string, revision = 1): Promise<ChatPromptStackProposal> {
    phaseStackFolder(draft.folderName, (await capturePromptSourceEvidence(root)).packageVersion);
    if (await realpath(root) !== root ||
        draft.sourcePath !== `docs/tasks/${draft.folderName}` ||
        supportingFiles.length !== 2 || draft.files.length < 2 || draft.files.length > 49)
        throw new Error('Unsafe prompt stack destination or incomplete draft');
    let tasks = root;
    for (const part of ['docs', 'tasks']) {
        tasks = join(tasks, part);
        try {
            const info = await lstat(tasks);
            if (!info.isDirectory() || info.isSymbolicLink())
                throw new Error('Unsafe prompt stack parent');
        } catch (error) { if (!missing(error)) throw error; }
    }
    try { await lstat(join(tasks, draft.folderName)); throw new Error('Prompt stack target already exists'); }
    catch (error) { if (!missing(error)) throw error; }
    const git = await capturePromptSourceEvidence(root);
    await versionCoherent(root, git.packageVersion);
    const files = [...supportingFiles,
        { path: `${draft.sourcePath}/README.md`, text: draft.manifest },
        ...draft.files.map(({ path, text }) => ({ path, text }))].map(file =>
        ({ path: file.path, after: file.text, afterHash: hash(file.text), before: null as null }));
    if (files[0].path !== `${draft.sourcePath}/prompt-assessment.md` ||
        files[1].path !== `${draft.sourcePath}/implementation-plan.md` ||
        new Set(files.map(file => file.path)).size !== files.length ||
        files.some(file => !file.path.startsWith(`${draft.sourcePath}/`) ||
            Buffer.byteLength(file.after, 'utf8') > 32_000))
        throw new Error('Prompt stack has invalid reviewed files');
    const unsigned: Omit<ChatPromptStackProposal, 'digest'> = {
        id: randomUUID(), root, projectId: hash(root), ownerId, chatId, messageId,
        leaseDigest: hash(leaseToken), revision, folder: draft.folderName,
        sourceVersion: git.packageVersion, gitHead: git.head, worktreeId: git.worktreeFingerprint,
        assessmentMessageId, planMessageId, createdAt: new Date().toISOString(), files };
    if (Buffer.byteLength(JSON.stringify(unsigned), 'utf8') > 384_000)
        throw new Error('Prompt stack exceeds saved proposal limit');
    return { ...unsigned, digest: promptProposalDigest(unsigned) };
}

export function validatePromptStackProposal(proposal: ChatPromptStackProposal): void {
    const { digest, ...unsigned } = proposal;
    if (promptProposalDigest(unsigned) !== digest || proposal.projectId !== hash(proposal.root) ||
        proposal.files.some(file => hash(file.after) !== file.afterHash))
        throw new Error('Saved prompt stack proposal bytes or identity changed');
}
