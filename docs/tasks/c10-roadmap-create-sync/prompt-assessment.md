# /prompt-ass — c10-roadmap-create-sync

**Status:** ASSESSED / DESIGN APPROVED / PROMPT AUTHORING; NOT IMPLEMENTED OR QUALIFIED
**Date:** 2026-10-12 (America/Chicago)
**Source examined:** GitHub `jfin602/dope` `main` following ADR 0036's combined prompt-discovery/spatial-canvas amendment (`7d7f15f90b51c66f726ea94387267988954e5dde`). P16 candidate `27ab84e2aaf424b17e1d90ccc5016f8af858661f`, package `0.10.16`, is **NOT GREEN**, not owner-closed. Remote read-only inspection does not establish the local checkout state.
**Authority:** current ADR 0036 (both dated amendments), ADR 0016 (restrained orange), ADR 0017, ADR 0025/26, ADR 0028/29, ADR 0037, `docs/planning/p10/phase-10-plan.md`, `docs/workflow.md`, `BOOT.md`, `AGENTS.md`, and P16 closeout.
**Correction:** `c10-roadmap-create-sync` under `docs/tasks/`, **Correction 10, fixed unchanged `0.10.16`**. Prompt authoring is not separate permission to execute.

## Source-grounded assessment

- `packages/project-intelligence/src/node/roadmap-import.ts` `previewRoadmapImport` is deterministic/read-only, but hardcodes `docs/roadmap/mvp-roadmap.md`. It recognizes real Dope headings, refs and provenance; preserve unsupported/ambiguous Not Green statuses instead of broad text guessing.
- `packages/project-intelligence/src/node/roadmap-store.ts` retains versioned `.dope/roadmap.json`, checked expected revisions/handles, source-owner locks and explicit preview acceptance; source-backed titles are currently immutable. `project-planning-actions.ts` centralizes human/model checked edit authority. New linked Markdown writes must extend that boundary, not bypass it or claim cross-file transactionality.
- `packages/theia-extension/src/browser/roadmap-canvas-widget.ts` currently renders `<ol>` checkpoint buttons; the Phase 10 P16 browser showed no visible import/create. Inspector/projection are already integrated. `physical-map-widget.ts` already uses `@xyflow/react`, fit/focus/zoom, source navigation and map widgets; reuse these patterns, not a second graph engine.
- Current `scripts/codex-phase-core.mjs` exports `parsePrompt` and `buildPlan` with strict grammar and correction unchanged-version semantics. `scripts/validate-codex-phase.mjs` and the runner read `docs/tasks/<folder>/P*.txt`. Work already advertises Prompt Stack discovery; share/extract a pure validated reader for the Roadmap rather than duplicate a looser parser.
- Existing Chat action/context tests run through `packages/theia-extension/lib/node/chat-backend.js` and `chat-context-composer.js`, with `packages/chat/lib/node/index.js` for durable saved Chat; the actual files live in theia-extension node, not `packages/chat/src/chat-backend.ts`. P16 observed `roadmap-checkpoint` disabled in ordinary Chat settings, so no real model proposal was exercised.
- P16 browser seeded an importer preview via domain API, while the UI had no entry. Phase 6 displayed Active rather than owner-closed and Phase 7 Unknown rather than qualified; this is separate evidence-projection truth work. The exact P16 `npm run check` passed 611 tests/builds, not the blocked live gates. Direct Electron GUI and full no-hosted-egress evidence remain missing.

## Prompt decomposition and order

