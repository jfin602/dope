# Correction 4 Implementation Plan — Gemini Provider + Compact Shared sMap Pipeline

Status: **APPROVED / READY**
Correction folder: `c4-smap-gemini-provider`
Required unchanged package version: `0.4.6`
Predecessor: `c4-smap-hierarchical-synthesis` implementation through P7 at reachable commit `66f023f717afd63433d442015b575edf049ae1b6`; P8/P9 superseded/unexecuted under ADR 0013
Authority: ADR 0013 plus ADR 0004/0009-0012 where not amended

## Source trace

Current implementation seams:
- `packages/software-map/src/hierarchical-synthesis.ts` owns `SynthesisProvider`, capabilities/budgeting, strict staged request/results, progress contracts and final proposal assembly.
- `packages/software-map/src/evidence-planner.ts` creates deterministic bounded evidence views under provider capability.
- `packages/software-map/src/system-discovery.ts`, `system-challenge.ts`, `per-system-discovery.ts` and `reconciliation.ts` implement the hierarchy-first sequence.
- `packages/theia-extension/src/node/lmstudio-synthesis-provider.ts` translates stages to the OpenAI-compatible Local endpoint and currently asks for prose-heavy rationale/uncertainty fields.
- `packages/software-map/src/service.ts` and `packages/theia-extension/src/node/software-map-backend.ts` expose/implement a Local-shaped setup API even though the analysis provider itself is generic.
- `packages/theia-extension/src/browser/software-map-controller.ts` and `software-map-widget.ts` own setup/progress state and currently render Local-only configuration.
- `SynthesisTiming` currently measures duration/cache reuse but not tokens/bytes/provider kind.
- `@dope/theia-extension` has no Gemini SDK dependency.
- root `test:product` enumerates tests explicitly, so new provider tests must be wired into the aggregate.

## Preflight for every prompt

Read:
- BOOT.md and AGENTS.md;
- ADR 0004 and ADR 0009-0013;
- current ARCHITECTURE, PRODUCT-MODEL, project-overview, roadmap and software-map-storage;
- reachable hierarchical P7 implementation commit `66f023f717afd63433d442015b575edf049ae1b6` and exact P1-P7 implementation history/results; read predecessor P8 prompt only as the approved benchmark specification, not as completed evidence;
- this correction assessment/plan/README;
- all earlier prompts/results in this correction.

Require:
- hierarchical P7 implementation commit `66f023f717afd63433d442015b575edf049ae1b6` is reachable; P8/P9 are not prerequisites and must remain truthfully unexecuted/superseded;
- package exactly `0.4.6`;
- clean intended Git state apart from runner-owned changes;
- Node 24;
- Theia 1.75.0 / Electron 42.8.1;
- Yarn 1 workspace discipline and no root package-lock;
- Phase 5 inactive.

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

Refactor the current strict-but-prose-heavy stage protocol before adding Gemini.

Use a new synthesis stage/contract version and update cache/work identity accordingly.

The provider-facing intermediate contract should contain only downstream-required architectural state. Define bounded typed structures for:
- packet/view/stage identity;
- temporary candidate key;
- node kind/name/parent;
- short bounded responsibility;
- confidence;
- evidenceRefs / ownershipEvidenceRefs;
- typed ambiguity/unresolved codes;
- typed candidate relationships when the next stage needs them;
- challenge keep/merge/split/reject mappings;
- unresolved candidate/item status.

Remove model-authored intermediate requirements for:
- boundary rationale;
- free-form rationale;
- sibling distinction;
- arbitrary uncertainty strings;
- subdivision rationale paragraphs;
- finding/reconciliation/verification message prose.

Strict provider-independent validation rejects surplus fields/prose and fabricated refs.

Update all producers/consumers together:
- stage schemas/parser;
- stage context serialization;
- planner assumptions;
- discovery/challenge/subtree/reconciliation/verification flow;
- structural conflict generation;
- final proposal assembly;
- Local stage instructions/schemas;
- affected fixtures/tests.

Human review must remain useful. Map typed findings/ambiguity plus deterministic evidence into concise final rationale/open-question text outside the provider data bus. Do not add another LLM narration call.

Preserve:
- full ArchitectureEvidencePacket;
- provider-derived budgets;
- whole evidence items and original refs;
- System -> Subsystem -> Component structural validation;
- proposal-only candidate identity;
- developer review/correction/explicit acceptance;
- bounded reconciliation/verification;
- progress safety.

Inspect the legacy Local one-shot `synthesize(packet)` method and all repository callers. If dead after hierarchical orchestration, remove it and its obsolete tests/instructions rather than keep a second incompatible protocol. If a live caller remains, return Planning needed rather than silently creating dual semantics.

