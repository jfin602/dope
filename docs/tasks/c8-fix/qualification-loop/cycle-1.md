# c8-fix P6 qualification loop — cycle 1

Date: 2026-10-09. **Disposition: NOT GREEN; repaired the earliest failing aggregate gate.**

## Source and preservation

- Starting source: clean `main` HEAD `4b771dc02f1e81333b617ec776b18ff5a320062e`, version `0.8.33`; `origin/main` was `8f1df04448d853eb210abb94eb8f60e4de7d5550`. P1–P5 are commits `a14a84a`, `31b5cc6`, `bb9a176`, `dccf52e`, `4b771dc` in that order. No dirty-tree runner continuation was needed in this checkout.
- The owner-reported original local P13 bytes are present in commit `cd9133b` (13 versioned manifests; `pre-phase4-clean-baseline`, `theia-baseline`, and `work-selection` test changes; original `docs/tasks/p8d/closeout.md` and evidence). This checkout is **not** the previously reported dirty P13 tree. The original P13 Not Green record and evidence were not edited. Its two legacy empty-validation task IDs were `work-1e867fa44d30dbcecb545f57cf9dfd4c` and `work-e6833a22201e32d93f1901ec47d1f754`.
- A clean disposable project copy was made at `/tmp/dope-c8-fix-p6-gui` from the preserved `/tmp/dope-p8d-p13-gui` fixture. Both started at Git HEAD `d4dfbf38628ba70726cf3b3610c2279643f500dc`; the copy's initial Planning state SHA-256 was `46a98f6a50e6024715c16c7cb789a5261a7c0468892595608abcf177607733c2`. The developer's Dope and Adaptive SEO trees were not changed by the copy.

## Earliest failing gate and repair

The original P13 baseline assertions reran successfully (focused 7/7 across baseline and Work selection). The first full `npm run check` on `4b771dc` passed typecheck, runner 103/103, baseline 11/11, and local install 1/1. Product tests reached 358/359 and stopped at `test/unit/agent-core.test.ts`'s stale exact transition table: it expected `blocked → cancelled` to be illegal while the Phase 8D review path deliberately uses `blocked → cancelled` for rejection and `blocked → completed` for acceptance. The real `AgentStore.updateRun` requires the corresponding persisted review decision for those transitions. [Full failed aggregate](cycle-1-check.txt).

The narrow test repair added those two legal transitions to the table. The focused `node --test test/unit/agent-core.test.ts` then passed 7/7; `git diff --check` passed. This source repair received its own checkpoint commit `8748cb4870e8cac3d2a5aca4a05623b5f3d747ec` (`c8-fix/P6-repair1: Align reviewed run transition guard`). No runtime authority rule changed. The aggregate for the repaired source is cycle 2 evidence.

## Mandatory gate matrix at cycle end

| Gate | Cycle 1 result |
| --- | --- |
| A. Source/preflight | PASS for 13 unchanged `0.8.33` manifests, no root lockfile, preserved original P13 bytes and known P1–P5 commits; repair checkpoint recorded. |
| B. Real GUI/Codex saved tasks | UNEXECUTED at this cycle's aggregate stop. |
| C. Frozen candidate, Dope validation, accept/reject | UNEXECUTED. |
| D. Authority/failure matrix | UNEXECUTED as T3; existing focused fixtures are not live qualification. |
| E. Steering/map/restart | UNEXECUTED. |
| F. Legacy reopen | UNEXECUTED. |
| G. Final exact-candidate aggregate | OBSERVED FAIL: product 358/359 on `4b771dc`; browser and Electron stages not reached. |

Next cycle starts from clean source checkpoint `8748cb4`, with the aggregate and live GUI gates still outstanding.
