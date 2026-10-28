# /prompt-plan — c11-greenfield-patch

**Date:** 2026-10-28. **Status:** three authored prompts planned, NOT RUN or GUI-qualified. Source reference GitHub `main` `0320536b45242c03546051061ae982651652d304`, project version `0.11.8`. The owner's actual local repository and game tree are unobserved by authoring. [Assessment](prompt-assessment.md), [Greenfield experience contract](../../planning/p11/greenfield-experience-contract.md), [UX-018/UX-019](../../planning/p11/usability-issue-ledger.md).

## User journey

The developer opens the REAL persistent PixiJS tower-defense project and asks:
1. "Lets plan the start of a new project. I want to make a 2D tower defense game with pixi.js"
2. After the developer created structure: "Okay I created our basic structure"

G1 success = useful provisional small-playable-slice architecture, reasoning, and meaningful next decision without claiming nonexistent files or treating missing source/Architecture/Map as an obstacle to designing. G2 success = current attached project files/manifests genuinely observed and used in the reply; correct recovery if actual attachment/read unavailable. Both remain ordinary saved Chat; neither automatically creates a formal plan, roadmap node, Work grant or file edit. Other response styles are allowed; no hardcoded exact phrases.

## Minimal implementation and verification sequence

| Prompt/gate | Code owner / work | Verification and hard stop |
| --- | --- | --- |
| **P1 — Greenfield conversational behavior** | `ChatProjectGrounder.explicitPaths/ground`: distinguish explicit filename requests from technology/library references; preserve path safety, legitimate missing file and existing-file evidence. `ChatContextComposer.GROUNDED_CHAT_INSTRUCTION`: distinguish source facts from provisional recommendations and avoid gratuitous missing-map reports. Preserve model, routing and context owner. | Focused parser/grounder/composer/ChatBackend tests using literal G1 text and `Read src/game.ts`/`package.json` controls. **Then manual owner live G1 in actual browser/Q4 before authorizing P2.** If NOT GREEN, stop/review P1; no automatic runner progression. |
| **P2 — Current project-structure awareness** | `ChatProjectGrounder.ground` plus only necessary `ChatBackend`/`ChatContextComposer` integration: small current root snapshot + bounded config and relevant source reads after structure-change utterance. Preserve actual source refs and no-root/multi-root diagnostics from existing widget/lease. Do not add model tool-calling or globally scan source. | Focused tests for G2 phrasing with files added between turns, no source as distinct state, fixture B isolation, symlink/`.dope`/hidden exclusions, manifest-version proof, source hashes, context budget and hosted consent. |
| **P3 — Real browser G1/G2 closeout** | Manual only; existing saved Chat, actual local Q4 and Codex browser. Inspect workspace binding and precise Auto context, reproduce exact messages, measure model outcome/continuity, no game writes. | G1 owner-reviewed first; G2 only if G1 passed. Disposition each independently PASS/FAIL/BLOCKED/EVIDENCE GAP/NOT RUN. Full aggregate once, only after successful live gates and exact-source coherence; no fake Phase 11 Green. |

**Crucial sequencing:** `npm run codex:phase:validate -- c11-greenfield-patch` is allowed for source/metadata validation. The ordinary `npm run codex:phase -- c11-greenfield-patch` automatically runs P1 and P2 headless; that **does not honor the required manual G1 pause**, so don't use unattended full-stack execution here. Owner separately launches P1; reads/observes its G1 browser outcome and authorizes P2 only after passing. P3 manual closeout repeats both gates on the resulting source. Authored P*.txt remain immutable; a failed gate is repaired only through a separately reviewed unstarted supersession or follow-up, not edited in place. Each headless implementation targets <=8 minutes (10 soft, hard 15); split further only with explicit owner review.

## Focused test matrix

- G1: literal lowercase `pixi.js`; alternate technology/library names; existing user-written file `src/game.ts` (including punctuated path), legitimate `package.json` explicit read, true missing file fact vs "not inspected" and blocked traversal/hidden files.
- G1: no mandatory "What I Can Confirm"/"Missing" reply schema; no fabricated project claims, normal model provider/role, Chat history preserved, no Roadmap/Work activity on exploratory messages.
- G2: root existed empty -> source/`package.json` created externally -> next turn sees fresh directory and source hashes; correct no-root/multi-root and no actual files; no unsupported "workspace files are not attached" default.
- G2: deep/large directories, budget/truncation, symlink escape, `.dope` secrets, wrong-project Chat binding, retry/source drift, no unsafe extra hosted transfer or provider fallback.
- Cross-seam: exactly what `previewContext` previews should be used by `runTurn`; saved Auto context refs match evidence actually supplied; no stale-source invented facts; previous selected Roadmap Help/planning flows are unchanged.

## Acceptance and product ownership

**G1:** local-model response is concrete and useful with no existing-code prerequisite; real Chat mode, correct selected model; no fabricated `pixi.js` file claim or forced formal JSON. **G2:** assistant sees the actual game project structure as of the new turn, cites real current files and adjusts the conversation. If the owner game cannot be safely inspected or Chat is not attached, report accurate BLOCKED/EVIDENCE GAP and use a disposable twin only for mechanics; never pass real-project G2 from a substitute alone.

Prior CP and Phase 11 outcomes stay intact. No automatic linked Markdown, Roadmap change, agent Run or game-source mutation. No project-wide runtime/Architecture/Bridge redesign. Explicit human approval required for implementation and qualification, and separate merge approval for docs branch.

## Evidence handoff

At each executed prompt report starting Git HEAD/dirty state, touched source/test files, exact commands and outcomes, selected provider and model if tested, Auto-context IDs/content hash and actual browser response, risk/uncertainty and STOP condition. P3 may create a new source-bound `docs/tasks/c11-greenfield-patch/qualification.md` only **after** a real run, preserving any existing owner-authored record; do not pre-author a passing closeout.
