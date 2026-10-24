# /prompt-plan — c11-work-experience-recovery

**Plan source:** remote `main` `e02c32c` / project `0.11.8`; P6 tested source `a9994e7` and [closeout](../c11-work-experience/closeout.md). Planning only. Phase 11 OPEN / NOT GREEN.

## Goal and exit rule

Make discovered/saved Prompt Stack opening, reload/restoration, and light-theme Work affordances reliable enough to remove P6 W1/W7/W8 failures. **Do not claim the entire Work Experience correction Green** unless its still-missing consequential W2–W6/W9 requirements are also directly qualified or explicitly dispositioned by the owner. Continue to distinguish a Work run ending, required validation, candidate promotion, Git checkpoint, manual verification and owner acceptance.

| Prompt | Minimal implementation seam | Proof from automated tests | Human gate |
| --- | --- | --- | --- |
| P1 — Saved stack | `chat-panel-widget.ts`, `work-selection-controller.ts`, `phase-stack-controller.ts`, `shared-panel-state.ts` only as necessary | Discovered folder creates/loads canonical sequence; saved ID selected; no transient `Work unavailable` on success; persisted reload and History re-entry; invalid/source-drift/foreign/denial | W1 exact GUI after P4 |
| P2 — Reload | Widget `storeState/restoreState`/`initialAttach`, `SharedPanelState`, Work open owners, workspace event/race handlers, controller attach/read | Reattach success/error/retry/stale request, duplicate owner prevention, no persistent placeholder after finite failure; project isolation, no stolen Chat dock | W7 real reload/backend restart after P4 |
| P3 — Theme | `dope.css` Work scoped selectors plus minimal Work UI classes, `dope-theme` only if necessary | CSS/theming test verifies effective contrasting color pairs, active/disabled/focus, no dark regressions and no unscoped global changes | W8 Light (Theia) + Dope Dark at 700×900 and ordinary widths |
| P4 — Manual | No blind refactor; direct GUI qualification + new `closeout.md` in this stack | One coherent final `npm run check` + focused tests/source diffs | W1–W10 explicit observed/pass/fail/block/gap, original failures preserved |

## Ordered implementation procedure

1. **Preflight before each step**: read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, Phase 11 [Work contract](../../planning/p11/work-experience-contract.md), this README/assessment/plan, original P6 closeout, and the actual source/tests. Inspect local Git HEAD/branch, dirty and untracked files (notably original P6 evidence), version coherence and prior correction commits. Do not trust remote SHAs as current local Run state.
2. **P1**: Instrument or trace `selectWork` → `WorkSelectionController.select` → `PhaseStackController.select/selectStored` → `openTaskStack` and panel owner mapping. Identify actual sequenceId/folderName transitions and async ordering; fix smallest authoritative ID/UI sync seam. Do not invent alias stores or change persisted schema. Add focused synthetic integration/DOM/controller tests that would fail before the fix. Preserve errors as visible errors; no auto-Start.
3. **P2**: Reconcile panel restoration state with the real attached Work controller and workspace roots; make pending/error states explicitly distinguishable, with keyboard accessible Retry and Select Work actions; cancel/dismiss stale requests. Test real same-Work owner selection + generic tab restoration, late attach/read after project switch, backend unavailable and retry. Prefer state/epoch and resolved promises to arbitrary timeout hacks. Avoid changing existing History/Chat provider or storage.
4. **P3**: Inspect computed effective Work colors in light and dark themes (source CSS alone cannot prove visual contrast); use scope-specific Theia semantic tokens/fallbacks and theme-root selectors. Address Next action header/card, ordinary/secondary/primary/disabled buttons, state text, input/help, borders/focus and transcript detail. Add deterministic CSS/contrast tests with focused narrow layout assertions. Never spread dark-only `--dope-*` fallbacks to light. Keep orange reserved for action/active.
5. **P4**: Outside `codex:phase`, start matching browser build, operate disposable fixtures. Open two stacks from discovery, reload and reselect via History and old Work owner, switch themes, verify usable 700×900 and center/narrow docks, deliberately simulate failed validation only if a real safe Dope-owned run and project dependencies exist. Confirm source/diff/permissions and retained W1–W10. Attempt independent native UI only with real window input/screenshot; record evidence gap otherwise. Perform final aggregate once and produce new report.

## Tests and exact failure matrix

- **Opening**: discovered valid A/B, existing saved stack, first-open sequence ID, read-only invalid stack, source changed, foreign/stale ID, rapid double click, busy scan, project changed mid-request.
- **Restoration**: attached Work run/stack, transcript survives reload, one ownership slot per Work identity, failed/delayed attach, late request discarded, Retry works, Change Workspace clears old data, generic Work tab not forever stuck, History opens source-backed details.
- **Validation authority**: required command absent/not-run/unavailable/failed/passed must be distinguished from provider end/error and repository drift; failed required validation must not permit candidate acceptance. Real browser missing `tsc` if feasible; shell result alone does not qualify.
- **Visual**: theme switching Light (Theia) ↔ Dope Dark, text/button/input/focus/warning/disabled contrast, 700×900 and left/right/bottom dock as supported, long errors, keyboard. Target WCAG AA where applicable, evidence actual theme computed values rather than only regex.
- **Security**: opening/retrying never Starts, accepts grant, resumes, transfers hosted data, accepts dirty worktree, promotes candidate or bypasses source/version/foreign checks; transcript remains sanitized and no secret/hidden reasoning or external remote fetch from untrusted Markdown.

## Evidence budget and stop lines

P1–P3: <=8m target, 10m soft, 15m hard per prompt. Focused tests and `git diff --check`, extension build/typecheck only when touched. Avoid full aggregate on each small prompt. P4 manual may take longer; run one final `npm run check` against a single recorded product SHA/version/bundle. All tests need genuine exit codes/command outputs, not fabricated pass. No unsafe install, unapproved egress or destructive user-project change. If a necessary backend fix requires persisted schema, security semantics or new runtime, STOP and report separate correction scope rather than silently expanding.

## Branch and execution handoff

Source-authored prompt files are sequential and immutable after writing. Check local source for conflicts because P6 product was committed after the prior planning branch. Validate the stack grammar with `npm run codex:phase:validate -- c11-work-experience-recovery` before any Run. Run P1–P3 only with explicit developer instruction and normal runner checkpoints. P4 is **manual**, browser-required, not a runner auto-pass. No `/activate` gate. Do not update `ROADMAP.md` without linked-source approval.

Final report should be `docs/tasks/c11-work-experience-recovery/closeout.md` with P6 observed failures vs new observations, per-gate W1–W10, exact tested HEAD/dirty and bundle fingerprint, permissions, attempts and limitations, and specific next actions. If W1/W7/W8 pass but other consequential gates remain unqualified, report **scoped recovery PASS / original correction STILL NOT GREEN**; do not conflate scopes.
