# /prompt-ass — c11-work-experience-recovery-v2

**Supersession basis:** The previous [c11-work-experience-recovery](../c11-work-experience-recovery/README.md) was rejected before P1 by the first-committed-source integrity check. This v2 re-authors the same implementation intent with valid prompt grammar in a new directory. Do not erase prior Git history or disable source drift checks.

**Assessment dated:** 2026-10-23. **Evidence scope:** GitHub `main` at `c405b98`, `0.11.8`, and the committed historical [P6 manual closeout](../c11-work-experience/closeout.md), which tested product `a9994e7`. The closeout had originally been reported uncommitted by the owner, but exists on reviewed remote `main`. This assessment is **not** new browser observation, defect diagnosis, a source build, or owner acceptance of a changed product.

## Reproduced symptoms vs unproven causes

| ID | P6 observed fact | Severity / interpretation | Do not infer |
| --- | --- | --- | --- |
| WR-001 | Clicking discovered Prompt Stacks in fixtures A and B created durable sequences but initially showed `Prompt Stack · Work unavailable` and "Prompt Stack could not be opened"; History later opened each saved P1-of-3 sequence. | P0 navigation/selection reliability. The backend record exists. | A failed store, missing prompt content, or a verified cause without tracing selection transition. |
| WR-002 | A previously open Work owner tab stayed `Loading Work…` after browser reload, even after Back to Select Work; History reopened a functioning Work detail while the stale tab remained. A2 transcript itself restored. | P0 restoration/liveness/owner-duplication. | That History itself is broken, that an Electron build proves parity, or that arbitrary timeout alone solves it. |
| WR-003 | Work "Next action" and controls had light text against a light background under `Light (Theia)` at 700×900, while Dope Dark was usable. | P1 accessibility/contrast defect. | Only one hardcoded color is responsible, or that changing global theme tokens is safe. |
| WR-004 | Missing `tsc` returned shell exit 127 in disposable fixtures; no Dope-owned validation reached the command. Work A1 failed provider-side before validation, with `not-started` validation; A2 was read-only completed with unknown validation. | **Qualification gap**, not independently proven product recovery defect. | Missing-compiler recovery works or fails inside Work, or that A1 represents a compiler failure. |
| WR-005 | Native Electron built but no independent GUI manipulation/capture was possible. W2–W6/W9 remained partial, blocked, or not run. | **Qualification gap**; explicit owner decision needed on any waiver. | Browser screenshots or a successful build imply native GUI equivalence. |

The P6 record marks **W1 FAIL, W7 FAIL, W8 FAIL; W2–W5 BLOCKED, W6/W9 NOT RUN, W10 PASS browser/source only**. No correction-scope Green is permitted based on the 775-test aggregate or this assessment.

## Relevant current implementation seams (reviewed source, not a root-cause claim)

- `chat-panel-widget.ts` Work list renders discovered stack selection using `stack.sequenceId ?? stack.folderName`; `selectWork` and `navigateWork` coordinate panel-owner identity and controller selection. After sequence opening the displayed selection may need reconciliation to the newly created authoritative sequence ID.
- `work-selection-controller.ts` `select` delegates an existing sequence to `phase.selectStored` or an uncreated stack to `phase.select`. `phase-stack-controller.ts` `select` calls `runtime.openTaskStack` and establishes `selected`, followed by refresh. Study async races, busy guards, project handle and status evidence before changing behavior.
- `chat-panel-widget.ts` `storeState` / `restoreState`, asynchronous `initialAttach` and rendering of `Loading Work…` when `workController.handle` is absent, `shared-panel-state.ts` Work ownership, and History-to-Work navigation are the primary restore seams. Review root changes, reopen/cancel requests and dispatch order rather than adding an independent Work store.
- `dope.css` contains many Work declarations plus a dark-only `.dope-dark` token set; Light (Theia) should use effective Theia semantic foreground/background tokens, with selective Work-scoped overrides. Existing `test/unit/dope-theme.test.ts` checks dark palette and should continue to pass.

## Proposed corrective boundaries

**P1: saved stack opening.** Diagnose real code path discovered stack → `openTaskStack` → saved sequence → owner selection/panel render; establish a single canonical persisted sequence ID once known. Handle open failures with truthful retry and no permission side effect. Test two distinct stacks, already-saved History re-entry, rejected source change, invalid stack, foreign project, busy/race and explicit no-Run-on-open. Do not bypass sequence fingerprint, version, grant, or reconciliation.

**P2: restoration and liveness.** Make each restored Work panel attach or display a finite, explainable "cannot load" state with Retry / Select Work (supported actions only); discard stale async responses; only one owner for project/selection; preserve separate Chat and actual saved transcript. Test delayed/rejected attach and workspace switch, reload saved run/sequence and old generic owner tab. Avoid blind auto-reopen or timed auto-run.

**P3: light theme.** Limit to existing Work/Transcript CSS and minimal theme-aware presentation selectors, preserving Dope Dark neutral/orange identity. Measure actual effective contrast: >=4.5:1 for normal text, >=3:1 for large text and essential non-text boundaries/focus where applicable; disabled affordances must still be identifiable without reliance on color. Dark/alternate theme and narrow dock should not regress. No dependency or root theme overhaul.

**P4: manual qualification.** New direct browser tests on safe disposable projects must reproduce P6 failures before or at comparison, verify fixes with real reload, and exercise a genuine required-validation run if allowed. Missing `tsc` shell-only proof is insufficient; if validation cannot be reached, record the gate blocked. Native Electron parity is an independent check, not assumed. Preserve W1–W10 statuses distinctly and record a new closeout.

## Dependencies, authority, and feasibility

- Immutable prompt order after authoring; no revision to `c11-work-experience/P1–P6`, P6 closeout or `c11-bridge-repair` P5/P15, no historic qualification rewrite.
- Reuse typed persisted identity, backend source truth, grant, dirty-worktree acceptance, validation and candidate review. Never make a UI retry run code, accept permissions, promote a candidate, or invent Green.
- Product source, package versions, CSS, test coverage and current local branch/dirty state must be read again at each actual Run. A remote source SHA is an authoring base, **not** a hard runtime pin.
- Local model readiness is optional for navigation/contrast repairs, but Dope-owned validation qualification needs a real permitted run; do not trigger external hosted data or install missing compiler without explicit approval. No unsolicited network.
- P1–P3 target <=8 minutes each, hard stop 15 minutes per implementation prompt; P4 manual T3 outside that implementation budget.
- Recommend **four prompts**, not one broad polish prompt. P1 isolates the saved sequence identity transition; P2 isolates restart/owner lifecycle; P3 isolates color tokens; P4 collects live qualification. P1/P2 may share cause, so each must inspect current prior fixes and avoid duplicating logic.

**Disposition:** Prompt authoring approved by user's `/prompt-ass + /prompt-plan + /prompt-write` request. **Implementation and validation remain separate owner-initiated actions.**
