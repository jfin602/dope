import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { captureSequenceEvidence, phaseFocusSequenceEvidence, stackSourceDrift } from '@dope/agent-core/lib/node/sequence-reconciliation';
import { importPhaseStack } from '@dope/agent-core/lib/sequence';
import type { RoadmapTaskStack } from '@dope/agent-core/lib/node/roadmap-task-discovery';
import type { RoadmapIndex, RoadmapLink } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { FailedPromptEvidence, PhaseFocusBlockedEvidence, PhaseFocusCheckpointEvidence,
    PhaseFocusQualificationEvidence } from '@dope/project-intelligence/lib/roadmap-task-projection';

const execute = promisify(execFile);
const hash = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
const sha = /^[a-f0-9]{40}$/;
const safePath = (path: string): boolean => path.startsWith('docs/tasks/') || path.startsWith('docs/planning/');
const promptKey = (path: string, number: number, fingerprint: string): string =>
    `phase-focus-prompt:${encodeURIComponent(path)}:P${number}:${fingerprint}`;
const correctionKey = (path: string): string => `phase-focus-correction:${encodeURIComponent(path)}`;

export interface PhaseFocusEvidence {
    projectId: string; checkpoints: PhaseFocusCheckpointEvidence[];
    qualifications: PhaseFocusQualificationEvidence[]; failedPromptEvidence: FailedPromptEvidence[];
    blocked: PhaseFocusBlockedEvidence[]; diagnostics: string[];
}

async function git(root: string, args: string[]): Promise<string> {
    const { stdout } = await execute('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args],
        { cwd: root, encoding: 'utf8', maxBuffer: 2_000_000,
            env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_EXTERNAL_DIFF: '0',
                GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } });
    return stdout;
}

/** A citation is useful only while the owner-named file and cited line still have their exact bytes. */
export async function validPhaseFocusCitation(root: string, citation: { path: string; sha256: string; line: number;
    text: string; status?: string; statusText?: string }): Promise<boolean> {
    if (!safePath(citation.path) || citation.path.length > 512 || citation.path.includes('\\') ||
        citation.path.split('/').some(part => !part || part === '.' || part === '..') ||
        !/^[a-f0-9]{64}$/.test(citation.sha256) || !Number.isSafeInteger(citation.line) || citation.line < 1) return false;
    let path = root;
    for (const part of citation.path.split('/')) {
        path = join(path, part);
        const info = await lstat(path).catch(() => undefined);
        if (!info || info.isSymbolicLink()) return false;
    }
    const info = await lstat(path);
    if (!info.isFile() || info.size > 1_000_000) return false;
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const bytes = await handle.readFile();
        if (bytes.length > 1_000_000 || hash(bytes) !== citation.sha256) return false;
        const line = new TextDecoder('utf-8', { fatal: true }).decode(bytes).split(/\r?\n/)[citation.line - 1];
        if (line === undefined || !line.trim().startsWith(citation.text.trim()) ||
            citation.statusText !== undefined && !line.trim().startsWith(citation.statusText.trim())) return false;
        const verdict = citation.statusText ?? citation.text;
        const stated = /\bnot[ -]green\b|\bnot qualified\b|\bunqualified\b/i.test(verdict) ? 'not-green' :
            /\bwaived?\b|\bowner.closed for sequencing\b/i.test(verdict) ? 'waived' :
            /\bgreen\b|\bqualified\b/i.test(verdict) ? 'green' : 'unknown';
        return citation.status === stated && stated !== 'unknown';
    } finally { await handle.close(); }
}