| Prompt | Single owner / deliverable | Tier | Model | Depends |
| --- | --- | --- | --- | --- |
| P1 | Generic bounded candidate discovery and selectable source preview | T2 | Sol High | P16 basis |
| P2 | Durable linked-document metadata/revision-safe acceptance | T2 | Sol High | P1 |
| P3 | Visible import/create entry and existing-roadmap UI acceptance | T1 | Sol Medium | P1–P2 |
| P4 | Minimal source-aware Markdown mapped-field patch writer | T2 | Sol High | P2 |
| P5 | External edit detection, deterministic reconciliation/conflicts | T2 | Sol High | P4 |
| P6 | Recoverable pending-sync/missing-link/restart protocol | T2 | Sol High | P5 |
| P7 | Zero-model greenfield draft and safe Markdown creation | T2 | Sol High | P2/P4 |
| P8 | Greenfield manual UI and existing Chat planning entry | T1 | Sol Medium | P3/P7 |
| P9 | Ordinary Chat roadmap-checkpoint allowance/preview fix | T2 | Sol High | P2 |
| P10 | Existing Chat one-step draft planning proposal bridge | T2 | Sol High | P7/P9 |
| P11 | Shared read-only runner grammar/task-stack discovery | T2 | Sol High | P2 |
| P12 | Source-backed prompt/continuation/correction projection | T1 | Sol Medium | P11 |
| P13 | React Flow spatial Roadmap canvas in existing center tab | T1 | Sol High | P12 |
| P14 | Semantic world/phase/checkpoint zoom and stable branch layout | T1 | Sol High | P13 |
| P15 | Touch/pointer gestures, viewport restoration and Arrange mode | T1 | Sol High | P14 |
| P16 | Safe prompt source navigation and inspector accessibility | T1 | Sol Medium | P11–P15 |
| P17 | Historical phase status evidence precedence correction | T2 | Sol High | P1/P2 |
| P18 | Focused cross-owner and adversarial integration coverage | T2 | Sol High | P1–P17 |
| P19 | **Single manual real browser/Electron/local-model closeout** | T3 | Sol High | P18 |

**Why 19 instead of a single large prompt:** source import, durable link, source writes, reconciliation, browser UI, Chat allowance, Chat planning, runner schema, graph projection and canvas are distinct owners or risk boundaries. Consolidating them would exceed the <=8-minute ordinary target and obscure security/persistence failures. P18 is the only general integrated T2 matrix; P19 only final real-world T3 and aggregate. P19 may exceed the normal prompt time gate.

## Preservation and deferrals

One saved ChatPanel, fully user-dockable left/right/bottom/center including center split; do not introduce a Roadmap chatbot, external Codex agent permissions, automatic inference or hosted fallback. No phantom green status, checkout overwrite, wholesale Markdown normalization, automatic model-based syncing or new mutable prompt source. Linked `ROADMAP.md` owns mapped prose; `.dope/` owns stable IDs, semantic links and sync metadata; task files remain independent read-only executable definitions; Work/AgentTask/runner owns execution; Project Mind/Planning Map/Architecture/History keep original data authority. No direct Chat filesystem/shell/Git/MCP grant. No Phase 12 global semantic alignment. No Phase 11 activation, historic P16 requalification-by-relabeling, or edits to completed P1–P16 prompts.

## Efficiency and evidence distribution

P1/P2/P4–P7/P9–P11/P17 protect their changed store/authority seam with focused T2; P3/P8/P12–P16 use targeted T1 presentation tests. Existing tests that import `packages/project-intelligence/lib/**` or `packages/theia-extension/lib/**` require rebuilding **only changed relevant package output(s)** before running; browser-source-string tests may not need a package build. No routine `npm run check`, browser/electron full builds, full test matrix or restart on P1–P18. P18 runs one bounded integrated safety pass; P19 runs one full `npm run check` on exact source candidate and real GUI/restart/model/egress. Register new tests once in `test:product` where appropriate. Keep the version `0.10.16` coherent, 13 manifests and 20 pins unchanged, `yarn.lock` and absent root package-lock unchanged. Agent does not commit when runner owns commits. Correct severe source uncertainty with a bounded plan reconciliation rather than hand-waving.

Prompt grammar: all files `P<number>-<lower-kebab-slug>.txt`, matching `TASK: Correction 10 / P<number> — ...`, exactly one final `P19-...-closeout.txt` whose TASK title includes closeout, every prompt `- Required unchanged project version: \`0.10.16\`.`, explicit Browser required only P19. The runner validator must be executed *after* prompt writing. Historical P16 remains NOT GREEN.
