TASK: Correction 4 / P2 — MODULES/README bootstrap, document evidence, coverage ledger and omitted-responsibility recovery

MODEL / REASONING / USAGE
- Recommended configuration: `GPT-6 Sol High`.
- Browser required: no.

VERSIONING
- Required unchanged project version: `0.4.6`.

VALIDATION TIER / EXECUTION BUDGET
- Tier: **T1 — Focused implementation validation**.
- Target <=8 minutes; 15-minute hard budget.
- Use only the narrow cross-package integration needed to prove safe document collection.

GOAL

Add the optional root `MODULES.md` bootstrap architecture seed and three-state onboarding flow, preserve README/repository-only fallbacks, add broader eligible documentation as provenance-bearing non-authoritative support, make source-backed coverage inspectable, and let Subsystem Challenge recover a substantial responsibility omitted by discovery.

PREFLIGHT

Read BOOT/AGENTS, ADR 0010-0015 including the MODULES/README bootstrap contract, current architecture/product/roadmap/workflow, P1 result, and this correction assessment/plan/README.

Inspect current:
- ArchitectureEvidencePacket/evidence item contracts;
- evidence collection and source fingerprints;
- evidence planner/responsibility signals;
- stage request/cache identities;
- Subsystem Discovery/Challenge contracts and provider instructions;
- relevant tests.

Require exact successful P1 predecessor and package `0.4.6`.

MODULES BOOTSTRAP / ONBOARDING

Add a provider-independent optional root `MODULES.md` architecture-seed input for uninitialized projects.

Detection/choice behavior:
- inspect only project-root `MODULES.md` for this preferred seed channel;
- if present, use it automatically as strong **Documented** architecture intent beside deterministic repository evidence;
- when README also exists, keep README as secondary project orientation;
- if MODULES is absent but root README exists, present a recommendation to create MODULES and an immediate **Continue with README** action;
- if neither exists, present the MODULES recommendation and an immediate **Analyze repository anyway** action;
- no documentation file is required and declining creation must not block analysis.

MODULES content should be treated as System -> Subsystem architecture intent: purpose, responsibilities, primary paths, major dependencies and explicit uncertainty. Do not require it to enumerate Components/files/classes/functions.

Safely resolve/read it under existing containment/symlink rules. Apply a deterministic bounded content policy and expose presence/size/truncation state. MODULES selection/content/hash/budget must participate in affected request/cache identity.

Authority:
- MODULES is **Documented**, never **Observed**;
- it may guide naming, grouping, candidate boundaries and verification priorities;
- conflicting source/framework/runtime evidence remains visible and can override the proposal's interpretation of current implementation;
- MODULES alone cannot establish a physical boundary or recovered Subsystem;
- after explicit architecture acceptance, `.dope/architecture.json` remains canonical;
- routine refresh/re-analysis must not silently re-import later MODULES edits;
- do not implement automatic MODULES/canonical bidirectional synchronization in this correction.

Expose a portable **Prepare this repository for Dope** prompt/copy affordance from the recommendation path. Its content must instruct another AI coding environment to analyze the actual repository and create only a root `MODULES.md` describing System -> Subsystem purpose/responsibilities/primary paths/major dependencies, use repo/docs/package/runtime/import/build/infra/test evidence, preserve uncertainty, avoid exhaustive implementation enumeration, and not modify application code.

ROOT README ORIENTATION

Add a provider-independent project-orientation input for the root `README.md`:
- only the project-root README belongs in this direct orientation channel;
- safely resolve/read under existing project containment/symlink rules;
- include it directly in initial repository-global System Discovery context, and System Challenge where needed to preserve orientation; when MODULES is present, README remains secondary orientation rather than the architecture seed;
- label it as project orientation, never direct physical evidence;
- complete README when it fits the deterministic orientation budget;
- deterministic documented truncation/excerpt + visible `truncated` state when oversized;
- no README is a normal empty orientation;
- do not add an LLM summarization/preprocessing call.

README content/hash/truncation policy must participate in request/cache identity so changed README context cannot reuse stale synthesis output.

Do not allow README text alone to satisfy direct production-behavior support for a System/Subsystem/Component.

DOCUMENTATION EVIDENCE

Add the smallest explicit deterministic documentation support type/contract needed to preserve **Documented** claims separately from Observed implementation evidence.

Treat root `MODULES.md` as the dedicated bootstrap architecture-seed document rather than rediscovering it as an undifferentiated broader-doc item. Eligible broader discovery may include:
- accepted architecture/decision/contract docs;
- package/service READMEs;
- deployment/runbooks/operations docs;
- API/protocol/config docs;
- textual/Mermaid architecture descriptions;
- developer guidance materially describing current responsibilities.

