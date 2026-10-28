# c11-greenfield-patch — Natural Chat and live project awareness

**Status (2026-10-28): ASSESSED / PLANNED / PROMPTS AUTHORED ONLY — NOT IMPLEMENTED, RUN, OR QUALIFIED.** Owner requested `/prompt-ass + /prompt-plan + /prompt-write c11-greenfield-patch` after GitHub PR #8 approved [greenfield-first Phase 11](../../planning/p11/greenfield-experience-contract.md). This is a **small existing-Chat correction**, not a reimplementation of structured planning or a new planning/chat system. Phase 11 remains OPEN/NOT QUALIFIED, Phase 12 inactive.

**Source authoring basis:** GitHub `main` `0320536b45242c03546051061ae982651652d304`, unchanged manifest `0.11.8`. Authoring branch `docs/c11-greenfield-patch`; no local checkout, dirty user changes, running Dope browser/model or game project tree have been inspected. Older historical CP P8 and P5 NOT GREEN evidence remains immutable. The separate manual Checkpoint One source was reported uncommitted in October; verify real local state rather than overriding it.

[Assessment](prompt-assessment.md) · [Implementation plan](implementation-plan.md) · [G1/G2 contract](../../planning/p11/greenfield-experience-contract.md) · [ADR 0025](../../decisions/0025-durable-project-chat-and-chatpanel-ai-presence.md) · [UX-018/019](../../planning/p11/usability-issue-ledger.md)

## Immutable prompt sequence

| Prompt | Owner and scope | Mode | Evidence |
| --- | --- | --- | --- |
| [P1](P1-natural-greenfield-chat.txt) | Ordinary Chat path-vs-library interpretation; natural evidence-balanced model instruction, G1 focused tests | GPT-6 Sol High, headless | **Then stop for real-browser G1 owner review before P2** |
| [P2](P2-fresh-workspace-awareness.txt) | Bounded fresh active workspace root/manifest/source orientation on natural change messages; G2 focused/security tests | GPT-6 Sol High, headless | Only after owner confirms G1 PASS |
| [P3](P3-manual-greenfield-closeout.txt) | Real selected local-Q4, saved Chat, Codex-browser G1/G2 replay and source-bound closeout | GPT-6 Sol High, **manual** | No headless auto-run, no Phase 11 full Green |

## IMPORTANT: manual execution / G1 pause

This stack uses the runner's **source grammar** but **not unattended phase execution**. `npm run codex:phase:validate -- c11-greenfield-patch` checks metadata (when run locally with available tools); writing this stack does not run that command. The ordinary `npm run codex:phase -- c11-greenfield-patch` executes implementation P1 and P2 consecutively and **cannot enforce the user-required G1 browser pause**, so **do not invoke that unattended command** for this campaign.

1. After a separate owner implementation authorization and local preflight, run **P1 only**, manually through the existing Codex agent with these unchanged prompt bytes. No self-commit, no destructive git actions, no silent provider change.
2. Owner operates the real Dope browser with the selected loaded local model and exact G1 phrase, checks source context and actual response. If G1 fails, **stop**; do not execute P2 or rewrite P1 in place. Record findings separately.
3. After explicit owner G1 PASS/continue decision, run **P2 only**, then operate G2 from the same saved Chat with actual current source evidence. If blocked/failed, stop. Any file-creation/security negative should use disposable twin instead of owner game.
4. Finally run **P3 manually** on source-exact coherent product after both changes; independently record G1, G2, adjacent regressions and any missing evidence. The correction can be scoped Green only with direct live evidence and human acceptance, not only deterministic tests or output shape.

P1 and P2 implementation targets <=8 minutes, soft limit 10, hard stop 15. P3 manual GUI observation is not an implementation prompt or automatic runner task. No `/activate` gate. Authored P*.txt filenames/text/order must never be edited in place once written; revisions use explicit reviewed supersession/provenance.

## Safety and non-goals

- Preserve `ChatPanelWidget/Controller`, `ChatBackend`, `ChatContextComposer`, `ChatProjectGrounder`, `ChatRepository`, model routing and saved refs. Reuse existing read-only APIs; keep source hash, root containment, `.dope` exclusion, lease, project ID, token caps, cancellation and hosted egress consent.
- Do not change formal planning intent classifier, `RoadmapGreenfield`, Architecture/Physical Map authority, Planning Bridge, Work, prompts/runner or model defaults. Ordinary "let's plan a game" remains conversational; no implicit JSON, proposals or canonical writes.
- The developer's own PixiJS game is **not** a disposable fixture. Chat may only read it with existing authorized project context; do not write or reset it. Separate adversarial fixtures only in temporary disposable roots. No assumptions about existing game file names.
- Do not alter `package.json`, workspace versions, internal pins/lockfiles, Phase 11 status or historical qualification; no reset/stash/clean/force-push, no agent self-commit. Stop if actual local worktree/source/version conflicts with the preflight basis.
- P3 alone can add a new observed evidence record, and only once real observations exist. This prompt authoring is **not an execution permission**.

**Result to pursue:** Dope talks naturally about building a game before source exists, then detects and discusses real files when the developer adds them. The human developer stays in control.
