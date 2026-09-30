# Correction 4 Implementation Plan — Gemini Provider + Compact Shared sMap Pipeline

Status: **APPROVED / QUEUED**
Correction folder: `c4-smap-gemini-provider`
Required unchanged package version: `0.4.6`
Predecessor: `c4-smap-hierarchical-synthesis` after truthful closeout
Authority: ADR 0013 plus ADR 0004/0009-0012 where not amended

## Preflight for every prompt

Read:
- BOOT.md and AGENTS.md;
- ADR 0004 and ADR 0009-0013;
- current ARCHITECTURE, PRODUCT-MODEL, project-overview, roadmap and software-map-storage;
- exact `c4-smap-hierarchical-synthesis` closeout/candidate/evidence;
- this correction README/plan;
- all earlier prompt/results in this correction.

Require:
- package exactly `0.4.6`;
- clean intended Git state apart from runner-owned changes;
- Node 24;
- Theia 1.75.0 / Electron 42.8.1;
- no root package-lock;
- Phase 5 inactive.

Do not reopen/relabel the predecessor. This correction consumes its evidence and remediates the shared synthesis/provider boundary.

## Global time-efficiency rule

P1-P3 run focused permanent tests for changed surfaces and the minimum compile/typecheck/build step necessary to catch integration errors.

Do not repeatedly run:
- the entire `npm run check`;
- full restart matrices;
- Electron packaging/native launch;
- real end-to-end Local synthesis;
- real Gemini synthesis;
- broad browser dogfooding.

Defer those to P4 unless a focused failure demonstrates a cross-cutting regression that cannot safely wait.

Never trade away permanent focused regression coverage merely to save time.

## P1 — Compact provider-independent hierarchical stage contracts

Refactor the current hierarchical stage protocol before adding Gemini.

The current schemas are strict JSON but still carry unnecessary prose-heavy fields. Replace cross-stage model prose with compact typed state.

Define/validate a new stage contract version that can express, as required by each stage:
- packet/view/stage identity;
- temporary candidate key;
- node kind;
- short bounded name/responsibility;
- parent key;
- confidence;
- evidenceRefs;
- ownershipEvidenceRefs;
- typed ambiguity/unresolved codes;
- typed candidate relationships with evidence refs;
- challenge keep/merge/split/reject mappings;
- unresolved candidate/item status.

Remove intermediate requirements for provider-generated:
- boundary rationale;
- free-form rationale;
- sibling distinction;
- arbitrary uncertainty strings;
- subdivision rationale paragraphs;
- finding/reconciliation/verification message prose.

Strict schema must reject surplus prose/fields.

Update:
- validators;
- stage request/result schemas;
- cache/stage identity/version;
- planner/context serialization;
- reconciliation/conflict/verification context;
- final proposal assembly.

Human review must remain understandable. Add deterministic mapping from typed ambiguity/finding codes + candidate/evidence state into concise review/open-question text. Do not add a narration model call.

Preserve complete packet provenance, candidate/proposal/canonical identity separation, developer acceptance and all structural/evidence negative guards.

If the old one-shot Local `synthesize(packet)` path is now dead production code, remove/quarantine it rather than maintaining a second incompatible synthesis protocol; prove callers before removal.

Focused tests only, including permanent guards that reject prose-heavy surplus output and fabricated refs.

## P2 — Gemini provider and shared provider telemetry

Add a Gemini 3.8 Flash adapter behind the existing provider-independent synthesis boundary.

Use the Gemini Developer API / AI Studio API-key path. Keep Google SDK/request/response types out of `@dope/software-map`.

Gemini must:
- implement the exact P1 stage contracts;
- use provider structured output/schema enforcement where supported;
- expose provider capabilities/context/input budget;
- support cancellation/timeout;
- classify authentication, quota/rate-limit and upstream failures without leaking secrets;
- report token usage metadata when available.

Introduce a provider-independent stage execution/usage envelope or equivalent so orchestration can capture:
- input tokens;
- output tokens;
- total tokens;
- measurement source/quality;
- output bytes if easiest at the adapter boundary.

Extend Local adapter telemetry:
- use OpenAI-compatible reported usage when available;
- otherwise retain conservative estimation and label it `estimated`;
- never fabricate exact output usage.

Orchestration, not adapters, measures wall-clock stage duration.

Do not change evidence selection, stage semantics or Local chunking/compression behavior in P2.

Use mocks/fixtures for Gemini; do not spend a real API call yet.

## P3 — Explicit provider selection, secrets and collapsible setup UI

