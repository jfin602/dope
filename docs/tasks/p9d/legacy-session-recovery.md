# Legacy Development Session recovery

The old `.dope/development-sessions.json` file remains in the project. Run this offline utility only when you choose to archive its developer-authored content. It reads v1 and v2 Session collections and prints a validated export to standard output. It does not initialize Project Mind, migrate Sessions, call a model, or write any project file.

From the Dope repository, pass the project's **canonical absolute path** and choose a format:

```bash
node scripts/export-legacy-development-sessions.mjs --project /absolute/project/root --format text
node scripts/export-legacy-development-sessions.mjs --project /absolute/project/root --format json
```

The optional `--file /absolute/project/root/.dope/development-sessions.json` makes the file target explicit. It must be exactly that file within the chosen project. The utility refuses symlinked paths, malformed or oversized collections, unsupported schemas, copied or moved project roots, and conflicting Project Mind identity. An error prints to standard error and produces no export. The original file is never rewritten.

To keep an archive, redirect standard output to a destination **outside the project** that you choose, then inspect it. For example:

```bash
node scripts/export-legacy-development-sessions.mjs --project /absolute/project/root --format json > /safe/archive/legacy-sessions.json
```

JSON includes the original v1/v2 collection fields, including v2 artifact references, plus the source SHA-256 hash for comparison. Text includes titles, objectives, notes, next actions, closeout details, and v2 artifact references. Keep the original `.dope/development-sessions.json` as the authoritative legacy record. If a project was copied or moved, use the original project path and original file to export; the tool will not rebind a copy. Any later promotion of recovered text into Project Mind is a separate, explicit developer action.
