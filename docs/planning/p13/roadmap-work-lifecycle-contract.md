# Phase 13 — Roadmap → Work → Evidence lifecycle contract

**Approved:** 2026-11-05. **Authority:** [ADR 0051](../../decisions/0051-roadmap-work-evidence-lifecycle.md), [Gate semantics ADR 0040](../../decisions/0040-phase-gate-roadmap-domain.md), [Planning Bridge ADR 0038](../../decisions/0038-planning-bridge-and-idea-to-implementation-workflow.md). **Documentation handoff:** [Task-Anchored Documentation Routing](task-anchored-documentation-routing-contract.md), under ADR 0041. **Status:** forward requirements only, not shipped or qualified.

## 1. One project view, independent owners

The Roadmap canvas is the normal entry point to plan, launch a reviewed Work preparation, monitor live activity and inspect Gate-level evidence. Do not make the operator manually reconcile Work task checkboxes with a parallel Roadmap checklist.

Maintain canonical identities in the existing schema-2 Roadmap service: project/root ID, Phase ID, Gate ID, Criterion ID, accepted revision and linked-document/source hash where applicable. Use the already-owned PlanningMap → PlannedTransformation → WorkItem → AgentTask/AgentRun → candidate/validation/History records. A typed source-bound association/projection connects them; neither Work nor Chat directly sets Roadmap GREEN. Keep the existing criterion/coverage/qualification owner as the only disposition boundary. If inspection finds an existing safe association mechanism, extend it instead of adding a shadow database.

## 2. Independent state facets and derived user labels

Store or derive separately: (a) planning draft/coverage approval/locked basis, (b) Work preparation and execution, (c) evidence evaluation and Gate qualification, (d) owner Phase closeout. A Phase can have a completed run but outstanding qualification. Orthogonal issues include Blocked, Failed, Source Stale, Needs Decision and Waiver. No one enum substitutes for the facets.

- **Planning:** accepted or in-progress editable Phase; “at least one Gate” alone is not complete coverage. Keep `Unplanned`/empty required-Gate warnings explicit. Replace the present display word `Planned` with `Planning` where describing editable phase state, without changing unrelated historical records.
- **Ready for Work:** the owner has finished planning the exact accepted revision and signed Gate-set coverage; normal structural editors hidden. No implicit run. A prepared Work proposal can be reviewed from the Roadmap.
- **In Work:** linked authorized Work runs are genuinely active/under review. Status is derived from run events and current linkage, not AI prose.
- **Awaiting Qualification:** linked Work may be finished, but one or more required current Criteria/Gates lack sufficient verified evidence or owner decisions.
- **Complete:** current Gate qualification, approved coverage, exception disposition and explicit owner Phase closeout all agree. Show verified evidence/closeout provenance.

A different Phase remains independently editable or ready; a current Phase need not block unrelated planning unless a real dependency exists.

## 3. Finish Planning transaction

Developer selects `Finish Planning` on the Roadmap. Preview exact Phase ID/revision, ordered required Gate IDs and Criterion expected results; validate semantic completeness/duplicates/dependencies, coverage approval, pending proposals, current linked Markdown/source-sync conflicts and current project/owner identity. Missing linked Markdown is not silently treated as published; respect existing initial-link and sync contracts. Approval stores a checked durable lock/basis receipt without writing a second Roadmap. On failure nothing locks or starts. On success, hide structural edit actions on that Phase; retain accessible read, select, inspect, copy and evidence navigation. A Phase reopen before execution requires explicit reviewed action and invalidates stale preparation. Post-run change is an amendment, never a silent unlock.

## 4. Prepare Work and execution

From a locked Phase use existing `Prepare Work`: source-grounded impact/Physical Map, PlanningMap transformations, WorkItems with requirements, explicit dependency graph, relevant Criterion IDs, acceptance/validation targets and source references, then reviewed bounded prompt/Work candidates. Show uncovered or ambiguous Criterion mappings and prohibit launch until mandatory mappings resolve or a recorded owner decision allows an explicitly limited scope. Preserve distinct approvals: frozen Roadmap coverage, architectural plan, approved Work proposal, per-run grant/Run, candidate promotion, qualification, Phase closeout. Do not invent a “Run all” bypass.

At documentation and Work handoff, follow the linked Task-Anchored Documentation Routing contract: applicable AGENTS.md instructions lead bounded, task-relevant reading; a durable projection retains the original objective, accepted plan and verification basis through execution and recovery. Documentation consultation does not change the Roadmap or Work owner or count as qualification evidence.

