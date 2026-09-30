# Correction 4 Implementation Plan — sMap Coverage + Iterative Review

Status: **APPROVED / READY**
Correction folder: `c4-synth-coverage-review`
Required unchanged package version: `0.4.6`
Activation source: `4a887ecebc546f9944adf54890143827623e008c`
Assessment source: `77e379f9f7e86d17c69f35b5304802d2054b0268`
Authority: ADR 0014 as amended 2026-09-30 plus ADR 0008-0013 where not amended

## Preflight for every prompt

Read:
- `BOOT.md` / `AGENTS.md`;
- ADR 0008-0014;
- current `ARCHITECTURE.md`, `PRODUCT-MODEL.md`, roadmap and workflow;
- `docs/tasks/c4-synth-improvements/README.md`, P4 evidence and closeout/disposition;
- this correction assessment/plan/README;
- exact current source/tests named by the prompt.

Require:
- package exactly `0.4.6`;
- activation source reachable;
- current prompt stack commit reachable;
- clean intended Git state;
- `c4-synth-improvements` remains closed Not Qualified and P5 remains unexecuted;
- old hierarchical P8/P9 remain unexecuted;
- provider comparison, storage and Phase 5 remain blocked.

Do not hard-code Adaptive SEO vocabulary or expected architecture.

## P1 — Provider attempt ledger and bounded retry reliability

### Goal

Make every real provider attempt observable and retainable, including failure/retry/final-call records, then automatically recover only narrowly classified transient Gemini transport/upstream failures.

### Domain contract

Introduce a compact provider-independent call-attempt record carrying at least:
- stable call/attempt identity;
- stage/call purpose;
- subject;
- provider/model;
- attempt number and retry-parent relationship;
- start/duration;
- request/output byte counts and token usage when available;
- safe failure class;
- cache/reuse state where applicable;
- whether the output was consumed.

The ledger is operational/derived state, not canonical project state.

Progress events may remain a user-facing projection but cannot be the sole retention mechanism.

### Retry rule

Retry only explicitly classified transient transport/upstream failures:
- same provider;
- same selected model;
- same exact stage/request;
- capped attempts;
- visible in attempt ledger/progress;
- no silent provider/model fallback.

Do not automatically retry:
- invalid stage JSON;
- schema/contract validation failure;
- architecture content rejection;
- evidence-reference failure;
- authentication/configuration failure except where existing provider semantics explicitly classify otherwise.

Keep raw provider/secret-bearing errors out of UI/telemetry.

### Likely source/tests

- `packages/software-map/src/hierarchical-synthesis.ts`;
- orchestration/cache implementation reached from current backend;
- `packages/theia-extension/src/node/gemini-synthesis-provider.ts`;
- `packages/theia-extension/src/node/software-map-backend.ts`;
- `test/unit/gemini-synthesis-provider.test.ts`;
- synthesis/backend initialization tests as needed.

### Validation

T1 only:
- focused provider/orchestration/telemetry tests;
- affected package typecheck/build if contracts changed;
- `git diff --check`.

No live provider/browser/restart/package work.

## P2 — README/document evidence, coverage planner and omitted-responsibility recovery

### Goal

Give initial synthesis the repository's own orientation cheaply, add broader documentation as non-authoritative evidence, improve responsibility coverage, and let Subsystem Challenge recover an important responsibility that discovery omitted.

### Root README path

At evidence collection/planning time:
- discover only the project-root `README.md` for the direct initial-orientation channel;
- read it safely under project containment/symlink rules;
- send it directly only to repository-global initial System Discovery/Challenge context as labeled project orientation;
- use the complete README when within the approved deterministic budget;
- when oversized, apply deterministic documented truncation/excerpt behavior and expose that state;
- absence is normal and must not fail analysis;
- do not add an LLM summarization pre-pass.

README text must not become direct production evidence merely because it is model context.

### Broader documentation evidence

Add a distinct deterministic documentation evidence representation. It must:
- preserve project-relative path/provenance;
- classify current architecture/decision docs, package/service READMEs, operations/API/config docs, planning docs and excluded historical/generated material;
- carry bounded claim/content fields;
- never satisfy direct implementation responsibility checks by itself;
- preserve **Observed / Documented / Inferred** semantics through synthesis/review.

Exclude by default:
- `docs/tasks/**`;
- qualification/evidence/closeout artifacts;
- generated prompts/agent artifacts;
- independent benchmark expected architecture/reference material;
- other clearly historical answer-key material.

Do not require every repo to have docs.

### Coverage planner

Add deterministic source-backed coverage cues/ledger entries stronger than raw recurring word frequency.

Prefer cues supported by:
- exported domain/service behavior;
- state/repository ownership tied to behavior;
- worker/job execution;
- provider/integration boundaries;
- public/API/delivery contracts;
- framework registrations tied to application responsibility;
- dependency relationships connecting those behaviors.

