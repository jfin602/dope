# Phase 10 Plan — Unified Roadmap & Local-First AI Planning

**2026-10-13 correction outcome:** Activated `c10-roadmap-create-sync` P1–P18 was implemented at unchanged `0.10.16`. Manual P19 is **NOT GREEN** at exact final product source `71d91efb3668e57816bb031f82ab309acea17cfc`; see `docs/tasks/c10-roadmap-create-sync/closeout.md` for the 671/671 aggregate, direct browser passes and remaining local-model/authority/native-GUI gaps. Historical P16 below remains Not Green. No owner-close or successor activation follows.

**Status:** DESIGN APPROVED / P1–P16 OWNER-ACTIVATED / P1–P15 IMPLEMENTED / P16 NOT GREEN at committed `0.10.16` source `27ab84e` (2026-10-12); NOT OWNER-CLOSED
**Date:** 2026-10-12 (America/Chicago)
**Authority:** ADR 0036; ADR 0016 (2026-10-12 current theme), 0017, 0022–0026, 0028–0030, 0034–0035.
**Entry:** Phase 9 is owner-closed/qualified, and `docs/planning/p10/activation.md` records the separate 2026-10-12 owner activation for P1–P16. The `0.10.0` baseline remains unchanged until P1.

**Qualification record:** `docs/tasks/p10/closeout.md` records the exact-source passing aggregate and the blocking real-UI/local-planning gates. The entry/baseline language below describes the historical activation point; it is not a current qualification claim.

## Goal

Make existing phase plans explorable as a game-map-like checkpoint progression with correction branches, unscheduled Issues/Ideas pools, Software Map-style **in-place left inspector**, and ordinary dockable project Chat. Manual editing and constrained local-model Chat collaborate through one revisioned, deterministic project planning authority. Planning Maps stay actual architecture transformation views; History stays observational; no additional Session objects.

## Proposed workstreams — not executable prompts

1. **Model / migration.** Inspect real Markdown roadmap/phase plans, Project Mind and known-issues registries. Define stable checkpoint IDs, semantic edges, typed links, single-writer field ownership, safe lossless import or explicit read-only fallback. Preserve all historical qualification.
2. **Shared actions.** Bounded project-scoped reads, previews, typed create/edit/link/reorder/promotion; expected revisions and PlanningMap basis, deterministic lifecycle/graph checks, owner atomicity, undo for eligible edits, affected-object subscriptions.
3. **Roadmap UI.** Center checkpoint path, correction branches, detached Ideas/Issues pools, no standalone details page; Software Map-like inspector, direct semantic gestures, theme/keyboard/narrow-pane support.
4. **AI collaboration.** Reuse durable single-owner Chat; selected-object compact retrieval refreshed per step, project/root isolation, safe Dope-owned planning proposal parser/executor, stale rejection and explicit approvals; do not grant Chat code-agent tools.
5. **Local model.** Small context/action vocabulary, strict JSON/constrained-output without native tool-calling, capability-aware token budgeting and tested 4,096-total-token profile where supported; real LM Studio/local provider, bounded retries/cancel/failure, no silent hosted egress.
6. **Qualification.** Existing real-project import/round-trip, zero-model manual workflow, local-model edit/restart, Chat/map inspector consistency, concurrent stale edit/project switch, PlanningMap basis and adoption, evidence-true gates, alternate theme, browser/Electron GUI and independent closeout.

## First working slice

Open a real project's roadmap; click an existing checkpoint and edit it in the left inspector; ask a local Chat model to make another authorized small edit; see both commits on the map and available in the AI's **next** context; restart and confirm persistent identities. Repeat with no AI and a deliberately stale request, proving no lost updates, code execution or hosted fallback.

## Sequencing and constraints

Phase 9 was OWNER-CLOSED / GREEN / QUALIFIED on 2026-10-12 at `0.9.35` / `af3447c`; a coherent `0.10.0` successor baseline now exists (see `docs/planning/p9/phase-9-closeout.md` and `docs/planning/p10/baseline.md`). That is not Phase 10 activation or qualification. Historical `c9-codex-chat` and `c9-theme-fix` fixed-version targets/evidence and 9A/9B/9C records are unaffected; do not execute their old version-specific stacks unreviewed on the successor baseline. Plan richly but prompt sparsely using `/prompt-ass -> /prompt-plan -> /prompt-write` **only after a separate owner implementation activation**, ordinary <=8-minute prompt targets and appropriate T1/T2/T3 security/local/GUI gates. This plan performs no implementation, activation or version change.

The former Living Software Knowledge Model moves to **Phase 12** after the newly designed **Phase 11 Human-Centered UI** (ADR 0037); its deterministic-first/local-only Background constraints remain inactive. Phase 10 Roadmap remains the same approved design, now separately owner-activated for its P1–P16 implementation stack; its actual source and qualification remain pending. Phase 11 usability review follows only when separately activated.

