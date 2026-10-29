# /prompt-plan — c11-g3-recovery

**Date:** 2026-10-29 · **Status:** ASSESSED / PLANNED / PROMPTS AUTHORED (NOT RUN) · Version `0.11.8` unchanged · source reviewed on `main` through `c8c8bfe`; documentation commit `cef0fa3`. Prompt titles and order immutable after authoring. No Git branch / no package changes. Historical G1 single Q4 browser Green, G2 owner Green report, earlier CP Not Green, and existing `c11-greenfield-g3` prompts remain independently preserved.

## Four short loops; don't run full runner unattended

| Prompt | Product owner / source and bounded deliverable | Qualification stop |
| --- | --- | --- |
| **P1 — Intent and response-first extraction** | `ChatBackend` + small pure deterministic parser near `roadmap-local-model.ts`; `RoadmapGreenfield` preview phase-only safe path as needed; normal Chat grounding. From saved completed assistant phase sequence make one strategic review proposal without extra inference, speculative schedules or lost user requirements. Recoverable offer preflight. | Deterministic R1–R4 regression and a targeted native/manual smoke observation; do not advance on an unsafe parser. |
| **P2 — Message cards and history** | Reuse `ChatRoadmapAction` and `ChatRepository.recordRoadmapAction` already committed at `c8c8bfe`, existing `ChatPanelWidget/Controller`. Put typed card below source assistant reply, persist correct terminal outcome and no action widgets in composer; protect copy and drag-pan. | Focused saved Chat reopen / multi-chat / source binding + manual visual inspection. |
| **P3 — Canvas and lifecycle** | `RoadmapCanvasWidget` + `roadmap-canvas-model` and actual Chat->editor event; existing `dope.roadmap.open`. Numbered phases left-right, checkpoints grouped, secondary edges subdued, editor-only Accept/Reject, true parser stages and terminal failure/recovery, canonical no-write. | Focused graph and authority tests + real UI review in Chrome; Electron parity still separate. |
| **P4 — Manual G3 recovery closeout** | Actually operate Google Chrome AND Electron native on coherent exact source, same local Q4/model data where inference applies, correct project/owner state and exact saved transcript; record R1–R7 and human verdict. | Only Green when both clients genuinely pass and owner accepts scope; otherwise NOT GREEN / BLOCKED / EVIDENCE GAP. |

Each implementation prompt should target <=8 minutes if feasible, soft 10 / hard 15, narrow actual source and focused tests. This is a goal for the implementation work, **not a Roadmap delivery estimate**. A change too large to validate safely should stop with bounded evidence and follow-up, not invent a pass. Worktree may contain uncommitted owner changes; never reset/stash/clean/force-push/self-commit. Keep `npm run codex:phase:validate -- c11-g3-recovery` grammar separate from real run. Unattended `npm run codex:phase -- c11-g3-recovery` would run P1–P3 without owner-controlled stop; **run implementation prompts individually and conduct manual browser gates**, P4 always manual. The user can run these manually via Codex app. No `/activate`.

## Exact native acceptance scenario

Project request:
"I want to make a 2D tower defense game with PixiJS. Let's do a fixed enemy path. You collect money for killing enemies. Your main tower has persistent health throughout every wave. If your tower health reaches 0 you lose. You use your money to buy more towers and abilities."

Then natural turns:
- "Lets make a roadmap first"
- "lets make a roadmap"
- "Roadmap"

Replay without silently changing wording; in a completed workflow the first clear request should activate the tool, so **do not send subsequent repeated user requests merely to force an offer**. Preserve remaining historical transcript as counterexamples, testing each on independent safe Chat/fixture state. The previous model Roadmap response includes **Phase 1 Core Foundation (Weeks 1-2)**, Phase 2 Combat, Phase 3 Economy/Progression, Phase 4 Game State, Phase 5 Polish. The parser must remove unsupported Weeks labels from *draft presentation* without altering source Chat, recover phase order exactly, preserve supported bullets, and flag uncovered main-tower health/abilities if absent. It must not claim those systems already exist without file evidence.

## R1–R7 decision matrix

- **R1:** Natural developer intent leads to typed proposal or an explicit safe clarification when "Roadmap" is genuinely ambiguous.
- **R2:** No `models.generate` call for conversion of already-completed response; optional AI expansion is explicit, not default. Parser rejects ambiguous dual lists and truncated/quoted text rather than guessing.
- **R3:** No invented time estimates; explicit source user dates preserved, unsupported implementation claims avoided; all six developer decisions covered or flagged as uncovered (never silently fabricated).
- **R4:** Checked project, revision, Chat and lease; stale/double/foreign/expired offers denied; recoverable preflight does not strand user; canonical no-write.
- **R5/G3-E:** Card under owning saved assistant; offered->ready/failed/rejected/accepted history across new turn/reload, composer clean, copy/debug separation and drag panning.
- **R6:** Existing Roadmap opens upon authorized preview; ordered Phase N, grouped checkpoints, subdued secondary edges and editor-level review, no automatic linked Markdown.
- **R7:** **Native Electron and Chrome** operated on equivalent exact source and comparable project/owner state, with actual runtime bundle/selected model provenance; build success alone is insufficient.

Only R1–R7 all passed in real product are eligible for G3 scoped Green. An untestable native GUI, missing model or active project conflict is a recorded evidence gap, never a reason to erase failed history.
