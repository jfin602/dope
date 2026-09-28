# Product Phase 2 — Project Mind Plan

Status: HISTORICAL — OWNER-CLOSED FOR SEQUENCING; P6 AUDIT REMAINS NOT QUALIFIED
Date: September 28, 2026
Execution folder: `p2`
Preparation baseline: `dac6e57275134fc610d8c0c6e2620a90d7d58c2f`, package `0.1.6`
Activation source/package baseline: `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781`, `0.2.0`; owner waiver: `docs/planning/p2/activation.md`
Theia `1.75.0`, Electron `42.8.1`, Node 24, Linux AppImage

## Approval and prerequisite

The owner approved the Phase 2 documentation/stack and subsequently explicitly instructed "Proceed with Phase 2 despite Phase 1 being Not Qualified." The separate sequencing waiver is recorded in `activation.md`. Phase 1 remains Not Qualified with all restoration, Test Explorer and customization/extension gaps preserved. Phase 2 later reached a Not Qualified P6 audit; the owner then accepted the retained Phase 2 gaps for sequencing and authorized Phase 3 without relabeling the audit Green.

The exact coherent activation source is `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781` (`0.2.0`), with the documentation-only execution authorization commit identified in `activation.md`. Root/all workspace versions, internal references and baseline assertions agree. P1 may proceed after the waiver commit is clean and reachable. Every prompt checks this recorded waiver and ordinary version/clean-tree prerequisites; it must not demand Phase 1 Green in addition to the authorized waiver. Preserve inherited failures; the waiver does not reduce any Phase 2 validation or exit requirement.

## Objective and exit

Give one local software project durable developer-managed knowledge that remains useful with no model configured. Project Mind is the UI/product term; Project Intelligence owns its semantics. On reopening, the developer can retrieve their notes, captured ideas, unresolved/answered questions and decisions with rationale, provenance and relationships intact.

Qualify actual Dope knowledge through the same ordinary product path and a second unrelated local folder for isolation. Domain tests alone cannot pass the gate; an unusable restarted workbench is Not Green. Preserve inherited failures and never generalize the dogfood result to arbitrary stacks without evidence.

## Source findings and preserved behavior

The existing spike has one `Note` per folder in `.dope/note.json`. `packages/contracts/src/note.ts` validates a strict schemaVersion 1 with UUID/title/body/developer provenance. `note-service.ts` provides read/save and backend notifications. The Node `NoteStore` validates a local folder, serializes same-process writes per URI and uses temporary replacement. `NoteBackend` fans out events and disposes listeners; Theia modules bind RPC and the widget.

`ProjectMindWidget` supports only one root and renders every notification into its form. Loading clears the form before awaiting a read; save completion renders without verifying the original project is still selected. A production editor must not inherit draft loss or stale response races. The current write queue does not coordinate independent backend processes or detect stale drafts. There are no collections, lifecycle operations, links or search yet.

Reuse current typed transport/contributions, semantic theme CSS, atomic-write pattern and Node test tools. Preserve ordinary IDE startup, WorkspaceMode, light override and extension/provider pin. Existing Note identity/corruption/event tests remain relevant and must evolve into migration/production checks, not simply disappear. Existing restart integration is supplemental; its headless result cannot erase the Phase 1 GUI stall.

## Artifact contract

Use a discriminated union for `note`, `idea`, `question`, `decision`. Common fields: stable UUID `id`, `schemaVersion: 2`, `type`, `title`, `createdAt`, `updatedAt`, `provenance`, `status`, `archivedAt` and `links`. Creation/update times are ISO UTC strings for new records; only migrated legacy records may retain explicitly unknown times (`null`). Archive time is nullable. Developer-authored content is rendered as text, not executable HTML.

- Note: `body`, status `active`.
- Idea: `body`, status `captured` or `parked`; explicit park/restore only.
- Question: `body`, optional `answer`, status `open` or `answered`; answering requires non-empty answer, reopening is explicit and preserves prior answer until edited.
- Decision: `decision`, `context`, `rationale`, `consequences`, `alternatives`, `revisitConditions`; status `proposed`, `accepted`, `superseded`, `rejected`. Proposed drafts may be incomplete. Accept requires a non-empty decision/context/rationale and all consideration fields present, with unknowns visibly identified. Allowed transitions: proposed -> accepted/rejected; rejected -> proposed; accepted -> superseded by a different accepted Decision in the same project. Superseded records remain historical. Do not implement automated policy/decision enforcement.

