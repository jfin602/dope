import { BaseWidget, codicon, Message } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import { PhaseStackController } from './phase-stack-controller';

export const PHASE_STACK_ID = 'dope-phase-stack';
function el<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, content?: string): HTMLElementTagNameMap[Tag] {
    const node = document.createElement(tag); if (content !== undefined) node.textContent = content; return node;
}
function button(label: string, click: () => void, disabled = false): HTMLButtonElement {
    const node = el('button', label); node.type = 'button'; node.onclick = click; node.disabled = disabled;
    node.setAttribute('aria-label', label); return node;
}
export class PhaseStackWidget extends BaseWidget {
    controller: PhaseStackController;
    private readonly content = el('div');
    private timer?: ReturnType<typeof setInterval>;
    private readonly workspaceListener;
    constructor(private readonly runtimeFactory: () => AgentRuntimeService, private readonly workspaces: WorkspaceService,
        private readonly focusRun: (id: string) => Promise<void>) {
        super(); this.id = PHASE_STACK_ID; this.title.label = this.title.caption = 'Phase Stack';
        this.title.iconClass = codicon('list-ordered'); this.title.closable = true;
        this.addClass('dope-phase-stack'); this.node.tabIndex = 0; this.node.append(this.content);
        this.controller = new PhaseStackController(runtimeFactory(), () => this.render());
        this.workspaceListener = workspaces.onWorkspaceChanged(() => void this.attach());
        void this.attach(); this.render();
    }
    private async attach(): Promise<void> {
        const roots = await this.workspaces.roots;
        const project = roots.length === 1 ? roots[0].resource.toString() : undefined;
        if (this.controller.project && this.controller.project !== project)
            this.controller = new PhaseStackController(this.runtimeFactory(), () => this.render());
        await this.controller.attach(project);
    }
    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg); this.timer = setInterval(() => void this.controller.refresh(), 2000);
        void this.controller.refresh();
    }
    protected override onBeforeDetach(msg: Message): void {
        if (this.timer) clearInterval(this.timer); this.timer = undefined; super.onBeforeDetach(msg);
    }
    protected override onCloseRequest(msg: Message): void {
        this.workspaceListener.dispose(); super.onCloseRequest(msg);
    }
    private render(): void {
        const c = this.controller, root = el('div'); root.append(el('h2', 'Phase Stack'));
        const status = el('p', c.message || (!c.project ? 'Open one project folder to use Phase Stack.' :
            !c.handle ? 'Attaching to project…' : 'Review the stack and repository basis before execution.'));
        status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); root.append(status);
        if (!c.handle) { this.content.replaceChildren(root); return; }
        const importer = el('section'), label = el('label', 'Project-local stack folder');
        const input = el('input'); input.type = 'text'; input.value = c.folderName; input.disabled = c.busy;
        input.placeholder = 'docs/tasks/p8c'; input.setAttribute('aria-label', 'Project-local stack folder');
        input.oninput = () => c.setFolderName(input.value); label.append(input);
        importer.append(label, button('Import Stack', () => void c.importStack(), c.busy));
        if (c.pendingDirtyImport) {
            const confirm = el('div'); confirm.append(el('p', 'Worktree is dirty: continue?'));
            confirm.append(el('p', 'Importing snapshots this stack against the current repository state. Starting a task with existing changes still requires explicit dirty-worktree acceptance.'));
            confirm.append(button('Continue', () => void c.continueDirtyImport(), c.busy),
                button('Cancel', () => c.cancelDirtyImport(), c.busy));
            importer.append(confirm);
        }
        root.append(importer);
        const list = el('section'); list.append(el('h3', 'Imported stacks'));
        if (!c.sequences.length) list.append(el('p', 'No stacks imported.'));
        for (const sequence of c.sequences) {
            const item = button(`${sequence.stack.folderName} · ${sequence.status}`, () => c.select(sequence.id), c.busy);
            item.setAttribute('aria-current', String(c.selected?.id === sequence.id)); list.append(item);
        }
        root.append(list);
        const s = c.selected;
        if (!s) { this.content.replaceChildren(root); return; }
        const detail = el('section'); detail.append(el('h3', `${s.stack.folderName} · Phase ${s.stack.phase} · ${s.stack.mode}`));
        detail.append(el('p', `Snapshot fingerprint: ${s.stack.fingerprint}`));
        detail.append(el('p', `Sequence: ${s.status} · source fingerprint: ${s.blockedReason === 'source-drift' ? 'drifted' : 'no drift recorded at last reconciliation'}`));
        if (c.evidence) detail.append(el('p', `Current HEAD: ${c.evidence.head} · package ${c.evidence.packageVersion} · ` +
            `${c.evidence.clean ? 'clean' : c.dirtyAcceptanceReady ? 'dirty basis selected, pending backend verification' :
                s.blockedReason === 'worktree-drift' ? 'dirty worktree drift' :
                    s.acceptedDirty ? 'accepted dirty basis' : 'dirty, acceptance required'}`));
        detail.append(el('p', `Imported basis: ${s.basis.head} · package ${s.basis.packageVersion}`));
        if (s.acceptedDirty) detail.append(el('p', `Accepted dirty basis: ${s.acceptedDirty.head} · ${s.acceptedDirty.paths.length} paths`));
        if (s.blockedReason) detail.append(el('p', c.dirtyAcceptanceReady ?
            `Recorded blocker (clears when Resume verifies the basis): ${s.blockedReason}` :
            `Blocked: ${s.blockedReason}`));
        if (s.gateMessage) detail.append(el('p', s.gateMessage));
        const entries = el('ol'); entries.setAttribute('aria-label', 'Phase Stack entries');
        for (const entry of s.stack.entries) {
            const checkpoint = s.checkpoints.find(item => item.entryNumber === entry.number);
            const state = checkpoint ? 'completed' : entry.number === s.currentEntryNumber ? s.status : 'queued';
            const row = el('li'); if (entry.number === s.currentEntryNumber) row.setAttribute('aria-current', 'step');
            row.append(el('strong', `P${entry.number} · ${entry.title} · ${state}`));
            row.append(el('div', `${entry.recommendation.label} · ${entry.recommendation.reasoning} · ` +
                `${entry.versionPolicy.kind} ${entry.versionPolicy.version} · Browser ${entry.browserRequired ? 'yes' : 'no'}`));
            if (checkpoint) row.append(el('div', `Checkpoint: ${checkpoint.sha}`)); entries.append(row);
        }
        detail.append(entries);
        const current = c.current;
        if (current?.execution === 'manual-gate' && s.status !== 'completed') {
            const gate = el('section'); gate.append(el('h4', `Manual gate · P${current.number}`));
            gate.append(el('p', 'Complete the exact prompt externally and checkpoint a clean result. Then reconcile repository evidence.'));
            const prompt = el('pre', current.promptText); prompt.setAttribute('aria-label', `P${current.number} snapshotted prompt`);
            gate.append(prompt, button('External completion: reconcile gate', () => void c.reconcile(), c.busy)); detail.append(gate);
        } else if (current?.execution === 'agent-task') {
            const controls = el('section'); controls.append(el('h4', 'Execution'));
            const validation = el('label', 'Required validation command');
            const command = el('input'); command.type = 'text'; command.value = c.validationCommand;
            command.placeholder = './validate.sh'; command.maxLength = 160;
            command.setAttribute('aria-label', 'Required validation command');
            validation.append(command); controls.append(validation);
            const grant = el('label'), grantCheck = el('input'); grantCheck.type = 'checkbox'; grantCheck.checked = c.acceptedGrant;
            grantCheck.setAttribute('aria-label', 'Accept project execution grant');
            grantCheck.onchange = () => { c.acceptedGrant = grantCheck.checked; this.render(); };
            grant.append(grantCheck, document.createTextNode(' Accept project execution grant: project read/write and local process, test and build. Git writes, network, secrets, outside-root and destructive effects are denied.'));
            controls.append(grant);
            if (c.needsDirtyAcceptance) {
                const dirty = el('label'), check = el('input'); check.type = 'checkbox'; check.checked = c.acceptedDirty;
                check.setAttribute('aria-label', 'Accept current dirty worktree for this task');
                check.onchange = () => c.setDirtyAcceptance(check.checked);
                dirty.append(check, document.createTextNode(' Accept current dirty worktree as this task’s starting basis.'));
                controls.append(dirty);
            }
            const readiness = el('p', c.readinessMessage); readiness.setAttribute('role', 'status');
            const resume = button(s.status === 'ready' ? 'Start' : 'Resume', () => void c.start(), !c.canStart);
            command.oninput = () => { c.validationCommand = command.value; readiness.textContent = c.readinessMessage;
                resume.disabled = !c.canStart; };
            controls.append(readiness, resume);
            controls.append(button('Stop', () => void c.stop(), c.busy || s.status !== 'running'));
            if (s.blockedReason === 'checkpoint-pending') controls.append(button('Create checkpoint', () => void c.checkpoint(), c.busy));
            else if (s.status !== 'running') controls.append(button('Reconcile repository', () => void c.reconcile(), c.busy));
            detail.append(controls);
        }
        const run = c.run;
        if (run) {
            const result = el('section'); result.append(el('h4', 'Latest Agent Run'));
            result.append(el('p', `Run: ${run.status} · ${run.outcome?.summary ?? 'No outcome yet.'}`));
            result.append(el('p', `Validation: ${run.validationResults.length ? run.validationResults.map(item => `${item.label}: ${item.status}`).join(', ') : 'not recorded'}`));
            result.append(el('p', `Checkpoint: ${s.blockedReason === 'checkpoint-pending' ? 'pending' :
                s.blockedReason === 'checkpoint-failed' ? 'failed' : s.checkpoints.at(-1)?.runId === run.id ? 'verified' : 'not recorded'}`));
            result.append(button('Open Agent Run detail', () => void this.focusRun(run.id))); detail.append(result);
        }
        root.append(detail); this.content.replaceChildren(root);
    }
}
