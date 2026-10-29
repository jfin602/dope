# /prompt-plan — c11-roadmap-redesign-v2

**CURRENT v2 EXECUTION AUTHORITY (2026-10-29):** The owner deliberately started the named v2 runner; its first attempt stopped at preflight with zero code changes and no P1 PASS. That direct execution action is the **new, distinct v2 sequencing decision**, recorded in [owner-run authorization](qualification/2026-10-29-owner-run-authorization.md). It supersedes the earlier documentation-only preflight request for another written approval. Old P1's exception remains limited to old P1; G3 Chrome R1–R7 gaps remain evidence gaps. Re-run v2 P1 normally with all original technical tests and stop conditions; **do not edit immutable P*.txt source** or forge a completed prompt.

**Date:** 2026-10-29; DOCUMENTATION / EXECUTABLE PROMPTS ONLY; NOT RUN / QUALIFIED.
**Source:** use current HEAD/local worktree, not a stale pinned SHA. Version `0.11.8` unchanged, main only. Retain old P1 NOT GREEN and its safe incompatible-schema rejection. The old P1 exception cannot authorize this stack; the owner's subsequent direct v2 runner launch is separately documented as the v2 execution decision.

## Design and authority

Build one actual Roadmap store authority with `phases[]`, `gates[]`, `corrections[]`, each Gate owns criteria with current evidence and evidence invalidation. Phase requires explicit approved coverage of its required Gate set before Phase Green eligibility. Use stable IDs and exact parents, source hashes/revisions and approved status transitions. Never treat tasks/runner prompt checkpoints as required Gates; no old alpha schema compatibility; incompatible saved index gets safe reviewed reimport/reinitialize path.

Stages are **incremental compile-safe boundaries**, not prolonged dual-model coexistence. A new pure domain validator may exist before it is called by the store, but a second runtime repository/writer or old-index-to-new qualification mapping is prohibited. Each stage compiles and has exact unit/integration success with explicitly named unimplemented next seam. P17 removes any temporary shims. The ultimate UX must match owner `this-style.png` with horizontal Phase cards, nested foldout Gates, clear arrows, restrained colors/progress and in-stage inspector/Chat docking.

## Runner block A — core domain (P1–P7)

- **P1 — Types and validation:** In `roadmap-store.ts` or a directly owned domain module define Phase, Gate, Criterion, Correction, evidence, status and schema validators as pure code; no unconnected second store. Test malformed IDs/parents/cycles and 0 criteria, compile. No UI expectation.
- **P2 — Schema-2 persisted read:** Wire the real `RoadmapStore` to new schema-versioned index read/write and preserve existing safe incompatible-schema rejection. Keep compile-safe consumer boundary; update store read/roundtrip tests. Do not recreate schema-1 compatibility.
- **P3 — Mutations:** Canonical store create/edit/reorder Phase/Gate/criterion and correction ownership with compare-and-swap revision/permissions and no-write rejects; tests persist/reload and stale/project isolation.
- **P4 — Gate evidence qualification:** Pure deterministic criteria/evidence evaluator wired to authoritative store/service, explicit result provenance/freshness, not mutable color; tests pass/fail/missing/stale/untrusted source.
- **P5 — Phase eligibility:** Record owner-approved Gate-set completeness, all required Gates Green/no blocker, waiver disposition, empty phase not Green; tests exercise changes invalidating Green.
- **P6 — Projection and service:** Replace RoadmapProjection and Service interface consumers with canonical Phase/Gate projection and selected Gate identity; no orphaned old checkpoint node stand-in; compile/serve app.
- **P7 — Planning actions:** Typed validated Gate actions and inspector model read/edit pathways with preview/approve/reject, safe source/project revision; stop if no user-approvable Gate creation.

## Runner block B — content + UI (P8–P13)

- **P8 — Markdown import:** Phase/Gate/criterion Markdown grammar, stable section mapping, ignore non-gate bullets, preserve unrelated Markdown.
- **P9 — Linked document roundtrip:** patch/sync/relink conflict/recovery including explicit authorization, no unintended canonical write.
- **P10 — Greenfield review:** Gate-capable but incomplete Phase-only preview, explicit proposed vs accepted, no accidental publish/auto-Green.
- **P11 — Chat AI proposals:** adapt saved Chat extraction/local model bounded validation so implementation steps remain tasks and missing Gate criteria are visible; no extra model call or fake schedule.
- **P12 — Canvas phase layout:** React Flow large horizontal Phase containers, arrows, no synthetic parent wires, proposed vs canonical preview.
- **P13 — Gate interactions:** nested keyboard/pointer foldouts, inspector selection, actual criteria/detail, pan/zoom/Focus/Fit/docked Chat. Tests and browser build, but no Chrome claim yet.

## Manual boundary (P14)

**Browser required: yes.** In real connected Codex Chrome, demonstrate actual Gate creation/edit/persistence, 3-phase screenshot grammar, nested selection, foldout and inspector, phase-only draft/Accept/Reject, source no-write and reloaded viewport; capture bundle/source identity and test results. P14 may repair its own narrow UI bugs in manual Codex session. Do NOT call the whole redesign Green. On full scoped PASS only, create an evidence/approved source commit with exact subject `c11-roadmap-redesign-v2/P14: Chrome UI integration qualification`, so the runner can recognize the gate and continue to P15. On failure, record NOT GREEN under a non-PASS subject and STOP, do not insert fake matching history.

## Runner block C — truth and cleanup (P15–P18)

- **P15 — Status + correction/dependency presentation:** required qualified N/M progress, no empty 100%, blocked/waived/stale; direct correction parent/diagnostic and deliberate dependency view. Source-backed pure selectors and component tests.
- **P16 — Dope Help:** existing deterministic help registry + bounded Chat context for Gate meanings and verified controls, no new Chat, auto-Work or hosted fallback.
- **P17 — Alpha cleanup:** remove every unused Roadmap checkpoint/milestone kind/API/alias and duplicate UI/test, dead charter references, while preserving unrelated Work checkpoint/History and historical documentation. Safe schema-incompatible explicit recovery remains.
- **P18 — Cross-seam integration:** Phase Focus, Work, task discovery, History, prompt navigation, linked docs, saved Chat, ownership/permission, source drift, light/dark/theme; one full `npm run check` when coherent, affected browser/Electron builds. Do not claim native UI from build.

## Final manual qualification (P19)

Connected real Chrome replays Gate qualification, source hashes, draft/accept/publish separation, Phase coverage approval, status/stale/waiver, correction/dependencies, Chat Help, alpha cleanup, responsive/keyboard/theme. Independently compare exact screenshot grammar and no silent write. Document exact tested source/build and verdict, provide owner-native same-source Electron checklist; Phase 11 remains OPEN pending its independent full gates.

## Operator and source rules

- `npm run codex:phase:validate -- c11-roadmap-redesign-v2` locally before execution; then `npm run codex:phase -- c11-roadmap-redesign-v2`. The runner stops at P14. Qualified P14 must be committed under its exact canonical subject to permit runner P15 resumption, then runner stops again at final P19.
- No /activate. Do not write implementation commits in this authoring. No false Git history markers or version advancement.
- Do not overwrite local dirty owner work, force-reset/stash/clean, silently commit untracked private evidence, touch persistent game files for destructive tests or publish Markdown without permission. Use disposable fixtures.
- No blanket 3-repair cycle on massive scopes; work is split into single-outcome prompts and STOP on unqualified slice. Focused tests/builds per prompt, no browser for P1–P13/P15–P18, real browser for P14 and P19.
