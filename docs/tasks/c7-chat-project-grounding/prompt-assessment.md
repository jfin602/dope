# Correction 7 Prompt Assessment — Chat Project Grounding

Status: **APPROVED / PROMPTS WRITTEN / READY FOR EXECUTION**
Correction folder: `c7-chat-project-grounding`
Required unchanged package version: `0.7.31`
Activation/source baseline: `2a83c637415f682b91d60babd8f89c6cb896662a`

## Conclusion

Use exactly three ordered prompts.

| Prompt | Boundary | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | deterministic project-grounding engine + safe repository/map evidence | T1/T2 | GPT-6 Sol High | no |
| P2 | Chat composition/retry/routing integration + Auto context UI/provenance | T2 | GPT-6 Sol High | no |
| P3 | adversarial exact-candidate browser/integration qualification + correction closeout | T3 | GPT-6 Sol High | yes |

This is the smallest safe split. The grounding engine owns filesystem/map truth and containment. Chat integration then consumes that stable result while preserving role routing, hosted egress, retry and context-budget behavior. P3 concentrates expensive direct evidence once.

## Current-source findings

### Normal Chat is not automatically grounded

`ChatContextComposer.compose()` currently supplies recent Chat history, manually selected typed context and the developer message. With no manual attachment, a question such as `what is in test/?` can reach the model without repository evidence.

The conversational Model Runtime exposes no filesystem/tool API. The existing manual-file path is realpath-contained, so unrelated file claims from an ungrounded turn are model fabrication rather than legitimate cross-project reads.

### Existing context refs are a good provenance substrate

`ChatUserMessage.contextRefs` already persists bounded references, token estimates, hashes and map generation/project IDs. Extend this contract minimally so a ref can identify **automatic** versus manual origin; do not create a second hidden provenance store.

Prefer an optional backward-compatible `origin: manual | automatic` (or equivalent strict field) on `ChatContextRef`. Existing persisted refs without it remain manual by migration/defaulting. Directory/search evidence may use narrow new context kinds if required to describe semantics cleanly; do not overload `file` with ambiguous directory/search payloads.

### Existing allowedSources must not accidentally disable the correction

Current Chat defaults set `allowedSources: []`; that list governs manual context attachment. The grounding correction must therefore not silently gate its core automatic repository/map evidence on that existing list.

Automatic grounding is core project-Chat behavior. If a new explicit grounding preference is introduced, default it enabled and keep it separate from manual attachment eligibility. Do not create a broad settings subsystem merely for this correction.

### Ground before final composition, after project/model intent is known

Grounding should run locally against the active canonical project root before the final model request. The final context budget must be calculated against the actual selected/resolved model, including role-following Chat.

For role fallback, recomposition on another candidate may change token truncation but must not change **which grounding evidence identities/facts were selected**. If the fallback model cannot fit the same evidence contract safely, fail rather than silently answering from a materially different evidence set.

Hosted egress rules remain authoritative. Automatic grounding may inspect locally before confirmation, but no retrieved project evidence may be sent to a hosted model until the existing Chat egress authority is satisfied.

### Retry must remain evidence-stable

Current retry rejects changed/missing manual context. Automatic grounding must follow the same principle: recompute against current project state and require the same persisted evidence identity/hash/generation set. If the project/map changed, the retry fails clearly and asks for a fresh turn rather than silently answering against new facts.

### Repository grounding needs its own bounded reader/searcher

`SoftwareMapIndex` supplies current Physical Map/Flow truth but is not a general repository search index. Add a dedicated backend `ChatProjectGrounder` / `ProjectGroundingService` beside `ChatContextComposer`.

Repository operations are project-relative and bounded:
- list directory;
- read file;
- path/file search;
- text search.

Use deterministic lexical/path cues rather than an LLM planning call. Initial intent coverage should handle explicit project-relative paths, existence/listing questions, obvious implementation-location queries and direct Architecture/Physical Map/Flow language.

Do not recursively index unbounded generated/vendor/dependency trees. Define one explicit skip policy for generic search/list traversal (at least `.git`, `.dope`, `node_modules`, generated/build/dist/vendor-like outputs) while still allowing a developer to ask about an explicitly named ordinary project directory when safe.

### Anti-fabrication must be both instruction and evidence contract

Every grounded Chat request should carry a compact system instruction that project facts are verified only from supplied evidence and that it must not claim to have read/listed/searched/inspected anything not present in turn evidence.

This prompt wording is defense-in-depth. Tests and qualification must prove backend evidence retrieval, containment and provenance rather than treating the instruction itself as sufficient.

### Orientation should stay tiny

Provide a small deterministic project orientation: attached project, Architecture availability and Physical Map status/generation, plus an optional bounded top-level outline. Do not send the developer's absolute machine path.

## Risk assessment

Highest risks:
1. path traversal or symlink escape;
2. accidental `.dope/`, dependency or unrelated-project leakage;
3. automatic retrieval exhausting small model context windows;
4. retry/fallback using different evidence than the original turn;
5. hidden auto-context that the developer cannot inspect;
6. hosted role routing sending newly retrieved data without existing egress authority;
7. broad text search becoming a slow pseudo-indexer;
8. grounding logic drifting into Phase 8 tool/delegation authority.

## Validation strategy

### P1 — focused engine evidence

Run only the new grounding tests, directly affected map/query tests and the narrow extension build. No provider/browser/package/restart suite.

### P2 — focused Chat integration

Run focused Chat/context/routing/repository/UI regressions and the extension/chat builds. No `npm run check`, no package build, no manual browser.

### P3 — one T3 qualification/closeout

Run the aggregate gate once plus direct browser/live Local/adversarial project grounding on disposable projects. No hosted paid call is required to prove egress denial/authorization wiring; do not spend quota just to repeat qualified routing behavior.
