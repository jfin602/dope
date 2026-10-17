# ADR 0038 — Planning Bridge and Idea-to-Implementation Lifecycle

**2026-10-17 owner-locked sequence policy / DOCS ONLY:** Only Planning Bridge outline/WorkItem order **before executable P*.txt authoring** may change. After authoring P1→PN fixed even if unstarted. A wholly unstarted authored sequence may be revised only via explicit reviewed supersession/new fingerprint preserving old provenance, never in-place reorder. Completed prompt text/hash/order/checkpoint/run/historical outcome immutable; append later evidence/continuations/corrections. Outside filesystem edits treated as source drift, not accepted state. [c11-phase-focus](../tasks/c11-phase-focus/README.md). Existing authored Bridge prompts untouched.

**Phase 11 placement amendment — 2026-10-17 (owner-approved):** The existing ADR 0038 design and PB1–PB8 breakdown are now a separate **`c11-planning-bridge` workstream within Product Phase 11 — Human-Centered Development Workflow**, downstream of the independently qualified `c11-brainstorm` Roadmap handoff. Its five stages, nine states, three planning approvals, fast lane, source ownership, provider-free/local-model use and independent execution grants are **unchanged**. PB8 must retain its own scoped qualification; **final Phase 11** independently requires integrated D1–D8 journey, existing usability gates and two materially distinct clean broad Hunts, plus owner closeout. See [Phase 11 plan](../planning/p11/phase-11-plan.md). Design only: no new runnable stack, Run, version, qualification, Phase 12 activation or altered historical evidence.


**Status:** ACCEPTED PRODUCT DESIGN / DOCS ONLY — NOT IMPLEMENTED OR QUALIFIED
**Date:** 2026-10-16 (America/Chicago); owner-approved `/docs-review` -> `/docs-apply`.
**Depends on:** ADR 0017, 0028–0032, 0034, 0036–0037; `docs/workflow.md`.
**Plan:** [Planning Bridge PB1–PB8](../planning/planning-bridge/plan.md).

## Decision

Establish **one continuous Dope development lifecycle**. The interactive brainstorm Roadmap is the main entry point for substantial new work. Once a checkpoint is approved, a separate **Planning Bridge** uses current Physical/Canonical Software Map evidence and a Planning Map to prepare WorkItems and executable task stacks. The developer can then implement, qualify, reconcile and close work using existing owners. The Bridge coordinates; it is **not** a new Chat, Roadmap, planning database, architecture authority, Work runner, Session or qualification engine.

**Five stages, nine workflow states:**

| Stage | State | Required transition |
| --- | --- | --- |
| 1. Idea & Brainstorm | **Captured** | Record idea/issue and begin brainstorming as needed. |
| 1. Idea & Brainstorm | **Brainstorming** | Approve proposed Roadmap scope. |
| 2. Approved Roadmap | **Roadmapped** | Scope/order/dependencies approved; select **Prepare Work**. |
| 3. Planning Bridge | **Architecting** | Grounded impact and Planning Map design; approve target. |
| 3. Planning Bridge | **Prepared** | WorkItems/stack approved for possible execution. |
| 4. Implementation | **Implementing** | Separate deliberate Run through existing Work/runner/grants. |
| 5. Qualification & Reconciliation | **Validating** | Compare actual implementation and required tests/direct evidence with plan. |
| 5. Qualification & Reconciliation | **Qualified** | Exact-source, scope-bound gates demonstrably pass; seek owner closeout. |
| 5. Qualification & Reconciliation | **Closed** | Owner accepts closure; statuses and linked artifacts reconciled. |

These are **derived workflow states**, not replacements for existing six-state Roadmap qualification colors, PlanningMap lifecycle, WorkItem status, AgentRun outcome or owner-close evidence. **Blocked, Stale, Needs Decision, Failed and Not Green** are orthogonal conditions; implementation completion, qualification and owner closeout stay distinct. Unknown is not Green.

