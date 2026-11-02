# /prompt-ass — c12-undo

**Assessment date:** 2026-11-01 (America/Chicago). **Assessment basis:** GitHub `main` examined at `9600cf460f372299501267a5a9828d413af53562` before authoring; the actual **local** worktree may contain newer/uncommitted implementation and must control execution. **Product at authoring:** `0.12.7` per existing contracts, not a verified local manifest. **Disposition:** ASSESSED / AUTHORED ONLY — no source edits, tests, Chrome execution, version bump or Green.

## User problem and desired behavior

The current Roadmap editor needs first-class **Undo** and **Redo** toolbar icons that step through its *actual retained revision states* for inspection. The user may browse backward/forward without writes. At any available revision other than current, show a compact bottom **Confirm Restore** action and **Return to Current**; confirmation explicitly reviews differences then safely restores that historical **editable structure as a new head revision**, retaining later history. Do not call these button presses ordinary mutating editor undo. They are revision cursor navigation.

## Source-grounded findings

1. `packages/project-intelligence/src/node/roadmap-store.ts`: schema-2 current `.dope/roadmap.json`, monotonic revision, project-root identity, lock/index-hash/atomic replace; not an archived historical sequence. `saveGateIndex()` checks protected Gate-set coverage, qualification/evidence, and `linkedDocument` metadata, so direct whole-index replacement is unsafe.
2. `packages/project-intelligence/src/node/project-planning-actions.ts`: an in-memory `undo` Map keyed by project handle retains one eligible before/after, token and current revision, erased on detach; `undoEligible` commits an additional revision but does not offer multi-step history or Redo. The existing Inspector calls it for eligible single edits; no claim it is an archive.
3. `packages/theia-extension/src/browser/roadmap-canvas-widget.ts`: existing center editor toolbar, React Flow projection, historic camera persistence, preview overlay and inspector selection provide the visual seam. `roadmap-inspector-model.ts` and widget own limited Undo Last Edit; avoid competing semantics or subtle double-writes.
4. Existing Roadmap source patch, publish/relink/sync and schema-2 import/greenfield/qualification mutations may flow through different owner entry points. P1 must inventory **every** successful revision-producing path and put archive capture at the common checked boundary or equivalent exact commit receipts; do not attach capture only to Chat or visual callbacks.
5. `docs/decisions/0040-phase-gate-roadmap-domain.md` locks stable Phase/Gate/Criterion, reviewed qualification, source hashes and owner identity. `docs/decisions/0045-roadmap-proposal-lifecycle-and-publication.md` separately owns pending/historical Chat cards, conditional View in Roadmap and reviewed publication. `docs/decisions/0034-developer-continuity-and-right-toolbar-history.md` keeps History read-only. No duplicated owners.

## Risk analysis and controls

| Risk | Response |
| --- | --- |
| A bare revision number is mistaken for a snapshot | Capture current verified baseline and future actual revisions only; expose unavailable past honestly |
| Crash between index and history write | One owner-controlled durability ordering/journal + exact reconciliation, no phantom committed history or silent missing revision |
| Retention/size/unsafe archived paths | Bounded project-local archive, schema/hash validation, safe canonical paths/locks, truthful gaps and no current-index corruption |
| Historical canvas accidentally edits current | Explicit read-only mode; disable mutation/approval paths and transient overlay; keep normal camera separate |
| Concurrent new head/source while preview open | Bind reviewed restore to selected snapshot digest/current head/project/owner/source fingerprint; fail closed on drift |
| Old Green/evidence/waiver resurrected | Restore only authorized plan structure; preserve historical audit/evidence, invalidate current affected eligibility; never automatic Green |
| Linked Markdown structural restore exceeds single-field patch | Explicit reviewed source-owner diff/transaction/recovery or **block unsupported linked restore** rather than bypass/overwrite |
| Pending Chat proposal auto-focuses history | Suppress automatic Roadmap proposal preview during historical browse; manual View remains accessible after returning current |
| One-step Inspector Undo conflicts with new controls | Preserve or deliberately reconcile existing action with separate cursor semantics; test both; no implicit destructive step |
| Local source/parallel owner work differs | Preflight local HEAD/dirty files/version/active stacks; no reset/stash/clean or self-commit |

## Decomposition and priority

- **P1 — Archive:** baseline, contiguous future commits, integrity, bounded reads, restart/corruption/recovery proof. No toolbar or restore writes.
- **P2 — Browse:** two icon buttons, read-only historical canvas, comparison/confirmation strip (initially nonwriting), Return to Current and Chat overlay isolation. No restore action execution.
- **P3 — Restore:** source-/revision-bound reviewed compare/apply, append new head, protected qualification/evidence rules, linked Markdown exact approval/recovery, idempotence and applied-only History. No AI/Work grants.
- **P4 — Independent manual Chrome:** actual connected Google Chrome journey and source/test evidence, plus bounded targeted repair and honest correction closeout.

Manual, separately initiated prompts fit the owner's browser-driven correction workflow. Avoid a runner implicitly executing P4, speculative UI animations, model calls, new stores or phase/version changes. Later prompt execution should not claim an unobserved native Electron GUI pass.

**Assessment result:** Proceed with separately authored c12-undo P1→P2→P3→P4, each gated on exact source and previous applicable evidence. Linked multi-field restoration is the principal unknown: preserve a truthful NOT GREEN if not safely realized.
