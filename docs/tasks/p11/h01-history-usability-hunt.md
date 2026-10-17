# H01 — first manual Usability Hunter: History and Work entry

**Run date:** 2026-10-16 America/Chicago. **Actor:** AI-operated real Dope browser GUI at `127.0.0.1:3010`. **Exact product source:** clean checkout `8990407eb2ca15d2987ec5b7fea86844d230515e` (`8990407`), version `0.11.8`; the served browser bundle matched the local build. **Fixtures:** two disposable projects under `/tmp/dope-p11-hunter-h01-bhklTr`. Checkout was clean before and after. No prior Hunter was recorded.

**Scope and result:** Discovery and triage only. No model turn, hosted call, Work run, product edit, version change or commit occurred. No screenshots were retained. H01 does not qualify a repair or Phase 11; Phase 11 remains **OPEN / NOT QUALIFIED**. UX-001–UX-007 were not retested.

## Direct GUI findings

| ID / impact | Reproduction and observed result | Smallest proposed repair and evidence limit |
| --- | --- | --- |
| **UX-008 / P2** | Open `src/status.ts`, then Refresh History. Continue describes only “Last focused editor at” an ISO timestamp. Close the editor and Continue correctly reopens it. Move that file within the disposable project, then Refresh: Continue becomes “No verified place to continue yet” without identifying the stale target. | Show the project-relative verified target and a plain-language stale-target reason, retaining exact-target verification. Likely owner: History presentation. The wording symptom is directly observed; root cause is unverified. |
| **UX-009 / P2** | Fresh project B shows “Partial History · 3 source diagnostics” above “No source-backed activity”; project A shows two diagnostics. The panel supplies no diagnostic details or recovery action. | Treat ordinary absent optional stores as an empty state and expose actionable details for genuine read failures. Likely owner: History projection and presentation. Source inspection suggests absent optional Planning Map and Project Mind metadata may contribute; the GUI did **not** verify that explanation. |
| **UX-010 / P2 provisional** | Select the dirty-tree activity and use Preview selected evidence. The preview foregrounds a basis hash, fingerprint and category, plus “working tree has changes,” with little readable context for a newcomer. Deselecting correctly invalidates the preview. | Put a readable, source-backed summary first and move integrity identifiers into details, preserving the local-only privacy boundary. Likely owner: History preview presentation. Impact is provisional because the later local explanation was not run. |

## Coverage and limits

History empty state, verified editor continuation, recent-activity suggestion to a saved empty Chat, stale-file handling, reload persistence, project isolation, keyboard command entry and read-only evidence preview were exercised in the browser. Work showed “No Work currently running” and “No saved Work yet.” New Work exposed its grant review, but Start Work was disabled because the Coding Agent was unavailable. This did not exercise a Work run or its completed status/review.

Completed Work status/review, AgentRun, native Electron GUI, a narrower viewport and the local explanation after preview remain **Evidence Gaps**. No existing UX-001–UX-007 result was upgraded by this hunt. In particular, [UX-003 supplemental M1](../c11-guidance/manual/m1-recovery-qualification.md) remains scoped Green for browser/local Q4 at its recorded source, and the original [M1](../c11-guidance/manual/m1-closeout.md), [P3](../c11-guidance/closeout.md) and [P8](known-issue-closeout.md) Not Green results remain historical.

**Triage:** UX-008 and UX-009 are P2 repair candidates; UX-010 is P2 provisional pending its local-explanation context. Proposed repair groups are (1) History continuation target and stale wording, (2) optional-store diagnostics and genuine read-failure detail, and (3) preview readability. These are proposals, not completed repairs or qualifications.

**Next different hunt:** H02 — Software Map → Physical Map/Flow → evidence-to-code navigation, including empty and error recovery. See the [issue ledger](../../planning/p11/usability-issue-ledger.md), [coverage matrix](../../planning/p11/panel-usability-matrix.md) and [manual Hunter procedure](usability-hunt-manual.md).