## Existing ChatPanel integration contract and qualification

The implementation **extends the current** `ChatPanelWidget` / `ChatPanelController`, `ChatService` / `ChatRepository`, `ChatContextComposer` / `ChatBackend`, model routing and leases. Roadmap/checkpoint/Planning Map retrieval and action proposals enter through existing bounded context and per-turn orchestration. The new planning-domain `ProjectPlanningActions` service is not a Chat service. Never create a Roadmap-specific Chat mode, widget, transcript store, competing controller or a ChatPanel bound to a particular diagram.

The user's normal Chat can be in any Theia area (left, right, bottom, center), and opening a map must not auto-open, relocate, change, close or steal focus from it. Map selection supplies optional visible **follow-active** context; explicitly **pinned** checkpoint/Planning Map context survives changing tabs until unpinned. The model never silently acquires permission because its panel is beside a map. Keep full editor/diagram visibility, including normal center tab splits, and preserve saved Chat identity, model, context preview, single-writer lease and restart restoration through layout moves.

**Required integrated gate:** with one actual saved Chat, exercise local-model planning from left/right/bottom/center; keep a Roadmap/Planning Map or code editor visible, including center split. Move/restore Chat without losing conversation identity or creating a new Chat writer; verify no forced panel opening/reposition, correct selection follow/pin, stale and cross-project rejection, real model-selection/hosted-consent behavior and no layout hijack. If the Theia shell cannot support the required center split, record Not Green/Evidence Gap instead of silently substituting a special Roadmap Chat.

## Prompt stack authoring — 2026-10-12 (documentation only)

The approved design has been source-assessed and decomposed into the **unactivated** `docs/tasks/p10/` stack: assessment, implementation plan, README and P1–P16 targeting `0.10.1`–`0.10.16`. P16 is the sole manual exact-source final qualification/closeout. No source, manifest, project version, qualification or Phase 10 activation changes occur from writing prompts. Implementation requires a separate explicitly owner-approved `docs/planning/p10/activation.md`; the `0.10.0` baseline remains intact. The stack retains the one existing ChatPanel across all positions, real center split, local/no-model gates and independent Phase 11/12 boundaries.

## Owner implementation activation — 2026-10-12

The owner explicitly issued `/activate p10` after the P1–P16 task stack was authored. `docs/planning/p10/activation.md` authorizes ordered implementation from the clean `0.10.0` baseline; it does not implement features, rerun tests, qualify Phase 10, or authorize Phase 11/12. The preexisting design-only statements above describe the earlier planning state where applicable. The first authorized prompt is `docs/tasks/p10/P1-source-import.txt`, which advances the manifests to `0.10.1` during real implementation, never at activation.

## P16 repair direction — Linked Roadmap creation/synchronization (approved design only)

**Entry truth:** P1–P15 implementation is retained. P16 passed the exact `0.10.16` aggregate (611 tests and builds), yet remains **NOT GREEN**: Roadmap has no visible import/create action, `roadmap-checkpoint` is disabled for ordinary Chat without an enabling setting, displayed historical Phase 6/7 truth is wrong, and real model proposals/authority and direct Electron UI qualification are unproved. See `docs/tasks/p10/closeout.md`; do not edit that evidence or pretend Phase 10 is owner-closed.

**Proposed unchanged-version correction:** `c10-roadmap-create-sync` (requires separate `/prompt-ass -> /prompt-plan -> /prompt-write` and implementation authorization). Reuse existing P1 importer, P2 store, P3 planning-action boundary and current Chat system. Workstreams:
1. **Visible initialization:** empty-state Import / Plan with Chat / Create manually. Discover/select common Markdown sources, preview supported checkpoints with truthful gates, and explicitly accept. Nothing mutates on browse or preview.
2. **Linked source lifecycle:** persist approved source file path, fingerprint, stable IDs and section mapping, last-synced revisions and visible sync status. Keep existing files intact; for greenfield, accept compact incremental Chat/manual planning drafts and safely create a new linked Markdown file at an approved unused path.
3. **Targeted bidirectional synchronization:** source-aware minimal document patches for mapped fields through `ProjectPlanningActions`, bounded external-file change detection and reparse, three-way diff, conflict/relink review, guarded path/root identity, revision safety, recoverable partial-write/restart state and no unsupported Markdown rewrite. Do not invent cross-store atomicity.
4. **Local Chat and gate repair:** expose/enable `roadmap-checkpoint` via normal Chat settings/context preview, preserve one saved Chat system across all placements, 4,096-total-token local model with strict JSON fallback, no hidden hosted inference or agent/file privileges. Reconcile historical Phase 6/7 owner-close authority without fabricating Green.
5. **Direct qualification:** real existing and greenfield file creation, two-way edits and conflicts, same saved Chat left/right/bottom/center with actual split, zero-model creation, proposal approval/denial, stale/foreign/malformed handling, next-turn freshness, model trace/egress, restart, browser and **native Electron** GUI, then exact-source aggregate. Preserve P16 Not Green until independently proved and owner-closed.

