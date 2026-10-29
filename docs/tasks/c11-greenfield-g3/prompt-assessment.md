# /prompt-ass — c11-greenfield-g3

**Owner request:** 2026-10-28/29 `/prompt-ass + /prompt-plan + /prompt-write c11-greenfield-patch` after reporting G2 complete and authorizing merge of the G3 design. **Naming decision:** `c11-greenfield-patch` already has immutable authored P1–P3 ending in a manual closeout; appending or replacing its source would violate fixed runner sequence. Author this **separate follow-on correction** as `c11-greenfield-g3`. No prior files are edited. **Status: DOCS AUTHORING ONLY, NOT RUN/QUALIFIED.**

**Source baseline:** GitHub `main` `c947700a6e57f81a40d43a256fe6814c55a18ea4`, root manifest `0.11.8`; source includes committed P1 changes and `afa221a` ("greenfiled G2: Green") touching ordinary Chat grounding/backend/widget/tests. This is an owner-reported G2 completion plus a GitHub commit, **not** an independently operated browser G2 review by this author. Verify local dirty state and dated exact-source G2 evidence before running; remote source does not establish local clean state or model readiness. [Approved G3 contract](../../planning/p11/greenfield-experience-contract.md), [G3 matrix](../../planning/p11/panel-usability-matrix.md), [UX-020](../../planning/p11/usability-issue-ledger.md), [ADR 0025](../../decisions/0025-durable-project-chat-and-chatpanel-ai-presence.md), [ADR 0036](../../decisions/0036-unified-roadmap-and-local-first-ai-planning.md).

## Product goal

In the developer-owned PixiJS tower-defense project, normal saved Chat should respond concisely, keep decisions and current file evidence, **check the actual Roadmap authority**, and at a useful project-planning moment offer a validated button or natural-language choice to generate a coherent provisional strategic roadmap. Both positive consent routes must hit the same project/Chat/revision/token authorization path. After the user approves **generation**, selected local Q4 proposes an entire strategic multi-phase draft, with truthful progress; a validated noncanonical draft becomes visible and the **existing central Roadmap canvas opens automatically**, while Chat stays docked where it was. The user separately reviews/accepts the generated draft and later authorizes canonical linked Markdown publication. Do not make the AI "create" or "publish" without developer approval.

## Source-grounded findings (GitHub main)

| Seam | Verified behavior / gap |
| --- | --- |
| `packages/theia-extension/src/node/chat-context-composer.ts` | Ordinary Chat grounding instructions and saved history/selected-model budget exist; no scoped concise-response guidance/checked Roadmap creation offer yet. Prior P1/G2 changes must not be undone. |
| `ChatBackend` + `packages/chat/src/service.ts` | Existing `runTurn`, proposal review, no-action/plan mode, selected-model security and ephemeral proposal state. Chat RPC currently has **no dedicated typed roadmap-creation-offer / confirm-generate** method and cannot treat a generic model output as user consent. |
| `RoadmapStore` / `RoadmapGreenfield` | Authoritative read, stable project/revision and existing creation/draft conflict checks; `beginImplementationPlan` / plan preview & reviewed projection and `begin` / `previewEdit` / `accept`. Existing `previewEditSequence` handles only 2–3 actions; `projectImplementationPlan` groups by dependency depth, **not explicit strategic phase sequence**. A full bounded strategic draft method is the smallest missing owner feature. |
| `ChatPanelWidget` / `ChatPanelController` | Single saved Chat with existing compact proposal controls and model selection; add stylized, accessible G3 offer/approve/reject UX to existing renderer rather than another Chat window or owner. |
| `planning-progress` event | Current stages `waiting`/`validating` and UI `Working…` are too coarse for a long roadmap-generation turn. Extend compatibly with truthful processing stages and cancel/retry, not fabricated model narration. |
| `RoadmapNavigationContribution` | Existing `dope.roadmap.open` command focuses the single main-editor canvas. Reuse plus project/draft refresh/viewport fit rather than create a second canvas. |
| `G1/G2 records` | G1 user supplied a source-bound single Chrome/local-Q4 GREEN turn, 32768 reference loaded, 27/27 focused tests; separate G2 commit message says Green. Neither proves any new G3 behavior. |

## Decision: split into five narrow T2 implementation prompts + one T3 manual closeout

| Prompt | Responsibility | Risk isolated |
| --- | --- | --- |
| P1 | Concise ordinary Chat and source-verified Roadmap opportunity / neutral offer (G3-A/B) | Model style and read-only state |
| P2 | A single typed, project-bound offer and dual explicit consent path (G3-C authorization only) | No unapproved generation |
| P3 | Bounded whole-strategic-draft model output and Greenfield preview/accept, review state (G3-C content) | Invalid output, stale writes |
| P4 | Truthful progress, cancel/error/recovery and existing central Roadmap focus, preserve Chat (G3-D) | UI/loading lifecycle |
| P5 | Cross-seam deterministic integration / security regression, narrow fixes only | Composition, existing owners |
| P6 | Manual Chrome/selected-Q4 real G3-A–D source-bound closeout; owner decision | Product-quality evidence |

**Execution gating:** Each implementation target <=8 minutes, soft 10/hard 15. Prefer single coherent short operation; stop/report if exceeding scope instead of broad opportunistic refactor. Because a full runner cannot pause after P2/P4 for live owner observation, use **individual authorized runs** with intermediate browser checks, not an unattended one-shot `npm run codex:phase -- c11-greenfield-g3`. `npm run codex:phase:validate -- c11-greenfield-g3` is local grammar validation only. P6 always manual/outside headless runner. Explicit owner Run separate from authorship; no `/activate`.

## Authority / negatives

Project/game source remains developer-owned; the G3 tool can **read Roadmap owner state**, create *one noncanonical draft after explicit approval*, and request existing editor navigation. No direct model arbitrary filesystem/network/shell tools, no automatic Work/agent Run, no silent hosted egress/selected-model fallback, no new Chat, Roadmap or plan store, no global model change. Test stale offer/owner revision, competing draft/pendingCreation, wrong Chat/project, dual clicks, ambiguous "yes", cancellation, restart, source drift, malformed/truncated model, permission/lease denial, keyboard/narrow and no duplicate publication. Current active project needs checked identity, not assumed no Roadmap because G1 lacked context. Existing automatic Greenfield semantic plan work and historical CP P8/P5 failures are outside scope, preserve bytes and dispositions.

**Disposition:** G3 assessed / authoring approved only. Phase 11 OPEN/NOT QUALIFIED, Phase 12 inactive. G3 cannot be declared Green without actual human-reviewed browser/local-model task and authoritative state proof.