/** Existing Roadmap owner citations and typed evidence links supply prompt-level verdicts. */
async function citedEvidence(root: string, index: RoadmapIndex, stacks: readonly RoadmapTaskStack[]): Promise<{
    qualifications: PhaseFocusQualificationEvidence[]; failedPromptEvidence: FailedPromptEvidence[] }> {
    const prompts = stacks.flatMap(stack => stack.fingerprint && !stack.diagnostic ? stack.prompts.map(prompt =>
        ({ stack, prompt, key: promptKey(stack.path, prompt.number, prompt.fingerprint) })) : []);
    const qualifications: PhaseFocusQualificationEvidence[] = [];
    const failedPromptEvidence: FailedPromptEvidence[] = [];
    for (const owner of index.checkpoints) for (const link of owner.links) {
        if (link.owner !== 'evidence' || !link.sourceHash) continue;
        const match = prompts.find(item => item.key === link.targetId);
        if (!match) continue;
        const citations = owner.evidence.filter(item => item.sha256 === link.sourceHash &&
            ['green', 'not-green', 'waived'].includes(item.status ?? ''));
        for (const citation of citations) if (await validPhaseFocusCitation(root, citation)) {
            qualifications.push({ projectId: index.projectId, stackPath: match.stack.path,
                promptNumber: match.prompt.number, promptFingerprint: match.prompt.fingerprint,
                evidencePath: citation.path, evidenceHash: citation.sha256,
                status: citation.status as 'green' | 'not-green' | 'waived' });
            if (owner.kind !== 'correction' || citation.status !== 'not-green') continue;
            const corrections = stacks.filter(stack => stack.mode === 'correction' &&
                owner.links.some(item => item.owner === 'evidence' && item.targetId === correctionKey(stack.path) &&
                    item.sourceHash === citation.sha256));
            for (const correction of corrections) failedPromptEvidence.push({ correctionPath: correction.path,
                failedPrompt: { stackPath: match.stack.path, number: match.prompt.number,
                    fingerprint: match.prompt.fingerprint }, evidencePath: citation.path, evidenceHash: citation.sha256 });
        }
    }
    return { qualifications, failedPromptEvidence };
}

/** Existing reviewed Roadmap link actions may attach a precise prompt/correction to a cited owner. */
export async function resolvePhaseFocusLink(root: string, index: RoadmapIndex,
    stacks: readonly RoadmapTaskStack[], link: RoadmapLink): Promise<boolean> {
    if (index.projectRoot !== root || link.owner !== 'evidence' || !link.sourceHash ||
        link.ownerProjectId !== undefined || link.ownerRevision !== undefined) return false;
    const known = stacks.some(stack => !stack.diagnostic && !!stack.fingerprint &&
        (stack.mode === 'correction' && correctionKey(stack.path) === link.targetId ||
            stack.prompts.some(prompt => promptKey(stack.path, prompt.number, prompt.fingerprint) === link.targetId)));
    if (!known) return false;
    for (const citation of index.checkpoints.flatMap(item => item.evidence))
        if (citation.sha256 === link.sourceHash && ['green', 'not-green', 'waived'].includes(citation.status ?? '') &&
            await validPhaseFocusCitation(root, citation)) return true;
    return false;
}