Focused validation:
- build/typecheck the Software Map and affected extension surface as needed;
- run synthesis/planner/System/challenge/per-system/reconciliation and Local-provider focused tests;
- add permanent guards that prose-heavy surplus output is rejected;
- `git diff --check`.

Do not run real Local/Gemini inference, full restart, package or full `npm run check` in P1.

## P2 — Gemini provider + provider-independent telemetry

Add Gemini 3.8 Flash behind the exact P1 `SynthesisProvider` semantics.

Dependency/runtime:
- add the current official `@google/genai` package to `@dope/theia-extension` using Yarn;
- update `yarn.lock`;
- never create `package-lock.json`;
- keep Google SDK/native response types in the node adapter.

Gemini adapter requirements:
- fixed initial model `gemini-3.8-flash`;
- Gemini Developer API / AI Studio API-key authentication;
- strict structured JSON generation against a provider-compatible projection of the P1 schema;
- parse/validate the raw output through the same full Dope stage validator Local uses;
- do not weaken Dope schema/domain validation merely because Gemini supports only a subset of JSON Schema;
- provider capabilities/context budget;
- cancellation/timeout;
- sanitized auth/quota/429/upstream error classes/messages;
- no secret echo.

Do not make remote token counting part of every evidence-planner estimate loop. Keep budgeting safe and bounded without multiplying API requests. Normalize actual provider-reported response usage when available.

Add a provider-independent execution/usage envelope or equivalent:
- output;
- inputTokens?;
- outputTokens?;
- totalTokens?;
- tokenMeasurement: `provider-reported | tokenizer | estimated | unavailable`;
- requestBytes;
- outputBytes.

Orchestration measures call duration. Extend `SynthesisTiming`/analysis telemetry with provider/model and normalized usage/size data while preserving cache semantics: reused results record zero new provider tokens/call time and remain distinguishable from fresh calls.

Extend Local:
- capture OpenAI-compatible `usage` if LM Studio supplies it;
- otherwise report conservative input estimates as `estimated`;
- never invent exact output/total counts.

Focused tests:
- new Gemini provider mocked tests for auth header/client config, model, structured output, schema projection, success, malformed result, cancellation/timeout, 401/403, 429, 5xx and secret redaction;
- Local telemetry regression;
- cache/reconciliation timing/usage tests;
- wire new test files into root `test:product`;
- build/typecheck affected packages;
- `git diff --check`.

No real Gemini request and no full aggregate/restart/package pass in P2.

## P3 — Explicit provider selection, secrets and collapsible setup UI

Make the setup/service path provider-neutral without constructing the future general Model Runtime.

Define a narrow Dope-owned synthesis provider selector/config:
- provider kind `local | gemini`;
- Local-only endpoint/context/token/model discovery/probe state;
- Gemini-only readiness/key-source state;
- selected provider identity used by analysis/cache/telemetry.

Backend:
- configure/select/probe the chosen provider explicitly;
- hold pasted Gemini key only in backend/runtime memory;
- allow backend `GEMINI_API_KEY` detection/use without returning the secret;
- clear provider/session secret/readiness on detach/reconnect where appropriate;
- never persist API keys to project or browser preference state;
- no automatic fallback on setup/call failure.

Frontend/controller:
- persist only harmless selection/preferences (for example provider kind, Local endpoint/model) if useful;
- never persist Gemini key;
- keep request/project generation guards;
- maintain manual/existing architecture routes and decline/cancel semantics.

Widget:
- Analyze Project setup contains independently collapsible **Local model** and **Gemini 3.8 Flash** sections, preferably accessible native `details/summary` or equivalent;
- Local shows current LM Studio controls;
- Gemini shows cloud disclosure that bounded repository synthesis evidence is sent to Google's Gemini API;
- Gemini key input is password-style when an environment key is not being used;
- show environment-key-detected state without exposing value;
- separate Test/Probe and Analyze actions;
- provider choice is explicit;
- progress shows provider/model and normalized timing/token metadata when present;
- no raw prompts, chain-of-thought, key material or misleading exact token values when measurement is only estimated/unavailable.

Focused validation:
- backend/provider-selection tests;
- secret non-persistence/redaction tests;
- software-map controller/widget tests for independent collapsibles and provider switching;
- initialization/cancel/root-switch regressions;
- build/typecheck affected packages;
- `git diff --check`.

No live full synthesis, restart matrix, AppImage or full `npm run check` in P3.

## P4 — Real same-pipeline Local/Gemini comparison + consolidated qualification

Browser and real providers required.
The bounded post-P3 model-selection one-off supersedes P2's fixed Gemini 3.8 Flash assumption for P4. Discover available generation models, explicitly select and successfully probe one, then record that exact model ID throughout the Gemini run. No automatic fallback.

