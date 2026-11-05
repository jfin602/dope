import type { AgentRun, TaskContractSnapshot, WorkDocumentRead } from '@dope/agent-core';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import { checkEffect, projectPath } from '@dope/agent-core';
import type { ExecutionGrant } from '@dope/agent-core';

/** Recheck file bytes in the restored candidate without placing source text in run state. */
export async function verifyRecoveryReads(candidateRoot: string, grant: ExecutionGrant,
    reads: readonly WorkDocumentRead[]): Promise<WorkDocumentRead[]> {
    const verified = new Map<string, { contentHash: string; fileBytes: number }>();
    for (const read of reads) {
        const path = projectPath(read.path);
        if (!read.contentHash) throw new Error(`Document finding source identity unavailable: ${path}`);
        if (!checkEffect(grant, { kind: 'workspace-read', scope: 'workspace', path }).allowed)
            throw new Error(`Fresh grant cannot verify document finding: ${path}`);
        if (!verified.has(path)) {
            let current = candidateRoot;
            for (const part of path.split('/').slice(0, -1)) {
                current = join(current, part);
                const stat = await lstat(current);
                if (!stat.isDirectory() || stat.isSymbolicLink())
                    throw new Error(`Document finding path changed: ${path}`);
            }
            const handle = await open(join(candidateRoot, path), constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                const stat = await handle.stat();
                if (!stat.isFile() || stat.size > 32 * 1024 * 1024)
                    throw new Error(`Document finding file unavailable: ${path}`);
                const bytes = await handle.readFile();
                verified.set(path, { contentHash: createHash('sha256').update(bytes).digest('hex'),
                    fileBytes: bytes.length });
            } finally { await handle.close(); }
        }
        const actual = verified.get(path)!;
        if (actual.contentHash !== read.contentHash || actual.fileBytes !== read.fileBytes)
            throw new Error(`Document finding source changed: ${path}`);
    }
    return [...reads];
}

/** A compact account of owner-backed facts. It never makes a prior run executable. */
export function workRecoveryContext(current: TaskContractSnapshot,
    prior?: AgentRun): { text: string; reads: WorkDocumentRead[] } {
    const acceptance = current.acceptance === 'unknown' ? 'unknown' : current.acceptance.join('; ');
    const links = current.roadmap === 'unknown' ? 'unknown' : current.roadmap.links
        .map(link => `${link.gateId}/${link.criterionId}: ${link.expectedResult}`).join('; ') || 'none';
    const validation = current.validation.map(target => `${target.kind}: ${target.label}`).join('; ') || 'none';
    const lines = [
        'DOPE CHECKED TASK RECOVERY (owner records, not model memory or a grant)',
        `Original accepted objective: ${current.objective}`,
        `Acceptance: ${acceptance}`,
        `Roadmap expected results: ${links}`,
        `Approved verification targets: ${validation}`,
        `Accepted step plan: only the frozen task instructions are authoritative; separate step completion unknown.`,
        `Planning basis: ${current.planning === 'unknown' ? 'unknown' :
            `${current.planning.mapId}/${current.planning.workItemId} revision ${current.planning.mapRevision}`}`,
        `Source HEAD: ${current.sourceHead}; current grant ${current.grant.id} revision ${current.grant.revision}.`,
    ];
    let reads: WorkDocumentRead[] = [];
    if (prior) {
        const previous = prior.taskContract;
        if (!previous || prior.basis?.head !== current.sourceHead ||
            previous.sourceHead !== current.sourceHead || previous.objective !== current.objective ||
            previous.instructionsHash !== current.instructionsHash ||
            JSON.stringify(previous.acceptance) !== JSON.stringify(current.acceptance) ||
            JSON.stringify(previous.planning) !== JSON.stringify(current.planning) ||
            JSON.stringify(previous.roadmap) !== JSON.stringify(current.roadmap) ||
            JSON.stringify(previous.validation) !== JSON.stringify(current.validation))
            throw new Error('Original Task Contract checkpoint missing or accepted basis changed; prepare a new reviewed task');
        reads = prior.documentReads ?? [];
        lines.push(`Prior run ${prior.id}: ${prior.status}; candidate ${prior.candidateFingerprint ?? 'unknown'}.`);
        lines.push(`Actual candidate effects: ${prior.candidateDelta?.effects.map(effect =>
            `${effect.kind} ${effect.path}`).join('; ') || 'none recorded'}.`);
        lines.push(`Actual Dope verification: ${prior.validationResults.filter(item => item.owner === 'dope')
            .map(item => `${item.label} ${item.status}`).join('; ') || 'none recorded'}.`);
        lines.push(`Prior command outcomes: ${prior.commandEvidence?.map(item =>
            `${item.commandSummary} ${item.result}`).join('; ') || 'none recorded'}.`);
        lines.push(`Prior Pi compaction: ${prior.contextCompactions?.map(item =>
            `${item.reason} ${item.result}`).join('; ') || 'none recorded'}; summary content unverified.`);
        lines.push(`Prior interruption: ${prior.outcome?.summary ?? 'unknown'}; candidate review: ${prior.candidateReview ? 'pending' :
            prior.reviewDecision?.kind ?? 'unknown'}.`);
        lines.push(`Observed document ranges: ${reads.length ? reads.map(read =>
            `${read.path}${read.section ? `#${read.section}` : ''} bytes ${read.offset}-${read.endOffset} content SHA-256 ${read.contentHash ?? 'unknown'} (question: ${read.question})`)
            .join('; ') : 'none recorded'}.`);
        lines.push('Document meaning/findings: unknown unless independently established from current source. ' +
            'Unresolved questions: unknown. Last model summary: unverified. ' +
            'Next step: inspect the restored candidate and current requirements before the affected edit or test. ' +
            'Do not replay old mutations or infer GREEN from a read, command, or candidate.');
    } else {
        lines.push('Document findings, unresolved questions, actual edits/tests and next step: unknown until observed in this run.');
    }
    const text = lines.join('\n');
    if (Buffer.byteLength(text, 'utf8') > 12_000)
        throw new Error('Checked Task Contract exceeds bounded Work recovery context');
    return { text, reads };
}