## The Planning Bridge: five ordered operations

**A. Understand current software.** From a Roadmap checkpoint **Prepare Work**, gather source-backed Physical Map, canonical architecture, dependency, relevant docs/contracts and existing-work evidence. Show affected branches, uncertainty and freshness. Reanalyze only explicitly selected branches if needed. **Output: impact assessment.**

**B. Design the transformation.** Focus/create the existing Planning Map preloaded with checkpoint requirements and evidence; design typed PlannedTransformations against a current/target/diff overlay while the Physical/Canonical Map stays unchanged. Manual and AI proposals use revision-checked Dope owner actions. Present conflicts, staleness and explicit rebase; require **architecture approval**. **Output: reviewable transformation plan.** Editing does not silently invoke **Adopt Target**.

**C. Decompose into WorkItems.** Derive bounded editable WorkItems referencing one or more transformations and originating checkpoints, with stable identity, working sets, dependencies, requirements/constraints, acceptance criteria, validation and ownership. Support one-to-many/many-to-one mappings and human split/merge/accept. Reject cycles, stale basis and foreign references. **Output: ordered WorkItems.** Completion does not imply tests, promotion or physical realization.

**D. Compose the task stack.** Use the approved WorkItems/dependencies to draft `docs/tasks/<folder>/P<number>-<slug>.txt` prompts via existing runner/Work grammar, T1/T2/T3 policies, appropriate integration/manual/browser/native qualification, iterative repair loops and a sole final closeout. Keep a clear preview and editable scope. Follow existing `/prompt-ass -> /prompt-plan -> /prompt-write` and mandatory Prompt Efficiency Gate; <=8-minute ordinary prompt target, 10-minute soft and 15-minute hard limit without weakening safety. No fixed prompt count. The stack source and snapshot are execution representation, **not another task authority**. **Output: draft prompt stack/manifest.**

**E. Approve and hand off.** Validate project and Git/source basis, Planning Map/Physical Map freshness, WorkItem dependencies, prompt grammar/version/hash, source safety, grants and manual-gate routing. Developer explicitly **approves stack**; separate deliberate **Run** authorizes its execution (no `/activate` prerequisite). Mere viewing/approving must never run it. Existing Work/AgentTaskSequence, ExecutionGrant, isolated ExecutionWorkspace, CandidateDelta validation, developer review, Dope-owned promotion and Git checkpoint authority remain intact.

## Artifact ownership and links

- **Roadmap:** what/why/when, checkpoint IDs/edges and typed links. Supported mapped prose belongs to linked Markdown and follows the existing lossless source adapter/approval contract; no duplicate document truth.
- **Canonical Architecture + Physical Map:** accepted structure and observed real source. Planning never changes either implicitly.
- **PlanningMap -> PlannedTransformation -> WorkItem:** the sole forward planning ontology, stored under existing `.dope/planning-maps.json`. Preserve basis, explicit rebase/adoption, WorkItem developer transitions and Phase 3 retirement.
- **Prompt Stack + Work/runner + AgentTask/Run:** executable source, immutable snapshot, grants, candidate, validation and run evidence. A generated WorkItem is not automatically an AgentTask.
- **History / Developer Continuity:** sourced activity and precise resume via ADR 0034. Do not revive superseded mandatory Development Sessions (ADR 0033) or introduce a hidden session container.
- **Traceability:** checkpoint -> Planning Map/transformations -> WorkItems -> stack/prompt -> AgentTask/Run -> qualification/closeout. One checkpoint may produce multiple stacks; a Planning Map may support several checkpoints. Use stable project-scoped typed IDs and owner resolution, not mutable copies of another owner's truth.
- Prefer owner-backed derived state. If a minimal Bridge-owned approval/provenance record is necessary, give it one explicit writer, version/revision and project-local recovery; do not pretend cross-owner edits are distributed transactions. Source/fingerprint/stale approval conflicts fail closed.

