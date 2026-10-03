import { injectable } from '@theia/core/shared/inversify';
import { CommandRegistry, MenuModelRegistry } from '@theia/core/lib/common';
import { AbstractViewContribution, FrontendApplicationContribution, OpenerService, open } from '@theia/core/lib/browser';
import { BaseWidget, codicon, Message } from '@theia/core/lib/browser/widgets/widget';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import URI from '@theia/core/lib/common/uri';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import type { Evidence, GraphNode, GraphRelationship, AnalysisProgressStage } from '@dope/software-map';
import { SoftwareMapConnection, SoftwareMapController } from './software-map-controller';
import { outlineLabel, revealOutlineAncestors } from './software-map-outline';
import './dope.css';

export const SOFTWARE_MAP_ID = 'dope-software-map';
const analysisStages: { stage: AnalysisProgressStage; title: string }[] = [
    { stage: 'collecting-evidence', title: 'Collecting repository evidence' },
    { stage: 'building-skeleton', title: 'Building architecture skeleton' },
    { stage: 'system-discovery', title: 'Discovering Systems' },
    { stage: 'system-challenge', title: 'Challenging System boundaries' },
    { stage: 'subsystem-discovery', title: 'Discovering Subsystems' },
    { stage: 'subsystem-challenge', title: 'Challenging Subsystem boundaries' },
    { stage: 'component-discovery', title: 'Discovering Components' },
    { stage: 'reconciliation', title: 'Reconciling architecture' },
    { stage: 'verification', title: 'Verifying uncertain boundaries' },
    { stage: 'preparing-review', title: 'Preparing sMap for review' },
];

export class SoftwareMapWidget extends BaseWidget {
    readonly controller: SoftwareMapController;
    private readonly changeListener;
    private openedReviewId?: string;
    private readonly rootsListener;
    private workspaceRequest = 0;
    private readonly status = document.createElement('p');
    private readonly tree = document.createElement('section');
    private readonly detail = document.createElement('section');
    private readonly violations = document.createElement('section');
    private readonly controls = document.createElement('section');
    private readonly expanded = new Set<string>();
    private outlineWorkspace?: string;
    private revealedSelection?: string;
    private unassignedOpen = false;
    private readonly progressClock = document.createElement('span');
    private localSetupOpen = true;
    private geminiSetupOpen = false;
    private readonly clockTimer: ReturnType<typeof setInterval>;

