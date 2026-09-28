# Dope Roadmap

Status: ACTIVE ROADMAP
Current gate: Product Phase 2 — Project Mind (owner sequencing waiver; Phase 1 remains Not Qualified)

This roadmap deliberately starts small.

Dope's long-term vision is an integrated development environment spanning coding, project knowledge, planning, research, architecture, AI collaboration, validation, and durable development context. The initial roadmap does not attempt to build that whole vision at once.

The sequencing rule is:

Theia
-> IDE
-> Project Mind
-> Planning
-> AI Presence
-> Scoped Delegation
-> Development Sessions

Each stage should make Dope more useful to the developer before the next layer of AI is added.

## Progressive self-development qualification

Dope should increasingly be developed inside Dope as the roadmap advances.

This is a cross-phase qualification ladder, not an additional phase and not permission to pull later capabilities forward.

| Roadmap stage | Self-development qualification |
| --- | --- |
| Foundation Spike 0 | External bootstrap. Qualify the substrate with existing external tools. Self-hosting is not required. |
| Product Phase 1 — IDE Alive | Dope as editor. Open and work on the Dope repository comfortably inside Dope using ordinary IDE capabilities. |
| Product Phase 2 — Project Mind | Dope understands Dope. Its own decisions, notes, questions, ideas, and durable project context are useful through Project Mind. |
| Product Phase 3 — Planning | Dope plans Dope. A real Dope feature can move from thought/decision into a live Plan and Tasks without leaving Dope. |
| Product Phase 4 — AI Presence | AI understands Dope through Dope-owned project state and provider-independent read-only assistance. |
| Product Phase 5 — Scoped Delegation | Dope changes Dope. A bounded Dope task can be delegated through the ordinary authority, review, ChangeSet, and validation path. |
| Product Phase 6 — Development Sessions | Dope Builds Dope. A real Dope feature can travel end-to-end through durable project understanding, planning, implementation, validation, review, and session closeout inside Dope. |

Self-development never receives privileged authority.

Dope must remain repairable with conventional external editor, terminal, Git, build, test, and recovery tooling even after the self-development milestone is reached.

Dogfooding Dope on its own repository is a necessary product qualification, not proof that the product generalizes to every stack.

## Foundation Spike 0 — Theia substrate qualification

Status: **QUALIFIED / OWNER-CLOSED** at package `0.0.6`, closeout commit `425b89d222e1542815af9e38aaa21a4e5a472cb7`.

Purpose:
- prove or reject Theia as Dope's IDE/workbench substrate
- prove domain/presentation boundaries
- prove serious commodity IDE capability
- prove custom Dope UI and layout control
- prove typed frontend/backend communication
- prove minimal Dope-owned persistence and restart restoration
- stress customization and service rebinding
- prove Linux packaging

The spike does not need to prove model integration, Agent Mind execution, tool calling, autonomous mutation, or the future shared coding loop.

Minimal Project Mind and Planning surfaces may use spike data to prove that Dope-owned product views fit naturally inside Theia.

Authority:
- docs/THEIA-SPIKE.md
- docs/planning/foundation-spike-0/decision-record.md
- docs/planning/foundation-spike-0/qualification-plan.md

Package family: 0.0.x

The gate is closed: Theia 1.75.0 is the qualified initial substrate. Upgradeability remains a design requirement and will be qualified on the first natural Theia upgrade rather than through synthetic Phase 0 work.

## Product Phase 1 — IDE Alive

Status: **NOT QUALIFIED — OWNER AUTHORIZED PHASE 2 SEQUENCING**

P6 closeout is **Not Qualified** at `dac6e57275134fc610d8c0c6e2620a90d7d58c2f` (`0.1.6`). The subsequent explicit owner sequencing waiver permits Phase 2 entry without changing this qualification result; see `docs/planning/p2/activation.md`.

Purpose:
Make Dope a serious native development environment before differentiating it with production project intelligence or AI.

Package family: `0.1.x`  
Activation baseline: `0.1.0`

Initial scope:
- production Electron application as the primary user-facing shell
- repository/workspace opening
- editor and language tooling
- Explorer and search
- terminal
- Git/SCM and diff workflows
- debugger
- Problems
- test discovery/execution integration
- preferences and keybindings
- extension installation/use and restart persistence
- Dope branding and sensible default workbench layout
- dark-first default theme with persistent user-controlled theme override
- reliable startup, restart, editor/workbench and workspace restoration
- reproducible Linux AppImage packaging/launch
- direct interactive Theia GUI dogfooding using the Dope repository itself (browser-hosted workbench or Electron)

Presentation rule:

Dope prefers dark mode. First-run/default presentation should be dark and Dope-owned surfaces should be designed/qualified dark-first. Developers remain free to select light mode or compatible custom themes; an explicit user choice persists and overrides the default.

The browser application remains useful for development, debugging, automated qualification, and direct interactive P5 workbench qualification. P4 separately qualifies the packaged Electron artifact and native launch. Headless/CDP-only browser evidence is not sufficient.

The existing Foundation Spike Project Mind Note and Planning views remain provisional spike artifacts. Phase 1 may make them non-intrusive, but must not turn them into production Phase 2/3 features.

Exit condition:

