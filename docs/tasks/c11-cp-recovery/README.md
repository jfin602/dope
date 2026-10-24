# c11-cp-recovery — Conversational Planning P8 source-grounded recovery

**Status (2026-10-24): P1–P5 AUTHORING ONLY / NOT IMPLEMENTED, RUN OR QUALIFIED.** The owner explicitly requested `/prompt-ass + /prompt-plan + /prompt-write c11-cp-recovery` after [original P8 NOT GREEN](../c11-conversational-planning/closeout.md). The historical failed closeout is now present in GitHub `main`; it was originally uncommitted in the owner's local checkout and current local changes remain **unverified**. The old P1–P8 files, failed evidence and source hashes are immutable. No `/docs-apply`, product source edit, Run, Green, Phase 11 owner closeout or version bump follows from authoring these docs.

**GitHub authoring base:** `6f744d82d6a56a7b8831f6b8f2922fb47382beff`, root version `0.11.8`. Work on branch `docs/c11-cp-recovery` without modifying `main` until separate merge authorization. Local HEAD, dirty worktree, fixtures, model state and current browser bundle have not been inspected from this remote-only workflow.

## Goal

Fix only the original source-bound P8 failures: (1) real existing `src/diffEditor.js` was treated as `src/diffEditor.js;` and incorrectly classified absent/directory, (2) the complete-plan model/preview service existed but normal Chat and `Plan with Chat` did **not** activate its `planOnly` binding, and (3) reloading saved Chat yielded a stale "open in another window" lease. Reuse existing ChatPanel, RoadmapGreenfield implementation-plan owner, ChatProjectGrounder, strict local Q4 plan-envelope and proposal review, and exclusive ChatRepository leases. No new Chat/plan owner or Work authority, no automatic canonical Markdown, Run or implied qualification.

[Source-based assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [Original P8 closeout](../c11-conversational-planning/closeout.md) · [Conversational Planning contract](../../planning/p11/conversational-planning-contract.md)

## Immutable authored prompt sequence

| Prompt | Responsibility | Model | Execution |
| --- | --- | --- | --- |
| [P1](P1-grounding-path-truth.txt) | Exact file-path normalization and grounded source reads (CP2) | GPT-6 Sol High | Headless |
| [P2](P2-plan-entrypoint.txt) | Actual implementation-plan entrypoint + reviewable first response (CP1/3/6) | GPT-6 Sol High | Headless |
| [P3](P3-chat-lease-recovery.txt) | Safe same-tab saved Chat recovery without stealing other writers (CP5) | GPT-6 Sol High | Headless |
| [P4](P4-recovery-regressions.txt) | Cross-seam deterministic integration, negative/security tests | GPT-6 Sol High | Headless |
| [P5](P5-manual-cp-closeout.txt) | Actual browser/Q4/32768 manual CP1–CP10 requalification | GPT-6 Sol High | **Manual only** |

**Execution contract:** On the actual local checkout, first inspect `git status --short`, `git rev-parse HEAD`, exact existing original P8 closeout and competing work; do not reset, stash, clean or overwrite user files. Verify unchanged coherent `0.11.8` manifests; if advanced, STOP and re-assess (never downgrade). Validate metadata with `npm run codex:phase:validate -- c11-cp-recovery` **locally**; this is not a Run or Green gate. After a distinct developer Run authorization, `npm run codex:phase -- c11-cp-recovery` executes **P1–P4 only**, runner commits; P5 is operated separately manually in real GUI with local selected model, no `/activate`. Implementation prompt target <=8m / 10 soft / 15 hard; P5 manual exception. No agent self-commit, hosted fallback, provider/global model change, unsafe Chat file/shell tools, modified authored P*.txt or historical results.

**Acceptance boundary:** The **same exact P8 prompt** must yield an actual source-cited first-pass structured **reviewable** plan, with correct existing-file grounding; saved Chat reload must recover promptly without a second active writer. Human approvals, linked Markdown, Planning Map target, prompt publication, Work execution and owner qualification remain independent. A passing automated aggregate is not manual Green. Native Electron GUI must be directly observed or marked evidence gap. Full Phase 11 still open, Phase 12 inactive.
