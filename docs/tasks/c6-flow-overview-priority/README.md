# Correction 6 — Flow Overview Priority

Status: **IMPLEMENTED / TARGET FLOW EXPOSED / HISTORICAL P7 REPAIR**
Correction folder: `c6-flow-overview-priority`
Required unchanged version: `0.6.7`
Activation source: `59573b0dd66935fc78ec1eb0cc34f60644e4f000`
Phase context: Product Phase 6 P7 Not Green / P8 blocked
Authority: ADR 0021, current Phase 6 plan, ARCHITECTURE, PRODUCT-MODEL, stability contract, and `docs/tasks/p6/P7-flow-dogfooding-evidence.md`

## Purpose

Repair the bounded Flow overview/query semantics exposed by the real Adaptive SEO P7 failure without changing Flow truth, accepted architecture, hard query limits or provider boundaries.

The analyzer already proves the target behavior exists:

```text
GET opportunities
-> route handler
-> AdaptiveRepository.list
-> three PostgreSQL reads
-> response branches
```

P7 failed because the real GUI could not expose that behavior as a traceable focused Flow.

## Root causes

1. **Budget before semantic reduction.** Raw CodeEntity facts consume the 100-node/200-fact budget before System/Subsystem overview aggregation, even when the presentation later hides that detail.
2. **Accidental lexical priority.** Flow fact ID sorting favors large interaction-kind groups such as `invokes`, allowing internal calls to starve behavioral Inputs.
3. **Shared endpoint scope leak.** A shared store endpoint owns one `anchorNodeId`; treating that anchor as scope ownership can pull unrelated callers into a focused Subsystem.
4. **Under-collapsed overview interactions.** Equivalent lower-level facts remain one summary per origin instead of one compatible visible interaction with multiple origins.
5. **Trace/overview coupling.** The controller issues a trace only when the selected identity survives the bounded overview result.
6. **Unusable truncation detail.** The default UI may print a long raw `continueFromIds` frontier inline.

## Locked correction laws

- Overview budgets count the semantic Flow actually rendered, not hidden raw implementation detail.
- Semantic reduction/aggregation occurs before visible overview budgeting.
- Overview admission uses explicit behavioral priority, not fact-ID lexical ordering.
- If a focused scope has evidenced Inputs, truncation may remove interior detail but must not remove every evidenced Input.
- Shared derived endpoints are shared infrastructure, not architecture-scope owners. Scope membership is fact-relative to the code-side participant(s).
- Equivalent overview interactions may collapse only when visible source, visible target, interaction kind, enrichment and behavior semantics are compatible. All origin IDs/evidence remain inspectable.
- Distinct interaction kinds, incompatible enrichment and incompatible behavior metadata never merge.
- A valid selected Flow endpoint/node may be traced within its current focus even if absent from the current overview.
- Truncation remains explicit, but default UI summarizes continuation count instead of dumping an unbounded raw-ID list.
- Keep the existing 100-node / 200-fact / 32-hop hard limits.
- Keep package version exactly `0.6.7`.

## Scope guard

Do not change:
- P1 Flow ontology/contracts except a narrowly necessary query DTO change;
- TypeScript/Express/PostgreSQL/external extraction truth unless a regression test proves the query repair cannot work without a small producer fix;
- accepted Adaptive SEO `.dope/architecture.json` or `.dope/smap.json`;
- provider/model requirements;
- Flow persistence;
- layout engine dependencies;
- Phase 7 AI scope;
- inherited file-search `ENOTDIR` unless it directly blocks correction qualification.

## Execution

This correction is deliberately one manual one-off prompt:

`one-off-flow-overview-priority.txt`

Use **GPT-6 Sol High** with browser/manual capability. Do not run this folder through `codex:phase`.

The one-off performs the bounded implementation repair, focused regression validation, direct Adaptive SEO GUI replay, final T3 release evidence and correction closeout in one pass.
## Exit

Green requires the real Dope GUI to expose and trace the previously blocked Adaptive SEO behavior with truthful bounded coverage:

```text
GET opportunities
-> receives
-> handler
-> AdaptiveRepository.list
-> three PostgreSQL reads
-> response branches
```

The focused view must no longer be flooded by unrelated calls solely through the shared PostgreSQL endpoint. Representative edges must expose provenance/source navigation. Final candidate release/restart/package/native evidence must be refreshed after the query/UI repair.

A Green correction does not rewrite the original P7 run as Green. It makes Phase 6 eligible to resume the P7/P8 qualification path under fresh evidence.



## Subsequent disposition

A later P7 requalification confirmed that the correction exposed the intended GET opportunities behavior in the real GUI as a 5-participant / 8-interaction trace from HTTP Input through the handler and `AdaptiveRepository.list` to three PostgreSQL reads and three response branches, with representative source evidence and explicit partial coverage. The trace rebuilt after restart.

This does not relabel P7 Green. The later run exposed separate blockers: the focused Subsystem canvas was too dim to read immediately and the packaged AppImage failed controlled shutdown. Presentation work is now routed to `docs/tasks/c6-map-canvas-priority/`; native shutdown remains a separate P7 blocker.
