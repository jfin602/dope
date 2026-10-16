# Phase 11 - Coherent 0.11.0 Baseline

**Date:** 2026-10-16 (America/Chicago)
**Status:** **VERSION BASELINE ESTABLISHED / DESIGN APPROVED / PHASE 11 NOT ACTIVATED OR QUALIFIED**
**Version-only baseline commit:** `70c41e617980b3d5a7f512c5a351e0b2a3e92ead`
**Baseline predecessor commit:** `7d461d9c6a4283ca7968a38d7b97dc7bf82f6051` (Phase 10 owner-close documentation)
**Qualified Phase 10 product source:** `af2b0f031c521d5992e3f3cd2125e80f3e6ad619` at `0.10.16` (byte-equivalent local replay `4c1529859000f12f8c4e0cd5d1dbb42c51506239`)
**Phase 10 owner-close:** [owner decision](../p10/phase-10-closeout.md), supported by [R6 qualification](../../tasks/c10-green-recovery/closeout.md).
**Approval:** owner `/docs-apply` immediately following the `/docs-review for 0.11.0 baseline and phase 11 alignment` (2026-10-16).

## Exact version-only change

The `0.11.0` commit updates **13 of 13** root/application/workspace `package.json` `version` fields and **20 of 20** internal `@dope/*` package references from `0.10.16` to `0.11.0` (33 version values), and **only those 13 manifest paths**. The commit comparison against its parent verifies the manifest-only file list. It makes no application-source, test, API, fixture, package dependency selection, unrelated field, build artifact, `yarn.lock` or root `package-lock.json` change. The repo still uses `yarn.lock` and has no root npm lockfile. No product source was rebased or copied from another branch.

A version marker does not by itself create a new qualification result. The last directly **qualified and fully validated product remains Phase 10 `0.10.16` / `af2b0f0`**, with R6's exact-source 737/737 tests, typecheck and browser/Electron builds. **Those checks were not rerun on the new `0.11.0` manifest bytes**, so do not relabel the R6 aggregate as a fresh `0.11.0` validation or claim a new functional runtime behavior. This is a coherent version-only starting point for prospective Phase 11 work, not Phase 11 implementation or a release.

## Entry and execution authority

Phase 10 is **OWNER-CLOSED / GREEN FOR THE OWNER-APPROVED R6 RECOVERY SCOPE**, and Phase 11's predecessor condition is satisfied. [ADR 0037](../../decisions/0037-human-centered-ui-and-usability.md) and the [Phase 11 plan](phase-11-plan.md) approve the human-centered UI **design**, not an executable implementation stack. No `docs/tasks/p11/` implementation stack has been authored, run or qualified from this baseline.

Use the current [repository workflow](../../workflow.md):
1. Inspect live registrations and actual Dope GUI/panel ownership to validate the [preliminary inventory](panel-usability-matrix.md). Its rows are hypotheses/checklist entries, **not proof of direct human task coverage**.
2. Plan bounded work through `/prompt-ass -> /prompt-plan -> /prompt-write p11`, respecting T1/T2/T3 splits, focused tests and direct human-GUI acceptance.
3. **Starting the authored `p11` stack by a deliberate owner/developer Run instruction** is the implementation authorization for that stack. No separate `/activate` command, `activation.md` file or activation-only STOP gate is required. Baseline creation and prompt writing alone do **not** authorize implementation.
4. First implemented Phase 11 checkpoint may advance from `0.11.0` to `0.11.1` under the accepted prompt/version contract, **only during actual authorized work**, not at baseline or planning.

**Preserved limits:** Keep saved Chat/Work owner identity and leasing, no second Roadmap Chat, safe local model approval/authority, explicit model selection and no silent hosted fallback, restrained Dope Dark theme/alternate-theme isolation, Project Mind access, safe linked Markdown, architecture/map/work permissions and Theia integration. The Phase 10 R4 network qualification covers the identified Codex-browser Dope tab, backend and local model only; native/independent-browser/whole-host network negatives remain **unqualified**. The Q4_K_M / loaded 32768 CPU-only parallel-4 Phase 10 planning profile is not an app-wide model default. Q4/64K, other providers/hardware and long-term reliability are not qualified by that historical R6 scope.

**Phase 11: NOT ACTIVATED / NOT IMPLEMENTED / NOT QUALIFIED. Phase 12: INACTIVE.** This baseline authorizes no agent work, model/provider change, global setting, extra security claim, historical record rewrite or successor phase activation.
