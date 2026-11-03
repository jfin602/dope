# Implementation plan — fast Roadmap, one final Codex Browser qualification

**Forward execution revision: 2026-11-03.** The owner prioritizes making the Roadmap editor usable for tower-defense dogfooding. F1 remains PARTIAL; F2 has already been run (verify actual local result); F3 has started and must be paused safely and rerun using the updated prompt without discarding partial source. F3–F5 are **implementation only**, with focused deterministic checks; F6 is the **only browser qualification**. Preserve earlier prompt/evidence files and the historical source-aware assessment.

## Authoritative data flow

One completed model-provided typed draft (F2) → ChatBackend protected current-turn /roadmap → Dope assigns trusted root/project/Chat/turn/revision/source/lease and stable IDs → RoadmapNativeStageOwner/ProjectPlanningActions validated noncanonical proposal (F3) → RoadmapCanvasWidget contextual review and checked subset Apply/Reject (F4) → ChatPanelWidget one summary and View (F5) → explicit owner Apply → RoadmapStore, applied-only History and safe linked Markdown. Native tools remain for targeted edits. No second Roadmap store, no response-to-canonical parser, no implicit approval or generated qualification.

## F1 / F2 handoff

F1's sole observed native trial was incomplete at cancellation; no matched method winner was established. Preserve [F1 report](qualification/2026-11-03-f1-partial.md) and do not spend additional inference time repeating it during F3–F5. F2 was already executed per owner report; first verify F2's exact source, status, tests and any dirty files. Do **not** change or rerun its authored prompt as part of this update. The one-pass typed route remains a conditionally selected implementation hypothesis until the real F6 run.

## F3 — minimal backend authority integration (T2; no browser)

Before restarting, stop the in-flight previous F3 safely; check for concurrent writers and preserve all tracked/untracked output. Reconcile existing F3 edits into the new objective rather than replacing them. Trace ChatBackend, F2 typed draft, roadmap-native-stage.ts, roadmap-proposal-presentation.ts, RoadmapStore and ProjectPlanningActions. Convert valid complete nested Phases/Gates/Criteria into the existing noncanonical proposal/checked review, using Dope-generated IDs and owner basis. Retain operation cap and full coverage truth. Focus deterministic tests: complete 5-Phase preview, exact hierarchy/IDs, reject/cancel/no write, source/revision/project/lease adversarial cases, a separately reviewed disposable subset Apply/History. Build only changed dependent package outputs before lib-importing tests. Failure in approval/source boundary **HOLD**. No Chrome, Codex Browser, browser build, server, Qwen or screenshots.

## F4 — canvas-native reviewed decisions (T1/T2; no browser)

Trace roadmap-canvas-widget.ts renderProposalBar, proposalSelection/reviewProposal, ProposedPhaseNode/Gate/Criteria and dope.css. Put contextual individual/Phase-group/selected/all-remaining controls and checked re-preview of provisional edits in the actual canvas. Remove the floating raw-ID operation panel only after deterministic same-owner parity. Preserve accepted edit controls, camera and historical read-only semantics. Focused tests: operation mapping, dependency closure, keyboard/focus/state selection, approved/rejected subset, duplicate/stale denial, no preview writes. Compile extension once; no full UI run. If editable proposed fields lack safe owner support, STOP PARTIAL rather than ship false affordances.

## F5 — Chat summary only (T1; no browser)

Trace saved Chat proposal/card/activities, tool-name/outcome recording and navigation. Keep one styled stateful summary with real Phase/Gate/Criterion counts, warning and View in Roadmap, including inert terminal history. Remove duplicate normal Chat Apply/Reject only after F4 source parity. Preserve non-Roadmap Ask/Allow and Markdown publication approvals, Chat text selection/clean copy, drag-to-scroll and focus. Focused Chat/controller and navigation/authority tests; compile only changed packages, no browser.

## F6 — single Codex Browser qualification (T3)

Perform final source/build preflight once. `npm run build:browser` builds extension and web bundles; avoid a redundant separate `build:extension`. Start or reuse ONE app server and verify served bundle/backend hash. **Codex Browser is the sole graphical test mechanism**; do not launch standalone Chrome or native Electron, and do not use browser automation outside Codex Browser.

On a new disposable TypeScript/PixiJS project, run the exact original >=5-Phase tower-defense /roadmap request with genuinely available selected local model. Record time to **complete validated review-ready** proposal, not just reasoning; check all requested mechanics in actual Gates/Criteria and safe omission of optional later features. Review/edit/select on Roadmap canvas, no floating raw-ID panel, one Chat summary + View. Before Apply verify no canonical/linked Markdown/History write; explicitly apply a valid selected Phase/Gate/Criterion subset in disposable fixture, inspect revision/receipt/sync and reload. **Then select an accepted Gate and verify Prepare Work is reachable** without auto-starting agent execution. This is the minimum dogfood-entry milestone, not full Work qualification.

One baseline F6 test and up to two observed-defect narrow repair/retest cycles; reuse already passed source checks and only rerun affected tests after a repair. Do not repeat multi-minute Qwen trials solely for speed ranking. Capture Codex Browser screenshot/DOM/actions and source/bundle hashes. Final single report classifies Roadmap usable/dogfood ready, scope qualified/not-green and independent P9/Bridge/native gaps. No self-commit, version bump, runner or automated Work launch.

## Prompt Efficiency Gate — updated

F3–F5 each have one primary responsibility, <=8-minute target, 10-minute soft and 15-minute hard; compile only changed package outputs in dependency order. No GUI, separate Qwen run, `build:browser`, `npm test` or `npm run check` during implementation. Keep only security-critical focused tests per prompt; no deferral of permission/source write hazards. F6 combines all **visual** and real-model checks once in Codex Browser, with one final browser build and at most two genuine focused repairs. This is deliberate operator-computer cost optimization, **not** relaxation of explicit owner approval or safety. F1/F2 historical source stays intact, old NOT GREEN results unchanged; F6 alone can decide integrated UI/dogfood readiness.