An authorized WorkItem may serve multiple Criteria; one Criterion may need evidence from several WorkItems or manual checks. Links are ID-based and versioned, not text matching. A Work run that was not launched from the Roadmap may offer **reviewed evidence association**; it may never auto-adopt an unrelated result or award GREEN.

## 5. Evidence identity and evaluation

Immutable evidence receipts reference stable receipt ID, project/owner, Phase/Gate/Criterion ID(s), WorkItem/AgentRun and tool/validator/human observation origin, execution context, resulting PASS/FAIL/UNKNOWN/BLOCKED, source/commit/working-tree and candidate identity, relevant expected result, timestamp, validation artifact digest/location, scope, approval/reviewer and freshness assessment. Persist safe links and minimal audit metadata; keep secrets, raw source bodies and private tool payloads out of broad History/navigation projection.

Build a checked, idempotent ingestion/reconciliation boundary from real validation or reviewed manual observation into existing Gate evidence authority. A successful command exit without a Criterion-specific verified assertion is NOT PASS. Candidate-only validation is not current accepted-source evidence without explicit applicability checks after accepted promotion. Tools, models and parser-generated summaries cannot self-approve sufficiency. Failed, flaky or missing evidence remains visible; evidence does not vanish on a new unrelated Work run.

For each Criterion evaluate required method(s) and current matching receipts. For a Gate, all required Criteria must have sufficient current approved evidence and no blocker. For a Phase, ADR 0040 coverage approval + required Gate results + exceptions/waivers determine qualification eligibility. Record the distinct owner closeout separately. No fake 100% for empty sets; counts mean qualified **required Gates** / total required Gates.

## 6. Drift, amendments and restoration

Store the locked phase-revision basis; compare materially relevant source/requirement/validator/accepted-candidate identities when receiving evidence and before qualification/closeout. A changed Criterion, source under test, relevant dependency or approval invalidates **affected** current status and queues requalification while retaining immutable original records. Unrelated metadata/UI/camera edits do not unnecessarily stale all results. Missing source identity produces UNKNOWN/EVIDENCE GAP, never inferred PASS. Review a post-run Phase amendment as a new canonical transaction; recheck Work grants, stale WorkItems and candidate basis. Do not reuse superseded grants. Historical Undo/Redo remains read-only and reviewed restores become new revisions, never wholesale evidence rollbacks.

On interruption/restart/cancellation, reconstruct the same status from durable run/evidence/decision IDs; deduplicate replays; interrupted Work is not finished or qualified. On split-brain or foreign project context, fail closed and present actionable recovery. Markdown sync failures remain distinct from accepted canonical changes and are surfaced instead of falsely reporting source agreement.

## 7. Roadmap monitoring UX

The center Phase card shows truthful planning/work/qualification/closeout state, current Gate numerator/denominator, active/failed/stale Work associations, last significant result and a single obvious next owner action. Expand a Gate to show its Criteria, actual evidence receipts and validation links, not a second checkbox store. Clicking a run or validation opens existing Work/History detail without discarding Roadmap context. Keep selected Phase/viewport stable; background Work events cannot steal focus. Honor narrow viewport, keyboard, reduced motion, semantic colors in Dope theme and alternate-theme token isolation. Pending proposed edits retain yellow dashed construction/attached Select/Accept/Reject tabs from existing canvas design; a locked canonical Phase is solid and structurally read-only. Semantic colors are not theme-customizable action accent.

## 8. Acceptance and exclusions

Required deterministic cases: one Phase locks while another edits; empty/incomplete Gate-set and unresolved proposals cannot lock; stale/foreign source and double confirmation fail closed; no pre-Run code effects; Work and direct Work evidence association remain reviewable; task completion and plain model claims never GREEN; duplicate same receipt is idempotent; negative/partial manual evidence stays unqualified; candidate-before-promotion does not qualify current source; successful current evidence changes only affected Criteria/Gates; amend/restore invalidates affected results; restart/replay/cancel preserves exact decisions; only owner can close; distinct UI state and click-through provenance survives browser reload.

Independent manual T3 must exercise real Dope + local model and a disposable project in the connected Codex in-app browser or connected Chrome, plus separate owner-native Electron evidence. Do not modify the owner's persistent game fixture. Security negatives include project/owner mismatch, grant bypass, filesystem escape, source drift, stale lease, proposal replay, external egress and History redaction. A mock/unit pass alone is not GREEN.

**Out of scope:** changing `/gen-roadmap` generation orchestration, implementing general background LSKM, removing evidence/waiver approvals, automatically executing Work on lock, adopting arbitrary Chat prose as Gate evidence, replacing the single Roadmap store or existing Work/candidate authorities.
