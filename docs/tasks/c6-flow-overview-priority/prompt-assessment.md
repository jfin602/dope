# Correction 6 Prompt Assessment — Flow Overview Priority

Status: **APPROVED / READY FOR PROMPT WRITING**
Correction folder: `c6-flow-overview-priority`
Required unchanged package version: `0.6.7`
Activation source: `59573b0dd66935fc78ec1eb0cc34f60644e4f000`
Docs authority baseline: `0ee68113d251faf61a636df317935902dfaa918b`
Phase context: Product Phase 6 P7 Not Green / P8 blocked

## Conclusion

Use exactly two ordered prompts.

1. **P1 — T2 implementation/regression repair.** Correct Flow overview scope, semantic reduction/budgeting, behavioral priority, compatible aggregate collapse, trace independence and truncation presentation. No browser.
2. **P2 — browser/T3 qualification + correction closeout.** Recreate the accepted Adaptive SEO disposable copy, replay the failed GET opportunities Flow in the actual GUI, refresh exact-candidate aggregate/restart/package/native evidence, and close the correction. Browser required.

Use GPT-6 Sol High for both. P1 crosses query/domain/controller/projection/widget boundaries. P2 is the exact real-GUI qualification that previously failed and owns final release evidence.

Both prompts keep package version exactly `0.6.7`.

## Current source findings

### The analyzer has the required behavior

P7 raw deterministic evidence found:
- 66 HTTP `receives` facts;
- 2,015 project `invokes`;
- 93 `reads`;
- 110 `writes`;
- 215 `responds`;
- 2 external calls.

The chosen real behavior is source-backed:

```text
GET /api/workspaces/:workspaceId/projects/:projectId/opportunities
-> inline route handler
-> AdaptiveRepository.list
-> PostgreSQL reads x3
-> response branches
```

Do not reopen P1-P3 analyzer scope merely because the GUI omitted this path.

### Query budgets raw facts before the System projection hides them

`packages/software-map/src/flow-query.ts` currently:
1. sorts every static raw Flow fact by ID;
2. admits in-focus raw facts through the 100-node / 200-fact budget;
3. only afterward creates architecture aggregates.

At System scope, `flow-map-projection.ts` then hides same-Subsystem code-level calls and substitutes summaries. Therefore hidden implementation detail can consume the query budget without appearing on the canvas.

This violates the locked overview intent.

### Flow fact ID order creates accidental behavior priority

`flowFactId()` prefixes IDs with interaction kind. Lexical sorting therefore groups large `invokes` populations ahead of later kinds such as `receives`/responses depending on ID ordering.

With thousands of Adaptive SEO invocations, deterministic ordering becomes accidental admission priority. Overview selection needs an explicit behavioral policy independent of fact identity.

### Shared endpoint anchor is being treated as architecture ownership

`PhysicalFlowEndpoint` has one `anchorNodeId`.

`flow-extractor.ts` preserves the first anchor when several callers resolve to one endpoint:

`anchorNodeId: prior?.anchorNodeId ?? endpoint.anchor`

`queryStaticFlow().inFocus()` then treats an endpoint as in focus through that one anchor. A shared PostgreSQL endpoint can therefore make unrelated callers look relevant to whichever Subsystem happened to own the first anchor.

P7 observed exactly this: Adaptive Recommendations included unrelated Collection/Feed/Installation/etc. repository operations through the shared store.

The endpoint ID must remain shared. The fix is scope semantics, not fake per-Subsystem database endpoints.

### System projection performs another reduction after query

`flow-map-projection.ts` currently maps System code participants to Subsystems and suppresses same-Subsystem internal calls at projection time.

That is useful visual logic, but too late for budgeting. P1 should make the query's System overview output already represent the visible semantic graph, then keep the projection deterministic/disposable.

### Equivalent overview interactions remain one summary per origin

Current aggregation creates one aggregate per raw origin using `aggregate:<origin-id>`.

Authority permits repeated equivalent lower-level interactions to collapse visually while retaining every origin. P1 should group only compatible visible interactions:
- same visible source;
- same visible target;
- same interaction kind;
- equivalent enrichment semantics;
- equivalent behavior metadata.

Union evidence and sorted `originFlowFactIds`. Never merge read/write, incompatible schema/data annotations or incompatible async/retry/error semantics.

