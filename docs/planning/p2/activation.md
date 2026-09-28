# Phase 2 package baseline and sequencing record

Date: September 28, 2026
Status: BASELINE REPAIRED — EXECUTION BLOCKED PENDING SEQUENCING DECISION

## Exact candidates

- Phase 1 closeout: `dac6e57275134fc610d8c0c6e2620a90d7d58c2f`, package `0.1.6`, **Not Qualified**.
- Phase 2 preparation: `56bb0194df2cf4c4a40aaf6b5a8176f5c5efda22` (`docs: Created phase 2 docs/tasks`).
- Owner-created root-only baseline: `7a65723fe215473bf33647ca1608b20eda59acda` (`docs: 0.2.0 baseline`). It changed only root package.json; workspace versions/internal references and baseline assertions were still `0.1.6`.
- Coherent baseline repair: the commit containing this record, subject `fix: align phase 2 activation baseline`. Resolve its exact SHA with `git log -1 --format=%H --grep="^fix: align phase 2 activation baseline$"`. Verify the five manifests/internal references and baseline assertions are `0.2.0`. This is a package baseline, not an owner sequencing decision or implementation success marker.

## Failed run preserved

`.codex-runs/p2/2026-09-28T14-56-00-335Z/P1.final.txt` records P1 stopping without changes at pre-task HEAD `7a65723fe215473bf33647ca1608b20eda59acda`. The missing qualification/waiver, unavailable activation record and incoherent baseline were explicit stop conditions. The runner then reported expected `0.2.1`, found `0.2.0` because P1 did not execute. No P1 success commit exists and no later prompts started. Local run artifacts are ignored by Git; this record preserves the durable failure summary.

## Sequencing eligibility

Pending. No Phase 2 sequencing waiver has been received or recorded. The earlier Phase 1 waiver authorized its P6 audit only. The baseline repair does not mark Phase 1 Green, waive a prerequisite or authorize p2 execution.

Before retrying P1, record either qualified Phase 1 correction/requalification with reconciled findings, or a separate explicit owner decision allowing Phase 2 to proceed despite the preserved Not Qualified closeout. Then update BOOT and the Phase 2 routing documents consistently, record the exact baseline repair SHA above and commit the decision from a clean intended tree. Keep package version `0.2.0` until P1 actually implements/validates `0.2.1`; never bump it merely to suppress the runner's failed postcondition.

## Baseline validation

After version repair: `npm run test:baseline` passed 3/3; `npm run typecheck` passed; `npm run test:product` passed 6/6; p2 grammar validation passed; no root package-lock.json; `git diff --check` passed. Theia remains 1.75.0 and Electron 42.8.1. No product behavior, framework, provider pin, runner or historical qualification evidence was changed. Browser/Electron packaging and GUI qualification were not repeated for this version-only repair.
