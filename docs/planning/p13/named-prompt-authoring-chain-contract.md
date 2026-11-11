> **2026-11-11 HISTORICAL THREE-STAGE CONTRACT / SUPERSEDED FOR NEW STACKS:** The forward owner-approved design is [ADR 0057](../../decisions/0057-direct-prompt-stack-generation.md) and [direct generation contract](direct-prompt-stack-generation-contract.md): /gen-stack <slug> stages actual prompt files directly, without mandatory Assessment/Plan records. The text below preserves the former named-chain contract and is **not** an additional prerequisite or fallback. Existing routes stay active only during qualification; remove them after real-model valid-stack/publication PASS and separate owner-approved cleanup. Historical drafts and evidence remain intact; 0.13.11 unchanged.

# Named Prompt Authoring Chain — Proposed Contract

**State:** Owner-approved documentation for a future correction, 2026-11-08. Authority follows approved ADR 0056. **No current shipping behavior or GREEN claim.** Version stays `0.13.11`.

## User entry and task identity
- Parse explicit, trusted user command `/prompt-ass <slug> <details>`; require a nonempty task description and a safe lowercase ASCII hyphenated slug, 3–32 characters. Reject empty, duplicate, path-like, reserved or unsafe names with a useful diagnostic. Do not execute a slash command merely because it appears in quoted text, previous assistant output, a code block or a chip label.
- The owner chooses the immutable slug (e.g. `clamp-api-correction`) and thus the eventual canonical destination `docs/tasks/clamp-api-correction/`. Dope never auto-generates or silently renames the folder. Use a separate opaque draft ID for runtime identity.
- Show a one-line title in a narrow Chat card; ellipsize only the presentation and retain the complete slug in a tooltip or accessible label.
- `/prompt-plan` and `/prompt-write` resolve the task exclusively through a trusted, owner/project/lease-bound chip or explicit selected draft; do not accept forged text-only identifiers, guessed global “latest draft,” or an old stale chip. The command remains editable; the chip itself carries a typed versioned reference.

## Stages and card behavior
```text
/prompt-ass <slug> <details> -> assessment staged/validated -> Assessment complete card
                 | click /prompt-plan (composer + bound Assessment chip)
                 v
          plan staged/validated -> Planning complete card
                 | click /prompt-write (composer + bound Plan chip)
                 v
   prompts staged, composed and finished -> Prompt Stack Proposal ready
                 | explicit Accept
                 v
       existing protected publisher -> docs/tasks/<slug>/
```
Use one stable card/draft identity and replace its *current projection* as phases advance while retaining immutable history of prior Chat turns/receipts. Stages: assessment staging/ready, plan staging/ready, prompt staging/ready-for-review, revising, rejected/accepted/stale/blocked. A button prefills the composer and typed chip, gives the owner a chance to add notes, and never submits on click. A chip must display name, stage and validity, offer remove, and be accessible by keyboard.

## Durable noncanonical storage
Use the existing trusted Chat/proposal transaction owner for canonical draft identity and stage state; do not introduce an independently mutable file database. A protected workspace under `docs/tasks/.drafts/<slug>/` may hold versioned structured stage records/chunks, exact content hashes and an atomic manifest linked to that owner. Store authoritative structured records once; cached Markdown is derived and regenerable. Keep records noncanonical, private to the project and unavailable as ordinary editable project docs.
- Explicitly exclude drafts from `git` by appropriate scoped ignore, from Work stack import/discovery, Docs discovery, ordinary source-change/dirty-work fingerprints, source search where applicable, and available standard file edits. **Do not** blanket-ignore meaningful owner source changes: pin and revalidate true brokered source hashes, worktree identity and version separately.
- Atomic writes and crash/restart recovery; reject symlink/path traversal, project switch, stale hashes, foreign owner/lease, duplicate slug, accepted-folder collision, oversized records and conflicting replay. Validate no unauthorized or irreversible writes before final Accept. If exclusions cannot be safely proven, reuse the existing `.dope` stage storage and record the precise constraint rather than creating unsafe task-directory files.
- Existing draft work must survive restart and remain inactive until explicitly resumed with valid owner/project credentials. Never silently promote partial stages on reload.

