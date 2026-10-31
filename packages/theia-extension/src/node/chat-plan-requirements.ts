import type { LocalImplementationPlan } from './roadmap-local-model';

export interface PlanRequirement { id: string; text: string; terms: string[] }
export interface PlanRequirementCoverage { requirement: PlanRequirement; stepNumbers: number[];
    deliverables: string[]; acceptanceCriteria: string[];
    status: 'covered' | 'needs-review' | 'missing'; explanation: string; complete: boolean }

const ignored = new Set(['a', 'an', 'and', 'before', 'complete', 'existing', 'files', 'for', 'from',
    'give', 'implementation', 'in', 'inspect', 'keep', 'me', 'of', 'ordered', 'plan', 'please',
    'project', 'put', 'relevant', 'src', 'js', 'that', 'the', 'this', 'with']);
const term = (word: string): string => word.endsWith('ies') && word.length > 4 ? `${word.slice(0, -3)}y` :
    word.endsWith('s') && word.length > 4 ? word.slice(0, -1) : word;
const terms = (value: string): string[] => [...new Set(value.replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase().match(/[a-z][a-z0-9]*/g)?.map(term).filter(word => word.length > 2 && !ignored.has(word)) ?? [])];
const requestClauses = (content: string): string[] => content.split(/(?<=[.!?;])\s+|;\s*|\n+(?=\s*[-*]\s+)/)
    .map(value => value.trim().replace(/^[-*]\s+/, '').replace(/[.!?;]+$/, ''));

export function planForbidsCommands(content: string): boolean {
    return requestClauses(content).some(clause =>
        /\bdo\s+not\b.{0,160}\b(?:execute|run)\s+commands?\b\s*(?:,|$)/i.test(clause));
}

/** Small exact reminders, not an additional source or generated summary. */
export function planOutputDirectives(content: string): string[] {
    return requestClauses(content).filter(clause => /^(?:use|do not|test that|reuse|include|keep)\b/i.test(clause))
        .filter(clause => !/^do not\s+(?:modify|edit|run|apply)\b/i.test(clause)).slice(0, 8);
}

/** Stable IDs are owned by Dope; these are request clauses, not a product-wide feature taxonomy. */
export function planRequirements(content: string): PlanRequirement[] {
    const clauses = requestClauses(content);
    const meaningful = clauses.flatMap(clause => {
        // Investigation, review and no-write directions govern the planning workflow.
        // A generic milestone request names no product capability to score lexically;
        // the typed plan still requires concrete steps, deliverables and tests.
        if (/^(?:please\s+)?inspect\b.*\bprepare\b.*\b(?:development\s+)?milestone\b/i.test(clause) ||
            /^inspect\b.*\busing\s+your\s+(?:(?:available|project|file)\s+)?tools\b/i.test(clause)) return [];
        const plannedCapability = /^(?:(?:inspect\b.+?\band\s+)?prepare)\b.*\b(?:implementation\s+)?plan\s+(?:(?:for|to)\s+)(.+)$/i.exec(clause);
        if (plannedCapability) return [plannedCapability[1]];
        if (/^identify\b.*\bpresent\b.*\bproposal\s+for\s+review\b/i.test(clause)) return [];
        if (/^prepare\b.*\b(?:implementation\s+)?plan\b/i.test(clause)) return [];
        if (/^requirements:$/i.test(clause) || /^(?:include|finish|do not|propose the smallest)\b/i.test(clause) ||
            /^keep\s+(?:the\s+)?implementation\s+small\b/i.test(clause)) return [];
        if (/^reuse\b.*\b(?:existing\s+(?:increment\s+)?(?:function|implementation)|rather\s+than\s+rewriting)\b/i.test(clause)) return [];
        if (/^(?:please\s+)?present\b.*\b(?:proposal|plan)\b.*\breview\b/i.test(clause)) return [];
        if (/^please\s+inspect\b/i.test(clause)) return /\btests?\b/i.test(clause) ? ['tests'] : [];
        return clause ? [clause] : [];
    }).slice(0, 12);
    return meaningful.map((text, index) => ({ id: `R${index + 1}`, text, terms: terms(text) }))
        .filter(item => item.terms.length > 0);
}

