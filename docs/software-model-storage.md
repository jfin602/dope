# Physical Software Model storage

The canonical architecture declaration is one project-local `.dope/architecture.json` file. Developers edit it with the ordinary editor and review/version it with Git. Dope reads it; Phase 4 does not write or migrate it. It contains explicit System, Subsystem, and optional Component identities, ownership roots, purposes, and Subsystem dependency rules. It does not allocate a second Project identity or alter Project Mind.

The file uses strict `schemaVersion: 1` parsing. A missing file is valid: analyzed code remains visible as unassigned, and no declared dependency rules apply. Malformed JSON, invalid schema, unsupported future versions, and unsafe paths fail analysis with diagnostics. The original bytes remain untouched. Recover by editing or restoring the file with ordinary filesystem/Git tools, then reanalyzing.

Attachment resolves a local `file:` folder to its canonical real path. Reading rejects symlinked or non-directory `.dope` entries and symlinked or non-file architecture entries. Declared ownership roots must be normalized project-relative paths with no traversal. Source navigation resolves a source path only within the attached canonical root.

The physical graph, fingerprints, and TypeScript compiler programs are in memory and disposable. They are rebuilt from source/config files and the architecture declaration after restart or when inputs change. No graph cache is written under `.dope` or into Project Mind. A config or declaration change triggers a clean compiler rebuild; source changes invalidate analysis, with unchanged compiler source units reused where TypeScript permits. Failed analysis is reported rather than published as current truth.
