import { parseArchitecture, projectPath } from './architecture';
import type { ArchitectureDeclaration } from './contracts';
import type { ArchitectureReviewNode } from './service';

export interface ReviewIssue {
    code: string;
    message: string;
    proposalKeys: string[];
    canonicalIds: string[];
    paths: string[];
}

/** The only review-to-canonical projection. It preserves root arrays and current omission rules. */
export function reviewDeclaration(draft: ArchitectureReviewNode[]): ArchitectureDeclaration {
    const systems = draft.filter(node => node.kind === 'system').map(system => ({
        id: system.id, name: system.name, purpose: system.purpose,
        ...(system.roots.length ? { roots: system.roots } : {}),
        subsystems: draft.filter(node => node.kind === 'subsystem' && node.parentProposalKey === system.proposalKey).map(subsystem => ({
            id: subsystem.id, name: subsystem.name, purpose: subsystem.purpose, roots: subsystem.roots,
            components: draft.filter(node => node.kind === 'component' && node.parentProposalKey === subsystem.proposalKey).map(component => ({
                id: component.id, name: component.name, purpose: component.purpose, roots: component.roots,
            })),
        })),
    }));
    return { schemaVersion: 1, systems };
}

export function reviewDiagnostics(draft: ArchitectureReviewNode[]): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const add = (code: string, message: string, nodes: ArchitectureReviewNode[] = [], paths: string[] = []) =>
        issues.push({ code, message, proposalKeys: [...new Set(nodes.map(node => node.proposalKey))].sort(),
            canonicalIds: [...new Set(nodes.map(node => node.id))].sort(), paths: [...new Set(paths)].sort() });
    if (!Array.isArray(draft) || !draft.length) {
        add('systems_required', 'At least one System is required');
        return issues;
    }
    const byKey = new Map<string, ArchitectureReviewNode[]>();
    const byId = new Map<string, ArchitectureReviewNode[]>();
    const byRoot = new Map<string, ArchitectureReviewNode[]>();
    for (const node of draft) {
        const keyOwners = byKey.get(node.proposalKey) ?? []; keyOwners.push(node); byKey.set(node.proposalKey, keyOwners);
        const idOwners = byId.get(node.id) ?? []; idOwners.push(node); byId.set(node.id, idOwners);
        if (typeof node.id !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(node.id)) add('invalid_id', `Invalid canonical ID: ${JSON.stringify(node.id)}`, [node]);
        if (typeof node.name !== 'string' || !node.name.trim() || node.name !== node.name.trim()) add('invalid_name', `Invalid name for ${node.proposalKey}`, [node]);
        if (typeof node.purpose !== 'string' || !node.purpose.trim() || node.purpose !== node.purpose.trim()) add('invalid_purpose', `Invalid purpose for ${node.proposalKey}`, [node]);
        if (node.kind !== 'system' && node.kind !== 'subsystem' && node.kind !== 'component') add('invalid_kind', `Invalid kind for ${node.proposalKey}`, [node]);
        if (node.kind !== 'system' && !node.roots?.length) add('roots_required', `Implementation roots required for ${node.proposalKey}`, [node]);
        if (!Array.isArray(node.roots)) { add('malformed_roots', `Malformed roots for ${node.proposalKey}`, [node]); continue; }
        const ownRoots = new Set<string>();
        for (const root of node.roots) {
            if (typeof root !== 'string' || !root.trim() || root !== root.trim()) {
                add('malformed_root', `Malformed root for ${node.proposalKey}: ${JSON.stringify(root)}`, [node]); continue;
            }
            try { projectPath(root); } catch { add('unsafe_root', `Unsafe root for ${node.proposalKey}: ${root}`, [node], [root]); continue; }
            if (ownRoots.has(root)) { add('duplicate_root', `Repeated root ${root} in ${node.proposalKey}`, [node], [root]); continue; }
            ownRoots.add(root);
            const owners = byRoot.get(root) ?? []; owners.push(node); byRoot.set(root, owners);
        }
    }
    if (!draft.some(node => node.kind === 'system')) add('systems_required', 'At least one System is required');
    for (const [key, nodes] of byKey) if (nodes.length > 1) add('duplicate_proposal_key', `Duplicate proposal key ${key}`, nodes);
    for (const [id, nodes] of byId) if (nodes.length > 1) add('duplicate_id', `Duplicate canonical ID ${id}`, nodes);
    for (const [root, nodes] of byRoot) if (nodes.length > 1)
        add('ambiguous_root', `Ownership root ${root} is claimed by ${nodes.map(node => `${node.proposalKey} (${node.id})`).sort().join(', ')}`, nodes, [root]);
    for (const node of draft) {
        if (node.kind === 'system') {
            if (node.parentProposalKey !== null) add('invalid_parent', `System ${node.proposalKey} must not have a parent`, [node]);
            if (!draft.some(child => child.kind === 'subsystem' && child.parentProposalKey === node.proposalKey))
                add('subsystems_required', `System ${node.proposalKey} needs a Subsystem`, [node]);
        } else if (node.kind === 'subsystem' || node.kind === 'component') {
            const parents = byKey.get(node.parentProposalKey ?? '') ?? [];
            if (!parents.length) add('missing_parent', `Missing parent for ${node.proposalKey}`, [node]);
            else if (parents.length !== 1 || parents[0].kind !== (node.kind === 'subsystem' ? 'system' : 'subsystem'))
                add('invalid_parent', `Invalid parent for ${node.proposalKey}`, [node, ...parents]);
        }
    }
    // The strict parser remains the final gate. This fallback exposes any schema rule the
    // per-node pass did not classify, including future declaration/dependency constraints.
    try { parseArchitecture(reviewDeclaration(draft)); }
    catch (error) {
        if (!issues.length) add('declaration_invalid', String(error));
    }
    return issues.sort((a, b) => a.code.localeCompare(b.code) || a.message.localeCompare(b.message) ||
        a.proposalKeys.join('\0').localeCompare(b.proposalKeys.join('\0')));
}