Archive/unarchive is an explicit reversible flag change across types, preserves identity/content/status/links, and defaults out of active lists. Do not hard-delete or destructively convert types. Record a resulting Decision as a new linked artifact. No transition schedules work.

Phase 2 provenance producer is the developer. Legacy migration preserves `developer` and adds migration metadata (`sourcePath`, `sourceSchemaVersion`, `migratedAt`). Reserve the broader authorship vocabulary without introducing AI producers. Migration timestamps must not imply historical creation time.

Links are either same-project artifact UUID references or normalized project-relative file paths with optional positive one-based line. `related` connects any two distinct artifacts; `answers` goes from a Note/Decision to a Question; `supersedes` goes from the accepted replacement Decision to the superseded Decision. Supersession changes the old status and adds the replacement's link in one snapshot mutation; the old detail derives its replacement from that incoming link. Require an existing target for a new artifact link and reject self-links/duplicates. Archived targets remain visible. A missing file becomes an unavailable reference; reject traversal, absolute/remote paths and symlink escapes. Follow file links through the ordinary editor adapter. No symbol index, arbitrary process/browser execution or cross-project relationship graph.

## Ownership and topology

`@dope/contracts` owns artifact/request/result/event DTOs with no Theia/provider imports. One new real `@dope/project-intelligence` package owns validators, transitions and deterministic list/filter/search operations, plus a separate `src/node` readable-file adapter. Pure domain modules do not import that adapter or Node filesystem code. Existing `@dope/theia-extension` binds backend instances, transport and UI. No standalone persistence package, interface factories or later runtime scaffolding.

Build contracts, then Project Intelligence, then the existing extension. Update explicit workspace/build/baseline checks to include the new real package when P1 introduces it. Theia packages remain exactly 1.75.0. Do not change framework/provider versions to implement Project Mind.

## Storage and project scope

One local folder is one project. Support neither multi-root nor remote Project Mind in this phase; explain unavailable contexts in the UI. The document `.dope/project-mind.json` contains `schemaVersion: 2`, stable UUID `projectId`, monotonic integer `revision`, and `artifacts`. Snapshot revision starts at 1 on first durable creation and increments per successful mutation. Read of missing state is empty and creates no directory/file or unstable persisted identity. First mutation or explicit migration creates identity. Copying a project copies knowledge/identity; opening two independent empty folders creates distinct projects. Folder relocation preserves existing IDs.

Normalize local paths on the backend. Bind a project handle to a connection's explicit project attachment and verify it on all operations; arbitrary subsequent workspace URI, artifact ID or client metadata cannot redirect storage. Canonicalize roots and validate `.dope` and store/lock paths against symlink redirection. Attachment is the local user's project-open operation, not a future authority expansion mechanism; do not claim sandbox containment. Theia's recent-workspace list is not proof of active project attachment. Validate every persisted document, RPC draft/status/link and expected revision.

All mutations acquire one exclusive filesystem lock per canonical project, including initial creation and migration. Read the latest validated snapshot under the lock, compare the caller's expected document revision (0 for empty state), apply one operation, increment revision and replace atomically. Use exclusive lock creation, temp write/file sync, rename and parent-directory sync on the Linux target before acknowledging success. Always release only the acquired lock. Errors/contended locks/stale revisions preserve committed data and return a visible failure; no overwrite or automatic last-write-wins.

Do not auto-steal locks based on age/PID assumptions. A crashed writer leaves an explicit recovery condition. Conventional recovery stops all project writers, backs up the `.dope` directory, inspects the store, removes a confirmed abandoned lock and reopens. External edits likewise require stopped writers. No distributed lock, collaboration, watcher-based synchronization or general transaction framework. Document the full-snapshot linear cost with a `ponytail:` comment; reconsider the adapter only when measured project size requires it.

## Legacy migration and recovery

