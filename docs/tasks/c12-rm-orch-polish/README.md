# c12-rm-orch-polish — source stabilization first, manual browser UI polish last

**Owner request:** 2026-11-04 `/docs-apply + /prompt-ass + /prompt-plan + /prompt-write c12-rm-orch-polish`. **Status:** decision/assessment/plan/prompts AUTHORED ONLY; implementation and verification NOT RUN. **Version:** 0.12.7 unchanged (must verify local manifest). **Authority:** [ADR 0050](../../decisions/0050-roadmap-chat-polish-and-review-controls.md) · [contract](../../planning/p12/roadmap-chat-polish-contract.md) · [assessment](prompt-assessment.md) · [implementation plan](implementation-plan.md).

## Outcome

Stabilize the two-Phase Qwen3.5-9B continuous tool-loop and reviewed proposal flow already demonstrated. Fix the failing source-drift and cleanup tests, add truthful ordinary Roadmap Apply History, and remove isolated dead nonvisual generation code **without changing the successful inference path**. Then, manually polish each Phase/Gate/Criterion/Correction's upper-right protruding icon-only review tab (checkbox, check, X), the compact canvas toolbar and the Chat message layout. Remove separate Chat tool-call dropdown/list and Roadmap confirmation content below footer actions; preserve truthful reasoning/tool events and copy/History. All visible UI changes require connected Codex Browser validation.

## Strict runner-first / manual-last order

| Order | File | Mode | Mandatory exit |
| --- | --- | --- | --- |
| **P1** | [Source drift + cleanup](P1-source-safety-tests.txt) | **Runner** | Genuine mid-turn source drift fails closed; fixtures tear down safely; focused test failures attributed |
| **P2** | [Roadmap Apply History](P2-roadmap-apply-history.txt) | **Runner** | Real owner Apply revision receipts appear once in Project History; provisional/reject/no-op excluded |
| **P3** | [Nonvisual code cleanup](P3-nonvisual-cleanup.txt) | **Runner** | Retire dead generation/status paths without changing native tool loop; focused builds and tests |
| **P4** | [Manual closeout boundary](P4-manual-ui-closeout.txt) | **MANUAL FINAL CLOSEOUT** | Do not run through normal runner. Direct owner to M1 → M2 → M3 below |

**Manual UI prompts** are deliberately in [manual/](manual/README.md), outside the runner-scanned flat prompt directory:
- [M1 — Roadmap review icon tabs + browser validation](manual/M1-roadmap-review-tabs.txt)
- [M2 — Chat tool timeline and footer cleanup + browser validation](manual/M2-chat-transcript-polish.txt)
- [M3 — final combined browser/cleanup qualification](manual/M3-browser-qualification.txt)

The existing runner needs **exactly one final closeout** P4; it automatically handles P1–P3 only. M1 and M2 each include their own browser check; M3 supplies the final combined acceptance matrix. **Do not** treat P4 as an extra implementation prompt or copy manual files into the flat runner root. Do not use a runner flag that automatically executes closeout.

## Commands (only on later explicit owner Run)

```bash
npm run codex:phase:validate -- c12-rm-orch-polish
npm run codex:phase -- c12-rm-orch-polish
```

After P1–P3 genuinely source-qualify and normal runner checkpoints finish, **STOP**. Execute M1, M2, M3 individually with the browser, assessing each before proceeding. P4 is the manual closeout/disposition index; no automatic P4 PASS marker.

## Universal guardrails

Read BOOT.md, AGENTS.md, docs/workflow.md, ADRs 0040/0045/0046/0047/0048/0049/0050, this stack and actual source/history/test evidence. Verify local HEAD/branch/status/diff, version and uncommitted changes; remote GitHub main is not proof of local cleanliness. Never reset/stash/clean, force push, overwrite owner's active project or existing Roadmap, run overlapping stacks, self-commit, modify model/provider/reasoning/context, bypass current-turn /gen-roadmap/Ask-Allow/stage/lease/source/approval or grant generic model writes. Use disposable fixtures. Preserve historical P1–P7 and P3 NOT GREEN reports unmodified.

Runner steps target <=8-minute focused work with hard 15-minute stop. Test-only source gates use focused compiled package builds/typecheck, relevant suites and git diff --check. A runner commit is implementation provenance, not GREEN evidence. Manual steps target bounded implementation/validation cycles; if the browser or selected local model is unavailable, report an evidence gap rather than invent screenshots or substitute a mock for a required observation. No Phase 12, full MVP, native Electron or Work qualification claim by this polish pass.

## Final evidence

Prove: passing source-drift and reliable fixture cleanup, exact ordinary Apply History receipt, no dead generation fallback, theme-correct top-right tabs with precise operations, compact bulk controls, no separate Chat tool-call disclosure, no text/overlays after response footer, accurate decision counts and bounded diagnostics, genuine tool events preserved in reasoning/activity, no pre-Apply canonical/Markdown/History write, and no regression to the observed serial two-Phase workflow. Native Electron owner observation remains separate.
