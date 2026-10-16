# Phase 11 — Living Usability Issue and Hunt Ledger

**Status:** Seeded from owner complaint and screenshot; **NO Phase 11 hunter executed or issue verified fixed**. **Date:** 2026-10-16.
**Authority:** [Plan](phase-11-plan.md), [Hunter](../../tasks/p11/usability-hunt-manual.md), [matrix](panel-usability-matrix.md), [initial U1–U9 checks](usability-recovery-contract.md).

| Stable ID | Evidence / severity | Task or suspected issue | Current disposition |
| --- | --- | --- | --- |
| UX-001 | Owner-reported P0 | Incorrectly selected linked Roadmap file, no discoverable Markdown relink | Open / reproduce |
| UX-002 | Owner-reported P0 | Validated local no-action user message obscured by JSON activity | Open / check current regression vs historical c10-better-planning scoped Green |
| UX-003 | Owner-reported P0 | Chat failed to explain how to change a Roadmap link | Open / reproduce and verify real controls |
| UX-004 | Screenshot only / P1 investigation | Loading Roadmap visible | **Evidence Gap**: still screenshot cannot prove a hang |
| UX-005 | Screenshot only / P1 investigation | Duplicate/truncated correction title and dense toolbar controls | Investigate live overlay, labels, keyboard |
| UX-006 | Screenshot/heuristic / P2 investigation | Follow Interactive unclear and transcript metadata excessive | Investigate narrow-pane comprehensibility |

**Per-issue schema:** ID (never reuse), first reporter/date, affected human task/surface/state, exact product SHA/version, environment/actor, expected vs observed/recovery, P0/P1/P2, owner report vs direct GUI vs heuristic vs source hypothesis, reproduction steps/screenshots, duplicate references, suspected owner, smallest repair, prompt+commit, source-bound retest and status (New / Investigating / Reproduced / Ready for Repair / In Repair / Verification Pending / Verified Fixed / Not Green / Evidence Gap / Owner-Deferred). Preserve prior failures/qualification truth when status changes.

## Manual hunt history and coverage delta

| Hunt | Date/SHA/version | Actor & real GUI | Distinct tasks/states covered | New or retested UX IDs | Outcome / next different target |
| --- | --- | --- | --- | --- | --- |
| Not yet run | — | — | **Not Audited** | — | First pass: source-verified registered surfaces, under-tested human user tasks |

After each manual hunt append its exact run facts, update the [coverage matrix](panel-usability-matrix.md), deduplicate issues, record distinct coverage and next hunt target. Neither an empty discovery pass nor two repeated tests of the same screen establish product Green.