P4 proves the packaged Dope desktop application can be built and launched normally, and P5 proves through direct interaction with the real Theia GUI—browser-hosted or Electron—that a developer can perform the normal development loop on the Dope repository: navigate, edit, search, run commands and tests, inspect diagnostics, use Git/diffs, debug, install/use extensions, restart, and resume without another IDE.

This is the first self-development milestone: **Dope as editor**.

## Product Phase 2 — Project Mind

Status: **ACTIVE ENGINEERING SCOPE — OWNER SEQUENCING WAIVER**

Execution folder: `p2`. Activation source `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781`, package `0.2.0`; prompt versions `0.2.1`–`0.2.6`. The owner explicitly authorized proceeding despite Phase 1 being Not Qualified. `docs/planning/p2/activation.md` records the satisfied sequencing prerequisite and preserved gaps. Authority: `docs/planning/p2/phase-2-plan.md`. No Phase 2 implementation/qualification success is implied by activation.

Purpose:
Give the project durable memory that is useful to the developer before AI is required.

Initial artifact scope:
- Note
- Idea
- Question
- Decision

Foundation scope:
- ProjectArtifact identity
- relationships/links
- provenance
- persistence and migration discipline
- Project Mind navigation
- basic artifact search
- project reopen continuity

Bounded product behavior:
- create/read/edit/archive multiple artifacts in one local project;
- explicit Question answering and Decision acceptance/supersession;
- Ideas remain captured knowledge without automatic scope expansion;
- visible artifact relationships and project-relative file references, including unavailable targets;
- unsaved-draft preservation and visible save/conflict/error states;
- readable project-local storage, explicit legacy Note migration and external recovery;
- cross-process mutation exclusion, revision conflicts and project isolation;
- dark-first, keyboard-accessible presentation with supported light override.

Remote/multi-root Project Mind, Planning/Tasks, AI, semantic search, Sessions and synchronization remain deferred.

Product naming:
- Project Mind is the developer-facing concept.
- Project Intelligence is the internal domain/service boundary that implements it.

Exit condition:

Using Dope should leave the project easier to understand when it is reopened, even with no model configured. Direct GUI qualification must create/use all four artifact types, link/search them, restart/reopen and recover the same saved knowledge. Use actual Dope knowledge and a second local project to qualify isolation. Migration, corruption/conflicts, external recovery, framework independence, and the resulting Electron package also require evidence. Supplemental headless checks do not replace the interactive pass.

## Product Phase 3 — Planning

Purpose:
Make planning and implementation part of one project state rather than separate markdown or chat workflows.

Initial scope:
- Plan
- PlanStep
- Task
- live step status
- plan revision/history
- links from plans/tasks to Project Mind artifacts
- links from plans/tasks to files or symbols where practical
- planning workspace and task detail

Plans are live control structures, not static memos.

Exit condition:

A developer can move from thought -> decision -> plan -> task -> coding without leaving Dope or depending on an LLM.

This is the first major product milestone:

Real IDE
+
Project Mind
+
Live Planning

## Product Phase 4 — AI Presence

Purpose:
Introduce AI as an observable collaborator inside an already-useful development environment.

Initial scope:
- provider-independent Model Runtime
- first-class OpenAI/ChatGPT/Codex compatibility
- first-class local-model compatibility
- capability-based provider adapters
- Ask / Explain / Trace / Find Related
- read-only project and editor context
- Project Mind and active Plan context
- suggestions for notes, questions, ideas, and plan refinements
- structured Agent Mind for visible working state

Default posture:
observation and assistance before mutation.

Exit condition:

AI can understand and assist with the project without owning canonical product state or requiring Dope to become chat-first.

## Product Phase 5 — Scoped Delegation

Purpose:
Give AI bounded hands without giving away the developer's authorship or control.

Initial scope:
- HUMAN / AI / SHARED ownership
- explicit observation versus mutation authority
- ProposedAction
- implement/test/refactor actions
- diff/apply/reject flow
- conceptual ChangeSet review
- validation integration
- continuous steering while work is active

Exit condition:

A developer can delegate a bounded portion of work, see what the agent believes and intends, intervene during execution, and retain control over mutation.

## Product Phase 6 — Development Sessions

Purpose:
Make the development session durable for the developer, not only for the model.

Initial scope:
- persistent DeveloperSession
- current objective and active plan
- developer versus AI contribution history
- unresolved work
- decisions made
- validation state
- captured ideas
- reopen/resume context
- session closeout

Exit condition:

Returning to a project restores the developer's mental context well enough to continue without reconstructing the prior session from chat history.

## Deferred beyond the initial roadmap

These remain valid parts of the vision but must not block the initial product:
- dedicated Research workspace
- ArchitectureModel and visual architecture canvas
- semantic project-wide search
- advanced ambient intelligence
- automatic Ideas capture
- visual planning and freeform canvases
- sophisticated model routing
- multi-agent orchestration
- cloud/remote execution
- collaborative/team workflows
- remote project-state synchronization
- advanced conceptual ChangeSets
- autonomous long-duration development

## Sequencing discipline

Do not promote a later phase simply because its concepts already exist in PRODUCT-MODEL.md.

After Foundation Spike 0:
1. incorporate actual substrate findings
2. run /docs-review
3. revise architecture/product contracts if evidence requires it
4. obtain owner approval
5. decompose Product Phase 1

The roadmap should continue to prefer a smaller usable product over prematurely implementing the full vision.
