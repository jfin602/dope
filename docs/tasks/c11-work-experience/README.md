# c11-work-experience — Polished Work and formatted AgentRun transcripts

**Status (2026-10-18/19):** Owner-approved documentation contract; `/prompt-ass + /prompt-plan + /prompt-write` authored **ONLY on dedicated Git branch** [`docs/c11-work-experience`](https://github.com/jfin602/dope/tree/docs/c11-work-experience). Baseline main `c0b3771902918bd34dd25aa93a23d5a913ebca0d`, root manifest `0.11.8`. **NOT RUN / NOT IMPLEMENTED / NOT QUALIFIED.** Phase 11 OPEN / NOT QUALIFIED; Phase 12 inactive.

**Goal:** Make existing Work understandable and polished while keeping actual source-backed state, required validation, grants, dirty-worktree denial, candidate review and manual qualification honest. Improve existing AgentRun sanitized Markdown presentation and compact expandable tools, not a second Chat/Work/runtime/transcript store.

| Prompt | Outcome | Tier | Model | GUI |
| --- | --- | --- | --- | --- |
| [P1](P1-work-state-hierarchy.txt) | Pure authoritative Work status / next-action selector, separate validation/drift states | T2 | GPT-6 Sol High | no |
| [P2](P2-work-detail-controls.txt) | Structured Work detail and contextual recovery, grant, validation and review | T2 | GPT-6 Sol High | no |
| [P3](P3-transcript-markdown.txt) | Existing safe Markdown transcript readability and compact command/output | T2 | GPT-6 Sol High | no |
| [P4](P4-work-visual-polish.txt) | Neutral theme, responsive spacing, keyboard, accessibility and scroll | T1/T2 | GPT-6 Sol Medium | no |
| [P5](P5-work-integration-regressions.txt) | Work/History/Phase Focus/Bridge, renderer, persistence and authority regression coverage | T2 | GPT-6 Sol High | no |
| [P6](P6-manual-work-experience-closeout.txt) | Actual browser and available independent Electron W1–W10 final closeout | T3 | GPT-6 Sol High | **manual** |

**Authoritative documents:** [Owner-approved UX contract](../../planning/p11/work-experience-contract.md), [assessment](prompt-assessment.md), [plan](implementation-plan.md), Phase 11 plan, ADR 0030/0037/0038 and docs/workflow.md. The existing `c11-bridge-repair` P5 status **NOT GREEN** and historical P15/Phase Focus failures are untouched, even though the Bridge's latest full aggregate passed. The Work correction does not solve unqualified Bridge D5–D8 on its own.

**Code seams inspected on GitHub:** `packages/theia-extension/src/browser/chat-panel-widget.ts` (`renderWork`), `work-selection-controller.ts`, `phase-stack-controller.ts`, `agent-transcript-widget.ts`, `work-transcript-presentation.ts`, `untrusted-message-markdown.ts`, `shared-panel-state.ts`, `dope.css`, `frontend-module.ts`; agent/runtime types in `packages/agent-core` and `packages/contracts`. Exact local paths, source versions and test names must be refreshed at Run time.

**Execution authority:** Writing the stack is not running it. Inspect actual developer checkout HEAD, dirty tree and uncommitted Bridge overlap before merging/cherry-picking this branch; do not overwrite/stash/reset/clean owner work. Validate locally with `npm run codex:phase:validate -- c11-work-experience`. A separate explicit developer Run authorizes **only P1–P5** headless implementation; P6 is **manual** with direct GUI evidence outside the runner. No `/activate`, no agent self-commit, no package/lockfile/version bump. If actual version is not `0.11.8`, stop and re-assess; never roll back. Fixed authored P1–P6 order; after authoring, no silent reorder/rewrite. Focused implementation prompts <=8m target/15m hard, real checks; manual P6 distinct.

**Security/qualification:** No new Work/Chat/History owner or model/provider, no silent hosted project-data transfer, no fake validation/Green, no script/HTML/image/remote fetch from untrusted prose, no secrets/hidden reasoning, no drifting snapshot/foreign project bypass. W1–W10 are correction-scope gates **not** Phase 11 closure. Keep two broad distinct clean Hunts, D1–D8, manual qualification and explicit owner decision outstanding. No root linked `ROADMAP.md` update is authorized by prompt authorship.
