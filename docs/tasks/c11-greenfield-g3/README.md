# c11-greenfield-g3 — Conversational Roadmap creation after G1/G2

**Status (2026-10-28/29): ASSESSED / PLANNED / PROMPTS AUTHORED ONLY — NOT RUN, IMPLEMENTED OR QUALIFIED BY THIS STACK.**
**Name:** This is a NEW Phase 11 G3 follow-on correction. The owner requested the command under `c11-greenfield-patch`, but that old stack has immutable P1–P3 and final closeout; preserve it unchanged. This new independent runner-compatible stack is `c11-greenfield-g3`.

**Authoring basis:** GitHub `main` `c947700a6e57f81a40d43a256fe6814c55a18ea4`, version `0.11.8`, after owner-reported G2 completion (`afa221a` commit "greenfiled G2: Green") and G3 design merged by [PR #10](https://github.com/jfin602/dope/pull/10). Actual developer local state and the G2 Chrome/Q4 evidence not independently inspected here. [Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [G3 contract](../../planning/p11/greenfield-experience-contract.md) · [UX-020](../../planning/p11/usability-issue-ledger.md).

## Fixed, immutable prompt order

| Prompt | Focus | Mode |
| --- | --- | --- |
| [P1](P1-concise-roadmap-offer.txt) | Brief ordinary Chat and checked Roadmap opportunity | GPT-6 Sol High / T2 |
| [P2](P2-dual-consent.txt) | One approved typed offer via UI button or matched "yes" | GPT-6 Sol High / T2 |
| [P3](P3-whole-strategic-draft.txt) | Bounded multi-phase model generation + separately reviewed noncanonical draft | GPT-6 Sol High / T2 |
| [P4](P4-progress-editor-handoff.txt) | Real progress/cancel/error and existing main Roadmap editor focus | GPT-6 Sol High / T2 |
| [P5](P5-cross-seam-regressions.txt) | Direct integration and permission/security regression | GPT-6 Sol High / T2 |
| [P6](P6-manual-g3-closeout.txt) | Real selected local-Q4 / Codex-Chrome G3-A–D source-bound closeout | GPT-6 Sol High / **MANUAL browser** |

## Execution and review

Run `npm run codex:phase:validate -- c11-greenfield-g3` **locally** to check metadata; authoring does not run that command. A distinct developer authorization is required to run any prompt. The standard `npm run codex:phase -- c11-greenfield-g3` invokes all headless P1–P5 in order and does **not** pause for owner browser review; if maintaining the manual early product gates as agreed, run P1/P2/P3/P4/P5 **individually** with Codex (no agent self-commit). No mandatory `/activate`. P6 always manual via real Chrome/local Q4. Implementation target <=8 minutes/prompt, soft 10/hard 15. Stop on unknown dependency or observed failure rather than pressing through to pass final tests. Authored P*.txt bytes/order fixed; new changes require distinct reviewed continuation/supersession and new source fingerprint, not in-place edits.

After P1 make an early browser G3-A/B check. After P2 test actual button/explicit text/ambiguous denial with safe fixtures before P3. P3/P4 need a user-visible real generation preview and progress. P5 focuses safety tests. P6 records final source-bound results; correction only Green if the owner independently observes all four live gates, no critical safety gap.

**Non-goals:** no forced Roadmap when user brainstorms, no duplicate if existing Roadmap/draft, no model arbitrary tools/Work/hosted fallback, no second Chat/plan database, no premature `ROADMAP.md` publication, no edits to historical `c11-greenfield-patch` P1–P3 or its qualification evidence, no tower-defense file modifications without explicit owner approval, no root version bump, Phase 11 still OPEN/NOT QUALIFIED and Phase 12 inactive.
