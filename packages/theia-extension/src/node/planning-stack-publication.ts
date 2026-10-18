import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, realpath, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { importPhaseStack } from '@dope/agent-core/lib/sequence';
import { checkedTasksRoot, captureSequenceEvidence } from '@dope/agent-core/lib/node/sequence-reconciliation';
import { versionCoherent } from '@dope/agent-core/lib/node/sequence-checkpoint';
import { discoverRoadmapTaskStacks } from '@dope/agent-core/lib/node/roadmap-task-discovery';
import type { DraftStack } from '@dope/agent-core/lib/phase-stack-composer';
import type { BridgeOwnerSnapshot } from './planning-bridge-approvals';
import { PlanningBridgeApprovals } from './planning-bridge-approvals';

const digest = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const safeFolder = (name: string): boolean => /^([cp][a-z0-9-]+)$/u.test(name) && name.length <= 100;
const hex = (value: unknown): boolean => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const publicationFiles = (draft: DraftStack) => [
    ...draft.files.map(file => ({ filename: file.filename, path: file.path, text: file.text })),
    { filename: 'README.md', path: `${draft.sourcePath}/README.md`, text: draft.manifest }
];

export interface PublicationPreview {
    token: string; folderName: string; destination: string; destinationStatus: 'absent';
    draftHash: string; sourceHash: string; ownerHash: string; stackFingerprint: string; gitHead: string;
    packageVersion: string; checkpointId: string; projectId: string;
    scope: string; dependencies: string[]; gates: string[];
    files: { path: string; hash: string; diff: string }[];
}
export interface PublicationRecord {
    schemaVersion: 1; revision: number; projectId: string; checkpointId: string;
    folderName: string; draftHash: string; sourceHash: string; ownerHash: string; gitHead: string;
    packageVersion: string;
    stackFingerprint: string; status: 'publishing' | 'review-required' | 'published';
    files: { path: string; hash: string }[];
}

