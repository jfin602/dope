# Phase 12 — Bundled Local Agent Runtime and Real-Use Qualification

**Status (2026-10-29):** Owner-approved forward design; DOCUMENTATION AND PROMPT AUTHORING ONLY. Phase 11 **OPEN / NOT QUALIFIED**; Phase 12 **NOT ACTIVATED**; no 0.12.0 baseline, product code, package, Pi dependency or model integration is claimed. Entry requires separate exact-source Phase 11 owner disposition and coherent version-only 0.12.0 baseline, plus standalone Pi/Qwen qualification with acceptable results. [ADR 0039](../../decisions/0039-bundled-pi-local-agent-runtime.md).

## Purpose

Bundle Pi Agent directly with Dope and make it the default **local** agent runtime for eligible Chat/Planning and Work paths. The user should select/connect their model once through existing AI Center, with no independent Pi install, Pi config/profile or API wiring. Retain user-directed provider choice and Dope-owned tools/approvals. Prove that this genuinely helps write software by developing the owner's persistent PixiJS tower-defense game in a separately supervised real-use track.

## Ordered workstreams

1. **Pi first stack — `p12` (workstream label `p12-pi-agent`):** Pi package/SDK-or-worker selection, shipped runtime, AI Center model bridge, no-tool conversational/planning routing, brokered Work tools, transcripts/session compaction, AppImage and direct GUI qualification. [Assessment](../../tasks/p12/prompt-assessment.md), [plan](../../tasks/p12/implementation-plan.md), [prompts](../../tasks/p12/README.md). Repo's phase-runner grammar only accepts `p12`, not `p12-pi-agent` as an execution folder; the descriptive label is not a second stack.
2. **Manual tower-defense real-use and repair AFTER Pi qualification:** Use the actual owner-controlled PixiJS project in Dope, observing developer task completion and logging friction, then triage/bounded repair/real GUI retest. No predetermined number of fixes; use legal continuation/correction folder names and distinct authoring/Run permission. [Real-use contract](tower-defense-real-use-contract.md).
3. **Exit:** evidence-backed normal local work and real-use paths, no unauthorized writes or hosted egress, stable restart and data continuity, actual packaged Electron and browser evidence, remaining gaps explicitly dispositioned, then owner acceptance.

## Phase boundary

Phase 11 `c11-g3-recovery` requires independent P1–P4 Chrome checks then owner-native Electron observation; it is NOT equivalent to all Phase 11 exit gates. Phase 11 also owns broad usability Hunts and D1–D8; close only on recorded pass or explicit owner-approved narrowed/deferred scope, not invented Green. Never self-close Phase 11 from these docs; preserve all prior source-bound failures. Record completed, waived, transferred and still-open gates separately.

**Existing forward feature preserved:** the former Phase 12 **Living Software Knowledge Model** becomes **Phase 13** without changing its technical acceptance scope or ADR 0023 security rules. [Phase 13 scope](../p13/phase-13-scope.md).

## User experience and ownership

Dope installed -> AI Center auto-discovers/records actual local endpoint and model -> compatible model selected -> Pi configured and started internally -> ordinary saved Chat and bounded planning use no Pi coding tools -> explicitly authorized Work uses the same model with Dope-brokered tools and candidate review. Connection missing/cold/incompatible leads to helpful recovery, not hidden installation/fallback. Existing Codex, alternative providers, manual/no-model modes and four Chat placements survive.

## Qualification and documentation boundaries

[Pi qualification B1–B9](pi-qualification-contract.md), direct test on fresh AppImage, local Qwen plus missing-model paths, guarded project data/credentials, real multi-file fix in disposable fixture, and owner-native testing are mandatory for the Pi first-stack closeout. The real tower-defense project is **not a destructive fixture**: use safe disposable replicas for rejection, stale and security negatives. Phase 12 owner-close additionally requires representative real use and relevant regressions. No product mutation, prompt Run, auto-activation, broad provider refactor or version transition is authorized by this plan.