## Approval and authority boundaries

The **three planning approvals** are (1) Roadmap scope, (2) Planning Map target architecture, and (3) executable stack. These are **not** the separate run instruction, per-task ExecutionGrant, canonical **Adopt Target**, candidate review/promotion or final owner closeout. Provisional live Roadmap edits remain noncanonical until explicitly accepted. A model may interpret/project typed proposals but cannot self-approve, write repository/Markdown directly, gain ordinary Chat shell/Git/network/agent rights or mark evidence Green. No silent hosted data egress or provider switch.

## Workflow presentation

Keep the Roadmap as the full-center horizontally progressing checkpoint map, vertical correction branches, honest status semantics, and existing in-canvas Software Map-style details overlay. **Prepare Work** is its contextual next action. Move into the **existing center Planning Map** and in-place impact/current/target/diff inspector, then a progressively disclosed WorkItem/task-stack preview. Chat remains the **same saved dockable ChatPanel** in any supported left/right/center/bottom position; entering planning must not open, move, replace or reset it. The same chat/model/owner contextual actions serve planning, with factual progress and useful follow-up questions. Preserve restrained dark-orange theme, accessible keyboard/narrow layouts, focus, non-color states and recovery.

Every checkpoint shows its truthful next allowed action: brainstorm, approve, plan, prepare, run, review, qualify, close or repair. Do not replace ordinary code editing with a mandatory wizard.

## Fast lane, models and feedback

**Fast lane:** small bugs/fixes may start from an Issue, existing checkpoint or correction branch without full brainstorm. Ground source impact and do only applicable architectural planning; explicitly mark architecture N/A when truly unnecessary, using existing direct Work/Prompt Stack paths instead of fake transformations or WorkItems. Preserve traceability, permissions and evidence; less ceremony never means skipped safety.

**No-model/local-model-first:** manual planning, identity, dependencies and validation work with zero AI. Local models can propose bounded design/decomposition from selected-checkpoint/source-backed context; Dope deterministically owns IDs, cycles, revision checks, approvals and writes. Accept only complete schema-validated actions, with strict JSON fallback if native tool calling is unavailable. No partial-token mutation, full-repo ingestion, automatic multi-step inference loops or invisible hosted fallback. Respect actual provider/model and loaded capacity; Phase 10 Q4_K_M/32,768 was a tested planning profile, not an app-wide default or Q4/64K guarantee.

**Reconcile:** after work, deliberately reanalyze affected Physical Map branches and compare with the preserved Planning Map target. Record *implemented as planned*, *implemented differently*, *not implemented*, *unexpected implementation*; developer may accept an intentional difference. Required T1/T2/T3 and real GUI/native/manual evidence must be source/version-scoped. Not Green/failed work produces a linked vertical correction stack; fundamental design change returns to the Planning Map, explicitly rebases and regenerates only affected unexecuted tasks while invalidating stale approvals. Never silently reconnect a correction as Green or overwrite historical failures/waivers.

## Delivery and non-goals

Deliver separately as **PB1 state/provenance; PB2 Roadmap handoff; PB3 impact/transformations; PB4 WorkItems; PB5 stack composer; PB6 reconciliation/corrections; PB7 integrated UX/local-model qualification; PB8 source-bound owner closeout**. Logical slices, not eight fixed prompts. `c11-brainstorm` is the independently authorized upstream producer; avoid changing its current stack or qualifying it by association.

**Rejected:** second Chat/Work/Planning/Roadmap database, mandatory Sessions, cloned Markdown edits, separate runner parser, implicit code/canonical writes, auto-Run, fabricated completion/Green, forced architecture ceremony for bugs, provider lock-in.

**Execution status:** This ADR locks the **owner-approved design only**. No product-code edit, runnable prompt stack, implementation, test result, version bump, Phase 11 Green or Phase 12 activation is authorized by this documentation change. Preserve Phase 10 R6 scoped Green and its historical exclusions.
