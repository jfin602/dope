# /prompt-plan — c12-roadmap-sync runner implementation and closeout

**Decision:** ADR 0047 + ADR 0046. **Product reference:** 0.12.7 (verify actual local version). **Status:** PLAN + PROMPTS ONLY; no product code executed by authoring. The runner owns implementation checkpoint commits; final manual browser P10 does not run automatically.

## Prerequisite and operating contract
On owner's local checkout read BOOT.md, AGENTS.md, docs/workflow.md, this stack and ADR 0040/0045/0046/0047, c12-undo contract, actual current source/evidence. Inspect \`git status --short\`, head, dirty work and active runner state. Protect changes and use disposable project fixtures. If overlapping c12-undo components are already implemented/qualified, **reuse them** and prove integration; never run duplicate stacks. If prerequisite is absent, implement the missing scoped seam in its own Pn; STOP on a mandatory unsafe gap rather than declare a future step already complete.

### P1 — Native Pi broker Roadmap tools (runner)
Inventory actual RoadmapStore/Service, ProjectPlanningActions, Pi broker permissions and Chat/greenfield routes. Add versioned bounded project-scoped read/stage/cancel of noncanonical structured Phase/Gate/Criterion/Correction operations with stable IDs, leases and source fingerprints. Model cannot access apply/approve or write arbitrary Markdown. Focus tests, no canonical write on stage.

### P2 — Typed full-draft validation + exact proposal projection (runner)
Implement incremental staged batches, completeness marker, typed missing-field/dependency diagnostics and consistent server-owned before/after projection to saved Chat proposal card and provisional canvas. No saved-assistant text parsing as authoritative mutation, no second model pass and no fabricated Gate conversion from arbitrary checklist. Preserve explicit read-only Chat and no-action cases. Test greenfield 3+ phases with nested Gates, incomplete/cancelled draft and project isolation.

### P3 — Granular subset Apply/Reject (runner)
Backend owns operation-level pending/accepted/rejected/stale states. Support individual, Phase group, Apply/Reject Selected and Apply/Reject All Remaining. Check parent/dependent closure; one valid selected subset = one atomic revision/real receipt; invalid partial selections do not write. After any partial commit revalidate remaining pending operations with fresh revision/source lease. Confirm duplicate/late click idempotency, no orphan/cycles, no resurrected rejected item and only actual applied History.

### P4 — Durable revision archive (runner; formal Undo foundation)
Extend shared schema-2 RoadmapStore mutation boundary with current verified baseline and immutable subsequent snapshots across manual, approved Chat, import/source-sync, qualification/evidence and restore writers. Add archive list/read exact hash, gap/retention/quota and crash/restart integrity. In-memory undoEligible is NOT formal history. Prove no phantom revisions and no source write from browsing.

### P5 — Initial Markdown link + automatic safe sync (runner)
One-time project-local destination choice and confirmation with secure creation and stable mappings; existing accepted unlinked draft gets explicit first link (no startup autopublish). Enqueue durable revision-targeted deterministic sync after every committed change, preserving unrelated prose and external edits, with guarded source hash, source-authority write, restart recovery and visible Synced/Pending/Conflict/Failed. A confirmed canonical commit may precede verified Markdown bytes, but UI must disclose this truth. No repeated giant form, raw model file write or silent file collision overwrite.

### P6 — Direct canvas field editing and granular review (runner)
Pencils beside editable Phase/Gate/Criterion/Correction text, focus/Save/Cancel, single-line/multiline semantics, local edit conflict retention, protected fields read-only; backend-validated overlays and contextual individual/group/selection/bulk decision controls. Reuse same proposal identity as saved Chat card and active-tab-only preview, no focus hijack. Retire old linked Markdown editing form only after first-link, import/relink/conflict/status parity, with a small sync indicator.

### P7 — Formal Undo/Redo toolbar + historical preview (runner)
Always-visible icon-only Undo/Redo in existing center Roadmap toolbar, browsing **read-only** hash-verified retained history. Historical snapshot label, bottom Compare/Confirm/Return strip, truthful disabled states, as-of qualification labelling; disable current editing/approval/auto Chat preview during history navigation. No file change, code-editor Ctrl+Z takeover or model call; Confirm Restore remains disabled until P8.

### P8 — Explicit compare/approved restore (runner)
Use exact archived target + current head/source hash to preview editable-structure diff. Revalidate one-time developer approval under owner lock; successful restore appends a new monotonic revision and one actual receipt; old revisions remain. Preserve existing immutable evidence/waivers/Work/Chat/History and invalidate affected qualification/coverage as required. Linked Markdown structural restore uses existing source-aware owner/recovery, not raw historical file replace; blocked if safety cannot be demonstrated. Test stale/project/duplicate/collision/interrupted negative paths.

### P9 — Full integration / cleanup (runner)
Cross-owner tests for create/edit/selective decisions/history/Markdown/reload, retire unused response-mutating writer and giant editor form (retain import/relink/recovery), unify API/type/Help labels. Verify source no-write negatives, approvals, provenance, accessibility/camera/focus, no duplicate Chat activity, no other feature regression. Run relevant full project tests/typecheck and browser/Electron builds on exact candidate, record all failures. Do NOT substitute unit/browser builds for actual P10 GUI.

### P10 — MANUAL connected Codex Chrome three-cycle qualification (not runner)
Use the real connected Codex Google Chrome browser on exact final source and disposable tower-defense project. Verify actual full tree from native Pi tools, selective Apply/Reject, direct pencils, first link and automatic sync, formal Undo/Redo and reviewed restore, qualifications/evidence, full security/race/recovery negatives, narrow/keyboard/a11y and reload. Up to **three** targeted observed-defect repair + re-test cycles; fresh source and browser build after each change; one final closeout with PASS/FAIL/NOT RUN/GAP and truthful Green/Not Green. Owner-native Electron evidence is separately obtained or reported as GAP. No fabricated successful browser action.

## Runner handling
1. Later owner invocation: \`npm run codex:phase:validate -- c12-roadmap-sync\`.
2. Then \`npm run codex:phase -- c12-roadmap-sync\` runs only P1–P9. Runner owns successful checkpoint commits. STOP on NOT GREEN.
3. Manually execute P10 in connected Codex Chrome; **do not** use \`--closeout\` to force an automatic PASS.
4. Preserve all previous source-bound reports, tests, owners, current /roadmap and Undo contracts. No automatic product-version bump, Phase 12 closure, Work grant or old correction replay.

## Exit criteria
- R1 native object graph complete, no parser-authoritative fallback (P1–P2).
- R2 granular dependency-safe decisions, atomic partial Apply (P3).
- R3 canvas-first UI including direct fields + review and elimination of giant editing workflow (P6).
- R4 one-time Markdown link, checked automatic sync with crash/conflict recovery (P5).
- R5 **formal durable Undo/Redo and reviewed restore** including safe linked Markdown/evidence protection (P4/P7/P8).
- R6 integrated regression proof and actual browser closeout (P9/P10).
All mandatory boundaries need verified evidence. A missing linked-restore positive, unavailable required local-model demonstration, unobserved native requirement or failed browser matrix is reported honestly; qualification may be scoped only with explicit owner disposition, never inferred.
