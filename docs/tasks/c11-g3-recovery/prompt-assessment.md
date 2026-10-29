# /prompt-ass — c11-g3-recovery

**Owner-approved date:** 2026-10-29. **Documentation authoring only**; source implementation, local product build, browser run and final Green are NOT represented by this stack. **Target:** Dope IDE Phase 11, fixed `0.11.8`, original app source assessed at `57bf7267`, refreshed to **`c8c8bfe`** before documentation apply and `cef0fa3` after six docs updates. Latest real owner native Electron screenshot/transcript and source inspection are evidence; actual native binary ID, dirty worktree and loaded model are unknown. **No additional Git branch:** author/commit to `main` per owner direction. Existing `c11-greenfield-g3` P1–P6 and `c11-greenfield-patch` P1–P3 are immutable, NOT superseded in place.

[Owner contract](../../planning/p11/greenfield-experience-contract.md) · [R1–R7](../../planning/p11/panel-usability-matrix.md) · [UX-020](../../planning/p11/usability-issue-ledger.md) · [ADR 0025](../../decisions/0025-durable-project-chat-and-chatpanel-ai-presence.md) · [ADR 0036](../../decisions/0036-unified-roadmap-and-local-first-ai-planning.md).

## Why this is needed — exact owner experience

- Natural user requests **"Lets make a roadmap first"**, **"lets make a roadmap"**, then **"Roadmap"** in a saved Chat return progressively different prose roadmaps rather than reliably opening the project-bound Roadmap creation action.
- The local Q4 response contains roadmap phases and requirements but also invented calendar week ranges, unsupported assertions that intended systems are already implemented, and incomplete requirements (e.g. game health and abilities).
- A manual native Roadmap offer successfully opened the existing Roadmap editor but showed an empty graph with **"Select an exact local model for strategic Roadmap generation"**. Chat was **Follow Interactive**, though prior complete assistant message records actual local Q4 model. After failed generation the editor showed "Generating Roadmap" with an error.
- Earlier visual capture showed dense milestone/dependency connectors; phase numbering now exists in `roadmap-canvas-model.ts`, but its actual native readibility is unqualified. Canvas-first proposal Accept/Reject exists in `RoadmapCanvasWidget`, but end-to-end acceptance has not passed on native.
- Chrome qualification and simulated model checks established limited paths, not Electron parity; a passing browser build or 800+ tests does not make the native G3 workflow Green.

## Source findings: preserve existing implementation

| Source seam | Evidence / needed correction |
| --- | --- |
| `ChatBackend.offerRoadmap` | Short regex requires assistant "roadmap" and "draft" or exact narrow user phrase; user intent path too weak. |
| `ChatBackend.decideRoadmapOffer` | Consumes pending offer before validating model, then invokes `models.generate` for strict JSON even when saved assistant already contains phase sequence. Replace common path with zero extra inference. |
| `ChatBackend.runTurn` | Exact "Yes, create the roadmap" branches to offer; other natural requests go through model. Need contextual intent and no false authorization. |
| `chat-project-grounder.ts` + `chat-context-composer.ts` | Grounding is bounded, sometimes only orientation. Project *desires* are not evidence of implemented source. Source-backed claims remain mandatory. |
| `packages/chat/src/index.ts` / `node/chat-repository.ts` | **Already committed at `c8c8bfe`**: typed `ChatRoadmapAction` on saved assistant and repository action persistence. Extend/synchronize, never replace/duplicate. |
| `chat-panel-widget.ts` | `roadmapActionCard(message)` exists under assistant message after `c8c8bfe`. Verify no leftover Roadmap cards, status or acceptance controls in composer and durable lifecycle. |
| `RoadmapGreenfield.previewStrategicDraft` | Validated project/revision-bound noncanonical preview and explicit Accept; current `StrategicDraftInput` requires 2–32 phases and **1–16 checkpoints/phase**. A phase-only parsed list cannot be passed as invented checkpoints. Add narrow reviewed phase-only path or explicit partial-review diagnostics while maintaining canonical publication completeness. |
| `RoadmapCanvasWidget` / `roadmap-canvas-model.ts` | Proposed canvas and Accept/Reject exist; visible "Phase N" already derived from array order. Reuse. Need live connector clarity, terminal failure, no fake inference spinner and native parity. |
| `ChatService` | Existing streamed progress, typed offer/draft and selected model. Parser default need not resolve exact local model; optional expansion requires deliberate selection + verified model provenance. |

## Issues and division of labor

**Loop 1 — P1: intent + response-first parser** (G3-01/02/03/04/09/10/11). Detect intent from developer utterance and saved context; select exact completed response, parse strategic ordered phases once, filter unsourced week estimates, preserve source messages, show uncovered requirements, avoid second inference and exact model dependency. Backend/Greenfield tests before UI. No aggressive untrusted regex authorization.

**Loop 2 — P2: message action and persistence** (G3-05/06). Extend already-committed typed action history to anchor exact source assistant, survive reload, use clean composer, keep no-replay. Small Chat schema/service/renderer integration changes only.

**Loop 3 — P3: canvas review and recovery** (G3-07/08/13). Show preacceptance numbered phases and grouped checkpoints, Accept/Reject on existing editor, terminal failure state not misleading, preserve data edges and separate Markdown publication.

**Loop 4 — P4: independent Codex Chrome qualification and owner native handoff** (G3-12 and R1–R7). Each P1–P3 must already PASS its real Codex Chrome gate. P4 replays the exact conversation end-to-end in Chrome, records R1–R6 and R7 browser source evidence, and supplies an actionable manual Electron checklist for the owner. Codex has NO native GUI control on the owner's machine. The owner tests native AFTER all Chrome loops pass; R7 parity and full G3 remain pending until that evidence is reviewed. Negative tests use disposable workspace. No self-commits or version changes. Four prompts, P4 is the Chrome closeout only.

**Owner execution correction (2026-10-29):** All four authored prompts require a **real Google Chrome test via Codex browser** and an independent PASS before manually launching the next. Browser required=yes in P1–P4. Do not substitute mocks or a browser build. No Codex native Electron computer use is available; owner operates native only after all Chrome passes. A Chrome-qualified P4 is not R7 parity or full G3 Green. This amends prior authored execution assumptions at the user's request before starting the loops.

## Security and scope guards

Use only current authoritative `RoadmapStore` / `RoadmapGreenfield` and existing Chat owner; no arbitrary LLM shell/network/file tools, Work executions or hosted egress without permission. Permission to prepare a proposal is not approval of draft content or canonical Markdown creation; no new store, ChatPanel or standalone editor. Bind source message ID, source content hash, project identity, owner revision, Chat writer lease and proposal token. Safe retry model check does not permit double execution. All responsive progress stages reflect actual code work. Native Electron tests are still REQUIRED for full Green, but are exclusively **owner-operated after all four Chrome gates pass**; before owner evidence arrives, report NATIVE PENDING/EVIDENCE GAP rather than treating Chrome as native parity. Full old Phase 11 status remains OPEN / NOT QUALIFIED.