**Scope fence:** Only one explicitly selected Roadmap document's mapped planning data is synchronized. Phase 12's broader semantic software/docs/contracts alignment is not pulled into Phase 10. All P1–P16 historic prompts and version evidence remain untouched; documentation approval does not execute this correction.

## P16 correction scope extension — automatic prompts and spatial Roadmap

**Approved design; no implementation/activation.** Extend the existing unchanged-version `c10-roadmap-create-sync` correction with both runner-aware source checkpoints and the interactive Roadmap canvas. Preserve prior workstreams: visible import, greenfield creation via existing ChatPanel or zero-model manual flow, persistent bidirectional linked Markdown synchronization, `roadmap-checkpoint` Chat context repair, Phase 6/7 gate truth and direct P16 qualification. Do not rewrite historical P1–P16 or their NOT GREEN closeout.

**Prompt partition guidance for `/prompt-ass -> /prompt-plan -> /prompt-write c10-roadmap-create-sync`:**
1. **Read-only shared runner discovery:** reuse Work Prompt Stack discovery where possible and the existing `parsePrompt`/`buildPlan` grammar; index valid task stacks in configured `docs/tasks/` (phase, continuation, corrections and later version families), expose source-backed prompt number/title/version/model/browser requirement, link to phases, mark one-offs/superseded/invalid records separately. IDs derive from project+stack+prompt, with root-contained verified file paths and stable renames. No implicit runner or Markdown writes.
2. **Interactive spatial canvas replacement:** swap the Roadmap `<ol>` display for React Flow using existing projection and left inspector, deterministic path/branch positions, background pointer/touch pan, wheel/trackpad/pinch zoom, accessible Zoom/Fit/Focus controls and neutral semantic theme. Reuse map infrastructure rather than introducing a second rendering framework or rewriting `RoadmapService`.
3. **Branching, semantic zoom, file navigation:** three zoom levels (world phases / medium stack groups / near individual prompts) with explicit expand/focus; continuation slices within their phase, corrections as side routes attached only to evidenced origin and unmatched work in a reviewable pool. Single click selects; double-click or keyboard Enter / Open Prompt opens the exact file in ordinary Theia editor, without execution. Node dragging only in explicit Arrange mode and affects presentation coordinates, not graph order or domain revisions. Preserve viewport/selection across refresh, project switch, restart and center split.
4. **Integrate with previous creation and sync contract:** prompt discovery is read-only owner-backed projection independent of the selected linked Roadmap Markdown file. No reserializing prompt text into `.dope/` as a second owner; no automatic editor/Chat/agent grants, and no accidental false Green or implicit work launch. Maintain the existing ChatPanel and bounded local 4,096-token planning path.
5. **Qualification:** focused tests for grammar parity (`p10`, `p8a/p8b`, `p1-0`, `p2-1`, `c10-...`), contiguous numbers/closeout/version, one-off/invalid/superseded/missing/renamed/foreign handling, stable checkpoint identity, branch evidence, no mistaken Green, editor double-click/Enter without launch, mouse/pointer/touch/wheel/pinch/keyboard Fit/Focus, semantic disclosure, Arrange safety, bounded hundreds-of-prompts performance, restart and dark/light/narrow/center split. Final direct real-browser/native-Electron, local model, no-hosted-egress, Markdown round-trip, stale approval and exact-source full aggregate are still mandatory.

**Scope and sequencing:** Do not create a new runner/parser/Chat/Work subsystem or replace Phase 12 background alignment. Keep ordinary prompts narrow (discovery, map foundation, LOD/branching/source navigation, integration, manual T3 closeout). `0.10.16` stays the version for the approved correction unless a separate owner version decision changes it. A documentation amendment is not execution permission or qualification.

## Owner correction activation — 2026-10-13

The owner instruction `/activate phase 10` (2026-10-13T14:34:11Z) is applied to the **pending** `c10-roadmap-create-sync` correction, not to a second run of the already-activated/completed original `p10` prompt sequence. The specific approval is recorded at [c10 activation](c10-roadmap-create-sync-activation.md). The authored `docs/tasks/c10-roadmap-create-sync/` **P1–P18** are now owner-authorized for runner implementation after exact local Git/version/dirty-tree and parser-validation preflight; **P19** remains the sole manual T3 qualifier. The version must remain **`0.10.16` unchanged**. No correction implementation, test result, Electron GUI qualification or Phase 10 owner closeout is claimed by this activation. Historical P16 remains NOT GREEN; Phases 11/12 remain inactive.