Expose explicit migration when valid legacy `.dope/note.json` exists and no new store exists. Reading/opening alone never migrates. Under the project lock, recheck the source and target, validate with the existing strict parser, preserve ID/title/body/developer provenance, add honest migration metadata, and write a schema 2 collection. Preserve original `note.json` bytes. Unknown creation/update dates are `null`; later edits keep unknown creation but record actual update time.

Once the new store exists, it is authoritative and the legacy file is retained history, not a second writable source. Repeat migration must not duplicate or merge the record. Existing/corrupt/unsupported targets reject migration rather than get replaced. A failed temp write/rename leaves original bytes and any previous committed snapshot intact; incomplete temporary files are noncanonical. A failure after replacement must be reported truthfully and recovered by re-reading the committed snapshot/revision before retrying, never by blindly replaying creation.

Add `docs/project-mind-storage.md` during implementation with format examples, location, single-writer/external-edit limits, Git implications, migration, backups, abandoned locks and corrupt/future-schema recovery. Recovery is inspect/copy/restore through conventional tools with writers stopped; no healthy Dope GUI is required. Never advise overwriting the only bad copy or importing unknown schema as empty state.

## Project Mind UI and consistency

Replace the spike Note UI with list/detail editing for the four types, explicit create/save/status/archive/link actions, type/status/archive filters and case-insensitive text search over title/content. Search is an in-memory derived scan with stable ordering; no persistent index/embeddings. Expose linked artifacts/file targets and unavailable-target messages. Capture an Idea without changing the active code/task surface.

Prefer explicit Save over autosave. Track draft, base revision, pending operation and attached project. Protect dirty drafts against selection/workspace changes, notifications and close; offer save/discard/cancel where the host permits, and never claim saved before backend acknowledgement. Conflicts keep draft text visible and allow explicit reload/copy/reconcile rather than overwrite. Use request generation/project identity to discard late load/save responses and event updates after switches/disposal. Notifications update saved projections only; no producer can replace an unsaved editor blindly. Surface retryable save/error/unsupported-context state.

Keep ordinary IDE startup foreground and existing commands. Project Mind opens on demand and may restore its view without making view state canonical. Labels, focus order, keyboard operation, empty/loading/error states, dark-first tokens and readable user-selected light theme are required. Do not make Planning's placeholder into production Planning or equate BUILD/PLAN mode with artifact status.

## Stack and validation

P1 `0.2.1`: core contracts/domain/query package and framework-independent guards; preserve legacy path until migration is implemented.
P2 `0.2.2`: collection storage, locks/revisions/migration/recovery, project attachment and typed backend transport; extend permanent failure/isolation tests.
P3 `0.2.3`: production Project Mind UI, draft/race/conflict protection, links/search/filter/lifecycle actions and keyboard/theme checks.
P4 `0.2.4`: process restart/reopen/migration/conflict integration and resulting Electron package/native-launch evidence.
P5 `0.2.5`: direct interactive GUI qualification on Dope and a second local project, exact candidate/knowledge/Git evidence; manual handoff.
P6 `0.2.6`: evidence-only audit with Qualified/Not Qualified disposition and route to post-Phase-2 review only on qualification.

P1-P4 are runner-owned with focused checks and `npm run check`; add production suites to actual aggregate commands as introduced. Run `npm run codex:phase:validate -- p2`, no-root-lock and whitespace checks per prompt. P4 additionally runs current restart/process integration and Linux packaging; record build environment/caches/native launch and exact artifact hashes. P5 does not infer interactive truth from those checks. A product repair requires regression coverage, repeated failed GUI step and fresh affected package evidence.

P6 cannot repair behavior or generate Phase 3 prompts. Preserve every failure/gap and exact evidence baseline. Qualification requires no unresolved product-blocking defect and Green applicable Phase 2 evidence; inherited non-blocking gaps must be explicitly bounded/accepted, not relabeled Green.

## Exclusions

No AI/provider/Agent Mind/authority/tool runtime, embeddings, semantic search, automatic repository ingestion or capture, Plans/Tasks, Sessions, architecture model, cloud/remote/multi-root storage, sync/team collaboration or framework upgrade. No special Dope self mode. Conventional external repair remains supported.
