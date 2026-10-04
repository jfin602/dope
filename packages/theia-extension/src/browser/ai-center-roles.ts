import { AI_ROLE_IDS, AI_ROLE_POLICY_VERSION, parseAIRolePolicy, resolveAIRole } from '@dope/ai';
import type { AIRoleHardConstraints, AIRoleId, AIRolePolicy, AIRolePolicyEntry, AIRolePolicySnapshot,
    AIRoleResolution, AIRoleTarget } from '@dope/ai';
import type { AIInventoryState } from '@dope/contracts/lib/ai-registry-service';
import type { AIRolePolicyService } from '@dope/contracts/lib/ai-role-policy-service';

export const ROLE_DETAILS: Record<AIRoleId, { name: string; purpose: string; authority: string; active: boolean }> = {
    interactive: { name: 'Interactive', purpose: 'Responsive foreground assistance',
        authority: 'Chat consent for hosted project data belongs to the Chat request.', active: false },
    'deep-reasoning': { name: 'Deep Reasoning', purpose: 'Deliberate, heavier foreground analysis',
        authority: 'A future requesting feature must authorize hosted data transfer.', active: false },
    background: { name: 'Background', purpose: 'Non-interactive work',
        authority: 'Future background work may require Local-only execution and cannot enable hosted egress here.', active: false },
    'software-map': { name: 'Software Map', purpose: 'Architecture synthesis and Search Deeper',
        authority: 'Software Map still requires run-level exact target selection and project-evidence egress approval.', active: false },
    'coding-agent': { name: 'Coding Agent', purpose: 'Future delegated coding work',
        authority: 'No active consumer yet. Future coding authority cannot be granted here.', active: false }
};

export const emptyRoleHard = (): AIRoleHardConstraints => ({ requiredCapabilities: [], locality: 'any',
    enabledOnly: true, usableOnly: true, hostedProjectData: 'requires-feature-authorization' });

export function roleEntryLabel(entry: AIRolePolicyEntry | undefined, state?: AIInventoryState): string {
    if (!entry) return 'Not configured';
    if (entry.type === 'constraints') return `Matching models (${entry.hard.locality})`;
    const connection = state?.registry.connections.find(item => item.id === entry.target.connectionId);
    const model = state?.registry.models.find(item => item.connectionId === entry.target.connectionId &&
        item.providerModelKey === entry.target.modelId);
    return `${connection?.alias ?? entry.lastKnown?.connectionLabel ?? 'Removed connection'} · ${
        model?.label ?? entry.lastKnown?.modelLabel ?? 'Removed model'}`;
}

export function roleTargetLabel(target: AIRoleTarget, state: AIInventoryState): string {
    return roleEntryLabel({ type: 'exact', target }, state);
}

export const ROLE_REASON_LABELS: Record<string, string> = {
    'missing-connection': 'Connection removed', 'missing-model': 'Model removed', disabled: 'Disabled',
    unavailable: 'Unavailable or Local model not loaded', locality: 'Locality does not match',
    'hosted-egress-not-authorized': 'Hosted project-data egress needs feature approval',
    'hosted-egress-forbidden': 'Hosted project-data egress forbidden by role',
    'capability-unknown': 'Required capability unknown', 'capability-unsupported': 'Required capability unsupported',
    'context-unknown': 'Loaded context unknown', 'context-too-small': 'Known context too small',
    'already-candidate': 'Already in an earlier entry', 'fallback-disabled': 'Fallback disabled',
    'contradictory-constraints': 'Contradictory constraints', 'no-matching-model': 'No matching models'
};

/** The active-consumer set grows only when a feature actually starts routing through a role. */
export function roleWarning(snapshot: AIRolePolicySnapshot, state: AIInventoryState): boolean {
    return AI_ROLE_IDS.some(roleId => ROLE_DETAILS[roleId].active &&
        ['needs-configuration', 'broken', 'unavailable', 'using-fallback'].includes(
            roleResolution(snapshot, state, roleId, true).health));
}

export function roleResolution(snapshot: AIRolePolicySnapshot, state: AIInventoryState, roleId: AIRoleId,
    hostedProjectDataAuthorized: boolean): AIRoleResolution {
    return resolveAIRole({ policy: snapshot, inventory: state.registry, observations: state.observations,
        loadedLocalModels: state.loadedLocalModels ?? [], roleId, requestHard: emptyRoleHard(),
        hostedProjectDataAuthorized });
}

export class AICenterRolesController {
    snapshot?: AIRolePolicySnapshot;
    selectedId: AIRoleId = 'interactive';
    draft?: AIRolePolicy;
    dirty = false;
    busy = false;
    message = '';
    private serial = 0;
    private draftRevision = 0;

    constructor(private readonly service: AIRolePolicyService, private readonly changed: () => void) {}

    async load(): Promise<void> {
        const serial = ++this.serial;
        try {
            const snapshot = await this.service.list();
            if (serial !== this.serial) return;
            this.snapshot = snapshot;
            if (!this.dirty) {
                this.draft = structuredClone(snapshot.policies.find(item => item.roleId === this.selectedId));
                this.draftRevision = snapshot.revision;
            }
            this.changed();
        } catch {
            if (serial === this.serial) { this.message = 'Role policies could not be loaded. Try again.'; this.changed(); }
        }
    }

    select(id: AIRoleId): void {
        if (this.busy) return;
        this.selectedId = id;
        this.draft = structuredClone(this.snapshot?.policies.find(item => item.roleId === id));
        this.draftRevision = this.snapshot?.revision ?? 0;
        this.dirty = false;
        this.message = '';
        this.changed();
    }

    edit(change: (draft: AIRolePolicy) => AIRolePolicy): void {
        if (!this.draft) return;
        this.draft = change(this.draft);
        this.dirty = true;
        this.changed();
    }

    move(from: number, to: number): void {
        if (!this.draft || to < 0 || to >= this.draft.fallbacks.length || from === to) return;
        this.edit(draft => {
            const fallbacks = [...draft.fallbacks];
            fallbacks.splice(to, 0, ...fallbacks.splice(from, 1));
            return { ...draft, fallbacks };
        });
    }

    async save(): Promise<boolean> {
        if (!this.snapshot || !this.draft || this.busy) return false;
        let policy: AIRolePolicy;
        try { policy = parseAIRolePolicy(this.draft); }
        catch { this.message = 'Review role entries and constraints before saving.'; this.changed(); return false; }
        this.busy = true; this.message = ''; this.changed();
        try {
            const next = await this.service.mutate({ version: AI_ROLE_POLICY_VERSION,
                expectedRevision: this.draftRevision, policy });
            this.snapshot = next;
            this.draftRevision = next.revision;
            this.draft = structuredClone(next.policies.find(item => item.roleId === this.selectedId));
            this.dirty = false;
            this.message = 'Role policy saved.';
            return true;
        } catch {
            this.message = 'Role policy could not be saved. It may have changed elsewhere; reload and try again.';
            return false;
        } finally { this.busy = false; this.changed(); }
    }
}
