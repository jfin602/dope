import type { LocalImplementationPlan } from './roadmap-local-model';

export interface PlanRequirement { id: string; text: string; terms: string[] }
export interface PlanRequirementCoverage { requirement: PlanRequirement; stepNumbers: number[];
    deliverables: string[]; acceptanceCriteria: string[];
    status: 'covered' | 'needs-review' | 'missing'; explanation: string; complete: boolean }

const ignored = new Set(['a', 'an', 'and', 'before', 'complete', 'existing', 'files', 'for', 'from',
    'give', 'implementation', 'in', 'inspect', 'keep', 'me', 'of', 'ordered', 'plan', 'please',
    'project', 'put', 'relevant', 'src', 'js', 'the', 'this', 'with']);
const term = (word: string): string => word.endsWith('ies') && word.length > 4 ? `${word.slice(0, -3)}y` :
    word.endsWith('s') && word.length > 4 ? word.slice(0, -1) : word;
const terms = (value: string): string[] => [...new Set(value.replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase().match(/[a-z][a-z0-9]*/g)?.map(term).filter(word => word.length > 2 && !ignored.has(word)) ?? [])];

/** Stable IDs are owned by Dope; these are request clauses, not a product-wide feature taxonomy. */
export function planRequirements(content: string): PlanRequirement[] {
    const clauses = content.split(/(?<=[.!?;])\s+|;\s*/).map(value => value.trim().replace(/[.!?;]+$/, ''));
    const meaningful = clauses.flatMap(clause => {
        if (/^please\s+inspect\b/i.test(clause)) return /\btests?\b/i.test(clause) ? ['tests'] : [];
        return clause ? [clause] : [];
    }).slice(0, 12);
    return meaningful.map((text, index) => ({ id: `R${index + 1}`, text, terms: terms(text) }))
        .filter(item => item.terms.length > 0);
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
