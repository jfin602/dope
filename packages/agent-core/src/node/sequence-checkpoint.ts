import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { AgentRun, AgentTask } from '../contracts';
import type { AgentTaskSequence } from '../sequence';
import { AcceptedDirtyBasis, DirtyPath, agentState, captureDirtyBasis, safeGit } from './dirty-basis';

const execute = promisify(execFile);
const sha = /^[a-f0-9]{40,64}$/u;
const names = (raw: string): string[] => {
    const fields = raw.split('\0');
    if (fields.pop() !== '') throw new Error('Invalid Git path list');
    return fields.filter(Boolean).sort();
};
const same = (left: string[], right: string[]): boolean => JSON.stringify(left.slice().sort()) === JSON.stringify(right.slice().sort());

export function verifyCheckpointScope(accepted: AcceptedDirtyBasis | undefined, run: AgentRun,
    current: DirtyPath[]): string[] {
    const applied = new Set(run.appliedFiles ?? []);
    const prior = accepted?.paths ?? [];
    const scope = [...new Set([...prior.map(item => item.path), ...applied])].sort();
    if (!scope.length || scope.some(agentState) || !same(current.map(item => item.path), scope))
        throw new Error('Unaccepted ambient change or missing applied path blocks checkpoint');
    for (const item of prior) if (!applied.has(item.path)) {
        const found = current.find(path => path.path === item.path);
        if (!found || JSON.stringify(found) !== JSON.stringify(item))
            throw new Error('Accepted dirty byte identity changed outside task');
    }
    for (const path of applied) {
        const effect = run.candidateDelta?.effects.find(item => item.path === path);
        const found = current.find(item => item.path === path);
        if (!effect || !['create', 'modify'].includes(effect.kind) || !found || found.hash !== effect.after)
            throw new Error('Applied authoritative bytes differ from candidate');
    }
    return scope;
}