    constructor(controller: SoftwareMapController, private readonly workspaces: WorkspaceService, private readonly opener: OpenerService,
        private readonly openReview: () => Promise<void>, private readonly openPhysicalMap: () => Promise<void>) {
        super();
        this.id = SOFTWARE_MAP_ID;
        this.title.label = 'SMAP CONTROLS';
        this.title.caption = 'sMap — Software Map';
        this.title.iconClass = codicon('type-hierarchy');
        this.title.closable = true;
        this.addClass('dope-spike-view');
        this.addClass('dope-smap-view');
        this.node.tabIndex = 0;
        this.controller = controller;
        this.changeListener = controller.onChange(() => {
            this.render();
            const id = controller.flow === 'review' ? controller.review?.reviewId : undefined;
            if (id && id !== this.openedReviewId) { this.openedReviewId = id; void this.openReview(); }
            if (!id) this.openedReviewId = undefined;
        });
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.node.append(this.controls, this.status, this.tree, this.detail, this.violations);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.attach(); });
        this.clockTimer = setInterval(() => {
            if (this.controller.initialization?.state === 'analyzing')
                this.progressClock.textContent = `Elapsed analysis: ${Math.floor(this.controller.analysisElapsedMs() / 1000)}s`;
        }, 1000);
        void this.attach();
    }
    private button(label: string, action: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.onclick = action;
        return button;
    }
    private async attach(): Promise<void> {
        const request = ++this.workspaceRequest;
        const roots = await this.workspaces.roots;
        if (this.isDisposed || request !== this.workspaceRequest) return;
        const workspace = roots.length === 1 ? roots[0].resource.toString() : undefined;
        if (workspace !== this.controller.workspace) await this.controller.attach(workspace);
    }
    private element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        return element;
    }
    private field(label: string, value: string, change: (value: string) => void, multiline = false, secret = false): HTMLElement {
        const wrapper = this.element('label', label);
        const input = multiline ? this.element('textarea') : this.element('input');
        if (input instanceof HTMLInputElement && secret) input.type = 'password';
        input.value = value;
        input.oninput = () => change(input.value);
        wrapper.append(input);
        return wrapper;
    }
    private renderOnboarding(): void {
        const model = this.controller;
        this.controls.replaceChildren();
        this.controls.classList.toggle('dope-smap-compact-actions', model.initialization?.state === 'initialized');
        if (!model.workspace || !model.initialization) return;
        if (model.initialization.state === 'initialized') {
            const firstRow = this.element('div');
            firstRow.className = 'dope-smap-control-row';
            const open = this.button('OPEN', () => void this.openPhysicalMap());
            open.setAttribute('aria-label', 'Open Physical Map');
            const refresh = this.button('REFRESH', () => void model.analyze());
            refresh.setAttribute('aria-label', 'Refresh Software Map');
            firstRow.append(open, refresh);
            const edit = this.button('EDIT ARCHITECTURE', () => void this.openReview());
            edit.setAttribute('aria-label', 'Edit Architecture');
            edit.className = 'dope-smap-edit-architecture';
            this.controls.append(firstRow, edit);
            return;
        }
        if (model.flow === 'none') {
            this.controls.append(this.button('Analyze Project', () => model.begin()));
            this.controls.append(this.element('p', 'Software Map is uninitialized. Analyze Project is available whenever you are ready.'));
        } else if (model.flow === 'offer') {
            this.controls.append(this.element('h3', 'Analyze Project?'), this.element('p', 'Choose a synthesis provider, an existing declaration, or manual architecture.'));
            const bootstrap = model.initialization.bootstrap;
            if (bootstrap?.modules) this.controls.append(this.element('p', 'Root MODULES.md will guide the initial architecture proposal as documented intent. Repository evidence remains authoritative for implementation.'));
            else {
                this.controls.append(this.element('p', 'Recommended: create a root MODULES.md to describe Systems and Subsystems before analysis. You can analyze now without it.'));
                const prompt = `Prepare this repository for Dope. Analyze the actual repository and create only a root MODULES.md describing its System -> Subsystem architecture: purpose, responsibilities, primary paths, major dependencies, and explicit uncertainty. Use source code, existing documentation, package/workspace boundaries, runtime entry points, imports, build configuration, infrastructure, and tests as evidence. Do not invent uncertain boundaries, enumerate every Component/file/class/function, or modify application code.`;
                this.controls.append(this.button('Copy Prepare this repository for Dope prompt', () => void navigator.clipboard.writeText(prompt)));
            }
            const setup = this.button(bootstrap?.modules ? 'Set up synthesis' : bootstrap?.readme ? 'Continue with README' : 'Analyze repository anyway', () => void model.setup());
            setup.disabled = model.setupBusy;
            this.controls.append(setup);
            if (model.initialization.declarationPresent) {
                const existing = this.button('Use existing architecture', () => void model.useExisting());
                existing.disabled = model.setupBusy;
                this.controls.append(existing);
            }
            this.controls.append(this.button('Define architecture manually', () => model.manual()), this.button('Not now', () => model.decline()));
        } else if (model.flow === 'setup') this.renderSetup();
        else if (model.flow === 'dry-run') this.renderDryRun();
        else if (model.flow === 'review') this.renderReview();
        else if (model.flow === 'manual') this.renderDraft('Manual architecture');
    }
    private renderSetup(): void {
        const model = this.controller;
        if (model.initialization?.state === 'analyzing') {
            this.renderProgress();
            this.controls.append(this.button('Cancel analysis', () => void model.cancel()));
            return;
        }
        this.controls.append(this.element('h3', 'Synthesis setup'));
        this.controls.append(this.button('Dry run (no model calls)', () => void model.dryRun()));
        const local = this.element('details');
        local.open = this.localSetupOpen;
        local.ontoggle = () => { this.localSetupOpen = local.open; };
        local.append(this.element('summary', 'Local model'),
            this.element('p', 'Runs through your local LM Studio compatible endpoint. Discovery and capability probing use no project evidence.'));
        local.append(this.field('Endpoint', model.endpoint, value => model.changeEndpoint(value)));
        local.append(this.field('Loaded context tokens', String(model.contextWindowTokens), value => model.changeContextTokens(value)));
        local.append(this.field('Optional session token', model.token, value => model.changeToken(value), false, true));
        local.append(this.button('Discover models', () => void model.discover()));
        const label = this.element('label', 'Model');
        const select = this.element('select');
        for (const id of model.models) {
            const option = this.element('option', id);
            option.value = id;
            option.selected = id === model.model;
            select.append(option);
        }
        select.onchange = () => model.changeModel(select.value);
        label.append(select);
        local.append(label);
        if (model.initialization?.resumable) {
            const retry = this.button(`Retry failed stage with ${model.model || 'selected Local model'}`, () => void model.synthesize('local', true));
            retry.disabled = model.providerKind !== 'local' || !model.setupReady || model.setupBusy;
            local.append(retry);
        }
        const probe = this.button('Run structured-output capability probe', () => void model.probe());
        probe.disabled = model.setupBusy || !model.model;
        local.append(probe, this.element('p', model.providerKind === 'local' && model.setupReady ? 'Structured-output probe passed. Model ready.' :
            model.setupBusy ? 'Checking local model…' : 'Run the probe before analysis.'));
        const start = this.button(model.initialization?.resumable ? 'Restart analysis with Local' : 'Analyze with Local', () => void model.synthesize('local'));
        start.disabled = model.providerKind !== 'local' || !model.setupReady || model.setupBusy;
        local.append(start);
        const gemini = this.element('details');
        gemini.open = this.geminiSetupOpen;
        gemini.ontoggle = () => { this.geminiSetupOpen = gemini.open; };
        gemini.append(this.element('summary', 'Gemini'),
            this.element('p', 'Cloud synthesis. When Gemini is selected, bounded repository evidence used for synthesis is sent to Google’s Gemini API.'),
            this.element('p', model.geminiEnvironmentKeyAvailable ? 'Gemini API key available on this machine.' : 'Enter an AI Studio API key. Dope saves it in this machine’s credential store after model discovery succeeds.'));
        gemini.append(this.field(model.geminiEnvironmentKeyAvailable ? 'Optional replacement AI Studio API key' : 'AI Studio API key',
            model.geminiKey, value => model.changeGeminiKey(value), false, true));
        const refreshGemini = this.button('Refresh Gemini models', () => void model.discoverGemini());
        refreshGemini.disabled = model.setupBusy;
        gemini.append(refreshGemini);
        const geminiLabel = this.element('label', 'Gemini model');
        const geminiSelect = this.element('select');
        for (const id of model.geminiModels) {
            const option = this.element('option', id);
            option.value = id;
            option.selected = id === model.geminiModel;
            geminiSelect.append(option);
        }
        geminiSelect.disabled = model.setupBusy || !model.geminiModels.length;
        geminiSelect.onchange = () => void model.changeGeminiModel(geminiSelect.value);
        geminiLabel.append(geminiSelect);
        gemini.append(geminiLabel);
        if (model.initialization?.resumable) {
            const retry = this.button(`Retry failed stage with ${model.geminiModel || 'selected Gemini model'}`, () => void model.synthesize('gemini', true));
            retry.disabled = model.providerKind !== 'gemini' || !model.setupReady || model.setupBusy;
            gemini.append(retry);
        }
        const geminiProbe = this.button('Test selected model', () => void model.probeGemini());
        geminiProbe.disabled = model.setupBusy || !model.geminiModel || !model.geminiModels.includes(model.geminiModel);
        gemini.append(geminiProbe, this.element('p', model.providerKind === 'gemini' && model.setupReady ?
            `${model.geminiModel} ready.` : model.geminiModel ? `${model.geminiModel} requires a successful test.` : 'Discover models before analysis.'));
        const geminiStart = this.button(model.initialization?.resumable ? 'Restart analysis with Gemini' :
            `Analyze Project with ${model.geminiModel || 'Gemini'}`, () => void model.synthesize('gemini'));
        geminiStart.disabled = model.providerKind !== 'gemini' || !model.setupReady || model.setupBusy;
        gemini.append(geminiStart);
        if (model.initialization?.resumable) {
            this.controls.append(this.element('p', `Failed: ${model.initialization.resumable.failedStage ?? 'interrupted stage'}` +
                (model.initialization.resumable.failedSubject ? ` · ${model.initialization.resumable.failedSubject}` : '')),
            this.element('p', model.initialization.resumable.message),
            ...(model.initialization.resumable.failedProviderKind && model.initialization.resumable.failedModelLabel ?
                [this.element('p', `${model.initialization.resumable.failedProviderKind} · ${model.initialization.resumable.failedModelLabel}`)] : []));
        }
        const cancel = this.button('Cancel', () => void model.cancel());
        this.controls.append(local, gemini, cancel);
        if (model.progressEvents.length || model.initialization?.resumable) this.renderProgress();
    }
    private renderDryRun(): void {
        const model = this.controller, result = model.dryRunReport;
        this.controls.append(this.element('h3', 'Generation dry run'),
            this.element('p', 'Checking this project without a model request or project write.'));
        const steps = this.element('ol');
        for (const label of [
            `${model.dryRunBusy ? 'Current' : result?.inputFingerprint ? 'Completed' : 'Needs attention'}: Collect and validate repository evidence`,
            `${model.dryRunBusy ? 'Queued' : result?.savedRun ? 'Completed' : 'No saved run'}: Inspect saved analysis work`,
            'Untested: Model capability, generation stages and output quality',
        ]) steps.append(this.element('li', label));
        this.controls.append(steps);
        if (model.dryRunBusy) this.controls.append(this.element('p', 'Collecting deterministic inputs…'));
        if (model.dryRunError) this.controls.append(this.element('p', model.dryRunError));
        if (result) {
            this.controls.append(this.element('p', `Current input fingerprint: ${result.inputFingerprint ?? 'unavailable'}`),
                this.element('p', `Evidence: ${result.evidence.map(item => `${item.kind} ${item.count}`).join(', ') || 'none'}`),
                this.element('p', `Documents: ${result.documents.map(item => `${item.category} ${item.count}`).join(', ') || 'none'}`));
            for (const diagnostic of result.diagnostics) this.controls.append(this.element('p', diagnostic));
            if (result.savedRun) {
                const saved = result.savedRun;
                this.controls.append(this.element('p', `Saved run ${saved.runId} · ${saved.state} · ${saved.completedCount} validated checkpoints`));
                for (const item of saved.completed) this.controls.append(this.element('p',
                    `Completed ${item.stage}${item.subject ? ` · ${item.subject}` : ''} · ${item.providerKind} · ${item.modelLabel}`));
                if (saved.failed) this.controls.append(this.element('p',
                    `Failed ${saved.failed.stage}${saved.failed.subject ? ` · ${saved.failed.subject}` : ''}`));
                for (const item of saved.pending) this.controls.append(this.element('p',
                    `Known pending: ${item.stage}${item.subject ? ` · ${item.subject}` : ''}`));
            }
            this.controls.append(this.element('p', `Untested: ${result.untested.join('; ')}.`));
        }
        this.controls.append(this.button('Back to synthesis setup', () => model.returnToSetup()));
    }
    private renderProgress(): void {
        const events = this.controller.progressEvents;
        const current = events.at(-1);
        const work = current && ['failed', 'cancelled'].includes(current.stage) ?
            [...events].reverse().find(event => !['failed', 'cancelled', 'completed'].includes(event.stage)) ?? current : current;
        const saved = this.controller.initialization?.resumable;
        const runState = this.controller.initialization?.state;
        const completed = new Set([...events.filter(event => event.status === 'completed').map(event => event.stage),
            ...(saved?.completed.map(item => item.stage) ?? [])]);
        const active = work?.stage ?? saved?.failedStage;
        const report = this.element('section');
        report.className = 'dope-smap-progress';
        report.append(this.element('h3', runState === 'failed' ? 'Analysis failed' :
            current?.stage === 'cancelled' ? 'Analysis cancelled' :
                current?.status === 'retrying' || current?.attempt && current.attempt > 1 && current.status === 'started' ?
                    'Retrying model call' : 'Analyzing project'));
        this.progressClock.textContent = `Elapsed analysis: ${Math.floor(this.controller.analysisElapsedMs() / 1000)}s`;
        report.append(this.progressClock);
        if (current) {
            const currentTitle = analysisStages.find(item => item.stage === active)?.title ?? current.message;
            report.append(this.element('p', `${currentTitle}${work?.subject && ['subsystem-discovery', 'subsystem-challenge', 'component-discovery'].includes(work.stage) ? ` — ${work.subject}` : ''}`));
            if (work?.callPurpose && current.stage !== 'failed' && current.stage !== 'cancelled') report.append(this.element('p',
                `Model call: ${work.callPurpose === 'model-warm-up' ? 'Preparing selected model' :
                    analysisStages.find(item => item.stage === work.callPurpose)?.title ?? work.callPurpose}`));
            if (work?.providerKind && work.providerModelLabel) report.append(this.element('p',
                `${work.providerKind === 'local' ? 'Local' : 'Gemini'} · ${work.providerModelLabel}`));
            else if (saved?.failedProviderKind && saved.failedModelLabel) report.append(this.element('p',
                `${saved.failedProviderKind === 'local' ? 'Local' : 'Gemini'} · ${saved.failedModelLabel}`));
            if (work?.attempt) report.append(this.element('p', `Attempt ${work.attempt}${work.status === 'retrying' ? ' failed; retrying' : ''}`));
            const calls = events.filter(event => event.callDurationMs !== undefined);
            if (calls.length) {
                const list = this.element('ul');
                for (const call of calls) {
                    const usage = call.usage;
                    list.append(this.element('li', `${call.stage}${call.subject ? ` · ${call.subject}` : ''}${call.attempt ? ` · attempt ${call.attempt}` : ''}: ${Math.round(call.callDurationMs!)} ms${call.reused ? ' · reused cache' : ''}${call.status === 'retrying' ? ` · failed, retrying · ${call.message}` : call.status === 'failed' ? ` · failed · ${call.message}` : ''}` +
                        (usage ? ` · Tokens (${usage.tokenMeasurement}): input ${usage.inputTokens ?? 'unavailable'}, output ${usage.outputTokens ?? 'unavailable'}, total ${usage.totalTokens ?? 'unavailable'} · request ${usage.requestBytes} bytes, output ${usage.outputBytes} bytes` : '')));
                }
                report.append(list);
            }
            const recovered = [...calls].reverse().find(call => call.attempt && call.attempt > 1 && !['failed', 'retrying'].includes(call.status));
            if (recovered) report.append(this.element('p', `Recovered on attempt ${recovered.attempt} with ${recovered.providerModelLabel}.`));
            if (work?.totalUnits !== undefined) report.append(this.element('p',
                `${work.completedUnits ?? 0}/${work.totalUnits} ${work.stage === 'component-discovery' ? 'Subsystems' : 'Systems'}`));
            if (current.status === 'failed' || current.status === 'retrying' || current.status === 'cancelled')
                report.append(this.element('p', runState === 'failed' ? saved?.message ?? current.message : current.message));
            if (runState === 'failed') report.append(this.element('p', this.controller.setupReady ?
                'Retry the failed stage with the selected model, or restart analysis.' : 'Test the selected model, then retry the failed stage.'));
        }
        const stages = this.element('ol');
        for (const item of analysisStages) {
            const state = active === item.stage && runState === 'failed' ? 'Failed' :
                completed.has(item.stage) ? 'Complete' : active === item.stage ?
                    current?.status === 'cancelled' ? 'Cancelled' : 'Current' : 'Queued';
            const row = this.element('li', `${state}: ${item.title}`);
            row.className = `dope-smap-stage-${state.toLowerCase()}`;
            stages.append(row);
        }
        report.append(stages);
        if (saved?.completed.length) {
            const branches = this.element('ul');
            for (const item of saved.completed) branches.append(this.element('li',
                `Complete: ${item.stage}${item.subject ? ` · ${item.subject}` : ''} · ${item.providerKind} / ${item.modelLabel}`));
            report.append(branches);
        }
        this.controls.append(report);
    }
    private renderReview(): void {
        const review = this.controller.review;
        if (!review) return;
        this.controls.append(this.element('h3', 'Architecture review ready'),
            this.element('p', review.proposal.summary),
            this.element('p', `${this.controller.draft.filter(node => node.kind === 'system').length} Systems · ${this.controller.draft.filter(node => node.kind === 'subsystem').length} Subsystems · ${this.controller.draft.filter(node => node.kind === 'component').length} Components`),
            this.button('Edit Architecture', () => void this.openReview()),
            this.button('Decline review', () => void this.controller.cancel()));
    }
    private renderDraft(title: string): void {
        const model = this.controller;
        const editor = this.element('section');
        editor.append(this.element('h3', title));
        const validation = this.element('p');
        validation.setAttribute('role', 'status');
        const accept = this.button('Accept Architecture', () => void model.accept());
        const refreshValidation = () => { const error = model.draftError(); validation.textContent = error ? `Cannot accept: ${error}` : 'Canonical architecture is valid.'; accept.disabled = !!error || model.setupBusy; };
        for (const node of model.draft) {
            const row = this.element('fieldset');
            row.append(this.element('legend', `${node.kind}: ${node.name || '(unnamed)'}`));
            const edit = (key: 'id' | 'name' | 'purpose', label: string) => this.field(label, node[key], value => { node[key] = value; refreshValidation(); });
            row.append(edit('id', 'Canonical ID'), edit('name', 'Name'), edit('purpose', 'Purpose'));
            if (node.kind !== 'system') {
                const label = this.element('label', 'Parent boundary');
                const select = this.element('select');
                select.setAttribute('aria-label', `${node.kind} parent for ${node.name || node.proposalKey}`);
                for (const parent of model.draft.filter(item => item.kind === (node.kind === 'subsystem' ? 'system' : 'subsystem'))) {
                    const option = this.element('option', `${parent.name || parent.proposalKey} (${parent.id || 'no ID'})`);
                    option.value = parent.proposalKey;
                    option.selected = parent.proposalKey === node.parentProposalKey;
                    select.append(option);
                }
                select.onchange = () => { node.parentProposalKey = select.value; refreshValidation(); };
                label.append(select); row.append(label);
            }
            row.append(this.field('Implementation roots (one project-relative path per line)', node.roots.join('\n'), value => {
                node.roots = value.split('\n').map(path => path.trim()).filter(Boolean); refreshValidation();
            }, true));
            if (node.kind !== 'component') row.append(this.button(`Add ${node.kind === 'system' ? 'subsystem' : 'component'} under ${node.name || node.proposalKey}`,
                () => model.add(node.kind === 'system' ? 'subsystem' : 'component', node.proposalKey)));
            row.append(this.button(`Remove ${node.kind} ${node.name || node.proposalKey} and its children`, () => model.remove(node.proposalKey)));
            editor.append(row);
        }
        const cancel = this.button('Cancel', () => void model.cancel());
        cancel.disabled = model.setupBusy;
        editor.append(this.button('Add system', () => model.add('system')), validation, accept, cancel);
        this.controls.append(editor);
        refreshValidation();
    }
    private render(): void {
        if (this.isDisposed) return;
        const focusedControl = this.controls.contains(document.activeElement) ? (document.activeElement as HTMLElement) : undefined;
        const focusedLabel = focusedControl?.closest('label')?.firstChild?.textContent;
        const focusedButton = focusedControl?.tagName === 'BUTTON' ? focusedControl.textContent : undefined;
        const focusedNode = (document.activeElement as HTMLElement | null)?.dataset.nodeId;
        const focusedDisclosure = (document.activeElement as HTMLElement | null)?.dataset.disclosureId;
        const focusedEdge = (document.activeElement as HTMLElement | null)?.dataset.edgeId;
        const model = this.controller;
        if (this.outlineWorkspace !== model.workspace) {
            this.outlineWorkspace = model.workspace;
            this.expanded.clear();
            this.revealedSelection = undefined;
            this.unassignedOpen = false;
        }
        const status = model.status;
        this.status.classList.toggle('dope-smap-synthesis-status', !!model.workspace && !model.error && !model.loading &&
            model.initialization?.state === 'initialized' && status?.state === 'ready' && status.generation === status.publishedGeneration);
        this.status.textContent = !model.workspace ? 'Open one local project folder to inspect its Software Map.' :
            model.error ? `Error: ${model.error}` :
            model.loading ? `Analyzing or loading generation ${status?.generation ?? '…'}; previous results hidden.` :
            model.initialization?.state !== 'initialized' ? model.initialization?.state === 'analyzing' ? 'Software Map analysis in progress.' :
                model.initialization?.state === 'review_required' ? 'Architecture review pending.' : 'Software Map is uninitialized.' :
            !status || status.state === 'idle' ? 'Ready to refresh. No derived graph is loaded.' :
            status.state === 'failed' ? `Analysis failed at generation ${status.generation}.` :
            `SYNTHESIS  G${status.publishedGeneration} | ${status.analysis.completeness} | ${model.nodes.length} nodes | ${model.violations.length} violations`;
        this.tree.replaceChildren();
        this.detail.replaceChildren();
        this.violations.replaceChildren();
        this.renderOnboarding();
        if (focusedButton) [...this.controls.querySelectorAll('button')].find(button => button.textContent === focusedButton)?.focus();
        else if (focusedLabel) [...this.controls.querySelectorAll('label')].find(label => label.firstChild?.textContent === focusedLabel)?.querySelector<HTMLElement>('input, textarea, select')?.focus();
        if (model.initialization?.state !== 'initialized') return;
        if (status?.analysis.errors.length) {
            const diagnostics = this.element('section');
            diagnostics.append(this.element('h3', 'Diagnostics'));
            for (const error of status.analysis.errors) diagnostics.append(this.element('p', `${error.producer}: ${error.code} — ${error.path ? `${error.path}: ` : ''}${error.message}`));
            this.tree.append(diagnostics);
        }
        if (model.loading || status?.state !== 'ready' || status.generation !== status.publishedGeneration) return;
        if (status.declarationPresent === false) this.tree.append(this.element('p', 'No .dope/architecture.json declaration. Analyzed implementation remains unassigned.'));
        if (status.analysis.completeness === 'partial') this.tree.append(this.element('p', 'Partial analysis: inspect diagnostics before relying on this graph.'));
        const nodes = model.nodes;
        const children = new Map<string, GraphNode[]>();
        for (const node of nodes) {
            const parent = node.parentId ?? '';
            const group = children.get(parent) ?? [];
            group.push(node);
            children.set(parent, group);
        }
        for (const group of children.values()) group.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
        const revealSelection = !!model.selectedId && model.selectedId !== this.revealedSelection &&
            revealOutlineAncestors(nodes, model.selectedId, this.expanded);
        if (revealSelection) this.revealedSelection = model.selectedId;
        if (!model.selectedId) this.revealedSelection = undefined;
        const renderNode = (node: GraphNode): HTMLElement => {
            const row = this.element('li');
            const descendants = children.get(node.id) ?? [];
            const line = this.element('div');
            line.className = 'dope-smap-outline-row';
            const label = outlineLabel(node);
            if (descendants.length) {
                const disclosure = this.button(this.expanded.has(node.id) ? '▾' : '▸', () => {
                    if (this.expanded.has(node.id)) this.expanded.delete(node.id);
                    else this.expanded.add(node.id);
                    this.render();
                });
                disclosure.className = 'dope-smap-outline-disclosure';
                disclosure.dataset.disclosureId = node.id;
                disclosure.setAttribute('aria-label', `${this.expanded.has(node.id) ? 'Collapse' : 'Expand'} ${label}`);
                disclosure.setAttribute('aria-expanded', String(this.expanded.has(node.id)));
                line.append(disclosure);
            } else {
                const spacer = this.element('span');
                spacer.className = 'dope-smap-outline-spacer';
                spacer.setAttribute('aria-hidden', 'true');
                line.append(spacer);
            }
            const button = this.button(label, () => void model.select(node.id));
            button.className = 'dope-smap-outline-label';
            button.dataset.nodeId = node.id;
            button.setAttribute('aria-current', String(model.selectedId === node.id));
            const kind = this.element('span', node.kind === 'code' ? node.codeKind : node.kind);
            kind.className = `dope-smap-kind-${node.kind === 'code' ? node.codeKind : node.kind}`;
            button.replaceChildren(kind, document.createTextNode(label.slice(kind.textContent.length)));
            line.append(button);
            row.append(line);
            if (descendants.length && this.expanded.has(node.id)) row.append(list(descendants));
            return row;
        };
        const list = (items: GraphNode[]): HTMLUListElement => {
            const ul = this.element('ul');
            ul.className = 'dope-smap-outline';
            for (const item of items) ul.append(renderNode(item));
            return ul;
        };
        this.tree.append(this.element('h3', 'Architecture'));
        const systems = nodes.filter(node => node.kind === 'system');
        this.tree.append(systems.length ? list(systems) : this.element('p', 'No declared Systems.'));
        const unassigned = nodes.filter(node => node.kind === 'code' && node.ownership.state === 'unassigned' && !nodes.some(parent => parent.id === node.parentId && parent.kind === 'code'));
        const unassignedIds = new Set(unassigned.map(node => node.id));
        if (revealSelection && model.selectedId) {
            const byId = new Map(nodes.map(node => [node.id, node]));
            const seen = new Set<string>();
            for (let id: string | undefined = model.selectedId; id && !seen.has(id); id = byId.get(id)?.parentId) {
                if (unassignedIds.has(id)) { this.unassignedOpen = true; break; }
                seen.add(id);
            }
        }
        const unassignedSection = this.element('details');
        unassignedSection.className = 'dope-smap-unassigned';
        unassignedSection.open = this.unassignedOpen;
        unassignedSection.ontoggle = () => { this.unassignedOpen = unassignedSection.open; };
        unassignedSection.append(this.element('summary', `Unassigned / unknown implementation (${unassigned.length} roots)`));
        if (unassigned.length) unassignedSection.append(list(unassigned));
        else unassignedSection.append(this.element('p', nodes.length ? 'No unassigned code roots.' : 'No implementation found.'));
        this.tree.append(unassignedSection);
        if (model.selectedId) this.renderNodeDetail(nodes.find(node => node.id === model.selectedId));
        if (model.selectedViolation) this.renderViolationDetail();
        this.violations.append(this.element('h3', `Architecture violations (${model.violations.length})`));
        if (!model.violations.length) this.violations.append(this.element('p', 'No declared dependency violations found.'));
        for (const violation of model.violations) {
            this.violations.append(this.button(`${violation.rule}: ${violation.sourceSubsystemId} → ${violation.targetSubsystemId} (${violation.originRelationshipIds.length} physical edges)`,
                () => void model.selectViolation(violation)));
        }
        if (focusedNode) [...this.tree.querySelectorAll<HTMLButtonElement>('button[data-node-id]')].find(button => button.dataset.nodeId === focusedNode)?.focus();
        if (focusedDisclosure) [...this.tree.querySelectorAll<HTMLButtonElement>('button[data-disclosure-id]')].find(button => button.dataset.disclosureId === focusedDisclosure)?.focus();
        if (focusedEdge) [...this.detail.querySelectorAll<HTMLButtonElement>('button[data-edge-id]')].find(button => button.dataset.edgeId === focusedEdge)?.focus();
        if (revealSelection) [...this.tree.querySelectorAll<HTMLButtonElement>('button[data-node-id]')]
            .find(button => button.dataset.nodeId === model.selectedId)?.scrollIntoView({ block: 'nearest' });
    }
    private renderNodeDetail(node?: GraphNode): void {
        if (!node) return;
        this.detail.append(this.element('h3', node.name), this.element('p', `${node.kind} · ${node.id}`));
        if ('purpose' in node) this.detail.append(this.element('p', node.purpose));
        if (node.kind === 'code') {
            const owner = node.ownership;
            this.detail.append(this.element('p', `Source: ${node.path}${node.symbol ? ` · ${node.symbol}` : ''}`),
                this.element('p', `Ownership: ${owner.state}${owner.systemId ? ` · ${owner.systemId}` : ''}${owner.subsystemId ? ` / ${owner.subsystemId}` : ''}${owner.componentId ? ` / ${owner.componentId}` : ''}`));
        }
        this.renderEdges('Outgoing dependencies / relationships', this.controller.outgoing);
        this.renderEdges('Incoming dependencies / relationships', this.controller.incoming);
        this.renderEvidence(this.controller.evidence.filter(item => node.evidenceIds.includes(item.id)));
    }
    private renderViolationDetail(): void {
        const violation = this.controller.selectedViolation!;
        this.detail.append(this.element('h3', `Violation: ${violation.rule}`),
            this.element('p', `Rule ${violation.rule}: ${violation.sourceSubsystemId} → ${violation.targetSubsystemId}`),
            this.element('h4', 'Offending physical edges'));
        this.renderEdges('Source relationships', this.controller.offending);
        this.renderEvidence(this.controller.evidence);
    }
    private renderEdges(label: string, edges: GraphRelationship[]): void {
        this.detail.append(this.element('h4', `${label} (${edges.length})`));
        for (const edge of edges) {
            const source = this.controller.nodes.find(item => item.id === edge.sourceId)?.name ?? edge.sourceId;
            const target = this.controller.nodes.find(item => item.id === edge.targetId)?.name ?? edge.targetId;
            const row = this.element('div');
            row.className = 'dope-smap-edge';
            row.append(this.element('p', `${edge.originRelationshipIds?.length ? 'Aggregated' : 'Direct'} ${edge.kind}: ${source} → ${target}${edge.originRelationshipIds?.length ? ` · ${edge.originRelationshipIds.length} physical edges` : ''}`));
            this.renderEvidence(this.controller.evidence.filter(item => edge.evidenceIds.includes(item.id)), row);
            if (edge.originRelationshipIds?.length) {
                const show = this.button('Show originating physical edges', () => void this.controller.origins(edge));
                show.dataset.edgeId = edge.id;
                row.append(show);
                if (this.controller.selectedAggregateId === edge.id) {
                    row.append(this.element('h4', `Originating physical edges (${this.controller.originEdges.length})`));
                    for (const origin of this.controller.originEdges) {
                        const from = this.controller.nodes.find(item => item.id === origin.sourceId);
                        const to = this.controller.nodes.find(item => item.id === origin.targetId);
                        row.append(this.element('p', `${origin.kind}: ${from?.name ?? origin.sourceId} → ${to?.name ?? origin.targetId}`));
                        this.renderEvidence(this.controller.originEvidence.filter(item => origin.evidenceIds.includes(item.id)), row);
                    }
                }
            }
            this.detail.append(row);
        }
    }
    private renderEvidence(items: Evidence[], target: HTMLElement = this.detail): void {
        for (const item of items) {
            const label = `${item.class} · ${item.path ?? item.producer}${item.span?.line ? `:${item.span.line}${item.span.column ? `:${item.span.column}` : ''}` : ''} · ${item.producer}`;
            target.append(this.button(label, () => void this.openEvidence(item)));
        }
    }
    private async openEvidence(item: Evidence): Promise<void> {
        try {
            const location = await this.controller.source(item.id);
            if (!location || this.isDisposed) return;
            await open(this.opener, new URI(location.uri), location.span?.line ? { selection: { start: { line: location.span.line - 1, character: (location.span.column ?? 1) - 1 } } } : undefined);
        } catch (error) { this.status.textContent = `Source navigation failed: ${String(error)}`; }
    }
    protected override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
    }
    override dispose(): void {
        clearInterval(this.clockTimer);
        ++this.workspaceRequest;
        this.rootsListener.dispose();
        this.changeListener.dispose();
        super.dispose();
    }
}

@injectable()
export class SoftwareMapView extends AbstractViewContribution<SoftwareMapWidget> implements FrontendApplicationContribution {
    constructor() { super({ widgetId: SOFTWARE_MAP_ID, widgetName: 'sMap', defaultWidgetOptions: { area: 'left', rank: 200 } }); }
    async onDidInitializeLayout(): Promise<void> {
        // Add the Activity Bar entry without activating it or moving a restored user layout.
        await this.openView();
    }
    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand({ id: 'dope.softwareMap.open', label: 'Dope: Show Software Map' }, { execute: () => this.openView({ activate: true }) });
    }
    override registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.VIEW_VIEWS, { commandId: 'dope.softwareMap.open', label: 'Software Map' });
    }
}
