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

## sMap initialization state

A missing `.dope/architecture.json` is valid, but absence of that file is not by itself the sMap initialization contract.

The project-local `.dope/smap.json` schema 1 marker records only accepted initialization:

```json
{"schemaVersion":1,"architectureFingerprint":"<sha256 of exact architecture.json bytes>"}
```

Missing marker means uninitialized, including when a valid `.dope/architecture.json` already exists. The fingerprint must match the present declaration before Dope reports initialized. An existing declaration can be explicitly accepted without rewriting its bytes. Manual or corrected declarations are strictly parsed before acceptance.

The marker never stores provider endpoint, model, authentication, a decline, an evidence packet, a proposal or a review draft. `analyzing` and `review_required` are transient states scoped to the attached project connection; a restart or cancellation returns them to uninitialized. Ordinary Physical Map refresh requires an initialized marker.

For an uninitialized project, opening the repository does not authorize analysis. Dope may offer **Analyze Project?**. If the developer declines, no sMap is built and no canonical or derived map state is written merely to record that decline. The sMap tab remains available with an **Analyze Project** action for later initialization.

If repeated prompting is suppressed after a decline, that suppression is presentation/workspace state rather than canonical project architecture state.

Until resumable review drafts are deliberately specified, failure or cancellation before explicit acceptance returns the sMap to uninitialized.

## Detected architecture and Physical Map

Deterministic repository, semantic, framework and later runtime analyzers produce rebuildable evidence and architecture signals. For initial brownfield initialization, a bounded LLM synthesis step interprets that evidence into proposed System / Subsystem / Component structure.

The ArchitectureEvidencePacket and ArchitectureProposal are distinct derived artifacts. The evidence packet must be deterministically reproducible/inspectable without AI. The proposal may contain model interpretation, numeric confidence, rationale and human-readable evidence explanations, but every claimed source basis must resolve through `evidenceRefs` to the exact packet supplied to synthesis.

Neither packet nor proposal becomes canonical truth merely because serialization or caching is convenient. If either is cached, the cache is disposable/versioned and must preserve packet/proposal association strongly enough to reject stale or mismatched evidence references.

Human-readable `evidence` is explanation, not authority and not a substitute for source-backed `evidenceRefs`. Temporary proposal keys are not durable canonical architecture IDs.

When proposed/detected structure and canonical architecture disagree, Dope preserves both:
- canonical identity/intent remains developer-owned;
- physical evidence remains visible;
- reconciliation reports detected-only structure, drift or unassigned implementation instead of silently rewriting either side.

The physical graph, detected architecture, fingerprints, TypeScript compiler programs and any future disposable discovery cache are derived state. They must be reproducible from current source/config/runtime evidence plus canonical architecture.

## Developer confirmation and correction

The product must provide an explicit path for the developer to establish or change canonical architecture from generated proposals or from a blank/greenfield project. The first implementation may use bounded sMap controls and/or an ordinary architecture editor, but acceptance/correction must be an explicit developer action.

Proposed boundaries may be confirmed, renamed, reparented, merged, split, added, removed, replaced or ignored. The generated proposal becomes canonical architecture only after explicit acceptance. Subsequent automatic analysis may warn that implementation disagrees with the canonical choice, but it must not silently mutate canonical architecture.

A greenfield/manual path remains valid with no model configured: the developer may define architecture directly and initialize sMap from those declarations before implementation exists.

## Project-local sMap persistence boundary

The project-local `.dope/` directory is the required persistence boundary for durable Software Map state.

At minimum:
- `.dope/architecture.json` owns canonical developer-authored System / Subsystem / Component architecture;
- `.dope/smap.json` owns durable sMap initialization/version/state metadata required to reopen the project coherently;
- if Dope later persists additional sMap artifacts such as evidence packets, graph snapshots, fingerprints, proposal drafts or indexes, those project-persistent artifacts belong under `.dope/smap/` (or another explicitly documented `.dope/` child) in a Dope-owned, explicitly versioned format.

The repository plus its project-local `.dope/` state must be sufficient to recover durable sMap state. No global Dope database, Theia workspace/application storage, provider-native session, LM Studio state, model cache or other machine-local location may be required to determine the project's canonical architecture, initialized state or other durable sMap truth.

User/application preferences such as synthesis endpoint and selected model remain outside project files. Machine-local caches are permitted only as disposable accelerators: deleting them must not destroy project truth, change whether the sMap is initialized or prevent deterministic reconstruction from repository evidence plus `.dope/`.

Deterministic evidence remains derived rather than canonical merely because it is serialized. Persisted evidence/proposal/cache artifacts must retain schema/version and source-association information sufficient to reject stale, mismatched or incompatible data.

> Portability invariant: copying or cloning the repository together with its `.dope/` directory carries the durable Software Map with it.

## Filesystem and recovery rules

Attachment resolves a local `file:` folder to its canonical real path. Reading rejects symlinked or non-directory `.dope` entries and symlinked or non-file architecture entries. Declared ownership roots must be normalized project-relative paths with no traversal. Source navigation resolves a source path only within the attached canonical root.

Malformed JSON, invalid schema, unsupported future versions and unsafe paths fail with diagnostics without rewriting the original bytes. Recover by editing or restoring the file with ordinary filesystem/Git tools, then reanalyzing.

Acceptance checks the exact prior declaration fingerprint, stages replacement files in `.dope`, then installs the declaration followed by the marker. If the marker install fails, Dope restores the exact prior declaration bytes (or removes the newly created declaration). A malformed, unsafe or mismatched marker is never treated as initialized. Recover a mismatched pair by restoring the accepted declaration or removing the marker and explicitly accepting the intended declaration again. Marker and declaration entries must be regular files, and `.dope` must be a real directory; symlinks are rejected.

No derived graph, ArchitectureEvidencePacket, ArchitectureProposal or architecture-discovery cache belongs in `.dope/project-mind.json`. If any of those artifacts are persisted as project state, they belong under the documented sMap portion of `.dope/`; if they are cached outside the project, that cache must be explicitly disposable, versioned and safely reject/rebuild stale, mismatched or incompatible entries.
