# Named Prompt Authoring Chain — Proposed Contract

**State:** Documentation proposal for owner review only, 2026-11-08. Authority depends on approval of proposed ADR 0056. **No current shipping behavior or GREEN claim.** Version stays `0.13.11`.

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

## Source-grounded assessment
Pi uses existing brokered reads, including bounded late ranges. Stage compact typed preservation claims, dependencies, risks, exact observed source references/ranges/hashes, omissions and required T1/T2/T3; user-visible Chat output is a small status and card, not a 12k Markdown dump. The model does not manufacture source hashes or claim searched files were read. Source changes invalidate relevant claimed evidence. Markdown representation is rendered from checked records on demand for native read-only tabs and final published assessment.

## Dependency-ordered plan
Inherit only relevant validated Assessment fields and source references. Stage one bounded work item at a time: stable step ID, responsibility, affected source/tests, dependencies, acceptance, focused validation/build requirements, tier, deferrals, and applicable ten Prompt Efficiency Gate findings. The requested work count must be preserved when explicit, with exactly one distinct final manual T3 closeout. Avoid hallucinated CI, CommonJS adapters, extra dependencies or browser app files unless supported by actual source and plan rationale. Invalid plans remain drafts with actionable errors, not publishable authority.

## Incremental prompt generation
Derive the output folder from the draft slug. Pass bounded per-step plan records and relevant brokered source, not full assessment/plan Markdown. Reuse `IncrementalProposalController`, `IncrementalPromptStack`, the deterministic composer, `proposal_finish({ finalMessage })` and existing R3B publisher; no new prompt writer. The finished candidate includes generated `prompt-assessment.md`, `implementation-plan.md`, the manifest/README as required, contiguous P1–Pn including exactly one final manual browser closeout. Owner Accept writes exact reviewed bytes to `docs/tasks/<slug>/`; no Work grant, Run or Roadmap award.

## Invalidation, revision and safety
Assessment replacement makes plan and prompts stale; Plan replacement makes prompts stale. Saved prior good revisions remain available for inspect/recovery but cannot be published against stale dependencies. Revise copy-on-write; failed/rejected new revisions preserve last valid pending candidate. On source/project/owner drift, mark blocked or stale with explicit recovery; do not silently reuse. All permissions, source/version checks, idempotency, resource limits, native tabs and approval remain in existing owners.

## T1/T2/T3 qualification
T1: parsed command/name/collisions; source proof and assessment/plan grammar; durable records; cards/chips; exact safe prompt composition. T2: end-to-end stage transitions, no legacy draft drift or duplicate stores, cross-chat/restart/project swap, stale refs and protected Accept. T3: manual connected Codex browser with real selected GPT-OSS 20B, significant assessment/plan, ten-work-step prompt generation, editable composer handoff, revisions, read-only review, Accept/Reject, provenance, no auto Run/Gate. Distinguish browser from Electron, and keep honest historical NOT GREEN.

**Workflow authority:** `docs/workflow.md` implementation workflow, ten Prompt Efficiency Gates and separate manual closeout; ADRs 0016/0037 for material UI changes.
