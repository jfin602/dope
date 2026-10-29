# c11-g3-recovery — Native Roadmap creation recovery

**Status:** DOCS ONLY / ASSESSED + PLANNED + AUTHORING; NOT IMPLEMENTED OR QUALIFIED by these prompts. Owner approved 2026-10-29 `/docs-apply + /prompt-ass + /prompt-plan + /prompt-write c11-g3-recovery`, targeting `main` directly (no Git branch). Source rechecked `c8c8bfe` / `0.11.8` with prior G3 action-history implementation. [Assessment](prompt-assessment.md) · [Plan](implementation-plan.md) · [G3 contract](../../planning/p11/greenfield-experience-contract.md) · [R1–R7](../../planning/p11/panel-usability-matrix.md) · [UX-020](../../planning/p11/usability-issue-ledger.md).

## Immutable ordered prompts

| Task | Purpose | Runtime |
| --- | --- | --- |
| [P1](P1-intent-response-extraction.txt) | Natural Roadmap intent, parse source answer without second Q4 call, no invented schedules, requirements coverage, safe offer | Sol High, implementation |
| [P2](P2-message-action-history.txt) | Reuse persisted `ChatRoadmapAction`, message-attached cards, composer cleanup, history | Sol High, implementation |
| [P3](P3-canvas-review-recovery.txt) | Existing canvas Phase N, visual review/accept-reject, accurate failure/recovery | Sol High, implementation |
| [P4](P4-native-chrome-closeout.txt) | Direct real Chrome + Electron R1–R7 qualification and independent closeout | Sol High, MANUAL browser + native |

## How to run safely

1. In updated checkout, inspect real `git status --short` and `git log -1 --oneline`; protect local G3 and game changes. Check `npm run codex:phase:validate -- c11-g3-recovery` locally. This author used connected GitHub for source inspection and **has not executed that local validator or built the app**.
2. The default runner `npm run codex:phase -- c11-g3-recovery` runs P1–P3 headlessly **without a stop between human checks**; don't use it as unattended GREEN. Run each P1/P2/P3 individually with Codex Sol High and perform real UI observation between them. P4 requires manual browser and actual Electron operation; no automatic runner approximation.
3. Keep original G1/G2 greenfield and authored `c11-greenfield-g3` prompt files untouched. No self-commit, version change, /activate gate, forced native Electron fallback, invented phase time estimates, or mutation of owner's persistent tower-defense source for negative tests.

**Status truth:** G3 owner-observed NOT GREEN; Phase 11 OPEN/NOT QUALIFIED; current docs are forward requirements, not evidence that Loop 1–4 fixes are present.
