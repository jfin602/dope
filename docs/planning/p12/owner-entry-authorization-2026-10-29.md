# Phase 12 — explicit owner authorization for Pi runner execution

**Decision:** 2026-10-29 (America/Chicago)
**Status:** APPROVED TO BEGIN P1–P7 THROUGH THE EXISTING RUNNER; NOT IMPLEMENTED OR QUALIFIED
**Owner instruction:** "It's approved. Remove the gate from p1 so the whole stack can run."
**Baseline:** [committed `0.12.0`](baseline.md), version-only commit `e02a46447a460ee43f20ac65078238427468a81c`.
**Phase 11 entry:** [Narrowed owner closeout](../p11/phase-11-final-closeout-2026-10-29.md) recorded with evidence limitations.

## Decision and exact scope

The owner approved treating existing standalone Pi/Qwen results as sufficient for **experimental implementation entry**. The prior P1 requirement for independently GREEN standalone autonomous coding, and any second owner-approval or `/activate` step, are **removed**. The existing `p12` runner invocation is the deliberate Run; do not block P1 solely on standalone performance/timeout failures or repeat the synthetic optimization campaign.

The executable P1 entry section is amended under this express instruction. P2–P8 remain unchanged. P1–P7 may be executed sequentially through the existing phase runner; P8 remains the distinct **manual** browser and owner-operated native Electron qualification, not automatically completed or passed by the runner.

## Accepted evidence; remaining limitations

Standalone Pi 1.4.0 with local LM Studio Qwen successfully performed inference, read/edit/write/shell tools and saved sessions. The original 360-second tasks did not autonomously complete: Test 1 failed final functionality, Test 2 fixed behavior but introduced a failing test, Test 3 passed independent correctness checks without self-testing/final response. In the later Codex-free comparison, Q4_K_M passed independent checks for both tasks but had visible-test failures and hit 120-/600-second timeouts; Q3_K_L passed independent checks for the short task and its long task was manually interrupted. No fully qualified winner or long-session/context-compaction proof exists. These NOT GREEN and INCONCLUSIVE statuses remain recorded, not converted to PASS.

Owner authorization changes only the entry decision. Pi dependency provenance and license, no hidden/global Pi installs, model/endpoint/context validation, no unsolicited hosted egress, Dope-brokered grants and path/command isolation, independent candidate review/promotion, clean AppImage operation, recovery and B1–B9 real-work/GUI gates remain mandatory before a scoped Pi GREEN determination. The actual source worktree, license or security incompatibilities remain legitimate P1 blockers; document them instead of bypassing protections.

This approval does not close the Pi stack, change the Phase 11 historical qualification, authorize tower-defense mutations before separate real-use permission, or automatically deploy any artifact.

## Execute

From an updated local checkout of `jfin602/dope` on `main`, inspect the current HEAD, version and dirty state, then:

```bash
npm run codex:phase:validate -- p12
npm run codex:phase -- p12
```

Do not use the descriptive `p12-pi-agent` folder as a runner target. Preserve historical evidence and the owner's uncommitted local work. Only P1–P7 are runner-managed; follow P8's manual real-Chrome and native handoff contract afterward.

**Authorization recorded:** This documentation commit itself does not execute the runner, install Pi into Dope, or claim a model/GUI qualification.