/** Read-only reconciliation; runner reports never masquerade as Dope Work runs. */
export async function readPhaseFocusEvidence(root: string, index: RoadmapIndex,
    stacks: readonly RoadmapTaskStack[], agentStore: AgentStore): Promise<PhaseFocusEvidence> {
    if (index.projectRoot !== root || index.projectId === 'uninitialized') throw new Error('Foreign Phase Focus project');
    const result: PhaseFocusEvidence = { projectId: index.projectId, checkpoints: [], qualifications: [],
        failedPromptEvidence: [], blocked: [], diagnostics: [] };
    const applicable = new Map(stacks.filter(item => item.fingerprint && !item.diagnostic).map(item => [item.path, item]));
    const evidence = await captureSequenceEvidence(root);
    for (const sequence of (await agentStore.listSequences(root)).slice(0, 256)) {
        const path = sequence.stack.sourcePath ?? `docs/tasks/${sequence.stack.folderName}`;
        const current = applicable.get(path);
        if (!current?.fingerprint) continue;
        const currentFingerprint = current.fingerprint;
        // Older Work stacks use the default docs/tasks root without serializing sourcePath.
        // Discovery includes that path in its fingerprint. Rebind only an exact, still-current
        // legacy snapshot to the discovered path; the Work task keeps its original fingerprint.
        const discoveredFingerprint = sequence.stack.sourcePath ? sequence.stack.fingerprint :
            (await importPhaseStack(sequence.stack.folderName, sequence.stack.entries.map(entry =>
                ({ filename: entry.filename, text: entry.promptText })), path)).fingerprint;
        const drift = currentFingerprint !== discoveredFingerprint || await stackSourceDrift(root, sequence.stack);
        const checked = phaseFocusSequenceEvidence(index.projectId, sequence, evidence, drift);
        for (const checkpoint of checked.checkpoints) {
            const prompt = current.prompts[checkpoint.entryNumber - 1];
            if (!prompt || checkpoint.manualGate !== (prompt.kind === 'closeout' || prompt.browserRequired)) continue;
            if (!checkpoint.manualGate) {
                if (!checkpoint.taskId || !checkpoint.runId) continue;
                const [taskRead, runRead] = await Promise.allSettled([
                    agentStore.readTask(root, checkpoint.taskId), agentStore.readRun(root, checkpoint.runId)]);
                if (taskRead.status === 'rejected' || runRead.status === 'rejected') {
                    result.diagnostics.push(`${path}: Invalid Work task or run evidence for P${checkpoint.entryNumber}.`);
                    continue;
                }
                const task = taskRead.value, run = runRead.value;
                if (!task || !run || run.status !== 'completed' || run.taskId !== task.id ||
                    task.origin.kind !== 'phase-stack' ||
                    task.origin.promptId !== `${sequence.stack.folderName}-P${checkpoint.entryNumber}-${sequence.stack.fingerprint.slice(0, 12)}` ||
                    task.instructions !== sequence.stack.entries[checkpoint.entryNumber - 1]?.promptText ||
                    task.phaseStack?.stackFingerprint !== sequence.stack.fingerprint ||
                    task.projectId !== run.projectId) continue;
            }
            result.checkpoints.push({ ...checkpoint, stackFingerprint: currentFingerprint,
                promptFingerprint: prompt.fingerprint });
        }
        result.blocked.push(...checked.blocked.map(item => ({ ...item, stackFingerprint: currentFingerprint })));
    }
    const runsRoot = join(root, '.codex-runs');
    const rootInfo = await lstat(runsRoot).catch(() => undefined);
    if (rootInfo?.isDirectory() && !rootInfo.isSymbolicLink()) for (const stack of applicable.values()) {
        const folder = join(runsRoot, stack.folderName);
        const folderInfo = await lstat(folder).catch(() => undefined);
        if (!folderInfo?.isDirectory() || folderInfo.isSymbolicLink()) continue;
        // A later resumed run supersedes old failed attempts; old reports must not compete with it.
        const names = (await readdir(folder)).filter(name => /^\d{4}-\d{2}-\d{2}T[A-Za-z0-9.-]+Z$/.test(name))
            .sort().reverse().slice(0, 1);
        for (const name of names) {
            const reportPath = `.codex-runs/${stack.folderName}/${name}/run.json`;
            const directory = join(folder, name), file = join(directory, 'run.json');
            const [dirInfo, fileInfo] = await Promise.all([lstat(directory).catch(() => undefined), lstat(file).catch(() => undefined)]);
            if (!dirInfo?.isDirectory() || dirInfo.isSymbolicLink() || !fileInfo?.isFile() || fileInfo.isSymbolicLink() || fileInfo.size > 512_000) continue;
            let report: unknown;
            const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
            try { report = JSON.parse((await handle.readFile()).toString('utf8')); } catch { /* Untrusted report remains unknown. */ }
            finally { await handle.close(); }
            if (!report || typeof report !== 'object') continue;
            const data = report as { taskFolder?: unknown; phase?: unknown; stackMode?: unknown; prompts?: unknown };
            if (data.taskFolder !== stack.folderName || data.phase !== stack.phase || data.stackMode !== stack.mode ||
                !Array.isArray(data.prompts) || data.prompts.length !== stack.prompts.length) continue;
            let previousIndex = evidence.history.length;
            let prefix = 0;
            let previousSha: string | undefined;
            for (const prompt of stack.prompts) {
                const record = data.prompts[prompt.number - 1] as Record<string, unknown> | undefined;
                if (!record || record.number !== prompt.number || record.filename !== prompt.path.split('/').at(-1) ||
                    record.kind !== prompt.kind || !['passed', 'previously_completed'].includes(record.status as string) ||
                    typeof record.commitSha !== 'string' ||
                    !sha.test(record.commitSha)) break;
                const subject = stack.mode === 'correction' ? `${stack.folderName}/P${prompt.number}: ${prompt.title}` : prompt.version;
                const historyIndex = evidence.history.findIndex(item => item.sha === record.commitSha && item.subject === subject);
                if (stack.mode === 'correction' && evidence.history.filter(item => item.subject === subject).length !== 1) break;
                if (historyIndex < 0 || historyIndex >= previousIndex) break;
                if (previousSha && (await git(root, ['rev-parse', `${record.commitSha}^`])).trim() !== previousSha) break;
                if (prompt.number === 1) {
                    let driftedSource: RoadmapTaskStack['prompts'][number] | undefined;
                    for (const source of stack.prompts) {
                        const atCheckpoint = await git(root, ['show', `${record.commitSha}:${source.path}`]).catch(() => undefined);
                        if (atCheckpoint === undefined || hash(atCheckpoint) !== source.fingerprint) {
                            driftedSource = source; break;
                        }
                    }
                    if (driftedSource) {
                        result.blocked.push({ projectId: index.projectId, stackPath: stack.path,
                            stackFingerprint: stack.fingerprint!, entryNumber: driftedSource.number,
                            reason: 'source-drift', verified: true });
                        result.diagnostics.push(`${driftedSource.path}: Authored source differs from the first runner checkpoint.`);
                        break;
                    }
                }
                const committedText = await git(root, ['show', `${record.commitSha}:${prompt.path}`]).catch(() => undefined);
                if (committedText === undefined || hash(committedText) !== prompt.fingerprint) {
                    result.blocked.push({ projectId: index.projectId, stackPath: stack.path,
                        stackFingerprint: stack.fingerprint!, entryNumber: prompt.number,
                        reason: 'source-drift', verified: true });
                    result.diagnostics.push(`${prompt.path}: Authored source differs from its runner checkpoint.`);
                    break;
                }
                previousIndex = historyIndex;
                previousSha = record.commitSha;
                prefix++;
                result.checkpoints.push({ projectId: index.projectId, stackPath: stack.path,
                    stackFingerprint: stack.fingerprint!, entryNumber: prompt.number, promptFingerprint: prompt.fingerprint,
                    sha: record.commitSha, runnerReport: reportPath, verified: true });
            }
            if (prefix < stack.prompts.filter(prompt => prompt.kind === 'implementation' && !prompt.browserRequired).length) {
                const current = data.prompts[prefix] as { status?: unknown } | undefined;
                if (prefix && ['interrupted', 'failed', 'blocked'].includes(current?.status as string))
                    result.blocked.push({ projectId: index.projectId, stackPath: stack.path,
                        stackFingerprint: stack.fingerprint!, entryNumber: prefix + 1,
                        reason: `runner-${current?.status}`, verified: true });
                else result.diagnostics.push(`${stack.path}: Latest runner report has no verified complete prefix for the next prompt.`);
            }
        }
    }
    const cited = await citedEvidence(root, index, stacks);
    result.qualifications = cited.qualifications;
    result.failedPromptEvidence = cited.failedPromptEvidence;
    // One Git checkpoint may be independently known to Work and the runner. Two Work
    // claims for the same prompt are ambiguous and must not become one green claim.
    const claims = new Map<string, PhaseFocusCheckpointEvidence[]>();
    for (const checkpoint of result.checkpoints) {
        const key = `${checkpoint.stackPath}\0${checkpoint.entryNumber}\0${checkpoint.sha}`;
        claims.set(key, [...(claims.get(key) ?? []), checkpoint]);
    }
    result.checkpoints = [];
    for (const group of claims.values()) {
        const work = group.filter(item => item.taskId && item.runId);
        const selected = work.length === 1 ? work[0] : work.length === 0 && group.length === 1 ? group[0] : undefined;
        if (work.length > 1 || !selected) {
            result.diagnostics.push(`${group[0].stackPath}: Ambiguous checkpoint evidence for P${group[0].entryNumber}.`);
            continue;
        }
        result.checkpoints.push(selected);
    }
    if ((await git(root, ['rev-parse', '--verify', 'HEAD'])).trim() !== evidence.head)
        throw new Error('Git basis changed during Phase Focus evidence read');
    return result;
}