/** Project-scoped publication of already-composed text. It never opens a Work sequence. */
export class PlanningStackPublication {
    private readonly pending = new Map<string, { root: string; preview: PublicationPreview; draft: DraftStack }>();
    private readonly approvals: PlanningBridgeApprovals;
    constructor(private readonly readOwners: (root: string) => Promise<BridgeOwnerSnapshot>,
        private readonly readGit = captureSequenceEvidence) {
        this.approvals = new PlanningBridgeApprovals(readOwners);
    }
    private async location(root: string, folder: string) {
        if (!safeFolder(folder) || await realpath(root) !== root) throw new Error('Unsafe or foreign publication root');
        const tasks = await checkedTasksRoot(root);
        const directory = join(tasks.absolute, folder);
        const dope = join(root, '.dope');
        const base = await lstat(dope);
        if (!base.isDirectory() || base.isSymbolicLink() || await realpath(dope) !== dope)
            throw new Error('Unsafe Bridge metadata root');
        const metadata = join(dope, 'planning-bridge-publications');
        // Runner evidence excludes its own .dope/agent state, so this ephemeral lock does not
        // invalidate the exact Git/worktree basis between preview and confirmation.
        const lockDirectory = join(dope, 'agent');
        return { directory, metadata, record: join(metadata, `${folder}.json`),
            lockDirectory, lock: join(lockDirectory, `bridge-publication-${folder}.lock`) };
    }
    private async absent(path: string): Promise<void> {
        try { await lstat(path); throw new Error('Destination collision or overwrite denied'); }
        catch (error) { if (!missing(error)) throw error; }
    }
    private async record(root: string, folder: string): Promise<PublicationRecord | undefined> {
        const { metadata, record } = await this.location(root, folder);
        try {
            const parent = await lstat(metadata);
            if (!parent.isDirectory() || parent.isSymbolicLink() || await realpath(metadata) !== metadata)
                throw new Error('Unsafe publication metadata');
        } catch (error) { if (missing(error)) return undefined; throw error; }
        try {
            const info = await lstat(record);
            if (!info.isFile() || info.isSymbolicLink() || info.size > 64_000) throw new Error('Unsafe publication record');
            const handle = await open(record, constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                const value = JSON.parse(await handle.readFile('utf8')) as PublicationRecord;
                if (value.schemaVersion !== 1 || value.folderName !== folder || !Number.isSafeInteger(value.revision) ||
                    value.revision < 1 || !['publishing', 'review-required', 'published'].includes(value.status) ||
                    typeof value.projectId !== 'string' || !value.projectId ||
                    typeof value.checkpointId !== 'string' || !value.checkpointId ||
                    !hex(value.draftHash) || !hex(value.sourceHash) || !hex(value.ownerHash) ||
                    !hex(value.stackFingerprint) ||
                    typeof value.gitHead !== 'string' || !/^[a-f0-9]{40,64}$/u.test(value.gitHead) ||
                    typeof value.packageVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(value.packageVersion) ||
                    !Array.isArray(value.files) || !value.files.length || value.files.length > 100 ||
                    value.files.some(file => !(file.path === `docs/tasks/${folder}/README.md` ||
                        new RegExp(`^docs/tasks/${folder}/P[1-9]\\d*-[a-z0-9]+(?:-[a-z0-9]+)*\\.txt$`, 'u').test(file.path)) ||
                        !hex(file.hash)) || new Set(value.files.map(file => file.path)).size !== value.files.length)
                    throw new Error('Invalid publication record');
                return value;
            } finally { await handle.close(); }
        } catch (error) { if (missing(error)) return undefined; throw error; }
    }
    private async save(root: string, value: PublicationRecord): Promise<void> {
        const { metadata, record } = await this.location(root, value.folderName);
        await mkdir(metadata, { recursive: true });
        if ((await lstat(metadata)).isSymbolicLink() || await realpath(metadata) !== metadata)
            throw new Error('Unsafe publication metadata');
        const temporary = join(metadata, `${value.folderName}.${randomUUID()}.tmp`);
        const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`); await handle.sync(); }
        finally { await handle.close(); }
        try {
            if (value.revision === 1) await link(temporary, record); // first journal never replaces existing bytes
            else await rename(temporary, record);
        }
        finally { await rm(temporary, { force: true }); }
        const parent = await open(metadata, 'r');
        try { await parent.sync(); } finally { await parent.close(); }
    }
    private async currentSource(root: string, checkpointId: string, draft?: DraftStack) {
        const owners = await this.readOwners(root);
        const roadmap = owners.roadmap, planning = owners.planning;
        if (roadmap.projectRoot !== root || !roadmap.checkpoints.some(item => item.id === checkpointId) ||
            !planning || planning.map.projectId !== planning.projectId ||
            !planning.map.workItems.length || planning.map.workItems.some(item => item.status !== 'ready'))
            throw new Error('Current Roadmap, Planning and ready WorkItems required');
        if (!await this.approvals.approved(root, checkpointId, 'scope') ||
            !await this.approvals.approved(root, checkpointId, 'target'))
            throw new Error('Current scope and target approvals required');
        if (draft) {
            const workIds = planning.map.workItems.map(item => item.id).sort();
            const promptIds = draft.files.slice(0, -1).map(file => /- Accepted WorkItem: ([^\n]+)\./u.exec(file.text)?.[1]);
            if (promptIds.some(id => !id) || JSON.stringify([...promptIds].sort()) !== JSON.stringify(workIds))
                throw new Error('Draft WorkItems differ from current accepted Planning WorkItems');
        }
        return { sourceHash: digest(JSON.stringify({ roadmap, basis: owners.basis, planning })),
            projectId: roadmap.projectId, scope: roadmap.checkpoints.find(item => item.id === checkpointId)!.title,
            dependencies: planning.map.workItems.flatMap(item => item.dependsOn.map(id => `${id} -> ${item.id}`)) };
    }
    async preview(root: string, checkpointId: string, draft: DraftStack): Promise<PublicationPreview> {
        const { directory } = await this.location(root, draft.folderName);
        if (draft.sourcePath !== `docs/tasks/${draft.folderName}` || await this.record(root, draft.folderName))
            throw new Error('Publication already exists; review or choose a new stack');
        await this.absent(directory);
        const sources = draft.files.map(({ filename, text }) => ({ filename, text }));
        const allFiles = publicationFiles(draft);
        if (sources.some((item, index) => draft.files[index].path !== `${draft.sourcePath}/${item.filename}` ||
            item.text.length > 12_000) || typeof draft.manifest !== 'string' ||
            draft.manifest.length > 32_000 || !draft.manifest.startsWith(`# Draft ${draft.folderName}\n`))
            throw new Error('Unsafe draft file path or size');
        const imported = await importPhaseStack(draft.folderName, sources, draft.sourcePath);
        // The Work importer shares the runner's strict prompt grammar; the focused suite checks both.
        const git = await this.readGit(root), owner = await this.currentSource(root, checkpointId, draft);
        await versionCoherent(root, git.packageVersion);
        if (imported.mode === 'correction' && imported.unchangedVersion !== git.packageVersion)
            throw new Error('Draft version differs from project');
        const draftHash = digest(JSON.stringify(allFiles));
        const result: PublicationPreview = { token: randomUUID(), folderName: draft.folderName,
            destination: draft.sourcePath, destinationStatus: 'absent', draftHash,
            sourceHash: digest(`${owner.sourceHash}:${git.worktreeFingerprint}`), ownerHash: owner.sourceHash,
            stackFingerprint: imported.fingerprint, gitHead: git.head, packageVersion: git.packageVersion,
            checkpointId, projectId: owner.projectId, scope: owner.scope, dependencies: owner.dependencies,
            gates: imported.entries.map(entry => `P${entry.number}: ${entry.execution}${entry.browserRequired ? ' (browser)' : ''}`),
            files: allFiles.map(file => ({ path: file.path, hash: digest(file.text),
                diff: file.text.split('\n').filter((_, index, lines) => index < lines.length - 1 || lines[index] !== '')
                    .map(line => `+${line}`).join('\n') + '\n' })) };
        this.pending.set(result.token, { root, preview: structuredClone(result),
            draft: { ...draft, files: draft.files.map(file => ({ ...file })), diagnostics: [...draft.diagnostics] } });
        return result;
    }
    cancel(token: string): void {
        if (!this.pending.delete(token)) throw new Error('Unknown or consumed publication preview');
    }
    async publish(root: string, token: string, developerAction: boolean): Promise<PublicationRecord> {
        const pending = this.pending.get(token);
        if (!pending || !developerAction) throw new Error('Explicit developer approval required');
        this.pending.delete(token);
        const { preview, draft } = pending, paths = await this.location(root, draft.folderName);
        if (pending.root !== root) throw new Error('Foreign publication preview');
        if (digest(JSON.stringify(publicationFiles(draft))) !== preview.draftHash)
            throw new Error('Draft changed; preview again');
        if (preview.checkpointId === '' || preview.destination !== draft.sourcePath) throw new Error('Foreign preview');
        await mkdir(paths.metadata, { recursive: true });
        await mkdir(paths.lockDirectory, { recursive: true });
        if ((await lstat(paths.lockDirectory)).isSymbolicLink() ||
            await realpath(paths.lockDirectory) !== paths.lockDirectory) throw new Error('Unsafe publication lock directory');
        const lock = await open(paths.lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        let journal: PublicationRecord | undefined;
        let journalWritten = false;
        try {
            if (await this.record(root, draft.folderName)) throw new Error('Publication already exists');
            await this.absent(paths.directory);
            const fresh = await this.readGit(root);
            await versionCoherent(root, fresh.packageVersion);
            const owner = await this.currentSource(root, preview.checkpointId, draft);
            if (fresh.head !== preview.gitHead || fresh.packageVersion !== preview.packageVersion ||
                digest(`${owner.sourceHash}:${fresh.worktreeFingerprint}`) !== preview.sourceHash ||
                owner.projectId !== preview.projectId) throw new Error('Git or owner source changed; preview again');
            journal = { schemaVersion: 1, revision: 1, projectId: preview.projectId,
                checkpointId: preview.checkpointId, folderName: draft.folderName,
                draftHash: preview.draftHash, sourceHash: preview.sourceHash, ownerHash: preview.ownerHash,
                gitHead: preview.gitHead, packageVersion: preview.packageVersion,
                stackFingerprint: preview.stackFingerprint, status: 'publishing',
                files: preview.files.map(file => ({ path: file.path, hash: file.hash })) };
            await this.save(root, journal);
            journalWritten = true;
            await mkdir(paths.directory); // exclusive after collision check
            for (const file of publicationFiles(draft)) {
                const path = join(paths.directory, file.filename);
                const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                try { await handle.writeFile(file.text); await handle.sync(); }
                finally { await handle.close(); }
            }
            const found = (await discoverRoadmapTaskStacks(root, 'docs/tasks', { expectedPaths: [draft.sourcePath] }))
                .find(item => item.path === draft.sourcePath);
            if (!found || found.diagnostic || found.fingerprint !== preview.stackFingerprint)
                throw new Error('Published stack failed read-only discovery');
            const after = await this.readGit(root), refreshed = await this.currentSource(root, preview.checkpointId, draft);
            if (after.head !== preview.gitHead || after.packageVersion !== preview.packageVersion ||
                refreshed.sourceHash !== preview.ownerHash)
                throw new Error('Git or owner source changed during publication; review required');
            journal = { ...journal, revision: 2, status: 'published' };
            await this.save(root, journal);
            return journal;
        } catch (error) {
            if (journal && journalWritten)
                await this.save(root, { ...journal, revision: journal.revision + 1, status: 'review-required' });
            throw error;
        } finally { await lock.close(); await rm(paths.lock, { force: true }); }
    }
    /** Never resumes writes. An interrupted result needs an explicit review before it can be used. */
    async inspect(root: string, folder: string): Promise<{ record?: PublicationRecord; files: { path: string; status: 'missing' | 'matching' | 'changed' }[] }> {
        const record = await this.record(root, folder);
        if (!record) return { files: [] };
        const files = await Promise.all(record.files.map(async file => {
            const path = join(root, file.path);
            try {
                const info = await lstat(path);
                if (!info.isFile() || info.isSymbolicLink()) return { path: file.path, status: 'changed' as const };
                const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
                try {
                    if (!(await handle.stat()).isFile()) return { path: file.path, status: 'changed' as const };
                    return { path: file.path, status: digest(await handle.readFile()) === file.hash ? 'matching' as const : 'changed' as const };
                } finally { await handle.close(); }
            } catch (error) { if (missing(error)) return { path: file.path, status: 'missing' as const }; throw error; }
        }));
        return { record, files };
    }
    /** Explicit recovery after a crash: only complete, unchanged files can become published. */
    async confirmRecovered(root: string, folder: string, developerAction: boolean): Promise<PublicationRecord> {
        if (!developerAction) throw new Error('Explicit developer recovery review required');
        const paths = await this.location(root, folder);
        await mkdir(paths.lockDirectory, { recursive: true });
        if ((await lstat(paths.lockDirectory)).isSymbolicLink() ||
            await realpath(paths.lockDirectory) !== paths.lockDirectory) throw new Error('Unsafe publication lock directory');
        const lock = await open(paths.lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try {
            const review = await this.inspect(root, folder), record = review.record;
            if (!record || record.status === 'published' || review.files.some(file => file.status !== 'matching'))
                throw new Error('Partial or changed publication requires manual recovery review');
            const owner = await this.currentSource(root, record.checkpointId);
            const git = await this.readGit(root);
            if (owner.projectId !== record.projectId || owner.sourceHash !== record.ownerHash ||
                git.head !== record.gitHead || git.packageVersion !== record.packageVersion)
                throw new Error('Publication owner or Git source changed; review again');
            await versionCoherent(root, git.packageVersion);
            const found = (await discoverRoadmapTaskStacks(root, 'docs/tasks',
                { expectedPaths: [`docs/tasks/${folder}`] })).find(item => item.folderName === folder);
            if (!found || found.diagnostic || found.fingerprint !== record.stackFingerprint)
                throw new Error('Recovered stack failed strict read-only discovery');
            const recovered = { ...record, revision: record.revision + 1, status: 'published' as const };
            await this.save(root, recovered);
            return recovered;
        } finally { await lock.close(); await rm(paths.lock, { force: true }); }
    }
}
