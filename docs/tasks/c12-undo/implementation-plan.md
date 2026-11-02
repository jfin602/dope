# /prompt-plan — c12-undo

**Owner decision:** 2026-11-01. **Status:** ASSESSED / PLANNED / AUTHORED, NOT RUN. **Scope:** [ADR 0046](../../decisions/0046-roadmap-revision-navigation-and-restore.md), [complete product contract](../../planning/p12/roadmap-revision-navigation-and-restore.md), [assessment](prompt-assessment.md). No source implementation/qualification/version change in this planning step. Each prompt is a **separate manually initiated** GPT-6 Sol High task; inspect the actual local checkout and use existing Codex Chrome for P4.

## P1 — Durable revision archive (foundation)

1. Source inventory: schema-2 store read/replace/lock and all revision-creating mutations (Chat-approved, manual Inspector, Gate qualification/evidence, import/relink/sync/publish, greenfield, corrections); distinguish committed index change vs no-op, pending journal/recovery and external source read.
2. Implement owner-scoped versioned historical capture with exact current verified baseline at feature entry; immutable snapshots or exact reconstruction with digest, predecessor, IDs, source metadata, bounded quotas/retention and explicit gaps; migration is forward-only unless historical proof already exists.
3. Make commit and capture durable and crash-reconcilable through existing authority/locking; no false history if aborted before actual canonical commit or unverified partial write. No separate writer or source overwrite.
4. Expose safe bounded list/read/history capabilities over existing RoadmapService, strictly project-/root-/schema-bound, read-only. UI/history cannot grant writes. Preserve current `.dope/roadmap.json` and compatible schema-2 behavior.
5. Tests: baseline at Rn, multiple commits, all relevant write entry points, current digest check, restart, duplicates, failed zero-change, crash windows, corrupted/gapped/pruned history, symlink/traversal/cross-project and size bounds.

**Exit A:** Exact verified snapshots across restart with truthful earliest available revision, no regression to Roadmap/store/source writes. If any writer path is uncovered or durability uncertain, **NOT GREEN** and don't run P2 as qualified.

## P2 — Toolbar and non-mutating historical display

1. Add always-present Undo/Redo icon controls using existing Roadmap toolbar/Codicons; provide tooltip, aria-label, keyboard focus and disabled bounds. Do not take over code editor shortcuts.
2. Hold a project-/owner-bound ephemeral display cursor; fetch exact verified history from P1. Reuse the same large Phase/Gate/Criterion canvas grammar to show Rk vs head Rm; label historical state with text, not just color.
3. Lock historical view read-only: editor/Inspector Edit, approve/reject/current-source actions and active Chat proposal overlay cannot mutate/display as current. Suppress only historical-mode auto-View in Roadmap; allow explicit return to current and manual valid proposal navigation.
4. Provide bottom strip **Historical preview Rk · Current Rm** with Compare, **Confirm Restore Rk** (may open a nonwriting explanation placeholder until P3 is ready; do not present an operational destructive action), and Return to Current. P3 must wire actual reviewed confirm. Preserve current camera/selection and no surprise Fit All; no separate Roadmap widget.
5. Tests: multi-step cursor navigation, bounds, resizing, empty baseline/history gaps, reload/new project, history read-only, newest revision arriving, no index/source write, correct focus and pending Chat isolation.

**Exit B:** Browser-visible or component-verified historical navigation is nonmutating; if Confirm is not yet backed by P3, disable it with explicit “Restoration not available yet”, never feign a write. P3 requires P1 and P2 source-qualified.

## P3 — Exact-source restoration and History receipt

1. Build owner-controlled restore **preview** from verified archived structure vs current head, with exact impacted IDs/fields, external data/source/qualification effects and truthful unsupported cases. Bind project/root/owner/target digest/current revision/index hash/linked source and approval lease.
2. Implement explicit Confirm through a dedicated atomic/recoverable schema-2 owner operation. For unlinked, apply validated editable structure into a **new** current revision (Rm+1), preserve Rk and Rm, propagate archive capture and verified receipt. Never copy old protected evidence, qualifications, waivers or approvals into current Green; invalidate/requalify affected fields.
3. For linked, integrate current source writer *only* with an inspectable approved structural/full diff, stable section mapping, preserved unrelated prose, exact hash and safe journal/restart recovery. Existing linked single-field Chat patch is not a general restore API. If unsupported, keep Confirm blocked for that fixture; no false claim of full feature Green.
4. Handle no-op, reject, stale head/hash, concurrent second window, other project, duplicate click, failed source write, crash after partial write and repair/recovery; idempotent exact application identity and no double revision or destructive silent cleanup.
5. Reuse one verified successful-restore receipt as the source for **one** optional read-only Project History row. No History entry on unapproved/zero-effect, no duplicate after restart. Update existing Chat proposal validity/overlay on real head change; no skill/Pi/Work publication authority.
6. Tests: unlinked R9→R5⇒R10, then Undo→R9; old evidence/Green safe, linked positive and negatives (where actually implemented), source bytes before/after, cancellation/recovery/idempotence and true one-record History projection.

**Exit C:** Safe reviewed append-only restoration on intended scope; linked path fully supported or truthfully NOT GREEN for mandatory full-correction requirement. Preserve no-write on every unsupported/conflict case.

## P4 — Independent connected-browser qualification and closeout

1. Inspect P1–P3 evidence, local HEAD/dirty tree, exact running browser/server/source, the latest related Roadmap/Chat/publication stacks and any failing tests.
2. Use **real connected Codex Google Chrome** with disposable unlinked and linked schema-2 projects. Show Rn history, successive accepted edits, toolbar Undo/Redo, read-only historic Phase/Gate/Criterion view, original-source nonmutation, compare/return and reviewed Confirm.
3. Verify new head, retained future revisions, reload/restart, source mappings, evidence/qualification staleness, pending Chat/active-tab auto-preview suppression, stale projects/leases/concurrent changes, History receipt and negative tests. At least one actual linked-source restore **if the capability is implemented**; unsupported linked structural restore must be recorded **NOT GREEN** rather than treated as PASS.
4. Check narrow/wide editor, keyboard/aria, reduced motion, selected camera, no accidental Ctrl+Z hijack, no model/tool delay or extra calls, current ordinary Chat/proposal/Inspector workflow and no arbitrary source deletion.
5. Perform up to two focused repair/recheck cycles on real observed blockers; run final applicable deterministic tests, typecheck, browser/Electron builds and diff/source check; record exact Chrome screenshots, revisions, hashes and pass/fail/gaps. Native Electron remains owner-operated evidence gap unless actually run.

**Exit Q:** New correction **GREEN only if all A/B/C and mandatory Chrome safeguards are confirmed** on final source and no linked/document/qualification safety gap remains. Otherwise exact **NOT GREEN** and a narrow next repair proposal, never a fabricated pass.

## Execution governance

Four individual manual prompts in [README](README.md), in order. Do not auto-run a successor, use headless runner for P4, add `/activate`, self-commit product edits, reset/stash/clean owner changes or bump `0.12.7` merely due to prompt authoring. Each prompt checks **local** implementation and can reuse genuinely qualified source-bound proof; do not rely on stale GitHub assumptions or claim work performed while authoring.
