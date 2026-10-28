# /prompt-ass — c11-greenfield-patch

**Date:** 2026-10-28 (America/Chicago). **Owner authorization:** `/prompt-ass + /prompt-plan + /prompt-write c11-greenfield-patch` after greenfield-first `/docs-review` / `/docs-apply` merged through PR #8. **Status:** AUTHORING ONLY; no implementation, Run, live GUI or Green claim. **Authoring reference:** GitHub `main` `0320536b45242c03546051061ae982651652d304`, unchanged manifest `0.11.8`. GitHub is not the developer's local worktree, running bundle or real game directory. New files only on `docs/c11-greenfield-patch`; do not change any historical P*.txt, closeout, Roadmap, product source or game files.

## User evidence and intended experience

The owner's actual tower-defense conversation:
- Turn G1: "Lets plan the start of a new project. I want to make a 2D tower defense game with pixi.js"
- Reply: repeatedly styled "Based on the project evidence provided" / "What I Can Confirm" / "Missing/Unknown Information" / "Next Steps"; claimed files not attached, treated `pixi.js` as an absent project file, listed missing Architecture/Physical Map, returned a generic checklist instead of an initial software design.
- Turn G2: "Okay I created our basic structure"
- Reply: repeated missing-file report, asked the developer to share structure rather than inspecting the open project.

This is **direct owner-reported human UX NOT GREEN**, not independently reproduced browser/selected-Q4 evidence. Neither the live model request, Chat/project attachment nor the actual game files have been inspected in this GitHub-only assessment. Do not claim the owner has a particular src layout or that the response template is hardcoded.

The [greenfield contract](../../planning/p11/greenfield-experience-contract.md) makes **G1 natural project brainstorming and G2 fresh attached-workspace inspection** the immediate Phase 11 priority, ahead of G3–G5 formal-plan/Bridge work. The real PixiJS game is persistent, developer-owned and not a fixture or allowed mutation target.

## Current-source evidence (verified in GitHub)

| Seam | Verified current behavior | Consequence / confidence |
| --- | --- | --- |
| `packages/theia-extension/src/node/chat-project-grounder.ts` `explicitPaths` / `ground` | Lexically treats any dotted `.js` token as a path candidate; `ground` attempts a read for `pixi.js`. Root directory listing is conditional on "repository root" / "project root" phrases or explicit path intent. | **Verified source mechanism**, plausible cause of false missing `pixi.js` and missed "created our structure". Do not claim it definitely caused the saved reply until real request refs are inspected. |
| `ChatProjectGrounder.ground` orientation | Default message foregrounds Architecture initialized/unavailable and Physical Map available/unavailable, even when the user has an ordinary empty project. | Can crowd out greenfield context; absence of map does **not** mean absence of project files. |
| `packages/theia-extension/src/node/chat-context-composer.ts` | `GROUNDED_CHAT_INSTRUCTION`: "Project facts are verified only when supported ... State what is missing or unknown." The composer prepends it, includes bounded Auto-context, prior Chat history when enabled, and source-hashed refs. | Preserve source truth while giving model explicit permission to suggest novel architectures and not repeat generic unavailable reporting. The repeated headings are **not proven** to be hardcoded by this instruction. |
| `packages/theia-extension/src/node/chat-backend.ts` | `runTurn` routes unbound ordinary Chat to `ground`; formal plan is activated only by `requestsImplementationPlan` requiring "Plan a..." plus "inspect" and "complete ordered implementation plan". `previewContext` uses the same separation. | Tower-defense G1 stays normal Chat as desired; **do not broaden this classifier** as part of G1/G2. |
| `packages/theia-extension/src/browser/chat-panel-widget.ts` | Chat attaches only if `WorkspaceService.roots` reports exactly one root; otherwise panel has undefined workspace, and root resolution has an explicit failure state. | Verify live attachment first; no-root or multi-root problems are separate from lexical grounding. |
| `ChatPanelController` / `ChatRepository` / `AIRoleRoutingService` | Saved messages, history, context, project-root attachment, writer leases, selected model, role route and hosted-data consent already exist. | Reuse. No new Chat owner, app-wide model defaults, unrestricted model tools or auto Work. |
| `test/unit/chat-project-grounding.test.ts` / `chat-context-composer.test.ts` / `chat-backend.test.ts` | Tests cover exact filename evidence, source hashes, safe paths, stale source and synthetic model routing. | Missing direct G1/G2 wording tests and actual selected local-model browser proof. |

## /prompt-ass decision

**Smallest split: P1 ordinary conversational source-truth/response contract, P2 fresh greenfield workspace evidence, P3 manual real-browser/local-Q4 closeout.** Two bounded headless changes, with an **owner-operated live G1 checkpoint after P1 and BEFORE P2**. This is deliberate: the normal headless runner would otherwise execute both implementation prompts without stopping for G1. For this campaign, run the implementation prompts **individually** under separate owner direction, not with one unattended `npm run codex:phase -- c11-greenfield-patch` invocation. `npm run codex:phase:validate -- c11-greenfield-patch` remains metadata validation, not execution. P3 is manual only, first repeating G1 then G2 on actual project; a failed G1 hard-stops G2 qualification. No initial code/database/Bridge redesign.

### Authorized source scope and limits

- **P1:** fix explicit file/technology path intent; tiny balanced grounding instruction; prevent absent map/Architecture from becoming a needless project blocker; tests for actual G1 text, explicit `src/game.ts` and `package.json` paths, project safety and ordinary Chat routing. No new prompt template, invisible acceptance schema or extra model call.
- **G1 manual pause:** actual selected local Q4 in live saved Chat, exact owner text, inspect Auto context and natural response. Owner says whether the result is useful; if NOT GREEN, stop, report exact evidence and **do not execute P2**.
- **P2:** deterministic bounded current root listing/manifest/source-orientation appropriate for a newly created project, triggered by natural structural-change follow-up and optionally small attached-project orientation; ensure previewContext and runTurn match; preserve source hash/provenance, no full scan / new authority / hidden docs; focused tests for new files after prior turn, unknown/ambiguous root, project switch, egress and truncation.
- **P3:** manual actual Codex browser + selected loaded local Q4 (reference Qwen3-Coder 30B A3B Q4_K_M `32768` if actually loaded), read-only G1/G2 on owner game when safe, disposable fixtures for any simulated edits or security negatives; precise source-bound separate gates, no fabricated results.

Avoid codebase-wide test passes during P1/P2; run focused tests after correct package lib compilation. Final aggregate only if actual G1/G2 succeeded on one coherent product source, or report explicitly NOT RUN. Never cite a synthetic model reply as a real G1 pass.

## Protected boundaries

Keep exact `0.11.8` version, existing named ChatPanel/Backend/Grounder/Composer/Repository, project isolation, symlink/traversal denial, `.dope` private state, bounded reads/token budget and source references, provider selection/egress consent, cancel/retry, lease exclusivity, no implicit Roadmap/Markdown/Work mutation. No self-commit (runner or owner handles review/commit), reset/stash/clean/force-push, altered historical prompts/qualifications or owner game-source writes. Historical CP P8 and CP-recovery P5 remain NOT GREEN; earlier uncommitted Checkpoint One edits must be inspected and preserved rather than assumed lost or overwritten. A version/source conflict stops for owner review; it is not a reason to downgrade.

**Status:** ASSESSED and recommended for separate, manual owner-controlled execution. Phase 11 remains OPEN / NOT QUALIFIED, Phase 12 inactive.
