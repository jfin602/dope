# Phase 8A Iterative Qualification / Repair Loop

Status: **ACTIVE / MANUAL ITERATIVE LOOP / PHASE 8B BLOCKED**
Date: 2026-10-05
Folder: `c8-p8a-qualification-loop`
Version policy: **keep Product Phase 8A at `0.8.6`**
Maximum cycles: **5**
Execution: **manual GPT-6 Sol High with browser access; do not run through `codex:phase`**

## Starting evidence

Phase 8A is **Not Green - Evidence Gap** on the reported exact candidate:

- source HEAD: `4e73b6b`;
- plus uncommitted coherent `0.8.6` version updates;
- plus one bounded Codex App Server wire-compatibility repair;
- real `codex-cli 0.155.1` App Server initialized and completed a tiny read-only/no-network/no-approval scratch turn;
- automated focused and aggregate evidence is substantially Green;
- live Dope OAuth/account lifecycle remains the blocking evidence class.

The initial live blocker is: **eligible ChatGPT OAuth callback did not complete inside Dope**.

Because of that, the following remain unqualified in live Dope:
- authenticated account inventory;
- restart persistence;
- refresh;
- sign-out / reconnect / reauthorization;
- authenticated App Server replacement after refresh;
- App Server thread resume after replacement.

Controlled tests for refresh-token serialization, no API-key fallback, repairable auth/usage failures, independent accounts, Coding Agent eligibility and Chat/Software Map isolation remain useful retained evidence but do not substitute for the missing live lifecycle.

## Loop law

Run at most five cycles.

Each cycle:
1. observe the current first blocker directly;
2. diagnose from evidence, not guesses;
3. make the smallest repair inside the approved Phase 8A boundary;
4. run only the focused tests invalidated by the repair;
5. repeat the direct live evidence that was blocked;
6. if that blocker clears, continue through the remaining 8A direct gates until either another blocker appears or all gates are Green;
7. record the cycle evidence and checkpoint the coherent candidate.

Stop immediately if all Phase 8A qualification gates are Green.

After cycle 5, stop regardless of outcome and preserve any remaining blockers as **Not Green / Evidence Gap**. Do not route Phase 8B unless all 8A blockers are cleared.

## Scope boundary

Allowed repairs:
- ChatGPT-plan OAuth callback/listener/PKCE/state/nonce/client registration and token exchange;
- protected account/session persistence and refresh;
- AI Center Codex account/model/auth presentation;
- Codex App Server auth/restart/resume integration;
- exact current App Server read-only/no-network protocol compatibility;
- focused tests and qualification instrumentation necessary to prove the above.

Not allowed:
- AgentTask / ExecutionGrant repository mutation;
- Phase 8B work;
- unrelated Chat/Software Map redesign;
- generic provider/routing redesign;
- version advance beyond `0.8.6`;
- weakening security or egress authority to make the test pass.

## Execution prompt

Use:

`docs/tasks/c8-p8a-qualification-loop/one-off-p8a-qualification-repair-loop.txt`

This one-off owns repair, direct qualification, cycle checkpoints and the final Phase 8A closeout update.

