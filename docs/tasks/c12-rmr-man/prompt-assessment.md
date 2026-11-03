# Prompt assessment — c12-rmr-man

**Assessment:** 2026-11-03, manual four-prompt repair, not runner-compatible or executed.

## Source/evidence inventory

- packages/pi-runtime/worker.mjs ROADMAP_TOOLS declares roadmap_stage actions as Type.Array(Type.Any()). The worker description says to use new: aliases and batch in <=8 actions but does not communicate supported action kinds and required Phase/Gate/Criteria field shapes. Selected local models can guess unsupported kinds.
- packages/theia-extension/src/node/roadmap-native-stage.ts defines dotted shape kinds (phase.create, gate.create, criterion.add and others), enforces <=8 actions/call, <=48 operations, <=16 KB/call, expected stage sequencing, source/revision/lease and final completeness. It compares args.expectedSourceHash strictly against the linked hash or null. Its read() returns link.sourceHash if linked, otherwise link:null; it does not make a top-level explicit expectedSourceHash precondition obvious to the model. Omission is undefined, not null.
- packages/theia-extension/src/node/chat-backend.ts brokers typed Roadmap tools but turns errors into compact ROADMAP_ strings. It creates the final native proposal after the assistant turn; staged batches do not currently produce canvas-ready intermediate Chat events.
- packages/theia-extension/src/browser/roadmap-canvas-widget.ts already has checked proposal projection, one-time camera behavior, provisional drawing and historical suppression. Its active Chat proposal display currently requires a complete proposal. Preserve user pan/zoom/focus.
- test/unit/roadmap-native-stage.test.ts has passing deterministic revision-zero tests that explicitly provide expectedSourceHash:null. P10-A observed live Qwen3.5-9B failure; no failed backend payload trace was collected, so source-contract mismatches are grounded hypotheses, not demonstrated exact failed arguments.
- P10-A also observed unrelated linked Markdown and incomplete canvas-creation failures; retain in c12-roadmap-sync, not this focused repair.

## Division and dependencies

1. R1 (T1): compact accurately discoverable tool schema, clear source/revision-zero read values, finite precise backend errors; no new UI.
2. R2 (T1/T2): same server-owned staging proposal publishes monotonically sequenced bounded validated noncanonical partial snapshots; no new writer or visible canvas integration.
3. R3 (T1/T2): active-only existing Roadmap canvas subscribes to incremental projections, preserves human control and one final Chat review card.
4. R4 (T3): connected Chrome selected local model replays exact tower-defense prompt, verifies at least two pre-final visual changes, complete five-phase structure, explicit review/no-write and negatives. Up to three scoped repair/requal cycles, no speculative blanket fixes.

**T1/T2/T3 evidence:** Node tests import package lib/ outputs; compile changed package outputs once in dependency order before focused tests. R1 touches worker + Theia backend, so verify Pi runtime plus extension output; R2 may change @dope/chat then extension and requires chat build first; R3 generally changes extension frontend and event wiring only. R4 needs the real served browser bundle (build:browser) and actual connected Chrome. Don't run duplicate all-package builds in every stage. Run broader aggregate only if changed ownership or final regression evidence requires it, and attribute known unrelated baseline failures rather than conceal them.

**Efficiency:** One primary concern per implementation prompt; no duplicate stores, backend/CSS authority or old response-parser recovery. Ordinary prompts target <=8-minute implementation+focused checks; R4 is a distinct manual T3 gate. Safety/approval/source correctness overrides time. Sol High recommended because the source/hash and lease authority are sensitive. No fixed inference timeout increase or forced one-tool-call-per-element. The 10-minute stage lease can be assessed for safe bounded renewal under the same identity, not disabled.

**No-go:** no model self-Apply, canonical writes during generation, linked Markdown writes before owner Apply, changes to unrelated Work/Chat workflows, silent fallback to prose parser, stale approval token reuse, automatic tab switch or repeated camera fit, fake Phase/Gate GREEN.
