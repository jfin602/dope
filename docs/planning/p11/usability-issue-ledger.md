# Phase 11 — Living Usability Issue and Hunt Ledger

**Current documentation handoff (2026-10-16):** Following P3 Not Green, the owner approved a [targeted M1 manual verified-guidance repair contract](../../tasks/c11-guidance/manual/verified-guidance-repair-contract.md). **M1 executable prompt not written, not run; no product code changes or new qualification.** Version remains `0.11.8`; Phase 11 remains OPEN / NOT QUALIFIED. Prior P3/P8 results below are historical source-bound evidence.

**Status (2026-10-16 P3 handoff):** [P8 manual initial-tranche closeout](../../tasks/p11/known-issue-closeout.md) remains historically **NOT GREEN** for UX-003; P8 was tested on the then-uncommitted `0.11.8` candidate with product code from `8cad838`, and its version/evidence were subsequently committed at `266720b` **without a new GUI rerun**. [c11-guidance](../../tasks/c11-guidance/README.md) P1/P2 are committed through `3acbb6e`; the [manual P3 closeout](../../tasks/c11-guidance/closeout.md) is **NOT GREEN** on that exact source in browser/local Q4. No separate Usability Hunter has run. **Phase 11 remains NOT QUALIFIED / OPEN.**
**Authority:** [Plan](phase-11-plan.md), [Hunter](../../tasks/p11/usability-hunt-manual.md), [matrix](panel-usability-matrix.md), [initial U1–U9 checks](usability-recovery-contract.md).

| Stable ID | Evidence / severity | Task or suspected issue | Current disposition |
| --- | --- | --- | --- |
| UX-001 | Owner-reported P0; P8 direct browser | Incorrectly selected linked Roadmap file, no discoverable Markdown relink | **Browser regression passed** at `8cad838` + manifest-only `0.11.8`: Change linked file, preview, cancel, confirm, old bytes intact, restart/new-source sync. Native and remaining negatives are Evidence Gaps; not whole-phase verified fixed. |
| UX-002 | Owner-reported P0; P8 direct browser/local Q4 | Validated local no-action user message obscured by JSON activity | **Browser regression passed** for a valid `no-action.message`: prose main reply, collapsed/expandable/copyable JSON, keyboard/narrow view. Native and broader model reliability are Evidence Gaps. |
| UX-003 | Owner-reported P0; P8 and c11 P3 direct browser/local Q4 | Chat failed to explain how to change a Roadmap link | **NOT GREEN after correction P3.** The exact wording now consistently reaches the real change-file path in four local turns, but none explains preview, confirmation and old-file preservation; selected-checkpoint replies also omit Chat's inability to perform the action. In the same saved Chat, refresh guidance falsely asserted conflict in synced state, and an unrelated Planning Map link question incorrectly advised Objective edit plus Change linked file. See [source-bound P3](../../tasks/c11-guidance/closeout.md). Original P8 Not Green remains historical; native/hosted are Evidence Gaps. [M1 manual repair contract](../../tasks/c11-guidance/manual/verified-guidance-repair-contract.md) **approved docs only** for complete and accurate guidance, no executable prompt yet. |
| UX-004 | Screenshot only; P8 direct browser | Loading Roadmap visible | P8 saw transient Loading Roadmap resolve to the correct map after reload; no stuck-loader claim. Other load/error states remain unaudited. |
| UX-005 | Screenshot only / P1 investigation | Duplicate/truncated correction title and dense toolbar controls | Evidence Gap: P8 did not recreate the reported correction overlay; narrow Roadmap source overlay and keyboard cancel worked. |
| UX-006 | Screenshot/heuristic; P8 narrow Chat observation | Follow Interactive unclear and transcript metadata excessive | Investigating: narrow Chat kept the reply/activity usable, but a failed local turn's metadata wrapped densely and Follow Interactive meaning was not directly explained/tested. |

**Per-issue schema:** ID (never reuse), first reporter/date, affected human task/surface/state, exact product SHA/version, environment/actor, expected vs observed/recovery, P0/P1/P2, owner report vs direct GUI vs heuristic vs source hypothesis, reproduction steps/screenshots, duplicate references, suspected owner, smallest repair, prompt+commit, source-bound retest and status (New / Investigating / Reproduced / Ready for Repair / In Repair / Verification Pending / Verified Fixed / Not Green / Evidence Gap / Owner-Deferred). Preserve prior failures/qualification truth when status changes.

## Manual hunt history and coverage delta

| Hunt | Date/SHA/version | Actor & real GUI | Distinct tasks/states covered | New or retested UX IDs | Outcome / next different target |
| --- | --- | --- | --- | --- | --- |
| Not yet run | — | — | **Not Audited** | — | First pass: source-verified registered surfaces, under-tested human user tasks |

## P8 qualification handoff (separate from a Hunter run)

The [P8 record](../../tasks/p11/known-issue-closeout.md) contains exact candidate/version, local model settings, GUI clicks, screenshots, source hashes, one aggregate and U1–U9 pass/fail/gap outcomes. Its failure does not consume or replace the first manual Hunter. The **next different hunt target**, separate from the owner-approved and not-yet-run c11-guidance repair, is a disposable-project History → exact continuation → Work status/review flow, including empty/stale/restart and keyboard/narrow recovery. Run the [separate reusable Hunter](../../tasks/p11/usability-hunt-manual.md) only as a future manual discovery task; triage any new IDs here without relabeling the P8 failure or claiming Phase 11 Green.

After each manual hunt append its exact run facts, update the [coverage matrix](panel-usability-matrix.md), deduplicate issues, record distinct coverage and next hunt target. Neither an empty discovery pass nor two repeated tests of the same screen establish product Green.
