# P4 retirement and integration — dependency blocked

**Disposition: BLOCKED / NOT GREEN.** Pre-task HEAD `0caf527db0cb38765561e4abf4ad2a6a6a74894d`; main project version `0.13.11`. The working tree was clean at entry. P4 stopped in preflight before removing the existing Documents presentation or running the integration matrix.

## Source-bound findings

- P1 (`877c0c95`) adds native `.md`/`.txt` file editor modes. P2 (`469fa8ad`) defines `ProposalDocumentTabs` and read-only virtual Docs resources. The current frontend binds `ProposalDocumentTabs`, but no caller opens a tab from the Docs Chat card. The card still opens `DocumentsWidget` via `checkedDocumentationHandoff`. Therefore the native replacement cannot yet provide the user-facing exact proposal review path needed before deleting that widget.
- The P3 runner checkpoint `0caf527d` changes only `p3-dependency-blocked.md`; it adds no card navigation or tests. Neither Docs nor native Prompt Stack proposal cards have the required clickable file links and Open All Files behavior.
- Native `/prompt-write` still passes `finishedPromptStack(...).text` into the assistant output as an unpublished JSON draft. `ChatPlanningActivity` has no prompt-stack proposal kind. The originating Chat card, separate R3B guarded publisher and decision handlers are absent. `PlanningStackPublication` remains the distinct Planning Bridge publisher and is not an R3B substitute.
- The preserved c13-docs-view P7/P8 blocked reports and manual P9 NOT GREEN receipt describe the same missing publisher. No prior checkpoint commit was treated as a technical PASS. P1/P2 provide source and focused test files, but this checkout contains no separate P1/P2 qualification receipt establishing end-to-end replacement.

## Execution boundary

Read-only inspection: `git status --short --branch`, `git rev-parse HEAD`, `git log -15 --oneline --decorate`, `git show --stat --oneline` for P1/P2/P3, `rg` source/reference searches, and `cat`/`sed` of the c13-docs-view P1–P9 prompts and P7/P8/P9 evidence, c13-native-doc-editor P1–P4 prompts, source, tests and package scripts. No build or `node --test` invocation was run: the mandatory replacement and native-publisher preflight failed before the final-source integration gate. Test count: **0 run**; test failures: **none observed**, with the matrix **blocked/unverified**. No source, manifest, pin, lockfile, Work state, project document or historical report was changed by P4.

The old Documents UI must remain reachable until the native R3B owner and both cards' P3 navigation are implemented and source-verified. Then P4 can verify exact bytes, authority and integration before retirement. No P5 manual closeout, Work Run, grant, Roadmap Gate GREEN, version change or Git commit was performed here.
