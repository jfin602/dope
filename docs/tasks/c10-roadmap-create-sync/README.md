# c10-roadmap-create-sync — Phase 10 Roadmap correction stack

**P19 outcome (2026-10-13): NOT GREEN / NOT QUALIFIED** at unchanged `0.10.16` and exact final product source `71d91efb3668e57816bb031f82ab309acea17cfc`. P1–P18 implementation is committed; 671/671 tests and both builds passed, but live model approval/persistence, full linked recovery/authority/egress and direct Electron GUI remain open. See [separate correction closeout](closeout.md). Original P16 is unchanged, and Phase 10 is not owner-closed. The activation-only status below is historical.

**Status (2026-10-13):** **OWNER-ACTIVATED FOR P1–P18 IMPLEMENTATION / P19 MANUAL T3 / NOT EXECUTED OR QUALIFIED**; Phase 10 P16 remains **NOT GREEN / NOT OWNER-CLOSED**.
**Date:** 2026-10-12 (America/Chicago)
**Source baseline for planning:** `0.10.16`, P16 source `27ab84e2aaf424b17e1d90ccc5016f8af858661f` is **NOT GREEN / NOT OWNER-CLOSED**. ADR 0036 + linked Markdown + runner-aware interactive canvas amendments are approved designs.
**Execution folder:** `docs/tasks/c10-roadmap-create-sync/`; mode: **Correction 10**, package version **`0.10.16` UNCHANGED** (all 13 manifests and 20 internal pins).

## Goal

Repair visible Roadmap creation/import and ordinary Chat planning; maintain a permanently linked human-readable Markdown roadmap with deterministic bounded two-way mapped-field sync; discover Dope runner prompts into source-backed phase/slice/correction checkpoints; provide a spatial touch/pan/zoom React Flow canvas and normal Theia prompt-file navigation. Preserve the existing ChatPanel, ProjectPlanningActions, Work and all owner/evidence boundaries. No Phase 11/12 activation or historical P16 relabeling.

| Prompt | Primary responsibility | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| [P1](P1-roadmap-candidates.txt) | Roadmap candidate discovery and preview | T2 | GPT-6 Sol High | no |
| [P2](P2-linked-roadmap-store.txt) | Durable linked-source metadata/acceptance | T2 | GPT-6 Sol High | no |
| [P3](P3-roadmap-import-ui.txt) | UI import/create entry | T1 | GPT-6 Sol Medium | no |
| [P4](P4-markdown-patch.txt) | Guarded mapped Markdown patches | T2 | GPT-6 Sol High | no |
| [P5](P5-document-reconciliation.txt) | External-change detection/diff/conflicts | T2 | GPT-6 Sol High | no |
| [P6](P6-sync-recovery.txt) | Crash-safe pending-sync and relinking | T2 | GPT-6 Sol High | no |
| [P7](P7-greenfield-draft.txt) | No-model greenfield draft/create backend | T2 | GPT-6 Sol High | no |
| [P8](P8-greenfield-ui.txt) | Manual/Chat planning entry and draft UI | T1 | GPT-6 Sol Medium | no |
| [P9](P9-chat-context-allowance.txt) | Enable roadmap context in normal Chat | T2 | GPT-6 Sol High | no |
| [P10](P10-chat-draft-actions.txt) | Small-model Chat draft actions | T2 | GPT-6 Sol High | no |
| [P11](P11-runner-prompt-discovery.txt) | Shared strict runner prompt discovery | T2 | GPT-6 Sol High | no |
| [P12](P12-prompt-graph-projection.txt) | Prompt/slice/correction graph | T1 | GPT-6 Sol Medium | no |
| [P13](P13-spatial-roadmap-canvas.txt) | Replace list with React Flow canvas | T1 | GPT-6 Sol High | no |
| [P14](P14-roadmap-semantic-zoom.txt) | Semantic world/phase/checkpoint zoom | T1 | GPT-6 Sol High | no |
| [P15](P15-roadmap-viewport-gestures.txt) | Touch/viewport restore/Arrange mode | T1 | GPT-6 Sol High | no |
| [P16](P16-prompt-source-navigation.txt) | Double-click/Enter open prompt source | T1 | GPT-6 Sol Medium | no |
| [P17](P17-historical-gate-truth.txt) | Correct historical status precedence | T2 | GPT-6 Sol High | no |
| [P18](P18-create-sync-integration.txt) | Focused integrated authority regressions | T2 | GPT-6 Sol High | no |
| [P19](P19-roadmap-closeout.txt) | Real GUI/local-model/egress qualification and closeout | T3 | GPT-6 Sol High | **yes** |

## Execution and evidence law

**Explicit owner activation is recorded** in [the 2026-10-13 correction activation](../../planning/p10/c10-roadmap-create-sync-activation.md). Activation authorizes P1–P18 only after safe local preflight; P19 remains manual T3. Prompt authoring and activation do not themselves execute or qualify work. Verify actual Git HEAD/ancestry, clean or deliberately accepted dirty worktree, fixed `0.10.16` version across root/workspaces and internal pins, source freshness, and no concurrent mutating correction stack. Preserve pre-existing shared checkout deletions and uncommitted work. Do not reset, blindly pull, clean, stash-and-forget or force-update. This is unchanged-version correction; do not pre-bump manifests, add root `package-lock.json` or rewrite `yarn.lock`.

Validate the prompts after authoring:
```sh
npm run codex:phase:validate -- c10-roadmap-create-sync
```

After verifying the activated source and safe local preflight, execute ordinary prompts:
```sh
npm run codex:phase -- c10-roadmap-create-sync
```
The runner owns P1–P18 checkpoints, commits and manual browser handoff; do not manually commit during agent prompts. P19 is the **sole manual T3** with exact-source `npm run check`, real local model, browser **and direct Electron GUI**, restart, authority/evidence and independently observed no-hosted-egress. A completed stack/run is not Phase 10 Green. P19 writes a new correction `closeout.md` truthfully; historical `docs/tasks/p10/closeout.md` remains unchanged, and Phase 11 stays inactive until separate owner decision.

## Safety and efficiency

Manual zero-model and local 4,096-total-token model workflows must work; no silent hosted fallback. Only normal ChatPanel, no Roadmap-specific transcript/mode or agent grants. Prompt discovery remains read-only and double-click opens a source document, **never executes it**. Linked Markdown mapped prose remains document-owned; unsupported sections preserve bytes/read-only behavior. All Green/Not Green/waived truth is evidence-backed. Ordinary prompts use focused tests/changed-package builds, not repetitive full checks; P18 runs narrow T2 integration, P19 alone owns direct GUI and aggregate.

See [assessment](prompt-assessment.md) and [implementation plan](implementation-plan.md).