Make the backend configuration/provider selection explicit and provider-neutral.

Required provider modes:
- `local`;
- `gemini`.

Replace LM-Studio-shaped service methods/state where needed without leaking provider-native contracts into Software Map domain semantics.

Gemini key sources:
1. backend `GEMINI_API_KEY`;
2. explicit UI session key held in runtime/process memory.

Never persist a key in:
- `.dope/`;
- StorageService/preferences;
- synthesis provider selection preferences;
- logs;
- progress events;
- cache identities;
- evidence/proposals;
- raw surfaced errors.

Persist only harmless provider UX choices when appropriate.

Analyze Project setup presents independently collapsible sections:

**Local model**
- endpoint;
- loaded context;
- optional local token;
- discover/select model;
- probe/test;
- Analyze with Local.

**Gemini 3.8 Flash**
- clear cloud/repository-evidence disclosure;
- environment-key detected state or password-style session key input;
- fixed initial model label unless later requirements justify model selection;
- Test Gemini connection;
- Analyze with Gemini.

Provider failure ends the run with retry/settings/provider-selection recovery. Never auto-fallback.

Progress UI shows provider/model plus available per-stage timing/token usage without raw prompts or hidden reasoning.

Use focused controller/widget/backend/security tests only. No real full analysis yet.

## P4 — Real same-pipeline Local/Gemini comparison and consolidated qualification

Browser and real providers required.

Use the same clean benchmark source for both providers, preferably the exact Adaptive SEO benchmark clone/commit selected by predecessor P8.

Hold constant:
- repository commit;
- deterministic analyzer inputs;
- planner/stage versions;
- compact intermediate contracts;
- stage order;
- evidence selection;
- reconciliation/verification limits;
- canonical developer-authority rules.

Run the corrected pipeline once through Local and once through Gemini.

Do not introduce a provider-specific repair between the two comparison runs. If a shared defect is found, repair it with permanent regression coverage and replay both affected measurements as needed. If a provider adapter bug is found, repair the adapter without changing shared synthesis semantics.

For every stage/call record:
- provider/model;
- subject;
- planning duration;
- call duration;
- request/output bytes;
- input/output/total tokens and measurement source;
- cache reuse;
- error/retry state;
- candidate/unresolved counts where meaningful.

For each complete run record:
- Systems/Subsystems/Components;
- architecture-quality review;
- provenance/ref validity;
- unresolved/open review items;
- number of model calls;
- total provider-call time;
- deterministic/planning time;
- total input/output tokens with measurement-quality caveats;
- end-to-end elapsed time.

Interpret differences using ADR 0013 diagnostic categories. Do not implement aggressive Local-specific chunking/compression in this prompt merely because the comparison identifies Local as slower; capture the evidence for a later targeted correction.

Also qualify:
- explicit Local/Gemini collapsibles;
- cloud disclosure;
- session/environment key behavior;
- key non-persistence/non-leakage;
- no silent fallback;
- Local probe/warm-up regression;
- cancellation/retry/provider switching;
- restart/project isolation;
- final browser behavior.

Then run consolidated expensive validation once on the exact final candidate:
- focused correction tests;
- full `npm run check`;
- full required restart suite;
- correction prompt validation;
- version/internal-reference/no-root-lock/Theia/Electron checks;
- required Electron build/package/native-launch evidence;
- `git diff --check`.

Do not require a second unnecessary full Local/Gemini architecture run after the exact candidate evidence is already complete.

## P5 — Evidence-only closeout

Audit exact P4 candidate/evidence. Do not repair product behavior and do not rerun live provider synthesis merely to replace missing evidence.

Disposition:
A. compact shared intermediate contracts;
B. canonical/provider boundary;
C. Gemini adapter and AI Studio authentication;
D. secret handling / explicit provider choice / no fallback;
E. Local regression;
F. telemetry correctness/measurement quality;
G. real same-pipeline Local/Gemini architecture quality;
H. timing/token comparison and diagnostic conclusion;
I. UI/progress/cancellation/project isolation;
J. full repository/restart/package/version/phase boundary.

Green requires every mandatory gate Green.

If Green, route to `c4-smap-storage`.

If Not Green, identify the narrow next correction. Do not activate Phase 5.

## Scope guard

No Phase 5 visual Physical/Planning Map canvas, general AI Presence/Agent Mind/chat/tool execution, provider voting/debate, mixed per-stage provider routing, automatic fallback, persistent API-key preference storage, aggressive Local-specific chunking/compression, model-specific architecture contracts or Theia upgrade.
