# Correction 7 Implementation Plan — Chat Project Grounding

Status: **APPROVED / PROMPTS WRITTEN / READY FOR EXECUTION**
Correction folder: `c7-chat-project-grounding`
Required unchanged package version: `0.7.31`
Activation/source baseline: `2a83c637415f682b91d60babd8f89c6cb896662a`
Assessment: `prompt-assessment.md`

## Shared invariants

- Keep package version exactly `0.7.31`.
- Preserve the completed Phase 7 / 7B / 7C qualification history.
- Project facts may be called verified only when supplied as current turn evidence.
- Grounding is deterministic backend observation, not model-controlled tools.
- Filesystem evidence is project-relative and realpath-contained.
- Generic grounding never reads `.dope/`; typed domain readers remain authoritative there.
- Do not expose the absolute project path to the model.
- Auto context is visible and persists with normal turn provenance.
- Preserve Interactive role routing, explicit exact-model authority, no-silent-fallback and hosted-egress behavior.
- Retry/fallback may not silently switch to materially different grounding evidence.
- No write/delete/process/Git/network/delegation capability.
- P1/P2 use focused validation only; P3 owns broad/direct evidence.

## P1 — deterministic project grounding engine — T1/T2

Add a backend-owned grounding service beside Chat context composition.

### Repository reader/search

Implement bounded project-relative primitives:
- safe path validation + canonical root containment;
- directory listing;
- bounded text file read;
- bounded path/file search;
- bounded text search.

Reject absolute paths, traversal, NUL/control/path-normalization tricks, `.dope/` generic access and symlink escape. Do not follow arbitrary symlinked directories outside root.

Define deterministic bounds for directory entries, traversal/file count, per-file bytes, total returned bytes/results and search time/work. Results are stable-sorted and include explicit truncation/omission metadata.

### Intent and orientation

Add deterministic grounding selection over the developer's message:
- explicit project-relative path/directory mention;
- list/contents/existence questions;
- implementation-location/path/text questions;
- Architecture/System/Subsystem/Component questions;
- Physical Map questions;
- Flow/trace questions.

Do not call a model to decide what evidence to retrieve.

Always produce only a tiny orientation block: active project marker, Architecture availability, Physical Map availability/generation, optional bounded top-level outline. No absolute machine path.

### Domain/map evidence

Reuse canonical Architecture readers and current `SoftwareMapIndex` snapshot/status/current-input checks. Flow uses the existing bounded static Flow query. Stale/unavailable map state is reported as unavailable; never substitute old snapshot evidence.

### Grounding result contract

Return model-facing evidence blocks plus typed refs/diagnostics. Add the smallest Chat ref schema extension necessary for automatic-origin and directory/search semantics while remaining backward compatible with existing persisted Chat data.

### Tests

Create focused `chat-project-grounding.test.ts` (or equivalent) covering root/test listing, file read, existing/nonexistent path, path search, text search, Architecture, Physical Map/Flow, deterministic ordering/bounds, `.dope/`, absolute/traversal, symlink escape and stale map rejection.

Validation: focused grounding + directly affected Flow/index tests, narrow package builds, `git diff --check`, unchanged-version/no-root-lock check.

## P2 — Chat integration, provenance and Auto context — T2

### Composition

Wire Project Grounding into `ChatBackend`/`ChatContextComposer` before the final model request.

Automatic grounding is default project-Chat behavior and is separate from the existing manual `allowedSources` list.

Compose manual + automatic evidence through one budget. Manual context remains explicit developer input; Auto context uses the remaining bounded budget with deterministic priority. Never drop the user's message or silently exceed selected/resolved model capacity.

Inject one compact system instruction: project facts are verified only from supplied evidence; do not claim to have read/listed/searched/inspected project state that is absent from evidence; state missing/unknown evidence explicitly.

### Role routing / hosted egress

For Follow Interactive, grounding selection is local and deterministic, then composition is performed against the selected candidate's limits. No auto evidence is sent until existing hosted-project-data authorization is satisfied.

Role fallback may re-budget/truncate the same selected evidence identities but may not choose a new directory/search/map fact set. If equivalent evidence cannot be preserved, fail the turn rather than silently changing facts.

Exact-model semantics remain unchanged.

### Retry

Persist automatic refs on the user turn. Retry recomputes grounding and requires the same evidence identities plus content hashes/map generation where applicable. Changed project evidence fails retry clearly and requires a fresh turn.

### UI

Render automatic refs under a clearly labeled **Auto context** disclosure, distinct from manual context but in the same compact metadata area. Show kind + project-relative label; never reveal absolute root.

Preview Context should include automatic grounding for the current draft when an exact target is known; role-following preview may either resolve Interactive read-only or state that final budget depends on the routed model, but must not show fake evidence.

### Tests

Focused integration coverage:
- ordinary `what is in test/?` sends actual listing evidence;
- implementation-location question sends bounded search evidence;
- normal non-project conversational question receives orientation only, not broad search;
- persisted automatic refs + UI label;
- manual context preserved;
- retry same evidence succeeds and changed evidence fails;
- small context window truncation/omission;
- role-following fallback preserves evidence identities;
- hosted confirmation precedes sending auto project data;
- project switch cannot reuse grounding;
- anti-fabrication system instruction present;
- no canonical/map fingerprint mutation.

Validation: focused grounding/context/Chat/routing/presentation tests, chat + extension builds, diff/version/no-lock checks only.

## P3 — adversarial browser qualification and correction closeout — T3

Qualify one exact unchanged-version candidate and write the correction closeout.

### Automated

- `npm run check` once;
- focused grounding/context tests if outside aggregate;
- `npm run codex:phase:validate -- c7-chat-project-grounding`;
- `git diff --check`;
- exact `0.7.31`, internal-reference and no-root-lock checks.

### Direct project questions

On a disposable full Dope project copy with current map state where available, use a real Local model and ask ordinary Chat questions without manually attaching context:
- `what is in test/?`;
- `what is at the repository root?`;
- `does package.json exist?`;
- `does src/definitely-not-real.ts exist?`;
- `where is Chat persistence implemented?`;
- one real Architecture System/Subsystem question;
- one current Physical Map or Flow question.

Require the answer to be backed by visible Auto context whose persisted refs correspond to actual project evidence.

### Adversarial containment

Exercise `../`, an absolute external path, `/tmp` or equivalent, `.dope/` generic access, nonexistent path, symlink-to-outside, and stale/nonexistent map identity. Require rejection/unavailable evidence and no unrelated host/project content in the request or answer.

### Isolation and behavior preservation

Use a second disposable project to prove project-switch isolation. Exercise one manual context turn, one retry with unchanged evidence, one retry after evidence mutation (must fail), one Interactive-routed turn, and one exact-model/no-fallback failure path.

Hash/compare canonical Architecture/Project Mind/Planning files and Physical Map input fingerprint before/after. Grounding must be observation-only.

Inspect the transcript UI for distinct `Auto context` provenance and no absolute filesystem path leakage.

### Closeout

Write `docs/tasks/c7-chat-project-grounding/closeout.md` and update README with exact candidate, focused/aggregate/direct evidence, any bounded repair, residuals and **Green / Not Green**.

A tiny P3 repair is allowed only for defects inside the approved grounding correction. Do not add mutation tools or redesign role routing.

If Green, route next to a fresh Phase 8 Scoped Delegation `/docs-review`.
