# Phase 10 — c10-roadmap-create-sync Owner Correction Activation

**Owner instruction:** `/activate phase 10` (2026-10-13T14:34:11Z / 09:34 America/Chicago), interpreted in the context of the newly authored `c10-roadmap-create-sync` correction.
**Date:** 2026-10-13 (America/Chicago)
**Disposition:** **OWNER-ACTIVATED FOR CORRECTION IMPLEMENTATION ONLY / NOT EXECUTED / NOT QUALIFIED / PHASE 10 NOT OWNER-CLOSED**
**Existing Phase 10 activation:** `docs/planning/p10/activation.md` already activated historical `p10` P1–P16 on 2026-10-12. This is **not** a second run/restart of `p10`.
**Unqualified P16 source:** committed `0.10.16` source `27ab84e2aaf424b17e1d90ccc5016f8af858661f`; terminal evidence `docs/tasks/p10/closeout.md` is **NOT GREEN**, unchanged.
**Correction planning-entry commit:** `3f7fe48e6865c9d6b4592fc7bea38999967f1510` on GitHub `main`, with the complete 19-prompt correction folder `docs/tasks/c10-roadmap-create-sync/`. This is a documentation source reference, not a claim about the developer's local checkout.
**Version:** correction 10, package `0.10.16` **UNCHANGED** throughout P1–P19. Original historical P16 qualified/failed source remains a distinct fixed reference.

## Explicit owner authorization

The owner separately authorizes implementation of **`c10-roadmap-create-sync`**, specifically the already-authored ordered `P1`–`P18` correction prompts, after safe execution preflight. **P19** is the sole **manual, browser-required T3 qualification and evidence-only closeout**. This activation closes the activation prerequisite for the correction; it does **not** execute a runner, start an agent, change package versions or project files, qualify any feature, relabel historical P16, owner-close Phase 10, or activate Phase 11/12.

The authorized scope is precisely the accepted ADR 0036 linked Roadmap and runner/canvas amendments, `docs/planning/p10/phase-10-plan.md`, `docs/tasks/c10-roadmap-create-sync/prompt-assessment.md`, `implementation-plan.md`, `README.md` and P1–P19:

- Visible import/create of an existing Roadmap from project-owned Markdown with deterministic preview, explicit acceptance, durable linked source and safe bidirectional mapped-field synchronization/recovery.
- No-model greenfield creation and bounded local-model planning through the **existing saved ChatPanel**; repair disabled `roadmap-checkpoint` context, enforce approval, revision/owner checks, 4,096-total-token eligible local model support and **no silent hosted fallback/egress**.
- Read-only prompt-stack auto-detection using actual runner/Work conventions; phase/slice/correction prompt checkpoint projection, never a second prompt database or implicit execution.
- Replace the Roadmap list with an interactive React Flow map including touch/mouse pan, trackpad/pinch zoom, world/phase/checkpoint semantic disclosure, stable correction branches, inspector selection and checked double-click/Enter **Open Prompt** in the ordinary Theia editor, never Run.
- Preserve historical Phase 5/6/7/9/10 qualification and waiver truth, including the P16 Not Green gate.
- Final exact-source focused and direct browser/**native Electron**/restart/local-model/authority/egress evidence at P19. Missing critical evidence is Not Green, never a synthetic pass.

## Mandatory execution preflight

Before running anything, the operator must:

1. Inspect the **actual local** Dope checkout: `git status -sb`, `git log -5 --oneline`, current branch/HEAD ancestry, `package.json` version, all **13** manifests and **20** internal `@dope/*` pins, and whether the authored correction folder is present and matches the intended GitHub source. GitHub's `main` cannot establish cleanliness of the developer's machine.
2. Preserve all user work. P16 reported **362 pre-existing unrelated deletions in the shared checkout**; do **not** assume they are still present or absent, and do not reset, clean, force-pull, blindly stash or overwrite them. If dirty, make a deliberate interactive continue/no-continue choice per runner policy; isolate a worktree if necessary. Do not execute concurrently with a different mutating stack.
3. Confirm coherent `0.10.16` and correction ancestry; **do not re-run original `p10`** or target its old version sequence. The correction must keep `yarn.lock`, unrelated dependencies and absence of a root `package-lock.json` unchanged.
4. Run the real local parser validation **before** execution:
   ```sh
   npm run codex:phase:validate -- c10-roadmap-create-sync
   ```
   Stop and repair the authored correction metadata if validation fails. The authoring-time checks were static only; this record does not claim that the CLI validator ran.
5. Verify approved source/authority and narrowly scoped test prerequisites from the assessment/plan. Any material architecture, trust, data loss or baseline conflict returns to explicit review, not silent scope expansion.

Only after these checks, execution is authorized via:

```sh
npm run codex:phase -- c10-roadmap-create-sync
```

The runner owns P1–P18 prompt progression, normal commits, resume/dirty-tree protections and P19 manual handoff. Implementation agents must not create commits themselves. Do not use `--closeout` to bypass the required real native/browser T3 qualification.

## Qualification and successor law

P1–P18 focused implementation/integration tests do not qualify Phase 10. P19 must report exact committed source SHA and unchanged version, evidence for real existing/greenfield UI, linked-source round-trip/merge/crash recovery, semantic map/touch/navigation, genuine local inference/approval/next-turn freshness, wrong-project/stale denial, independent egress/agent authority, same Chat left/right/bottom/center incl center split, direct browser **and Electron** GUI, restart and one exact-source `npm run check`. Record **GREEN / NOT GREEN / Evidence Gap** per gate in a separate `docs/tasks/c10-roadmap-create-sync/closeout.md`; original `docs/tasks/p10/closeout.md` remains untouched. Even a Green correction requires a **separate explicit Phase 10 owner-close** and successor Phase 11 activation; Phase 12 remains inactive.
