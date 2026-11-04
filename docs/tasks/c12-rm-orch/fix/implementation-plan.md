# /prompt-plan — c12-rm-orch/fix

**Scope:** Continuous Pi tool-loop correction, preserving the existing protected Roadmap architecture. **Execution:** [runner-compatible c12-rm-orch-fix](../../c12-rm-orch-fix/README.md). **Status:** Authored, not executed or qualified. Version reference 0.12.7, verify actual local manifest.

## Universal preflight

Read BOOT.md, AGENTS.md, docs/workflow.md, ADRs 0040/0045/0046/0047/0048/0049, current phase-orchestration contract, this assessment/plan and old P7 NOT GREEN evidence. Inspect **local** HEAD/branch/git status/diff, existing source and tests, P7 and skill-picker changes. Do not assume GitHub remote reflects a dirty local working tree. No reset/stash/clean, force-push, self-commit, provider or model switch, real owner Roadmap modification, shell privilege expansion or runner qualification shortcut. Use disposable fixtures. P1–P2 source work targets <=8 minutes per bounded runner step with a 15-minute hard stop; stop truthfully on unsafe or incomplete prerequisites.

## P1 / R1 — Serial tool-loop and stage-before-receipt

1. Trace trusted exact /gen-roadmap command to ChatBackend, ModelBridge/Pi worker, roadmap_phase and roadmap_finish handler, RoadmapGenerationController, RoadmapGenerationNativeStage and StageOwner.
2. Convert the per-Phase independent model-run scheduling into **one bounded protected Pi agent execution**. The existing controller remains the only generation authority, supplies expected Phase and scope/call/tool/time limits and validates model/project/chat/turn/source/revision/lease on every operation. Preserve streamed real reasoning.
3. In the trusted tool handler, validate and **await the authoritative noncanonical stage** before returning success; return a bounded real proposal/seq/Phase receipt. Do not allow the model to progress past stage admission before a valid result. Avoid deadlocks: the handler must not wait for the encompassing model execution to end before staging.
4. Admit a second (and subsequent) Phase in the same worker session after the previous validated stage. Serialize tool callbacks even if Pi emits multiple calls in a batch. Deny duplicate, out-of-order, forged, malformed or late calls with bounded errors and finite retries, not automatic restarts.
5. roadmap_finish validates actual staged projection, Gate/Criteria closure, requirement ledger and source/lease state; it cannot self-approve or mark incomplete output review-ready.
6. Remove the old per-Phase inference scheduler as an executable path; **no compatibility fallback**. Keep historic saved Chat readable and manual typed edits functional.
7. End with deterministic full worker integration: one session -> phase 1 one Gate/two Criteria -> real stage result -> phase 2 one Gate/two Criteria -> stage -> finish, one proposal, zero canonical/Markdown/History writes. Test duplicate, simultaneous, stale, cancellation, source drift, expired lease, provider switch and finish too early. Run focused tests, changed builds, typecheck and diff check.

**Exit:** Source-verified true stage-before-tool-success and serial tool loop, not a live-model success claim.

## P2 / R2 — Canvas provisional Phases and next-Phase loader

1. Use the existing authoritative proposal/projection stream, not browser-generated fake Phases. After stage receipt, display Phase 1 with real Gates/Criteria on the active Roadmap tab while inference continues; preserve state in one proposal.
2. Add exactly one small `Generating next Phase…` placeholder at the next sequence location, with nonblocking pulse/spinner and reduced-motion static alternative. It has **no entity identity, speculative title, Gate/Criteria, percentage or count**. It moves forward only after the next validated stage, and disappears at review-ready/failed/cancelled/incomplete/stale.
3. Do not await canvas animation in the Pi tool/stage path. Respect once-only locate, user camera/pan/zoom/focus, active-tab auto-preview, manual View, historical mode, project switch, accessibility and Dope-only accent behavior.
4. Preserve distinct statuses: tool receipt and canvas provisional staging are not owner Apply. Only explicit checked owner Apply makes selected Phases canonical and visible as accepted/planned according to actual Gates. No evidence/qualification GREEN. Linked Markdown/History follow only real accepted transactions.
5. Test actual stage-producer events with canvas fakes and UI components; first Phase remains while Phase 2 placeholder displays; no fake counts, stale ghosts, focus steal, hidden-tab auto-switch, reduced-motion bug or UI backpressure. Prove fail/cancel/lease/source conflicts and no write before Apply; selected Apply/Reject, linked Markdown, History and reload after Apply.

**Exit:** Source-qualified continuous staged rendering and real acceptance; no connected browser claim. Avoid retaining old generation UI branch.

## P3 / R3 — Manual selected-model closeout

Require explicit owner live-test clearance and stable host. Use connected Codex Browser only, with exact built source on a disposable PixiJS project and actual selected Qwen3.5-9B Q4_K_M through LM Studio/Pi; do not switch model/reasoning/context to force success.

1. In one trusted /gen-roadmap command, request **exactly two Phases**: Phase 1 draws a fixed waypoint path; Phase 2 spawns one enemy that follows the path and stops. Each has one Gate and two observable Criteria.
2. Capture first and second real StageOwner receipts **inside one Pi execution**, actual canvas snapshot after Phase 1 while Phase 2 loads, placeholder movement/termination, reasoning/tool events, time to first stage, second stage and total result, tool-count/tokens/abort provenance when exposed.
3. Finish with roadmap_finish and one ready-for-review proposal. Verify canonical/linked Markdown/applied History unchanged before owner Apply; selectively Apply/Reject and verify actual accepted Phase(s), nested identities, History/Markdown sync and reload.
4. If that **passes**, prepare a separately authorized, bounded full tower-defense MVP trial; do not automatically run repeated long Qwen trials. If it fails, report NOT GREEN and preserve evidence.
5. Keep native Electron GUI as independent owner-observed gap, do not promote Phase 12/13 or engineering runner checkpoints to GREEN.

## Runner execution boundary

The current runner accepts only a single correction slug as its argument. Use:

    npm run codex:phase:validate -- c12-rm-orch-fix
    npm run codex:phase -- c12-rm-orch-fix

Run P1/P2 through the normal runner **only when the owner elects Run**. The final P3 is a manual closeout, never implicitly executed or marked PASSED. Correctly report IMPLEMENTED vs SOURCE-QUALIFIED vs EVIDENCE GAP under ADR 0048 and STOP on missing security prerequisites.