/** Check literal developer constraints that can be decided without model interpretation. */
export function planExplicitConstraintViolations(content: string, plan: LocalImplementationPlan,
    verifiedFiles: readonly string[] = []): string[] {
    // Exclude the plan's constraints/assumptions: stating a prohibition is not proposing it.
    const fragments = [plan.objective, ...plan.successCriteria, ...plan.steps.flatMap(step =>
        [step.title, step.detail, ...step.deliverables]), ...plan.tests, plan.guiQualification,
        ...plan.alternatives, plan.question];
    const proposed = fragments.join(' ');
    const proposedLower = proposed.toLowerCase();
    const violations: string[] = [];
    for (const clause of requestClauses(content)) {
        const forbidden = /^do\s+not\s+(?:introduce|add|use|include|install|recommend)\s+(.+)$/i.exec(clause);
        if (forbidden) for (const item of forbidden[1].split(/,\s*|\s+or\s+/i).map(value =>
            value.trim().replace(/^(?:a|an|any)\s+/i, '')).filter(Boolean)) {
            if (/^new\s+dependenc(?:y|ies)$/i.test(item)) {
                if (fragments.some(fragment => /\b(?:npm\s+install|yarn\s+add)\b/i.test(fragment) ||
                    [...fragment.matchAll(/\b(?:add|install|introduce|include|require)\b.{0,50}\b(?:new\s+)?(?:dev)?dependenc(?:y|ies)\b/gi)]
                        .some(match => !/\b(?:no|without|avoid|zero)\b/i.test(match[0]))))
                    violations.push(`Proposed new dependencies despite: ${clause}`);
            } else if (new RegExp(`\\b${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(proposed)) {
                violations.push(`Proposed forbidden item ${item} despite: ${clause}`);
            }
        }
        const requiredUse = /^use\s+(.+)$/i.exec(clause);
        if (requiredUse) {
            const requiredTerms = terms(requiredUse[1]);
            const found = terms(proposedLower);
            if (requiredTerms.some(word => !found.includes(word)))
                violations.push(`Requested use is not demonstrated: ${clause}`);
            // This is conditional on the developer's exact runner choice, not a default for plans.
            if (/^Node's\s+built-in\s+test\s+runner$/i.test(requiredUse[1]) &&
                (!/\bnode:test\b/i.test(proposed) || !/\bnode\s+--test\b/i.test(proposed)))
                violations.push(`Requested Node test runner is not implemented by a node:test case and node --test validation: ${clause}`);
        }
        const testResult = /^test\s+that\s+(.+?)\s+returns?\s+(.+)$/i.exec(clause);
        if (testResult) {
            const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const assertion = new RegExp(`${escape(testResult[1])}.{0,80}(?:returns?|equals?|equal|===|==|,|toBe)\\s*${escape(testResult[2])}\\b`, 'i');
            if (!fragments.some(fragment => assertion.test(fragment)))
                violations.push(`Requested test result is absent: ${clause}`);
        }
        if (/\breuse\b.*\bexisting\s+(?:(?:increment|[a-z][a-z0-9]*)\s+)?(?:implementation|function)\b/i.test(clause) &&
            !plan.steps.some(step => step.reuse.some(item => verifiedFiles.includes(item.path))))
            violations.push(`Requested existing function has no verified reuse path: ${clause}`);
    }
    return violations.slice(0, 8);
}

/** A lexical match is evidence of relevance, never semantic proof. Unclear mappings stay non-approvable. */
export function planRequirementCoverage(requirements: readonly PlanRequirement[], plan: LocalImplementationPlan): PlanRequirementCoverage[] {
    const checks = [...plan.successCriteria, ...plan.tests, plan.guiQualification];
    return requirements.map(requirement => {
        const core = requirement.terms.filter(word =>
            !['functional', 'visual', 'explicit', 'implementation', 'verification', 'read', 'only'].includes(word));
        const matches = plan.steps.map((step, index) => {
            const work = terms(`${step.title} ${step.detail} ${step.deliverables.join(' ')} ` +
                step.reuse.map(item => item.reason).join(' '));
            const shared = requirement.terms.filter(word => work.includes(word));
            return { index: index + 1, step, shared };
        }).filter(item => item.shared.some(word => core.includes(word)));
        const stepNumbers = matches.map(item => item.index);
        const deliverables = matches.flatMap(item => item.step.deliverables);
        const acceptanceCriteria = requirement.terms.length === 1 && requirement.terms[0] === 'test' ?
            plan.tests : checks.filter(value => requirement.terms.some(word => terms(value).includes(word)));
        const found = new Set(matches.flatMap(item => item.shared));
        const unmatched = requirement.terms.filter(word => !found.has(word));
        const explicit = unmatched.length <= 1;
        const hasWork = matches.some(item => item.shared.some(word =>
            terms(item.step.detail).includes(word)) && item.step.deliverables.length > 0);
        const hasExecution = matches.some(item =>
            ['call', 'invoke', 'execute', 'perform', 'wire', 'connect'].some(verb =>
                terms(item.step.detail).includes(verb)));
        const hasOperation = matches.some(item =>
            ['call', 'invoke', 'execute', 'perform'].some(verb =>
                terms(item.step.detail).includes(verb)));
        const functional = requirement.terms.some(word => ['functional', 'creation', 'operation'].includes(word));
        const missingAuthority = requirement.terms.some(word => ['authorization', 'permission', 'approval', 'explicit'].includes(word) &&
            !found.has(word));
        const actionInControl = requirement.terms.some(word => ['toolbar', 'button', 'control'].includes(word)) &&
            requirement.terms.some(word => !['toolbar', 'button', 'control'].includes(word));
        const status = !matches.length || missingAuthority || functional && !hasOperation ? 'missing' :
            !acceptanceCriteria.length || !hasWork || !explicit || actionInControl && !hasExecution ?
                'needs-review' : 'covered';
        const explanation = !matches.length ? 'No implementation step maps to this request.' :
            missingAuthority ? 'The required authorization work is absent from implementation steps.' :
            functional && !hasOperation ? 'A control or mention does not establish the requested functional operation.' :
            !hasWork ? 'The requested capability appears, but concrete implementation work is unclear.' :
            !acceptanceCriteria.length ? 'Implementation work appears, but verification is not established.' :
            actionInControl && !hasExecution ? 'A control is planned, but its underlying action is not clearly connected to execution.' :
            !explicit ? 'Related work appears, but differently worded or missing capability details need review.' :
            'Implementation detail, deliverable and verification are present; review the cited work before approval.';
        return { requirement, stepNumbers, deliverables, acceptanceCriteria, status, explanation,
            complete: status === 'covered' };
    });
}