Generic recurrence may supplement but not crowd out stronger cues.

The coverage ledger records a substantial cue as:
- represented;
- mapped through challenge recovery/merge/split;
- unresolved.

It is diagnostic, not a score or canonical architecture.

### Recovery contract

Advance the shared stage schema/version when required.

Subsystem Challenge still dispositions every discovery candidate exactly once, but gains a bounded explicit recovery output for a new Subsystem supported by uncovered coverage evidence.

Recovered candidates:
- use normal candidate identity/evidence rules;
- remain inside the challenged System;
- require source-backed implementation evidence;
- cannot be created from documentation-only claims;
- may use docs/README only as orientation/naming/context;
- appear in the coverage ledger.

No target Subsystem count.

### Likely source/tests

- `packages/software-map/src/synthesis.ts`;
- deterministic evidence collection in `@dope/code-analysis` / backend;
- `packages/software-map/src/evidence-planner.ts`;
- `packages/software-map/src/hierarchical-synthesis.ts`;
- provider instruction routing;
- `test/unit/architecture-evidence.test.ts`;
- `test/unit/evidence-planner.test.ts`;
- `test/unit/subsystem-stages.test.ts`;
- `test/unit/software-map-synthesis.test.ts`;
- root `test:product` if a new test file is added.

### Fixtures

Prove:
- useful root README improves orientation but cannot establish unsupported architecture;
- missing README is normal;
- stale/conflicting README/docs stay Documented/unresolved;
- implementation absent from docs remains discoverable;
- historical/qualification answer material is excluded;
- coverage cues retain deterministic provenance;
- challenge can recover one omitted source-backed responsibility;
- documentation-only recovery fails closed.

### Validation

T1 focused, with only the narrow cross-package integration needed to prove safe document collection.

No live provider/browser/package qualification.

## P3 — Typed Component descent and coverage diagnostics

### Goal

Make an empty Component Discovery result explicit and useful rather than silently returning `components: []`.

### Contract

Add compact typed zero-descent disposition equivalent to:
- `leaf-responsibility`;
- `insufficient-evidence`;
- `responsibility-belongs-elsewhere`;
- `no-stable-component-boundary`.

A zero result must cite/resolve parent evidence and pass strict schema validation.

Only `leaf-responsibility` is an affirmative "no Components needed" result. Other dispositions remain visible to reconciliation/review/coverage qualification.

Do not force fake Components.

### Propagation

Carry the disposition through:
- Component stage validation;
- per-System subtree assembly;
- reconciliation/open questions;
- coverage ledger;
- final review detail/diagnostics as appropriate.

A non-empty Component result must not also claim an incompatible zero disposition.

### Likely source/tests

- `hierarchical-synthesis.ts`;
- `reconciliation.ts`;
- `assembly.ts` / final proposal construction as applicable;
- subsystem/reconciliation/synthesis tests.

### Validation

T1 focused only.

## P4 — Branch-local Search Deeper

### Goal

Let the developer refine one System or Subsystem from the current edited review without re-running/replacing the rest of the architecture.

### Targeted request

Introduce a provider-independent targeted-analysis contract that identifies:
- review/session identity;
- target proposal key/kind;
- target branch revision/fingerprint;
- current edited target branch;
- parent System context where needed;
- relevant implementation evidence;
- uncovered/cross-boundary coverage cues;
- relevant README/document context;
- bounded target semantics.

Search Deeper must not become an open-ended agent loop.

### Backend behavior

For System target:
- may refine the System and its descendants.

For Subsystem target:
- may refine/split that Subsystem and Components inside the same parent System;
- may not move unrelated branches.

Return preview state only.

Reject stale output if the target branch changed after request start.

### Frontend/review behavior

Every pending System and Subsystem exposes **Search Deeper**.

The UI:
- shows busy/error state only for the active target;
- previews replacement/refinement;
- exposes explicit **Accept** / **Reject**;
- leaves unrelated Systems/Subystems/Components/manual edits byte-for-byte/logically unchanged;
- remains usable after prior manual edits;
- does not mutate canonical architecture until final architecture acceptance.

Evidence detail distinguishes:
- Observed;
- Documented;
- Inferred.

Source/document navigation remains available.

### Likely source/tests

- shared synthesis/service contracts;
- `packages/theia-extension/src/node/software-map-backend.ts`;
- `packages/theia-extension/src/browser/software-map-controller.ts`;
- `packages/theia-extension/src/browser/software-map-review-widget.ts`;
- `packages/theia-extension/src/browser/dope.css`;
- `test/unit/software-map-initialization.test.ts`;
- `test/unit/software-map-ui.test.ts`;
- focused targeted-synthesis tests.

### Validation

T2:
- focused domain/backend/frontend tests;
- affected build/typecheck;
- targeted project-switch/stale-result tests;
- no live browser qualification yet;
- no full `npm run check`/restart/package.