Each document support record must preserve:
- project-relative source path;
- deterministic source/document class;
- currentness/status only when deterministically knowable;
- bounded text/claim/section content;
- content/source fingerprint/provenance sufficient for cache invalidation and source navigation.

Exclude by default:
- `docs/tasks/**`;
- validation/evidence/closeout artifacts;
- generated prompts/agent artifacts;
- independent benchmark expected architecture/reference material;
- clearly historical answer-key material.

Roadmap/design/planning docs may be lower-confidence orientation/support but cannot become physical truth.

Do not use a model to classify/extract docs before synthesis.

OBSERVED / DOCUMENTED / INFERRED

Preserve the distinction in Dope-owned contracts:
- **Observed** = implementation/framework/runtime evidence;
- **Documented** = repository-authored claim/context;
- **Inferred** = synthesis conclusion/proposal.

Documentation-only support may guide naming, candidates, open questions or evidence requests. It cannot independently establish current implemented architecture or a recovered Subsystem.

COVERAGE LEDGER

Replace/augment frequency-shaped responsibility coverage with deterministic source-backed coverage cues.

Prioritize meaningful behavior signals such as:
- exported domain/service behavior;
- state/repository ownership connected to behavior;
- worker/job execution;
- provider/integration boundaries;
- public/API/delivery contracts;
- framework registrations tied to application behavior;
- dependency links joining the same responsibility across areas.

Generic recurring vocabulary can supplement these cues but must not crowd them out merely by frequency.

Create an inspectable deterministic coverage ledger where each substantial cue is:
- represented by a surviving boundary;
- carried through merge/split/recovery mapping;
- unresolved.

Ledger entries cite parent packet implementation evidence. Documentation may annotate a cue but cannot make an unsupported cue "covered."

The ledger is diagnostic state, never canonical architecture and never a target-count score.

SUBSYSTEM RECOVERY

Advance stage/view/cache versions only as required.

Subsystem Challenge must still disposition every discovery candidate exactly once, but add an explicit bounded recovery mechanism for an omitted responsibility.

A recovered Subsystem:
- stays under the challenged System;
- has ordinary candidate identity/name/responsibility/confidence/ambiguity fields;
- cites valid source-backed implementation evidence/ownership refs;
- is tied to an uncovered coverage cue;
- may use README/docs for orientation/naming only;
- cannot be created from documentation-only evidence;
- appears in downstream Component descent/reconciliation/coverage accounting.

Do not rerun unlimited discovery and do not force a target count.

PROVIDER INSTRUCTIONS

Update shared Local/Gemini semantics together.

Tell the model:
- root MODULES is strong documented architecture intent, not proof or canonical truth;
- root README is secondary orientation, not proof;
- documented claims must be corroborated for implemented boundaries;
- challenge may recover one or more source-backed omitted responsibilities when coverage warrants it;
- unresolved is preferable to unsupported invention.

No Adaptive SEO-specific names.

FIXTURES / REGRESSIONS

Prove:
1. root MODULES is detected and present in initial global context as Documented architecture intent, not direct evidence/canonical state;
2. MODULES + README uses MODULES as preferred architecture seed and README as secondary orientation;
3. missing MODULES + README exposes recommendation + **Continue with README** and succeeds;
4. missing MODULES + missing README exposes recommendation + **Analyze repository anyway** and succeeds;
5. portable **Prepare this repository for Dope** prompt is available and bounded to MODULES creation/no application-code edits;
6. stale/conflicting MODULES remains Documented and cannot override source-backed current implementation;
7. accepted canonical architecture is not silently changed by later MODULES edits/ordinary refresh;
8. useful README is present in initial global context and helps naming/orientation without becoming direct evidence;
9. missing README succeeds;
10. oversized README uses deterministic budget/truncation and cache identity;
11. stale/conflicting docs remain Documented/unresolved;
12. implementation absent from docs can still be covered/discovered;
13. historical task/qualification answer material is excluded;
14. document support has deterministic provenance/source navigation metadata;
15. strong source-backed coverage cues outrank noisy generic recurrence;
16. challenge can recover an omitted source-backed Subsystem;
17. documentation-only recovery fails closed;
18. changed MODULES/README/doc inputs invalidate affected synthesis cache identity.

Update `test:product` only if adding test files.

FOCUSED VALIDATION

Run:
- architecture-evidence / evidence-planner / subsystem-stage / synthesis focused tests;
- narrow document-collection test;
- affected package typecheck/build;
- `git diff --check`.

Do not run live providers, browser qualification, full `npm run check`, restart, packaging or native launch.

FINAL RESPONSE

Report:
- MODULES detection/onboarding/authority/cache contract and bootstrap prompt;
- README orientation contract/budget;
- documentation evidence/exclusion rules;
- Observed/Documented/Inferred representation;
- coverage ledger contract;
- recovery semantics;
- focused test results;
- unchanged `0.4.6`;
- readiness for P3.
