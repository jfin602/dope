# Dope Roadmap

Status: INITIAL ROADMAP
Current gate: Foundation Spike 0

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

## Foundation Spike 0 — Theia substrate qualification

Purpose:
- prove or reject Theia as Dope's IDE/workbench substrate
- prove domain/presentation boundaries
- prove serious commodity IDE capability
- prove custom Dope UI and layout control
- prove typed frontend/backend communication
- prove minimal Dope-owned persistence and restart restoration
- stress customization and service rebinding
- prove Linux packaging
- perform a framework-version upgrade

The spike does not need to prove model integration, Agent Mind execution, tool calling, autonomous mutation, or the future shared coding loop.

Minimal Project Mind and Planning surfaces may use spike data to prove that Dope-owned product views fit naturally inside Theia.

Authority:
- docs/THEIA-SPIKE.md
- docs/planning/foundation-spike-0/decision-record.md
- docs/planning/foundation-spike-0/qualification-plan.md

Package family: 0.0.x

No product phase may assume Theia qualified until this gate closes.

## Product Phase 1 — IDE Alive

Purpose:
Make Dope a serious development environment before differentiating it with project intelligence or AI.

Initial scope:
- production Electron application
- repository/workspace opening
- editor and language tooling
- explorer and search
- terminal
- Git/SCM
- debugger
- problems
- test integration
- preferences and keybindings
- extension support
- Dope branding and default workbench layout
- reliable startup, restart, and workspace restoration

Exit condition:

Dope should be comfortable enough that Dope can be developed inside Dope without immediately reaching for another IDE.

## Product Phase 2 — Project Mind

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

Product naming:
- Project Mind is the developer-facing concept.
- Project Intelligence is the internal domain/service boundary that implements it.

Exit condition:

Using Dope should leave the project easier to understand when it is reopened, even with no model configured.

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