### Trace is gated by overview membership

`PhysicalMapController.refreshFlow()` first fetches the overview and only issues the directional trace when the selected ID is present in that bounded overview result.

That makes overview truncation block an otherwise valid trace.

The query/backend already validate project, generation, focus and selected identity. Overview membership is not an authority check.

### Truncation UI exposes an unbounded raw frontier

`physical-map-widget.ts` renders the entire `continueFromIds.join(', ')` inline.

P7 found this truthful but unusable. Default UI should summarize the continuation count and keep any detailed IDs bounded/collapsible.

## Smallest safe implementation boundary

Primary:
- `packages/software-map/src/flow-query.ts`;
- `test/unit/software-map-flow-query.test.ts`.

Likely secondary:
- `packages/theia-extension/src/browser/flow-map-projection.ts`;
- `packages/theia-extension/src/browser/physical-map-controller.ts`;
- `packages/theia-extension/src/browser/physical-map-widget.ts`;
- `test/unit/flow-map-projection.test.ts`;
- `test/unit/physical-map-flow-ui.test.ts`.

Do not change `flow-extractor.ts`, Flow ontology/contracts or endpoint identity unless a focused regression proves a tiny compatibility adjustment is necessary. The expected repair does not require it.

## Required permanent regressions

### Dense overview starvation

Create a System with more than 100 raw implementation participants and hundreds of `invokes`, with an HTTP Input that lexical ordering would previously admit late.

Prove:
- overview reports truncation when applicable;
- evidenced Input remains visible;
- corresponding Output remains visible when within semantic budget;
- interior invocation detail is sacrificed before all behavioral anchors;
- the hard 100/200/32 limits are unchanged.

### Shared-store focus

Create one store endpoint used by code from Subsystems A/B/C and deliberately anchor the endpoint to A.

Focus B.

Prove only B's store interactions enter through focus membership; A/C do not leak solely through the endpoint anchor. Store identity remains one shared endpoint.

### Compatible aggregate collapse

Prove:
- equivalent reads with same visible semantics collapse with all origin IDs/evidence;
- read and write remain separate;
- incompatible enrichment remains separate;
- incompatible async/retry/error metadata remains separate.

### Trace independence

Prove a valid selected node/endpoint can issue a trace inside the current focus even when that identity is absent from a deliberately bounded/truncated overview.

### Truncation presentation

Prove default rendered text reports a bounded summary/count and does not dump all continuation IDs inline.

## P1 validation

T2 only:
- Flow query tests;
- Flow projection/UI/controller tests;
- directly affected Software Map/backend tests if query DTO/service behavior changes;
- affected software-map and Theia-extension builds;
- browser build only if widget/controller bundling changes require it;
- correction prompt validation;
- unchanged-version/no-root-lock checks;
- `git diff --check`.

Do not run full `npm run check`, restart, AppImage/native or manual Adaptive SEO qualification in P1.

## P2 qualification

Use a fresh `/tmp/adaptive-seo-dope-p7` recreated from unchanged `/home/jfin/dev/adaptive-seo-dope`.

Directly prove the previously failed behavior:
- Input is discoverable in the focused overview;
- shared PostgreSQL does not flood the focus with unrelated repository callers;
- downstream/upstream/clear tracing works;
- the GET opportunities route exposes `receives -> handler -> AdaptiveRepository.list -> reads x3 -> response branches`;
- representative edges expose origin/evidence/source;
- real branch/fan-out is visible;
- truncation remains explicit and usable;
- Architecture/Flow identity round-trip remains intact.

Because P1 changes production query/UI code, P2 refreshes final exact-candidate:
- focused Phase 6 suites;
- `npm run check`;
- `npm run test:restart`;
- p6 + correction prompt validation;
- AppImage/package inspection/native launch;
- version/no-root-lock/diff checks.

The inherited file-search `ENOTDIR` remains separate unless it blocks this qualification.

## Green definition

Green means the original P7 failure class is permanently guarded and the actual Dope GUI can expose/trace the real GET opportunities behavior on a final unchanged-`0.6.7` candidate with truthful bounded coverage.

The original P7 evidence remains Not Green history. Green correction evidence makes Phase 6 eligible to resume the P7/P8 qualification path; it does not rewrite that record.
