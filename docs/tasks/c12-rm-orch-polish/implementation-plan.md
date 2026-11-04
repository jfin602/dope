# /prompt-plan — c12-rm-orch-polish

**Decision:** [ADR 0050](../../decisions/0050-roadmap-chat-polish-and-review-controls.md). **Version reference:** unchanged 0.12.7 (verify actual local). **State:** PLAN AND PROMPTS ONLY; no source execution or qualification.

## First, runner-compatible backend/source gates

**P1 — Stale-source and fixture teardown stabilization.** Read exact P3 failed test and project setup. Create correct linked source/revision owner basis before starting Pi worker; change actual linked Markdown/source fingerprint between Phase 1 and Phase 2. Prove second tool fails closed, no canonical write, no stale approval, and first staged provisional content is not silently committed. Fix genuine app behavior if found, otherwise correct the fixture only. Attribute ENOTEMPTY using teardown order and owned async work; repair bounded cleanup without sweeping unrelated `dope-*` roots. Run focused normal + serial tests, document counts and any unresolved flakes.

**P2 — Ordinary Roadmap Apply in History.** Use existing RoadmapStore durable revision records and exact applied operation receipts. Project actual approved Apply (including selected subset and normal bulk), preserve reviewed Restore. Ensure stable IDs, timestamps, actual revision and changed counts, no Stage/Reject/No-op/duplicate sync as separate applied events. Test baseline/no revision, apply once, partial apply/reload, source sync conflict, restores, archive integrity, no qualification state mutation. Do not change canonical writer or reconstitute nonexistent historical entries.

**P3 — Scoped nonvisual generation cleanup and source regression.** Audit executable greenfield paths and generation-only dead helpers/status flags imported from the retired monolithic text/JSON/RM1/two-pass/per-Phase scheduler. Remove only provably unreachable nonvisual parts, their exclusive dead tests and references, preserving historical output readability, shared native stage/approval and the current continuous Pi tool loop. Do not touch visual controls, Chat footer/tool rendering or CSS (manual M1/M2 own them). Ensure focused Pi/Chat/History/source/Markdown tests and build/typecheck. Record exactly what was removed and what was intentionally retained.

**P4 — Manual closeout index.** The final root prompt `P4-manual-ui-closeout.txt` exists solely to satisfy the runner's **one final closeout** grammar and direct manual work. It must not be started by normal runner execution, nor committed as an automatic implementation PASS. After P1–P3 genuinely source-qualify, operator performs separately authored M1→M2→M3 in `manual/`, with browser observation and independent source verification.

## Then manual UI + browser gates

**M1 — Roadmap icon tabs and visual review.** Create one reusable component for each eligible proposed Phase/Gate/Criterion/Correction, attached tab upper-right protruding above card border, checkbox/check/X. Theme-native icons, focus/aria tooltips, keyboard, child/parent semantics and distinct checked review preview/Confirm. Replace large proposal text controls with compact accessible icons without removing selected/remaining bulk capabilities. Validate via actual connected Codex Browser on disposable staged proposal, narrow/zoom/reduced-motion and other-theme behavior. Do not launch live model solely for visual proof.

**M2 — Chat single activity timeline and strict footer.** Remove duplicate tool-call block but retain one chronological reasoning/activity tool trace and saved tool metadata/copy. Move all Roadmap result/status/confirmation content inside final/card before footer. Make info detail an anchored popover or above-footer expandable area. Shorten cards/default diagnostics; preserve Details and raw safe data. Confirm no content appended under assistant actions in saved/live/failed/cancelled/reloaded messages. Validate in connected Codex Browser on real saved Chat/proposal fixture and tests.

**M3 — Integrated exact-source browser qualification and UI cleanup.** Run browser matrix across M1/M2/History on latest built source with valid staged/proposed/partially applied/rejected/cancelled/stale fixtures. Check source safety, separate owner Apply and Markdown sync, keyboard/zoom/focus, reduced motion, other themes, inactive tab/manual return, tool timeline and footer. Only if owner separately approves and host stable may perform another live Qwen3.5-9B two-Phase or full MVP generation run. Examine M1/M2 dead CSS/select helpers for safe deletion; do not hide error evidence or rewrite P3 NOT GREEN. Record screenshots/browser observations, source hashes, exact tests and independent Electron gap. Stop PARTIAL/NOT GREEN if mandatory evidence absent.

## Universal execution contract

Every prompt reads BOOT.md/AGENTS.md/docs/workflow.md, ADRs 0040–0050 relevant, current local git status/diff/HEAD, actual package version, previous Pn source receipt and current suite. No reset/stash/clean, self-commit, bypass of /gen-roadmap/Ask-Allow/StageOwner/owner Apply/source/revision/lease, touching real tower-defense repo or provider/model setting changes. Runner handles only P1–P3, per bounded 8-minute target / 15-minute hard stop; manual M1/M2/M3 require connected browser evidence and individual qualification. A commit is not verification by itself. Cross-branch pushes or merges require separate owner authorization.

## Runner commands — after owner chooses Run

```bash
npm run codex:phase:validate -- c12-rm-orch-polish
npm run codex:phase -- c12-rm-orch-polish
```

STOP after P3 source implementation checkpoint. Manually read and execute `manual/M1-roadmap-review-tabs.txt`, then `manual/M2-chat-transcript-polish.txt`, then `manual/M3-browser-qualification.txt`. P4 is a manual closeout/disposition path, not an automatic fourth implementation prompt. Final correction GREEN requires all mandatory exact-source evidence; otherwise report implementation and qualification gaps separately per ADR 0048.
