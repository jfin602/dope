# c11-work-experience — Implementation and qualification plan

**Disposition:** Owner-requested /prompt-plan; planning and authoring only on branch `docs/c11-work-experience`. The contract is [Work Experience](../../planning/p11/work-experience-contract.md). Baseline GitHub main `c0b3771`, root manifest `0.11.8`; **not** the unverified local checkout. Phase 11 OPEN / NOT QUALIFIED, Phase 12 inactive.

## Target experience

An ordinary developer can open Select Work, inspect the current Prompt Stack or direct task, understand progress and separation of agent work / required validation / checkpoint / candidate review / owner qualification, make explicitly authorized choices when needed, and open a well-formatted read-only transcript. Raw machine evidence remains one expand away; actions remain visibly distinct and cannot gain authority from presentation.

## Ordered bounded work

| Step | Deliverable | Primary seams | Focused evidence | Gate |
| --- | --- | --- | --- | --- |
| P1 | Read-only Work view-state selector: stable step/overall state, action availability, precise validation vs drift and candidate distinctions | `work-selection-controller.ts`, `phase-stack-controller.ts`, current contract types | Pure selector tests including agent-finished-but-unvalidated, missing-tsc environmental cause, stale/foreign/blocked and no invented Green | W1–W3 |
| P2 | Restructured Work detail with compact fixed-order progress, one supported primary next action, contextual grant/drift/validation/review sections and expandable diagnostics | `chat-panel-widget.ts` Work branch; existing controllers/service actions | DOM/controller tests of actual action callback and disabled/approval conditions; direct/sequence/WorkItem paths | W1–W4 |
| P3 | Polished **existing** AgentRun transcript: safe full supported Markdown, readable paragraphs/tables/code, muted correlated command disclosure, accurate truncation/status, follow/Latest | `agent-transcript-widget.ts`, `work-transcript-presentation.ts`, `untrusted-message-markdown.ts` **only if required** | Safe render tests, command ordering, no image/HTML/unsafe link/network DOM, legacy transcript and persisted paging | W5–W7 |
| P4 | Neutral restrained-orange Work UI; spacing, visual hierarchy, focus, narrow/other dock, alt theme, empty/loading/error and scroll | `dope.css`, bounded Work widget classes and follow helper | Narrow/keyboard/ARIA/style focus tests and affected panel tests, no changed global tokens | W8 |
| P5 | Integration, truth/authority/restart/History/Phase Focus/Bridge regressions; fix only failures demonstrably caused by P1–P4 | Shared UI + existing test seams | Stable source-bound targeted suite and negative permission tests; one final aggregate **only if justified**, preferably P6 | W2, W4, W6–W9 |
| P6 | **Manual** direct real GUI qualification and closeout against one coherent final source | Browser and independent Electron when available, disposable work projects, history/transcripts | W1–W10 exact-source observations, pass/fail/gap per gate; one final aggregate; preserve historical failures | W1–W10 |

## Integration order and acceptance

1. **Preflight every implementation prompt:** read BOOT, AGENTS, docs/workflow, this plan and Work contract; inspect real branch/HEAD, coherent root and internal versions, dirty state, `c11-bridge-repair` overlap, exact source and tests. Never assume remote HEAD equals local machine.
2. **P1:** Pure selectors: no persisted schema or permission changes, no UI string-derived source truth. Use actual WorkSelection/sequence/run/candidate validation records and typed blockedReason/gateMessage, not a fabricated status owner.
3. **P2:** Recompose the existing `renderWork` path without massive general refactor. Keep Start/Resume/Stop/Reconcile/Dirty Acceptance/Verify Checkpoint and review/gate actions wired to **existing** controller methods; only show those actions when valid, never dispatch from visual progress clicks.
4. **P3:** **Enhance, do not replace**, current sanitized Markdown. Where language highlighting would require a new dependency or a risky parser/renderer, restrict to safe legible fenced code + language labels and explicitly record the limitation; do not violate 8-minute budgets.
5. **P4:** Consolidate classes and relevant `dope.css` rules with theme tokens; neutral secondary tools, intentional orange primary action, responsive hierarchy and accessible focus. Avoid blanket CSS changes that would alter the Chat/Map panels.
6. **P5:** Simultaneously exercise work selection, run statuses, command tool history, credential/egress denial, candidate review and source drift, Phase Focus immutable ordering, existing Chat safe Markdown, History re-open and multiple project/run IDs. Any real backend/domain failure uncovered **outside** UI correction should be recorded separately rather than masked or expanded into this stack.
7. **P6:** Manual gated qualification **outside** `codex:phase`. Test one actual successful completed Work and one genuine blocked/failed run, with current package/bundle/source evidence, after P1–P5 are implemented. Record W1–W10 and leave nonobserved native/hosted claims as evidence gaps. Do not mark Phase 11 Green merely on W1–W10.

## Gates that must never be combined

- Agent turn outcome vs required Dope-owned validation `passed` / `failed` / `unavailable/not run`.
- Candidate held/reviewed/promotion vs direct sequence automatic promotion/checkpoint, as applicable.
- Work run/sequence completed vs checkpoint accepted vs manual qualification Green.
- Dirty-worktree opt-in vs source-fingerprint drift denial vs Git-version/checkpoint reconciliation.
- Prompt Stack draft approval vs explicit execution Run, execution grant and hosted-data consent.

## Work budget and validation strategy

P1–P5 each target <=8 minutes; 10-minute soft and 15-minute hard limit. Target one narrow seam and relevant tests, `git diff --check` and changed package TypeScript build as needed. Avoid unnecessary full product aggregate per prompt. P6 is a distinct manual T3 run and may exceed normal coding budget. No simulated screenshots or claims of live frontend proof from static compilation.

## Branch/run handoff

This branch contains **docs and prompt sources only**. Prompt runner grammar requires contiguous P1–P6 and exactly one final `closeout`. Locally first run `npm run codex:phase:validate -- c11-work-experience` after merging/synchronizing the branch onto a reviewed working tree; authoring is **not** execution authorization. Developer's separately deliberate `npm run codex:phase -- c11-work-experience` action may run **only P1–P5** (headless implementation). **P6 is a manual, browser-required T3 gate and must never be accepted automatically.** Runner owns checkpoint commits; no agent self-commit. No `/activate`. Do not rewrite authored P*.txt, preserve Git/checkpoint evidence and original branch history.
