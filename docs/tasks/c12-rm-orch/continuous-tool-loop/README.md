# c12-rm-orch — continuous Pi tool-loop correction (prospective R1–R3)

**Owner approval:** 2026-11-04, `/docs-review` followed by `/docs-apply`, including the requirement that each successful Phase appears on the Roadmap with a loading affordance for the next. **Status:** DOCUMENTATION DESIGN ONLY — prompts NOT AUTHORED, implementation NOT RUN, model/browser behavior NOT QUALIFIED. **Authority:** [ADR 0049 refinement](../../../decisions/0049-roadmap-phase-orchestration.md) · [forward contract](../../../planning/p12/roadmap-phase-orchestration-contract.md). Product reference `0.12.7`; verify actual local worktree.

## Evidence and cause

A Qwen3.5-9B transcript showed `roadmap_phase` completing for Phase 1 and then two `roadmap_phase` attempts for Phase 2 returning `ROADMAP_GENERATION_TOOL_DENIED`, in one Pi execution. Source inspection on remote main showed a guard of the form `allowed && current && !operation && ...`: once the first tool filled `operation`, subsequent tool calls in that model execution were denied. The current adapter does not genuinely stage a Phase before telling the model the tool operation was accepted; the later controller stages only after inference returns. Therefore `completed` in the transcript is not by itself proof of a staged Phase. Fix this mismatch before declaring progress.

This evidence supports **testing** a continuous tool loop, not a claim that a larger Roadmap or lower overall latency has been demonstrated. The existing P7 NOT GREEN report remains factual. Do not rerun historical P1–P6 prompts, edit historical reports or treat a runner commit as independent qualification.

## Owner-approved target behavior

1. Exact user-origin `/gen-roadmap` starts one bounded protected Pi execution. The selected Qwen model can make successive `roadmap_phase` proposals through native tools, while Dope retains strict control of the expected Phase number, limits, permission/source/model/lease identity, duplicate prevention and sequencing.
2. A `roadmap_phase` result is **successful only when Dope has validated and actually staged** the Phase with its Gates and Criteria in the existing single **noncanonical** proposal. Before that point the UI may show model activity but not a committed/staged Phase. Failed operations return precise limited errors; no infinite retries.
3. On successful provisional staging, the actual Phase card and nested Gates/Criteria **appear immediately** in the Roadmap canvas. They are clearly `Staged · Provisional`, not owner-approved/Planned/GREEN. If the owner has the Roadmap tab closed, validated content is still available on reopening; no auto tab switch.
4. While waiting for the next tool-stage, display **one understated `Generating next Phase…` placeholder** at the next horizontal position. Animate a small Dope-theme accent pulse/spinner, without an invented Phase ID/title/Gates/percent/count or fake progress. Loading is visual-only, never a model/tool synchronization barrier. Reduced-motion uses static status icon/text. Move it after subsequent validated stages; remove on `roadmap_finish`, cancel, stale, failure, inactivity or deadline.
5. `roadmap_finish` requests finalization; Dope checks source/revision/lease, all actual staged content, dependency closure, requirement coverage claims/uncertainties and budgets before review readiness. **Only owner Apply** upgrades selected staged content to canonical accepted Roadmap entities; linked Markdown and History sync happen under existing checked mutation authority. No Apply during partial or invalid generation.

## Future targeted correction sequence (not executable prompts)

| Step | Code responsibility | Acceptance boundary |
| --- | --- | --- |
| **R1 — Real serial tool loop** | Replace independent per-Phase model executions with one protected Pi tool session. Make the tool handler stage-and-receipt atomic at its authoritative boundary. Remove `!operation` single-operation latch without bypassing actual stage checks, source/lease, sequencing or limits. | Two valid sequential `roadmap_phase` operations and `roadmap_finish` from **one Pi worker execution**; one proposal; receipt after stage only; duplicate/invalid operations denied |
| **R2 — Live staged canvas + loading** | Bind already validated stage snapshots to real Phase/Gate/Criteria canvas nodes and one nonblocking next-Phase loading placeholder; preserve focus/camera, reduced-motion and terminal safety. | First staged Phase remains visible while Phase 2 generates; animated placeholder only for next; owner Apply transitions to canonical, no pre-Apply writes |
| **R3 — Real local qualification** | After R1/R2 tests and stable host, one authorized selected-model Codex Browser two-Phase run. If qualified, expand to full tower-defense MVP using a separately bounded run. | Actual two-Phase receipts + nested canvas updates, `roadmap_finish`, review and safety, timings and no-write/Apply evidence; otherwise NOT GREEN |

## Essential regression matrix

- **Authority:** /gen-roadmap user origin, Ask/Allow, Pi worker protected tool names, project/root/chat/turn/lease/model/source/revision, source-hash change between tools, stale and cancelled receipts, no model self-Apply, no direct filesystem/Markdown writes.
- **Tool loop:** one in-flight stage, strictly increasing expected Phase index and stage sequence, model may continue in same Pi session, no `ROADMAP_GENERATION_TOOL_DENIED` solely because Phase 1 succeeded, out-of-order/repeated/parallel stages denied, malformed Gate/Criteria denied with bounded recovery, `roadmap_finish` at index 0 or with unresolved structural requirements rejected.
- **Canvas:** server-side staged receipt precedes UI addition; first Phase and its Gate(s)/Criteria are real validated projection; one next-Phase placeholder has no ID/Gates/count; first validated stage persists while loading next; no camera hijack; hidden tab, re-open, reduced motion, project switch, historical view and cancellation all correct. Canvas animation never awaits or drives model execution.
- **Completion and persistence:** one noncanonical proposal through the session, after review owner Apply/Reject selected/Phase group/all works with dependency closure. No canonical/Markdown/applied History writes before explicit Apply. A declined/failed/cancelled/stale draft cannot be silently promoted. Real accepted Phase after Apply obeys planning-vs-GREEN semantics.
- **Performance:** measure time to first staged Phase, time between Phases, total duration, model calls/tool invocations, reasoning/final usage when supplied, and any stalls. Do not claim speed from Phase 2 *attempt* alone; the transcript did not demonstrate successful Phase 2 staging.

## Execution boundaries

Only a later `/prompt-ass + /prompt-plan + /prompt-write` (or explicit equivalent) should author new R1–R3 implementation prompts; a separate explicit owner Run is required to execute them. Do **not** patch historical P1–P7 prompt bytes or qualification reports. Before coding inspect actual local HEAD/diff and any uncommitted P7/skill-picker changes. Do not reset/stash/clean, use real owner project data, create compatibility fallbacks or new source owner, change provider/model, self-commit or falsely claim qualified. Preserve Dope version 0.12.7 unless separately directed.
