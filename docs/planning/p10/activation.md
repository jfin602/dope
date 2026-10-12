# Product Phase 10 — Owner Implementation Activation

**Date:** 2026-10-12 (America/Chicago)
**Disposition:** **OWNER APPROVED / PHASE 10 ACTIVE FOR P1–P16 IMPLEMENTATION / NOT IMPLEMENTED OR QUALIFIED**
**Exact owner instruction:** `/activate p10` (2026-10-12T20:06:21Z)
**Activation entry source:** `a7311c33329a532a429b653e0851ace9edd1d782` on GitHub `main` (`docs(p10): assess, plan and author 16-step Roadmap prompt stack`).
**Coherent version baseline:** `0.10.0`, version-only commit `2fc3b93c01ed56b5c848e80181d630c390f3e551`.
**Qualified predecessor:** Phase 9 OWNER-CLOSED / GREEN at exact `0.9.35` source `af3447ccc419cc9c06051dbd4046a9145d7bf0ae` (see `docs/planning/p9/phase-9-closeout.md` and `docs/tasks/p9d/final-qualification.md`).
**Design and stack authority:** ADR 0036 and forward ChatPanel amendment; ADR 0016 (restrained dark orange); ADR 0017; `docs/planning/p10/phase-10-plan.md`; `docs/tasks/p10/README.md`, `prompt-assessment.md`, `implementation-plan.md` and `P1`–`P16` files.

## Explicit authorization

The owner **activates Product Phase 10 — Unified Roadmap & Local-First AI Planning** and authorizes the existing complete `docs/tasks/p10/` implementation sequence **P1–P15**, with **P16 as the sole manual final qualification/closeout handoff**. This activation satisfies the separate-owner-approval preflight demanded by every P10 prompt. It does not itself execute P1 or any agent/model, change source or manifests, qualify any capability, authorize background alignment, or owner-close Phase 10.

P1 must start from the actual Git-proven coherent `0.10.0` state; its assigned version is `0.10.1`. Subsequent P2–P15 advance in order through `0.10.15`, and manual P16 establishes the real separately committed `0.10.16` source/version checkpoint **before** evidence-only final closeout. Each transition updates the 13 root/app/package versions and all 20 pinned internal `@dope/*` references **during implementation**, not as an activation pre-bump. Runner owns normal P1–P15 commits and checks versions but does not bump them; no agent commits or dirty-tree overwrite. Keep `yarn.lock`, unrelated dependencies and absence of root `package-lock.json` unchanged unless separately justified and approved.

## Implement only the approved product design

The Roadmap becomes a center checkpoint path with meaningful phase/milestone/correction branches, visually detached Issues/Ideas pools and an **in-place Software Map-style left details inspector**. Roadmap status/gates remain provenance-backed and must not be inferred from decorative path completion or model claims. Existing Markdown, issue records, Project Mind Notes/Ideas/Questions/Decisions, Planning Maps/Architecture, Work/AgentRun, Chat and read-only History remain independent owners; migration/import is lossless or explicitly read-only, with stable identities, expected revisions, atomic per-owner mutation and safe stale/foreign handling.

**One existing Chat system remains mandatory.** Extend `ChatPanelWidget/ChatPanelController`, `ChatService/ChatRepository`, `ChatContextComposer/ChatBackend`, saved Chat identity/leasing and model routing instead of creating a Roadmap-specific chat/panel/mode/transcript. Chat remains user-placed left/right/bottom/center; opening a map must never force Chat open, relocate or steal focus. Support Follow-active and pinned checkpoint/Planning Map context, actual center split beside a map/editor, revision-safe next-turn refresh and no duplicate writers. Manual UI and ordinary conversational proposals use the same Dope-owned `ProjectPlanningActions` validation/approval boundary; ordinary Chat gets no coding-agent filesystem, shell, MCP, Git or promotion grants.

Manual no-model planning is required. Qualify a measured eligible short-context local model including a `4,096`-total-token budget profile when supported, strict JSON/constrained-output fallback without native function calling, bounded retries/cancellation, and **no silent hosted inference, fallback or project-data egress**. Preserve explicit consent and model provenance for selected hosted conversations. Use October 12 restrained dark-orange semantic theme; neutral utilities, accessible focus/non-color status, narrow/keyboard and light-theme behavior. Project Mind navigation is retired only after all original artifacts remain discoverable, editable and recoverable.

## Required implementation and qualification discipline

P1–P14 are narrow T1/T2 coding tasks with focused affected tests/builds (normal target <=8 minutes; 10-minute soft / 15-minute hard). P15 provides dedicated cross-owner T2 integration. P16 is **MANUAL T3**: real Dope and disposable project, saved Chat in all four docks **including actual center split**, real eligible LM Studio local-model and zero-model paths, safe Markdown round-trip, stale/foreign/race/authority and egress proofs, restart, alternate theme and accessibility, one full `npm run check` on the exact committed `0.10.16` source, and evidence-only `docs/tasks/p10/closeout.md`. Missing critical live gates are **NOT GREEN / Evidence Gap**, never silently waived. No successful test, browser run or local inference is claimed by this activation.

**Phase 11 Human-Centered UI / Usability Qualification and Phase 12 Living Software Knowledge Model stay INACTIVE** and require separate decisions. The pending version-specific historical `c9-codex-chat` and `c9-theme-fix` corrections do not automatically rebase onto Phase 10; do not run concurrent mutating stacks or alter their evidence without deliberate reconciliation.

## Local execution — separate from this activation

After safe local Git synchronization, check `git status --short`, actual commit ancestry, all 13 coherent `0.10.0` manifests, 20 internal pins, this activation record and the current task stack. Preserve all uncommitted/unpushed local work; never blindly reset, force-push or overwrite it. Then run:

```sh
npm run codex:phase:validate -- p10
npm run codex:phase -- p10
```

The validator and runner commands are **authorized but were not executed by this documentation-only activation**. The runner should stop for manual P16. Neither activation nor prompt-run completion is equivalent to qualification, owner closeout or Phase 11 activation.
