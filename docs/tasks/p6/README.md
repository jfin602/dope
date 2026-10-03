# Product Phase 6 — Flow Task Stack

Status: **OWNER-CLOSED FOR SEQUENCING / P8 NOT QUALIFIED — EVIDENCE GAP**
Activation baseline: `710edb362f9881ab41215705db4f08d8daca6293`
Package baseline: `0.6.0`
Authority: ADR 0020 as amended by ADR 0021, Phase 6 activation/plan

## Approved decomposition

| Prompt | Version | Boundary | Tier | Model | GUI |
| --- | --- | --- | --- | --- | --- |
| P1 | `0.6.1` | physical Flow domain/evidence contracts | T1 | GPT-6 Sol High | no |
| P2 | `0.6.2` | generic TypeScript deterministic invocation Flow | T1 | GPT-6 Sol High | no |
| P3 | `0.6.3` | Adaptive SEO HTTP/persistence/external boundary extraction | T2 | GPT-6 Sol High | no |
| P4 | `0.6.4` | bounded Flow query/aggregation/generation guards | T2 | GPT-6 Sol High | no |
| P5 | `0.6.5` | directional Flow projection/layout | T1 | GPT-6 Sol High | no |
| P6 | `0.6.6` | Architecture/Flow UI + provenance/source navigation | T2 | GPT-6 Sol High | no |
| P7 | `0.6.7` | Adaptive SEO direct Flow qualification + release evidence | T3 | GPT-6 Sol High | yes |
| P8 | `0.6.8` | evidence-only closeout | T3 audit | GPT-6 Sol Medium | no |

## Current gate

P1-P6 are implemented. P7 is Green on `0.6.7` by bounded supplemental closeout. P8 ran as an evidence-only audit at `0.6.8` and is **Not Qualified** because the final P7 candidate has no direct restart/isolation replay of the now-visible Adaptive SEO path or chosen-path edge/source inspection. The owner approved closing Phase 6 **for sequencing only** on October 3, 2026. The original Not Green records and P8 gaps remain retained. See the [Phase 6 closeout](closeout.md).

The retained evidence chain is:

1. Original P7 proved the real GET opportunities Flow facts existed, but overview budgeting/scope prevented the GUI from exposing the behavior.
2. `c6-flow-overview-priority` repaired the overview/query semantics and a later GUI replay exposed the intended HTTP Input -> handler -> `AdaptiveRepository.list` -> three PostgreSQL reads -> response branches.
3. `c6-map-canvas-priority` implemented the canvas-first shell, compact toolbar and floating inspection overlay, but its P3 replay at `d4f17c7338196aaf78f5851dce42622527c166e4` was Not Green.
4. `c6-flow-projection-contract` repaired that aggregate-versus-facts presentation mismatch. A fresh complete P3 replay rendered 18 participants / 27 edges but retained a Not Green result because the first fit was `0.564295×` and unreadable.
5. The one-off focused Flow readability repair now opens that same 18 / 27 graph at `1.0×`, enlarges Flow edge labels, and preserves manual zoom, pan and focused Fit. Its direct Dope Dark and Dark (Theia) replay is supplemental Green evidence for the map-canvas P3 gate. The earlier Not Green records remain intact.

The map-canvas P3 gate is cleared by the [supplemental closeout](../c6-map-canvas-priority/closeout.md). The later P7 replay and bounded path/window-close correction are recorded in the [P7 evidence](P7-flow-dogfooding-evidence.md#bounded-p7-closeout--2026-10-03). P8 audited that `0.6.7` candidate without changing Flow behavior. Phase 6 remains Not Qualified, but the owner accepted the bounded direct evidence gap for sequencing. Next: a fresh Phase 7 AI Presence `/docs-review`.

### Final-state aggregate replay (2026-10-03)

At clean candidate `395522291ce62bbbb15e62722680259c6b3a5ec8` / `0.6.7`, 135 focused tests, typecheck, browser/Electron builds, packaging and a fresh disposable Adaptive SEO browser replay passed their exercised gates. System Flow rendered 15 participants/31 interactions; dense Subsystem Flow rendered 18/27 at readable `1.0×`, with manual pan/zoom and explicit Fit. Sidebar, dedicated Edit Architecture draft behavior, palette persistence and Dope Dark/Light (Theia) were exercised. The rebuilt AppImage reached ready and shut down cleanly via SIGTERM, but normal window close was not qualified; native file-search `spawn ENOTDIR` remains observable.

**P7 Green by later closeout; P8 Not Qualified.** The final-state replay immediately above remains its historical Not Green observation. A subsequent bounded correction restored the Physical Map workspace path and a rebuilt AppImage exited cleanly after normal window close. See the [supplemental P7 closeout](P7-flow-dogfooding-evidence.md#bounded-p7-closeout--2026-10-03). P8 advanced the manifest family to `0.6.8` and recorded the remaining exact-candidate evidence gap in the [closeout](closeout.md).

## Locked truth rules

```text
import != invocation
reference != invocation
dependency != execution flow
```

A deterministically resolved invocation is valid Flow evidence even when payload semantics are unknown.

Data/type/schema/event annotations require separate evidence.

## Prompt files

- `P1-flow-contracts.txt`
- `P2-typescript-invocation-flow.txt`
- `P3-adaptive-seo-boundaries.txt`
- `P4-flow-query-aggregation.txt`
- `P5-flow-projection-layout.txt`
- `P6-flow-ui-integration.txt`
- `P7-flow-dogfooding.txt`
- `P8-flow-closeout.txt`