Benchmark:
- use the exact clean Adaptive SEO benchmark root and pinned SHA recorded by predecessor hierarchical P8 evidence;
- verify fetch is enabled and push remains disabled;
- restore the benchmark to exact pinned/clean state before each provider run;
- do not expose/use live customer credentials;
- if predecessor evidence did not establish an exact usable benchmark, stop with the specific prerequisite/evidence gap rather than silently substituting another repository.

Hold constant between Local and Gemini:
- benchmark commit;
- Dope candidate;
- analyzer inputs;
- planner/stage/contract versions;
- compact schemas and stage order;
- evidence-selection rules;
- reconciliation/verification bounds;
- developer-authority semantics.

Run one fresh Local analysis and one fresh Gemini analysis. Avoid cache contamination between provider comparison runs; provider identity remains part of cache identity.

Record every stage/call:
- provider/model;
- subject;
- planning duration;
- fresh provider-call duration;
- request/output bytes;
- input/output/total tokens + measurement source;
- cache reuse;
- retry/error;
- candidate/unresolved counts.

Record each complete run:
- packet/planner identity;
- exact Systems/Subsystems/Components;
- initial/challenged hierarchy where useful;
- architecture-quality assessment;
- provenance/ref validation;
- unresolved/open review items;
- model-call count;
- total provider-call time;
- deterministic/planning/assembly time;
- total token/byte volume with measurement caveats;
- end-to-end elapsed time.

Assess results using ADR 0013:
- comparable quality + much slower Local => local model/runtime bottleneck evidence;
- materially better Gemini from same input => model capability evidence;
- both slow/oversized => shared design/planner evidence;
- both materially improved vs predecessor => prior prose-heavy protocol bottleneck evidence.

Do not add aggressive Local-specific chunking/compression, different Local stage semantics or provider-specific architecture prompts after seeing the first result. Preserve comparison integrity. Product repair is allowed only for a concrete shared defect or provider-adapter defect, with permanent coverage and appropriate replay.

Direct UI/security/lifecycle qualification:
- independently collapsible Local/Gemini setup;
- cloud disclosure;
- environment and session key paths without revealing key;
- no key in preferences/.dope/log/progress/error/cache/evidence;
- explicit provider selection;
- no silent fallback;
- Local probe/warm-up remains functional;
- Gemini test/readiness works;
- cancel/retry/provider switching/root switching;
- review/source navigation/developer correction/acceptance;
- manual/existing declaration still works with no provider where applicable.

Evidence file:
Create `docs/tasks/c4-smap-gemini-provider/P4-local-gemini-comparison-evidence.md` with exact candidate/benchmark/provider identities, setup, security checks, per-stage telemetry tables, both hierarchies, quality comparison, diagnostic conclusion, UI/lifecycle proof, repairs/replays and residual gaps. Never write the API key.

Consolidated expensive validation on the exact final candidate:
- focused correction tests;
- `npm run check`;
- `npm run test:restart`;
- `npm run codex:phase:validate -- c4-smap-gemini-provider`;
- unchanged-version/no-root-lock/Theia/Electron/internal-reference checks;
- build/package the exact Linux AppImage and record path/mode/size/SHA-256/embedded version/composition;
- native launch/readiness/controlled close where environment permits;
- `git diff --check`.

Do not run a second unnecessary full provider comparison after complete exact-candidate evidence already exists.

## P5 — Evidence-only closeout

Audit exact P4 evidence/candidate. Do not repair product behavior and do not rerun live Local/Gemini synthesis merely to replace missing evidence.

Disposition:
A. compact shared intermediate contracts;
B. provider-neutral canonical boundary / schema enforcement;
C. Gemini adapter + AI Studio authentication;
D. secret handling / explicit choice / no fallback;
E. Local regression;
F. timing/token/size telemetry correctness and measurement quality;
G. real same-pipeline Local/Gemini architecture quality;
H. timing/token comparison and diagnostic conclusion;
I. UI/progress/cancellation/project isolation/developer authority;
J. full repository/restart/package/version/phase boundary.

Green requires all mandatory gates Green.

If Green, route to `c4-smap-storage`; do not activate Phase 5 directly.

If Not Green, identify the narrow next correction and keep storage/Phase 5 blocked.

## Scope guard

No Phase 5 visual Physical/Planning Map canvas, general AI Presence/Agent Mind/chat/tool execution, provider voting/debate, mixed per-stage provider routing, automatic fallback, persistent API-key preference storage, aggressive Local-specific chunking/compression, model-specific canonical architecture contracts or Theia upgrade.
