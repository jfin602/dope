# /prompt-ass — c12-rm-orch/fix

**Date:** 2026-11-04. **Status:** Source-informed assessment for future implementation, not local dirty-worktree inspection, run or qualification. Authority: [ADR 0049](../../../decisions/0049-roadmap-phase-orchestration.md), [tool-loop design](../continuous-tool-loop/README.md).

## Observed problem

The owner-provided transcript requested two PixiJS Phases, each one Gate with two Criteria. Qwen3.5-9B completed a roadmap_phase call for Phase 1, then tried Phase 2 twice in the **same Pi execution**; both second calls returned ROADMAP_GENERATION_TOOL_DENIED. It was cancelled without a final assistant result. Phase 2 was attempted around 90 seconds after start. This demonstrates that Qwen naturally attempted a sequential tool workflow; it **does not** prove Phase 1 was actually server-staged, that Phase 2 arguments were valid, or that the whole Roadmap would have finished rapidly.

In the GitHub reference source, chat-backend.ts guards tool validity with a condition equivalent to allowed && current && !operation. The first operation sets that variable, causing all later tool calls in the same execution to be denied. The tool returns accepted:true after argument checks, while RoadmapGenerationController stages the Phase **later**, after inference returns. Tool acceptance is therefore currently not the same as authoritative noncanonical staging.

The existing Pi worker already runs an agent session with tools. A continuous protected tool loop is technically plausible, but its safety, efficiency and full completion are **not qualified**. Earlier P7 recorded a distinct failed live trial: reasoning streamed for 60 seconds and the controller timed out before Phase 1. LM Studio logs for another request showed active inference until a client disconnect near 41 seconds. Those are different observations; their abort causes must not be conflated.

## Options and decision

1. **Reject** removing !operation alone. Without moving validated StageOwner staging inside the tool handler, model-visible tool successes are misleading, Phase order can race, and one proposal can remain incomplete.
2. **Reject** restarting new inference per Phase as the production fallback, unprotected direct model calls, duplicate staging owners, old full-plan JSON/RM1/Markdown parsers, or automatic conversion passes.
3. **Select** one continuous **trusted /gen-roadmap Pi execution**, with the existing controller acting as the admission/scope/budget authority. The model proposes bounded Phase tools; Dope serializes, validates, stages and only then sends a truthful result to Pi. roadmap_finish is a request subject to server-side completeness checks, never a model approval.
4. **Keep** the already-built schema-2 RoadmapStore/Service, ProjectPlanningActions, typed StageOwner, single proposal, Chat/Pi broker permissions, signed owner/root/chat/turn/lease/source identity, canvas review, checked Markdown sync, History and evidence-bound GREEN.

## Critical invariants

- **Serial stage:** A single in-flight proposal mutation; duplicate, parallel, skipped or out-of-order Phase requests fail closed. The next Phase becomes admissible only after the previous stage succeeded. No model self-Apply.
- **Truthful result:** A successful roadmap_phase tool result includes trusted proposal/stage identity after server stage validation. A failed stage returns a limited explicit error and does not increment expected Phase; bounded correction only.
- **Scope/limits:** One generation session, selected local model and context, caps on phases/tool calls/tokens/idle/absolute time and retries. No indefinite thinking loop or provider swap.
- **Finalization:** roadmap_finish only validates real staged content and outstanding requirements; not simply model says done. No canonical/Markdown/History writes until explicit owner Apply.
- **Canvas visibility:** First validated Phase and nested Gates/Criteria render while Phase 2 is still generating; they are Staged · Provisional, not owner-accepted, Planned or GREEN. The next-Phase pulse/spinner is a visual-only placeholder with no invented ID/title/Gates/count/percent. It must never block Pi, steal focus or violate reduced-motion.
- **Authority:** Exact top-level user /gen-roadmap only. Ask/Allow, project/chat/turn lease, source revision/hash, cancellation, stale model/source, callback generation ID and replay protection remain. Incomplete/cancelled drafts are not applicable.
- **Qualification:** Deterministic **actual Pi worker** integration proving stage-before-success and same-session two Phases plus finish; canvas/loader/security regressions; separate one-shot real Qwen two-Phase browser trial and eventual full MVP test. Model transcript alone is insufficient.

## Scope and evidence

R1 is source/backend integration; R2 is source/UI/transaction protection; R3 is manual selected-model connected Codex Browser. Native Electron owner evidence remains independent. Exact local HEAD, dirty changes and host state must be inspected during implementation. Historical c12-rm-orch P1–P7 outputs and NOT GREEN remain immutable. Do not report GREEN based on matching runner checkpoint commits.

The nested requested folder c12-rm-orch/fix is not supported by scripts/codex-phase-core.mjs as a runnable stack. The only runner-compatible prompt root is the sibling [c12-rm-orch-fix](../../c12-rm-orch-fix/README.md).