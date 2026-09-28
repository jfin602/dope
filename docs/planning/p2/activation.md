# Phase 2 package baseline and sequencing record

Date: September 28, 2026
Status: OWNER-AUTHORIZED PHASE 2 ACTIVATION — READY FOR P1

## Exact candidates

- Phase 1 closeout: `dac6e57275134fc610d8c0c6e2620a90d7d58c2f`, package `0.1.6`, **Not Qualified**.
- Phase 2 preparation: `56bb0194df2cf4c4a40aaf6b5a8176f5c5efda22` (`docs: Created phase 2 docs/tasks`).
- Owner-created root-only baseline: `7a65723fe215473bf33647ca1608b20eda59acda` (`docs: 0.2.0 baseline`). It changed only root package.json; workspace versions/internal references and baseline assertions were still `0.1.6`.
- Coherent activation source/package baseline: `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781` (`fix: align phase 2 activation baseline`), package `0.2.0` across root/all workspace manifests, internal references and baseline assertions. It was a baseline repair when created; the explicit owner decision below now authorizes Phase 2 execution from this exact source.
- Sequencing authorization: the commit containing this updated decision, subject `docs: authorize phase 2 sequencing`. Resolve its exact SHA with `git log -1 --format=%H --grep="^docs: authorize phase 2 sequencing$"`. This documentation-only commit retains package `0.2.0` and is not a P1 success marker.

## Failed run preserved

The first stopped run, `.codex-runs/p2/2026-09-28T14-56-00-335Z/P1.final.txt`, made no changes from root-only baseline `7a65723fe215473bf33647ca1608b20eda59acda`: missing waiver/activation record and incoherent versions were explicit stop conditions. The second stopped run, `.codex-runs/p2/2026-09-28T15-03-43-207Z/P1.final.txt`, made no implementation changes from the coherent repaired baseline because sequencing authorization was still absent. Both runner postconditions reported expected `0.2.1`, found `0.2.0` because P1 did not execute. No P1 success commit or later execution is implied. Ignored local artifacts remain intact; this record preserves the durable failure summary.

## Sequencing eligibility

On September 28, 2026, after reviewing the repeated P1 preflight stop, the owner explicitly instructed:

> Proceed with Phase 2 despite Phase 1 being Not Qualified.

This is the separate Phase 2 sequencing waiver required by the approved plan. It authorizes activating and executing the prepared p2 stack from the coherent baseline above without waiting for Phase 1 requalification. The prior Phase 1 P6 audit waiver remains separate historical authority.

Phase 1 remains **Not Qualified**. Preserve its GUI restoration failure, missing successful interactive Test Explorer replay, and remaining extension/customization/theme persistence gaps in the unchanged Phase 1 closeout. This waiver changes sequencing only: it does not make Phase 1 Green, assert a repair, waive Phase 2 tests/interactive/package gates, or authorize Phase 3. A stalled or defective workbench must still be reported truthfully and can prevent Phase 2 qualification.

P1 preflight is now eligible after this authorization commit leaves a clean tree. BOOT and Phase 2 routing point to this decision. Keep package version `0.2.0` until P1 actually implements and validates `0.2.1`; never bump it merely to suppress the runner postcondition. Retry with `npm run codex:phase -- p2 --closeout`; the runner still stops at the P5 manual GUI handoff.

## Baseline validation

After version repair: `npm run test:baseline` passed 3/3; `npm run typecheck` passed; `npm run test:product` passed 6/6; p2 grammar validation passed; no root package-lock.json; `git diff --check` passed. Theia remains 1.75.0 and Electron 42.8.1. No product behavior, framework, provider pin, runner or historical qualification evidence was changed. Browser/Electron packaging and GUI qualification were not repeated for this version-only repair.
