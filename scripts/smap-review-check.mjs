import { realpath } from 'node:fs/promises';
import { readSynthesisRun } from '@dope/code-analysis/lib/node/smap-analysis-file.js';
import { readInitialization } from '@dope/code-analysis/lib/node/smap-initialization-file.js';
import { collectArchitectureEvidence } from '@dope/code-analysis/lib/node/architecture-evidence.js';
import { TypeScriptAnalyzer } from '@dope/code-analysis-typescript';
import { reviewDiagnostics } from '@dope/software-map';

const args = process.argv.slice(2);
const json = args.includes('--json');
const project = args.filter(arg => arg !== '--json');
if (project.length !== 1) {
    process.stderr.write('Usage: npm run smap:review:check -- <project> [--json]\n');
    process.exitCode = 2;
} else {
    try {
        const root = await realpath(project[0]);
        const run = await readSynthesisRun(root);
        if (run?.status !== 'review_required' || !run.review) throw new Error('No persisted review_required Software Map work');
        const initialization = await readInitialization(root);
        const evidence = await collectArchitectureEvidence(root, new TypeScriptAnalyzer());
        const stale = [
            ...(initialization.initialized ? ['already_initialized'] : []),
            ...(initialization.declarationFingerprint !== run.declarationFingerprint ? ['declaration_changed'] : []),
            ...(evidence.sourceFingerprint !== run.review.packet.sourceFingerprint ? ['source_changed'] : []),
        ];
        const issues = reviewDiagnostics(run.review.draft);
        const result = { reviewId: run.review.reviewId, revision: run.review.revision, stale, blockers: issues };
        if (json) process.stdout.write(`${JSON.stringify(result)}\n`);
        else {
            process.stdout.write(`Review ${result.reviewId} revision ${result.revision}: ${issues.length} blocker(s)\n`);
            for (const issue of issues) process.stdout.write(`  ${issue.code}: ${issue.message}${issue.paths.length ? ` [${issue.paths.join(', ')}]` : ''}${issue.proposalKeys.length ? ` (${issue.proposalKeys.join(', ')})` : ''}\n`);
            process.stdout.write(`Staleness: ${stale.length ? stale.join(', ') : 'none'}\n`);
        }
        if (issues.length || stale.length) process.exitCode = 1;
    } catch (error) {
        if (json) process.stdout.write(`${JSON.stringify({ error: String(error) })}\n`);
        else process.stderr.write(`${String(error)}\n`);
        process.exitCode = 2;
    }
}