## P5 — Direct browser review correctness qualification

### Goal

Directly prove the review workflow independent of the later multi-repository architecture-quality gate.

### Browser matrix

Using a controlled project/proposal:
- open pending center review;
- hierarchy is readable;
- select nodes and inspect Observed/Documented/Inferred support;
- source navigation works;
- document navigation works when present;
- rename;
- add/remove/reparent;
- merge/split-equivalent correction;
- invalid draft blocks final acceptance;
- valid explicit acceptance succeeds;
- Search Deeper exists for every System/Subsystem;
- current manual edits are included in targeted request;
- preview does not mutate draft;
- Reject preserves draft;
- Accept replaces only target branch;
- stale target result is rejected;
- unrelated branches/manual edits remain unchanged;
- switch project/root during/after review and prove no stale review/preview leak.

Do not use final canonical acceptance on a real benchmark unless the state is restored.

### Repairs

P5 may repair only concrete review defects exposed by this matrix. Every repair gets a focused regression and only invalidated evidence is replayed.

### Validation

T3 browser gate. Do not run live multi-repo synthesis or packaging here.

Write `P5-review-qualification-evidence.md`.

## P6 — Multi-repository synthesis quality + consolidated final validation

### Goal

Prove architecture quality generically on real/controlled repositories after review mechanics are already qualified.

### Targets

1. Adaptive SEO pinned benchmark:
   - `~/dev/adaptive-seo-dope-p8`;
   - SHA `0b26a25107be7d8dfb2210bc7258ccac8603197e`;
   - push disabled.

2. Dope:
   - use a clean uncontaminated benchmark root/source snapshot;
   - do not permit current task/qualification docs to become synthesis answer material.

3. One smaller structurally clear repository or controlled repo fixture:
   - enough real structure to expose over-segmentation;
   - expected architecture may be used only after freeze.

Use one explicitly selected/probed real Gemini model for controlled qualification. Record exact ID; do not hard-code a current model name in product behavior.

### Documentation qualification

Across targets/fixtures prove:
- useful README orientation;
- no README;
- stale/conflicting docs;
- implementation not mentioned by docs;
- historical/qualification expected-answer exclusions.

### Freeze/compare rule

For each target:
- freeze generated hierarchy before consulting independent expected architecture/reference material;
- then compare material responsibilities captured, omitted/collapsed, technical-layer false boundaries, unresolved items and Component usefulness.

Repository-owned ordinary README/current docs are legitimate synthesis input under ADR 0014; independent expected-answer docs are not.

### Green quality

Do not require exact names/counts.

Green requires:
- major implemented responsibilities represented or explicitly unresolved;
- coverage ledger does not hide material uncovered cues;
- recovered boundaries are evidence-backed;
- empty Component descents are typed and defensible;
- no dominant technical-tier decomposition unless evidence supports it;
- each controlled initial analysis reaches review in <=8 minutes.

Eight minutes is a gate, not an automatic cancellation timeout.

### Consolidated expensive validation

After the last product repair, run once on exact final candidate:
- focused correction guards;
- `npm run check`;
- `npm run test:restart`;
- `npm run codex:phase:validate -- c4-synth-coverage-review`;
- unchanged-version/no-root-lock/Theia/Electron/internal-reference checks;
- Linux AppImage build/inspection;
- native launch/readiness/controlled close where environment permits;
- `git diff --check`.

Do not repeat expensive gates merely for reassurance.

Write `P6-multi-repository-qualification-evidence.md`.

## P7 — Evidence-only closeout

Audit the exact P6 candidate and P5/P6 evidence.

Do not:
- repair source;
- rerun live synthesis;
- rerun browser qualification;
- rebuild AppImage/restart/full check merely to fill missing evidence.

Use cheap deterministic integrity checks only.

Disposition at least:
A. provider attempt/retry reliability;
B. README/document evidence authority;
C. coverage planner/ledger;
D. omitted-responsibility recovery;
E. Component descent diagnostics;
F. Search Deeper branch isolation/staleness;
G. browser developer authority/navigation/project isolation;
H. multi-repository architecture quality;
I. <=8-minute performance;
J. regression/restart/package/version/phase boundaries.

Write `closeout.md` and update correction README truthfully.

If all mandatory gates Green, route to fresh `c4-smap-provider-comparison`. Otherwise keep downstream gates blocked and name the narrow next correction.

## Explicit non-goals

- no Adaptive SEO answer dictionary;
- no forced System/Subsystem/Component count;
- no documentation as physical/canonical truth;
- no independent benchmark architecture references before freeze;
- no provider voting/debate or mixed-provider architecture;
- no aggressive Local-only semantics;
- no Phase 5 visual map/planning;
- no general Agent Runtime/chat/tool calling/delegation;
- no c4 storage implementation;
- no package-version change.
