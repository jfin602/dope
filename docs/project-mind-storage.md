# Project Mind storage (schema 2)

Each attached local folder owns `.dope/project-mind.json`. It is one UTF-8 JSON snapshot:

```json
{
  "schemaVersion": 2,
  "projectId": "27ddf5b6-c2f1-4c27-8c1d-15e7ad5ee909",
  "revision": 1,
  "artifacts": []
}
```

Actual first writes contain an artifact. `artifacts` holds schema-2 Note, Idea, Question and Decision records, including UUIDs, statuses, links and developer provenance. New timestamps are UTC; a migrated Note's unknown historical `createdAt` and `updatedAt` are `null`. A subsequent edit records the new update time without inventing a creation time. The project ID survives relocation or copying of the folder; independently created folders receive different IDs. A missing read creates nothing. The first mutation or explicit migration creates the file at revision 1; each successful mutation increments the document revision once. Full-snapshot validation, search and replacement have linear size cost. This is not a database or a collaboration/sync protocol.

The backend accepts one explicit local-folder attachment per connection and returns an opaque, connection-scoped handle. Subsequent operations must use that handle and the last observed document revision. A different root, stale revision, changed project identity, invalid data or link, or held `.dope/project-mind.lock` is an error, never a last-write-wins update. Only the lock owner releases its lock. The lock is created exclusively across processes, and the latest snapshot is validated while held. Replacements use a unique temporary file, file sync, rename and directory sync on Linux. A write error after replacement may leave an uncertain outcome: **read the current snapshot and revision before retrying**. Do not blindly replay an initial creation. Temporary `.tmp` files are not canonical state.

## Legacy Note

`.dope/note.json` is legacy schema 1. Attaching or reading never imports it. Explicit migration requires a valid Note and **no** schema-2 store, rechecks both under the same lock, and imports its ID, title, body and developer provenance. It records `migration.sourcePath`, `sourceSchemaVersion` and `migratedAt`; it does not invent historical timestamps. The original file remains byte-for-byte unchanged. Migration refuses an existing (including corrupt or future-schema) target and does not reimport or merge. Legacy Note saves share the migration lock, so they cannot race the import. After schema-2 state exists, the old Note service refuses writes to the legacy file; it is retained history, not a competing writable source. The Phase 0 spike UI is not the Phase 2 editor; P3 replaces it.

## Git and recovery without the workbench

`.dope/project-mind.json` is ordinary project data: inspect and commit its changes alongside source as desired. Snapshot commits expose whole-file diffs; simultaneous branches and external edits require manual reconciliation. Do not commit the lock or leftover temporary files. Back up the **entire `.dope` directory**, including legacy source, before repair. Stop all project writers (all Dope instances and external editors) first. Use normal filesystem and Git tools; a healthy GUI is not required.

For an external edit, modify a stopped-writer copy, validate JSON schema, UUIDs, artifact links and monotonic revision, then replace the store while writers remain stopped. Do not edit under an active writer: this storage contract coordinates only its own lock users. For corruption or an unknown future schema, preserve the original bytes and inspect the schema/version; restore a known-good backup or Git version manually. Never treat an invalid document as empty or overwrite the only copy. A future-schema document requires a compatible reader or an explicit supported migration, not a downgrade-by-save.

If a process crashes with an abandoned `.dope/project-mind.lock`, stop all writers, back up `.dope`, inspect the store and any temporary files, confirm no process owns the lock, then remove **only the confirmed abandoned lock** before reopening. No PID or age-based auto-stealing occurs. If durability failed after rename, compare the current revision/content with the caller's last acknowledged state before deciding whether to retry or reconcile.

Canonical roots and storage entries are checked for symlink redirection; file links are relative to the attached root and symlink/traversal paths are rejected. This is path containment for Project Mind operations, **not** an OS sandbox or protection against arbitrary external processes.
