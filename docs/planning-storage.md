# Planning storage (schema 1)

Each attached local `file://` folder uses `.dope/planning.json`, a readable UTF-8 full snapshot:

```json
{
  "schemaVersion": 1,
  "projectId": "27ddf5b6-c2f1-4c27-8c1d-15e7ad5ee909",
  "revision": 1,
  "plans": [],
  "tasks": [],
  "history": []
}
```

The first actual write is a typed operation and includes a Plan and history entry. `projectId` is the **existing** `.dope/project-mind.json` project ID, never a new Planning identity. An attach with no canonical Project Mind snapshot returns a Planning prerequisite; reads create nothing. A mismatched identity fails closed, preserving both stores. Project Mind links added by a Planning mutation must resolve against the current same-project snapshot, including archived artifacts. Planning never writes reverse links to Project Mind. File links use project-relative paths and optional positive line numbers; missing files are allowed, but absolute, traversal, remote and symlink-escaping paths are not.

Every accepted mutation requires the observed document revision (zero before the first write), rechecks the store and Project Mind identity, applies exactly one typed operation, increments the document revision once, and appends one history entry. Each affected Plan also has a visible revision. A stale revision, invalid snapshot, held lock, or changed identity is an error; there is no last-write-wins merge. The backend's opaque handle is bound to one canonical root per connection. This is not a cross-store transaction: external Project Mind writers are not locked by Planning.

Planning uses its own exclusive `.dope/planning.lock`. It writes a unique temporary file, syncs that file, renames over the canonical store, and syncs the parent directory. Before-rename failure leaves committed bytes intact. After-rename sync failure means the write **may have committed**: reread the current snapshot and revision before deciding whether to retry, never blindly replay an initial creation. Temporary files are not canonical data. A lock is never auto-stolen, even when old.

For recovery, stop all Dope and external writers and back up the **whole `.dope` directory** first. Inspect the canonical store, lock and any leftover temporary files with normal filesystem/Git tools. Confirm no process owns an abandoned lock before removing only that lock. Restore a known-good backup or Git version for corruption; preserve the bad bytes for investigation. Unknown future schema needs a compatible reader or explicit migration, not downgrade-by-save. For stopped-writer external edits, validate the JSON, identity, paths, links, history and monotonic revision before replacement; the lock coordinates only cooperating Planning writers.

`.dope/planning.json` is ordinary project data: review/commit intentional changes alongside source, reconcile concurrent branch edits manually, and do not commit lock or temporary files. Full-snapshot validation, history and replacement grow with project size; this phase introduces no database, sync or generic persistence layer.