## Assessment wireframe — prompt count and task division

`/prompt-ass` creates the owner-named durable draft and proposes **how many implementation prompts** are needed and **how to divide the work**. Persist the task objective, proposed count, stable ordered task IDs/titles/brief objectives and responsibility boundaries, coarse dependencies, important constraints/deferrals/uncertainties, and a distinct final manual closeout outline. Honor an explicit owner count unless a change is reviewed.

Use bounded brokered reads as needed for informed decomposition. Factual source claims require real read evidence, but exhaustive inspection, separate observations/preservation/dependencies/risks citation stages, full T1/T2/T3 and ten efficiency checks are **not** prerequisites to Assessment completion. The wireframe is a structurally validated reviewable draft, not a full technical implementation Plan.

Dope owns project/owner/lease/source identity, noncanonical storage, draft revision and the checked handoff. A reviewed Assessment revision invalidates dependent Plan/Prompts without deleting historical evidence.

## Dependency-ordered plan — detailed technical design

`/prompt-plan` consumes the selected reviewed Assessment wireframe and performs deeper source/test investigation to produce complete dependency-ordered implementation steps. Expand each stable work ID into responsibilities, actual affected code/tests, preserved behavior, architecture/authority constraints, dependencies, risks, acceptance criteria, minimal builds/tests, T1 focused checks, T2 integration and one separate T3 independent manual closeout. Apply all ten relevant Prompt Efficiency Gates, including UI/theme/usability when applicable.

Preserve approved count/IDs/task boundaries. If deeper work demands a material split/count change, propose an explicit owner-reviewed Assessment revision first; never silently add, merge, drop or renumber tasks. Use real brokered reads for factual claims and mark unknown boundaries rather than inventing CI, modules or dependencies. A validated Plan is the input to Prompt Write, not publication or Run authority.

## Incremental prompt generation
Derive the output folder from the draft slug. Pass bounded completed **Plan** records (with count/IDs/task boundaries inherited from the reviewed Assessment wireframe) and relevant brokered source, not full assessment/plan Markdown. Prompt Write formats but does not redesign the Plan; material changes require reviewed prior-stage revision. Reuse `IncrementalProposalController`, `IncrementalPromptStack`, the deterministic composer, `proposal_finish({ finalMessage })` and existing R3B publisher; no new prompt writer. The finished candidate includes generated `prompt-assessment.md`, `implementation-plan.md`, the manifest/README as required, contiguous P1–Pn including exactly one final manual browser closeout. Owner Accept writes exact reviewed bytes to `docs/tasks/<slug>/`; no Work grant, Run or Roadmap award.

## Invalidation, revision and safety
Assessment replacement makes plan and prompts stale; Plan replacement makes prompts stale. Saved prior good revisions remain available for inspect/recovery but cannot be published against stale dependencies. Revise copy-on-write; failed/rejected new revisions preserve last valid pending candidate. On source/project/owner drift, mark blocked or stale with explicit recovery; do not silently reuse. All permissions, source/version checks, idempotency, resource limits, native tabs and approval remain in existing owners.

## T1/T2/T3 qualification
T1: trusted slug/identity, coherent count/task-boundary wireframe, detailed source-grounded Plan with T1/T2/T3 and efficiency, and final runnable prompt grammar. T2: exact stage ID/count handoffs or reviewed redivision, persistence/foreign-state and protected Accept. T3: connected Codex browser with real selected local model demonstrating lightweight Assessment, full Planning, substantial Prompt Write, editable chips/revisions/review and no auto Run/Gate. The prior exhaustive five-file Assessment benchmark is historical, not the permanent Assessment contract. Distinguish browser from Electron, and keep honest historical NOT GREEN.

**Workflow authority:** `docs/workflow.md` implementation workflow, ten Prompt Efficiency Gates and separate manual closeout; ADRs 0016/0037 for material UI changes.
