# Correction 4 Implementation Plan — sMap Synthesis Coverage + Iterative Review

Status: **APPROVED / READY**
Correction folder: `c4-synth-coverage-review`
Required unchanged package version: `0.4.6`
Activation source: `4a887ecebc546f9944adf54890143827623e008c`
Authority: ADR 0014 as amended 2026-09-30

## Preflight for every prompt

Read BOOT.md / AGENTS.md, ADR 0008-0014, current roadmap/workflow/Phase 4 authority, predecessor closeout/P4 evidence, this correction assessment/plan/README, and exact successful predecessor result.

Require package `0.4.6`, reachable activation/predecessor source and clean intended tree. Do not reopen old hierarchical/Gemini/synth-improvements closeout prompts.

## P1 — provider reliability and retained attempt telemetry

Introduce provider-independent call-attempt records distinct from transient progress.

Each attempted generation records safe stage/subject, provider/model, attempt number, retry relationship, elapsed call duration, completion/failure class, usage when available, cache reuse where applicable and whether its output was consumed.

Retain complete analysis telemetry through transition into review and after a failed run long enough to inspect/export qualification evidence. Do not persist it as canonical project state or include credentials/raw provider errors.

Classify retryable Gemini transport/upstream failures with safe typed codes. Permit at most one bounded automatic retry for approved transient classes. Retry the exact same request/stage/model; never switch provider/model. Schema/validation/architecture failures are not retryable.

## P2 — coverage cues and Subsystem recovery

Advance planner/view/stage/prompt/cache identities where contracts change.

Replace simplistic cross-area word ranking with generic source-backed scoring that favors meaningful production behavior, state ownership, worker/job behavior, integration/delivery/public contracts and coherent dependency neighborhoods over low-information recurrence.

Keep every cue deterministic, bounded and provenance-backed.

Before Subsystem Challenge, deterministically identify strong responsibility cues not represented by initial candidate evidence.

Extend Subsystem Challenge with a compact **recovery** output for substantial omitted responsibilities while retaining exact-once keep/merge/split/reject disposition of all initial candidates.

Produce a deterministic coverage ledger mapping strong cue IDs to represented / transformed-or-recovered / unresolved state.

## P3 — Component descent and coverage diagnostics

Advance stage contract as required.

A Component Discovery result always carries a compact descent disposition. Nonempty results report Components found. Empty results must choose a typed reason such as leaf responsibility, insufficient evidence, belongs elsewhere or no stable Component boundary and cite supporting parent evidence.

Feed unresolved/misplaced/insufficient descent plus uncovered responsibility cues into reconciliation/verification without forcing fake Components.

Expose coverage/descent diagnostics in the pending review/analysis result so qualification and Search Deeper can target weak branches.

## P4 — Search Deeper

Add a review-scoped targeted analysis service.

Input includes review ID, selected System/Subsystem proposal key and the **current editable draft** (or a validated current-branch snapshot), plus review/source identity. Build temporary synthesis candidates from current user-visible name/purpose/roots and retained proposal evidence where available; developer edits remain authoritative review state.

Deterministically expand targeted evidence beyond refs already attached to the branch by including relevant uncovered cues, dependencies and neighboring source-backed evidence.

Use bounded existing hierarchy stages where possible:
- System target: targeted Subsystem Discovery -> Challenge/recovery -> Component descent;
- Subsystem target: targeted Subsystem Challenge/refinement of the selected branch -> Component descent.

Return a preview branch proposal with base target-branch fingerprint. Do not mutate draft on search completion.

Accept applies only the validated replacement branch and preserves unrelated current edits. Reject discards the proposal. If the target branch changed after search began, acceptance fails stale rather than overwriting newer work.

Targeted calls are marked separately in attempt telemetry.

## P5 — direct browser review qualification

Use the exact final P4 implementation candidate and a controlled disposable benchmark state.

Through the actual workbench prove:
- valid explicit final acceptance;
- invalid acceptance blocking;
- rename/add/remove/reparent;
- practical merge/split-equivalent correction;
- source navigation;
- Search Deeper on a System;
- Search Deeper on a Subsystem;
- accept and reject targeted proposals;
- unrelated-branch/manual-edit preservation;
- stale branch proposal protection;
- project/root switch isolation;
- reopen the same pending review.

Record direct evidence. Avoid full aggregate/package reruns here.

## P6 — multi-repository synthesis qualification

Use one explicitly selected/probed Gemini model and the exact final candidate.

Run controlled initial synthesis on:
1. pinned Adaptive SEO;
2. Dope through an uncontaminated benchmark root;
3. one smaller structurally clear repository or controlled repository fixture recorded before execution.

For each, freeze the generated hierarchy before consulting architecture reference material. Record coverage ledger, discovery/challenge/recovery, Component descent dispositions, final hierarchy, complete call-attempt telemetry and review-ready elapsed time.

Green does not require exact names/counts. It requires major implemented responsibilities to be represented or explicitly unresolved, no unexplained empty descent, no dominant unsupported technical-tier decomposition and no obvious over-segmentation on the small benchmark.

Per controlled run, <=8 minutes is Green on performance but never a cancellation timeout.

After the last product repair, run full final-candidate validation once: `npm run check`, restart tests, correction validation, unchanged-version/no-root-lock/framework checks, AppImage build/inspect/native launch where environment permits and `git diff --check`.

## P7 — evidence-only closeout

Audit exact P5/P6 candidate/evidence. Do not rerun live models/browser/package work just to fill evidence gaps.

Green routes to fresh provider comparison, then storage. Any Not Green/Evidence Gap preserves evidence and blocks those gates.

## Non-goals

No benchmark answer dictionary, fixed architecture counts, provider voting, Local-specific optimization, general Agent Runtime/chat/tools, Phase 5 canvas/planning transforms, or canonical persistence of operational telemetry.