export async function versionCoherent(root: string, expected: string): Promise<void> {
    for (const lock of ['package-lock.json', 'npm-shrinkwrap.json']) {
        try { await lstat(join(root, lock)); throw new Error(`Forbidden root ${lock}`); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    const rootPackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
        version?: string; workspaces?: string[]; dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
    if (rootPackage.version !== expected || !Array.isArray(rootPackage.workspaces) || rootPackage.workspaces.length > 100)
        throw new Error('Checkpoint package version mismatch');
    const internal = new Set<string>();
    const manifests = [rootPackage];
    for (const workspace of rootPackage.workspaces) {
        if (!/^(?:apps|packages)\/[a-z0-9-]+$/u.test(workspace)) throw new Error('Invalid workspace manifest path');
        const pkg = JSON.parse(await readFile(join(root, workspace, 'package.json'), 'utf8')) as {
            name?: string; version?: string; dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>; peerDependencies?: Record<string, string> };
        if (pkg.version !== expected || !pkg.name) throw new Error('Internal workspace version mismatch');
        if (internal.has(pkg.name)) throw new Error('Duplicate internal workspace name');
        internal.add(pkg.name); manifests.push(pkg);
    }
    for (const manifest of manifests) for (const dependencies of
        [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies]) {
        for (const [name, version] of Object.entries(dependencies ?? {}))
            if (name.startsWith('@dope/') && (!internal.has(name) || version !== expected))
                throw new Error(`Internal reference mismatch: ${name}`);
    }
}

export async function checkpointSequence(root: string, sequence: AgentTaskSequence,
    task: AgentTask, run: AgentRun): Promise<string> {
    const entry = sequence.stack.entries[sequence.currentEntryNumber - 1];
    if (!entry || entry.execution !== 'agent-task' || sequence.status !== 'blocked' ||
        sequence.blockedReason !== 'checkpoint-pending' || sequence.taskId !== task.id ||
        sequence.runIds?.at(-1) !== run.id || run.taskId !== task.id || run.status !== 'completed' ||
        run.authorityDecision?.allowed !== true || !run.appliedFiles || !run.candidateDelta ||
        run.validationBasis !== 'execution-workspace' || !run.executionWorkspace || !run.finalGit ||
        run.finalGit.headChanged || task.origin.kind !== 'phase-stack' ||
        task.phaseStack?.stackFingerprint !== sequence.stack.fingerprint ||
        task.phaseStack.versionPolicy.version !== entry.versionPolicy.version ||
        run.basis?.head !== (sequence.checkpoints.at(-1)?.sha ?? sequence.basis.head) ||
        run.finalGit.head !== run.basis.head)
        throw new Error('AgentRun has no eligible checkpoint');
    if (!same(run.appliedFiles, run.candidateDelta.effects.map(item => item.path)) ||
        run.candidateDelta.effects.some(item => !['create', 'modify'].includes(item.kind)))
        throw new Error('Promotion evidence does not cover the complete candidate delta');
    if (task.completion.validation.some(target => run.validationResults.slice().reverse().find(item =>
        item.kind === target.kind && item.label === target.label)?.status !== 'passed') ||
        run.validationResults.some(result => result.status === 'failed' &&
            run.validationResults.slice().reverse().find(last => last.kind === result.kind && last.label === result.label)?.status === 'failed'))
        throw new Error('Required validation did not pass');
    const priorHead = run.basis.head;
    const head = (await safeGit(root, ['rev-parse', '--verify', 'HEAD'])).trim();
    if (!priorHead || head !== priorHead || sequence.acceptedDirty?.head !== undefined && sequence.acceptedDirty.head !== head)
        throw new Error('HEAD changed before checkpoint');
    const accepted = sequence.acceptedDirty?.paths ?? [];
    if (run.basis.clean === false && !sequence.acceptedDirty) throw new Error('Dirty run lacks explicit acceptance');
    const applied = new Set(run.appliedFiles);
    const status = await captureDirtyBasis(root);
    if (status.head !== head) throw new Error('HEAD changed before checkpoint staging');
    const scope = verifyCheckpointScope(sequence.acceptedDirty, run, status.paths);
    const expected = entry.versionPolicy.version;
    await versionCoherent(root, expected);
    if ((await safeGit(root, ['diff', '--cached', '--name-only', '-z'])).length)
        throw new Error('External staged changes block checkpoint');
    const subject = checkpointSubject(sequence);
    const validation = run.validationResults.filter(item => item.status === 'passed')
        .map(item => `${item.kind}: ${item.label}`).slice(0, 12);
    const body = checkpointBody(task, run, accepted.map(item => item.path), validation);
    if (body.length > 4000) throw new Error('Checkpoint summary exceeds limit');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    const options = { cwd: root, encoding: 'utf8' as const, maxBuffer: 2 * 1024 * 1024,
        env: { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } };
    await execute('git', ['--no-optional-locks', 'add', '-A', '--', ...scope], options);
    const staged = names(await safeGit(root, ['diff', '--cached', '--name-only', '-z']));
    const unstaged = names(await safeGit(root, ['diff', '--name-only', '-z']));
    const untracked = names(await safeGit(root, ['ls-files', '--others', '--exclude-standard', '-z']));
    if (!same(staged, scope) || [...unstaged, ...untracked].some(path => !agentState(path)) ||
        (await safeGit(root, ['rev-parse', '--verify', 'HEAD'])).trim() !== head)
        throw new Error('Staged scope or HEAD changed before checkpoint commit');
    for (const item of status.paths) {
        if (item.hash === null) continue;
        const blob = await execute('git', ['--no-optional-locks', 'show', `:${item.path}`],
            { ...options, encoding: 'buffer', maxBuffer: 33 * 1024 * 1024 });
        if (createHash('sha256').update(blob.stdout).digest('hex') !== item.hash)
            throw new Error('Staged bytes differ from verified checkpoint scope');
    }
    await versionCoherent(root, expected);
    await execute('git', ['--no-optional-locks', '-c', 'user.name=Dope', '-c', 'user.email=dope@local',
        '-c', 'core.hooksPath=/dev/null', 'commit', '--only', '--no-gpg-sign', '--no-verify',
        '--cleanup=verbatim', '-m', subject, '-m', body, '--', ...scope], options);
    const committed = (await safeGit(root, ['rev-parse', '--verify', 'HEAD'])).trim();
    const commitObject = await safeGit(root, ['cat-file', 'commit', committed]);
    const messageBoundary = commitObject.indexOf('\n\n');
    const actualMessage = messageBoundary < 0 ? '' : commitObject.slice(messageBoundary + 2).replace(/\n+$/u, '');
    if (!sha.test(committed) || committed === head ||
        (await safeGit(root, ['rev-parse', 'HEAD^'])).trim() !== head ||
        (await safeGit(root, ['log', '-1', '--format=%s'])).trim() !== subject ||
        actualMessage !== `${subject}\n\n${body}` ||
        !same(names(await safeGit(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD'])), scope) ||
        (await safeGit(root, ['diff', '--cached', '--name-only', '-z'])).length ||
        (await captureDirtyBasis(root)).paths.length)
        throw new Error('Checkpoint commit verification failed');
    for (const item of status.paths) {
        const treeEntry = (await safeGit(root, ['ls-tree', 'HEAD', '--', item.path])).trim();
        if (item.hash === null) {
            if (treeEntry) throw new Error('Deleted checkpoint path remains in commit');
            continue;
        }
        const blob = await execute('git', ['--no-optional-locks', 'show', `HEAD:${item.path}`],
            { ...options, encoding: 'buffer', maxBuffer: 33 * 1024 * 1024 });
        if (createHash('sha256').update(blob.stdout).digest('hex') !== item.hash ||
            !/^100(?:644|755) blob [a-f0-9]{40,64}\t/u.test(treeEntry) ||
            treeEntry.startsWith('100755') !== Boolean(item.mode && item.mode & 0o111))
            throw new Error('Committed bytes or mode differ from verified checkpoint scope');
    }
    await versionCoherent(root, expected);
    return committed;
}

export function checkpointSubject(sequence: AgentTaskSequence): string {
    const entry = sequence.stack.entries[sequence.currentEntryNumber - 1];
    if (!entry || entry.execution !== 'agent-task') throw new Error('No executable checkpoint entry');
    return sequence.stack.mode === 'phase' ? entry.versionPolicy.version :
        `${sequence.stack.folderName}/P${entry.number}: ${entry.title}`;
}

export function checkpointBody(task: AgentTask, run: AgentRun, accepted: string[], validation: string[]): string {
    return [`Dope AgentTask ${task.id}`, `AgentRun ${run.id}`,
        `Validation: ${validation.length ? validation.join('; ') : 'none required'}`,
        `Applied files: ${[...(run.appliedFiles ?? [])].sort().join(', ') || 'none'}`,
        `Accepted dirty files: ${accepted.slice().sort().join(', ') || 'none'}`].join('\n');
}
