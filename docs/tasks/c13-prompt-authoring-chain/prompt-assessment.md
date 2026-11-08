# /prompt-ass — c13-prompt-authoring-chain

**Disposition:** ASSESSMENT FOR DOCUMENTATION REVIEW ONLY. Source: GitHub `main` commit `7e5e3745` and saved owner direction on 2026-11-08; no local source test, build or browser qualification is claimed.

## Scope and source observations
The owner requires one named, persistent assessment→plan→write draft rather than three unrelated Chat Markdown artifacts. Input changes to `/prompt-ass <name> <task details>`. The selected name is the final task folder slug; assessment/plan cards populate `/prompt-plan` or `/prompt-write` plus a bound contextual chip in the composer, with optional notes before submit. Intermediate data should live within a protected task-related draft area and be retrieved in bounded structures rather than repeated full Markdown model context.

Current source inspected in GitHub: `packages/theia-extension/src/node/prompt-authoring-stage.ts` generates complete Markdown for assessment/plan and injects selected prior draft bodies (up to 12,000 characters each) into later instructions. `chat-backend.ts` uses selected saved draft messages as source-bound identities. `incremental-proposal-controller.ts`, `incremental-prompt-stack.ts`, `proposal-model-tools.ts` and the Pi worker provide protected prompt staging; `planning-stack-publication.ts` and `prompt-stack-proposal.ts` guard final publication. `docs/workflow.md` defines the three-stage decomposition and mandatory ten Prompt Efficiency Gates. These are implementation entry points, not evidence that the proposed new chain already exists.

## Preservation and authority
Retain Pi tool broker reads, source provenance/ranged late reads, project/worktree/owner/lease bounds, idempotent stages, real native read-only proposal tabs, existing Chat repository ownership, guarded R3B publisher, exact approval and source checks, and no Work/Run/Gate effect from authoring. Changes to Assessment must invalidate downstream Plan/Prompts; Plan changes invalidate Prompts, without deleting good historical evidence. No silent migration of unrelated old drafts or automatic inference on card click.

## Risks and mitigations
- `docs/tasks/.drafts/<slug>` lies inside a project source tree; it could leak into Git status, Docs/Work discovery, source fingerprints, default search, backup/sync or symlink paths. Prove scoped exclusions and security, otherwise use established `.dope` durable stage location while keeping a task namespace.
- A one-line display name is not sufficient identity: separate opaque draft ID and stage revision from mutable UI label; validate chip on actual submit.
- Naming collisions with an existing accepted stack or draft must deny, never merge/overwrite.
- Materially invalid assessment/plan cannot be considered complete just because it renders or the model stops; validate actual source coverage, T1/T2/T3, exact dependencies and ten actual efficiency checks.
- Separate stages require restart-safe durable state and selective context retrieval, not another accumulating full transcript.
- Failed revisions must preserve previously sealed pending versions; publication and Work remain separate.

## Dependencies and tiers
P1 identity/command → P2 protected storage → P3 structured assessment → P4 structured planning → P5 card/chips → P6 exact prompt assembly → P7 cross-owner integration → P8 manual live qualification. P1–P6 T1 focused scope; P7 T2 integration; P8 T3 selected GPT-OSS 20B connected browser. Ordinary prompts aim at 8-minute implementation+verification, 10-minute soft and 15-minute hard budgets; narrow rather than silently defer safety.

## Prompt Efficiency Gate assessment
1. One coherent owner/boundary per P1–P6; P7 shared boundary, P8 manual.
2. Split parser/storage/assessment/plan/UI/composer to keep normal prompts bounded.
3. Focus source/unit cases in each T1; exact user scenario in T3.
4. Build changed workspaces only in actual dependency order if compiled libs are consumed.
5. Cross-domain misuse/recovery in P7; direct UI and model observation in P8.
6. Avoid repeated aggregate check/build chains across prompts.
7. Prefer Medium for narrow T1, High for security/architecture and T2; defer unrelated UI changes.
8. Exact P1–P8 grammar, unchanged `0.13.11`, one final manual P8.
9. P5 applies ADR 0016 semantic theme and existing native card controls, visual T3.
10. P5 applies ADR 0037 visible next action and keyboard/narrow recovery, human T3.

**Decision:** Propose only. No current product state, tests or qualification is advanced.
