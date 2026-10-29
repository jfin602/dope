# /prompt-ass — c11-roadmap-redesign-v2 pending Gate-to-Work expansion

**Date:** 2026-10-29. **Disposition:** OWNER-APPROVED FUTURE PROMPT SOURCE SUPERSESSION; P1–P7 remain untouched/locally reported completed; P8+ not yet started. Product `0.11.8`. [README](README.md) and [lineage](pending-prompt-supersession-2026-10-29.md).

## Source-backed findings

- `packages/theia-extension/src/browser/roadmap-inspector-model.ts` contains `prepareWork()` and forwards selected checkpoint source scope to the existing Planning Map controller; V2 must change this to exact Gate identity.
- `packages/theia-extension/src/browser/planning-map-controller.ts` already exposes scope approval, `prepareStackOutline`, reordering, publication preview/publish and `launchWorkItem` with separate validation approval. These are implementation seams, **not proof of end-to-end GUI qualification**.
- `packages/theia-extension/src/node/visual-planning-backend.ts` contains `stackOutline`, `previewStackPublication`, `publishStack` and `PlanningTargetReview`; `packages/agent-core/src/phase-stack-composer.ts` composes runner-grammar P*.txt and final manual closeout from ready WorkItems.
- `packages/theia-extension/src/node/planning-stack-publication.ts` validates exact source/Git/revision and explicitly approved publication. Publishing a prompt stack does not Run or qualify its Gate.
- `PlanningMapController.launchWork()` uses `AgentRuntimeService.launchWorkItem` with selected coding agent policy, accepted validation command and existing Work grant/candidate authority. Local Pi is **not** currently installed as an integrated Dope agent; Phase 12 ADR 0039 defines that runtime only.
- Historical Planning Bridge closeout reported non-Green cross-owner Prepare Work handoff and incomplete live stack/Work journey. Existing class/method presence is not qualified GUI functionality; P15–P23 must test actual owner mapping and execution.
- `scripts/codex-phase.mjs` rejects changes to first-authored P*.txt source per **filename**, and `detectCompletedPromptPrefix` recognizes exact chronological correction prompt subjects. Editing pending P8–P19 in place would break resume; replacing **unstarted filenames** while retaining P numbers and completed P1–P7 sources obeys both rules.

## Requirement refinement

**Control-center principle:** A selected accepted Gate is the origin of planned implementation. It supplies qualification criteria and current evidence, and its Prepare Work action must create/reuse the *existing* scoped Planning Map/WorkItem/stack/Work pathway. This is not a new second task or qualification owner. Correctly handle separate Roadmap project ID and Planning collection owner ID.

**Scope layers:** Gate defines *why/what must pass*; Planning Map describes current/target architecture where needed; WorkItem describes *implementation scope/dependencies/validation*; Prompt Stack is *immutable executable representation*; Work runtime operates under separate grants; evidence/candidate/test/reconciliation update eligibility but never auto-Green on work completion. One Gate may map to many WorkItems/stacks; one WorkItem may support multiple criteria with explicit source references.

**Pi direction:** No Pi-only path in v2, no auto package installation, no provider default switch. Keep current agent execution via selected AI Center policy and Dope-owned broker; Phase 12 Pi will later consume the same task/prompt/grant contract. Do not conflate prompt-generation model `GPT-6 Sol` recommendation with coding agent runtime selection.

**Minimal workflow:** No new direct Quick Work implementation by default; when architecture analysis is not needed, show a truthful applicable existing fast-lane/architecture-N/A decision if supported. Do not bypass scope/source review or invent a quick path. Gate->Planning Map must work for architectural work now.

## Prompt decomposition decision

Retain P8–P13 original thematic boundaries with explicit Gate relationships; keep P14 manual first real UI check and exact title for runner resume. Add separate P15 Gate→Bridge, P16 ready WorkItems, P17 prompt composer, P18 approved publication/Work handoff, P19 evidence/status, P20 existing Help, P21 alpha cleanup, P22 integrated regression; final manual Chrome P23. This prevents overloading P18 with a previously unimplemented entire Work lifecycle. Every runner prompt has a focused source-bound deliverable; P14 and P23 require real Chrome. No repeated full check before P22.

**Risk:** Local P1–P7 commits may be ahead of GitHub remote `main`; do not reset/rewrite their SHA or assert they are published. After this docs commit, safely merge remote docs into local committed work, inspect source conflicts, run validator and confirm the runner detects P1–P7 as a completed Git prefix before P8.

## Exclusions

Do not rewrite started P1–P7, install Pi or create direct Pi tool grants, create a second Chat/Planning Map/Work/Roadmap owner, invent Gate evidence, auto publish/Run, silently migrate broken alpha schema, alter linked Markdown without approved patch, or relabel historical NOT GREEN. Documentation changes alone do not qualify or run anything.
