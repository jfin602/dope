# /prompt-plan — c12-rm-orch implementation sequence

**Authority:** [ADR 0049](../../decisions/0049-roadmap-phase-orchestration.md) and [phase-orchestration contract](../../planning/p12/roadmap-phase-orchestration-contract.md). **Product version:** keep actual `0.12.7` unchanged unless owner authorizes a separate versioned phase. **State:** plan only; prompts authored by /prompt-write, not executed.

## Universal preflight

**Invocation invariant for every step:** The **sole executable entry** to the Roadmap Generation Controller is a **trusted user-authored Chat submission** starting with the exact leading command `/gen-roadmap <roadmap prompt>`. Parse at the Chat command boundary **before any Pi inference**; after normalizing outer composer whitespace, require the exact `/gen-roadmap` token, a whitespace separator and a nonempty trimmed prompt (multiline body allowed). Strip the token before passing the body to the controller, retain trusted user-command provenance, and show usage with **zero controller/inference/stage/write calls** for missing body. Never scan quoted/code/prose content or model/tool output for executable commands. No intent classifier or natural-language routing, no automatic greenfield or Planning invocation, no `/roadmap` or `/roadmap generate` alias, no direct Generate Roadmap button, Work, injected tool/model text, old-format fallback or replay invocation. A retained UI affordance may only prefill the command for the user to submit. Normal Chat/Planning and ordinary `/roadmap` editing are unaffected. The command conveys requested intent, **not** permission to bypass Ask/Allow, project/source/revision/lease checks or final owner Apply.


Read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, decisions 0040/0045/0046/0047/0048/0049, current contract and stack README/assessment/plan. Inspect local `git status --short`, branch/HEAD, package manifest, actual D2 uncommitted edits, current proposal/staging/Chat/Pi/canvas/History/Markdown code and relevant evidence. Preserve dirty work; never auto-reset, stash or clean. Stop on a collision rather than overwrite. Use disposable fixtures only. Browser/native and real inference are intentionally outside P1–P6. Runner owns successful implementation commits.

## P1 — Legacy generation retirement

Produce an explicit reachability/deletion manifest grouped by old full-plan natural parser, typed JSON, RM1, two-pass locked-plan converter, old default model-choreographed multi-stage and their flags/tests/UI. Remove executable dispatch and exclusive code/tests, while preserving saved historical artifact readability, general Chat, unrelated Markdown parsing and common checked stage/Apply owners. Remove former generic greenfield triggers. Leave only the trusted `/gen-roadmap <roadmap prompt>` Chat command with an **unavailable until P2/P3** bounded fail-closed response; invalid or uncommanded inputs must not call inference. Assert via source tests that no legacy flow is invocable and no write occurs. Validate imports/typecheck for affected packages.

## P2 — Controller state machine and serial inference

Implement exact command parsing and trusted origin check **before** installing the first-class backend generation session, with sole entry from `/gen-roadmap <roadmap prompt>`, selected Pi model/provider binding, context snapshot, generation ID, scope ledger, one active bounded call, monotonic state events, AbortController/cancel, deadlines and exact project/turn/source identity. No Phase/Gate staging yet (test stubs/fakes). Verify serial ordering, stop conditions, late events after cancel, model/context/source drift and no provider auto-fallback. No new independent canonical state or tool authority.

## P3 — Validated native Phase builder

Wire one Phase at a time through existing typed native Roadmap edits/proposals, assigning IDs and relationships within trusted backend. Use small per-Gate operations if one Phase object exceeds proven model capability. Validate Phase/Gate/Criteria, stage each accepted object/batch into a **single noncanonical proposal**, and advance only when the Phase is complete. Revision-zero `null` hash/source preconditions must work. Test at least three phases with correct nested objects; negative stale, malformed, duplicate, missing Gate and out-of-order operation cases. No Apply or Markdown before owner review.

## P4 — Progressive canvas

Emit validated monotonic stage projection updates after Phase/Gate stage; reuse existing canvas/Chat proposal owner and event transport, not parallel browser state. Render Provisional, Generating and real counts while same Pi session continues; maintain camera/focus, active-tab rule, historical protection, accessibility, reduced motion. Coalesce only UI renders; never block tool path on paint. Browser component tests with fake deterministic events are allowed; no live Chrome.

## P5 — Scope truth, finish, cancellation, recovery

Implement deterministic required-field/scope-coverage ledger, bounded requests/retries/phase and total ceilings, runtime/finish telemetry and inspectable incomplete terminal states. Semantic coverage remains human-reviewable, not declared proven by model. Support explicit safe continuation of partial draft after fresh source/model authorization; no automatic next call on cancel/failure. Bind `review-ready` to dependency-closed full projection and current owner lease; integrate existing selective canvas Apply/Reject. Test failed phase, hidden Gate, duplicate, drift, interruption, expired lease, retry exhaustion, and safe no-write.

## P6 — Single-path integration cleanup

Audit all routes from the sole user Chat slash command to final proposal; delete obsolete generation imports, callbacks, dead UI branches, legacy flag and test-only selectors. Do not delete shared staging or imported Markdown tools. Add negative tests for unprefixed Chat, `/roadmap`, `/roadmap generate`, empty/embedded/near-match commands, button-direct calls, Work/tool/model inputs and replay, all with zero controller calls. Run focused core integration and relevant regression tests, check tracked source for old generation imports/references, and record exact measured deterministic call counts and runtime instrumentation (do not fabricate live Qwen speed). Report source implementation and evidence gaps independently.

## P7 — Manual connected Codex Browser closeout

After P1–P6 source implementation is verified, operator approves live inference and confirms stable Linux host/LM Studio; one connected Codex Browser session on exact built candidate with Qwen3.5-9B Q4_K_M selected. The user must submit `/gen-roadmap ` followed by the tower-defense requirements; that prompt must generate a reviewable >=5 Phase/Gate/observable-Criterion graph covering all MVP rules. Capture stage-by-stage canvas updates during actual inference, reasoning stream when supported, time to first stage, total runtime and calls, no-write pre-Apply, selective Apply/Reject, actual post-Apply canonical/history/Markdown, reload and safety negative; separate owner-native Electron evidence gap. Fail honestly if host/model unavailable or expected gates missing.

## Runner and progress

```bash
npm run codex:phase:validate -- c12-rm-orch
npm run codex:phase -- c12-rm-orch
```

Do not execute runner without owner choice. Runner P1–P6 success commits are checkpoints, NOT independent GREEN receipts; the existing runner still derives completion from commit prefixes. P7 is manual, no auto-P7. Each Pn soft target <=8m, hard 15m; if safety/required interface missing STOP and report exact blocker. Do not silently skip Pn, relax qualification, modify historical reports, self-commit or start another stack. A final correction GREEN needs full mandatory exact-source evidence; otherwise distinguish implemented/scoped-qualified/evidence-gap/failed and HOLD as documented by ADR 0048.
