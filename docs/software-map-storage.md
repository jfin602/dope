# Physical Map storage

Canonical architecture and detected architecture are intentionally different kinds of state.

## Canonical architecture

The project-local `.dope/architecture.json` file is the durable, developer-owned architecture authority. It is readable, reviewable with Git, recoverable outside Dope and independent from Theia or any AI/model provider.

Canonical architecture owns stable developer decisions such as:
- System, Subsystem and Component identity;
- names and purpose;
- intended containment/ownership;
- implementation selectors/roots where explicitly used;
- public/entry contracts where represented;
- allowed/forbidden dependency constraints.

Canonical architecture may exist before implementation. A greenfield project can therefore define its intended architecture before source entities are present.

A declaration is architecture authority, not proof that implementation exists. Declared architecture with no supporting implementation is represented as declared-only rather than fabricated into physical reality.

The current schema-1 declaration remains valid until a correction implementation demonstrates that new fields require a version bump. Existing strict parsing, path containment and recoverability rules remain in force.

## Detected architecture and Physical Map

Detected System / Subsystem / Component candidates are rebuildable derived state produced from deterministic repository, semantic, framework and later runtime evidence. They must not be persisted as canonical truth merely because discovery or caching makes it convenient.

A missing `.dope/architecture.json` is valid. Analysis should still discover architecture candidates and lower-level implementation facts; no canonical dependency rules apply until the developer establishes them.

When detected structure and canonical architecture disagree, Dope preserves both:
- canonical identity/intent remains developer-owned;
- physical evidence remains visible;
- reconciliation reports detected-only structure, drift or unassigned implementation instead of silently rewriting either side.

The physical graph, detected architecture, fingerprints, TypeScript compiler programs and any future disposable discovery cache are derived state. They must be reproducible from current source/config/runtime evidence plus canonical architecture.

## Developer confirmation and correction

The product must provide an explicit path for the developer to establish or change canonical architecture from detected candidates or from a blank/greenfield project. The first implementation may use bounded sMap controls and/or an ordinary architecture editor, but acceptance/correction must be an explicit developer action.

Detected candidates may be confirmed, renamed, reparented, merged, split, replaced or ignored. Automatic analysis may warn that implementation disagrees with the canonical choice, but it must not silently mutate canonical architecture.

## Filesystem and recovery rules

Attachment resolves a local `file:` folder to its canonical real path. Reading rejects symlinked or non-directory `.dope` entries and symlinked or non-file architecture entries. Declared ownership roots must be normalized project-relative paths with no traversal. Source navigation resolves a source path only within the attached canonical root.

Malformed JSON, invalid schema, unsupported future versions and unsafe paths fail with diagnostics without rewriting the original bytes. Recover by editing or restoring the file with ordinary filesystem/Git tools, then reanalyzing.

No derived graph or architecture-discovery cache belongs in `.dope/project-mind.json`. If a future disk cache is introduced, it must be explicitly disposable, versioned and reject/rebuild stale or incompatible entries.
