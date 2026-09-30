TASK: Correction 4 / P2 — README/document evidence, coverage ledger and omitted-responsibility recovery

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

Give initial repository-global synthesis the project's own root README as bounded orientation, add broader eligible documentation as provenance-bearing non-authoritative support, make source-backed coverage inspectable, and let Subsystem Challenge recover a substantial responsibility omitted by discovery.

PREFLIGHT

Read BOOT/AGENTS, ADR 0010-0014 including the README/document amendment, current architecture/product/roadmap/workflow, P1 result, and this correction assessment/plan/README.

Inspect current:
- ArchitectureEvidencePacket/evidence item contracts;
- evidence collection and source fingerprints;
- evidence planner/responsibility signals;
- stage request/cache identities;
- Subsystem Discovery/Challenge contracts and provider instructions;
- relevant tests.

Require exact successful P1 predecessor and package `0.4.6`.

ROOT README ORIENTATION

Add a provider-independent project-orientation input for the root `README.md`:
- only the project-root README belongs in this direct orientation channel;
- safely resolve/read under existing project containment/symlink rules;
- include it directly in initial repository-global System Discovery context, and System Challenge where needed to preserve orientation;
- label it as project orientation, never direct physical evidence;
- complete README when it fits the deterministic orientation budget;
- deterministic documented truncation/excerpt + visible `truncated` state when oversized;
- no README is a normal empty orientation;
- do not add an LLM summarization/preprocessing call.

README content/hash/truncation policy must participate in request/cache identity so changed README context cannot reuse stale synthesis output.

Do not allow README text alone to satisfy direct production-behavior support for a System/Subsystem/Component.

DOCUMENTATION EVIDENCE

Add the smallest explicit deterministic documentation support type/contract needed to preserve **Documented** claims separately from Observed implementation evidence.

Eligible discovery may include:
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
- root README is orientation, not proof;
- documented claims must be corroborated for implemented boundaries;
- challenge may recover one or more source-backed omitted responsibilities when coverage warrants it;
- unresolved is preferable to unsupported invention.

No Adaptive SEO-specific names.

FIXTURES / REGRESSIONS

Prove:
1. useful README is present in initial global context and helps naming/orientation without becoming direct evidence;
2. missing README succeeds;
3. oversized README uses deterministic budget/truncation and cache identity;
4. stale/conflicting docs remain Documented/unresolved;
5. implementation absent from docs can still be covered/discovered;
6. historical task/qualification answer material is excluded;
7. document support has deterministic provenance/source navigation metadata;
8. strong source-backed coverage cues outrank noisy generic recurrence;
9. challenge can recover an omitted source-backed Subsystem;
10. documentation-only recovery fails closed;
11. changed README/doc inputs invalidate affected synthesis cache identity.

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
- README orientation contract/budget;
- documentation evidence/exclusion rules;
- Observed/Documented/Inferred representation;
- coverage ledger contract;
- recovery semantics;
- focused test results;
- unchanged `0.4.6`;
- readiness for P3.
