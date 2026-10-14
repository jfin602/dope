# /prompt-ass — c10-better-planning

**2026-10-14:** Authored/Not Implemented. Correction 10 at unchanged `0.10.16`.

## Grounded problem
The supplied screenshot shows user-visible bare `{"type":"roadmap-intent"...}` and `{"type":"no-action"...}` assistant responses with no explanation. Code evidence: `packages/theia-extension/src/node/roadmap-local-model.ts` buffers/validates strict JSON; `chat-backend.ts` validates proposal context/approval; `chat-context-composer.ts` instructs strict output; `browser/chat-panel-widget.ts` renders saved assistant content as Markdown; `chat-panel-controller.ts` handles streaming, proposal and approval state. This is not proof that the model has genuine executable tool-calling authority. Do NOT loosen its action grammar merely to get conversational text.

## Product contract
Only known **validated** local planning envelopes (`roadmap-intent`, `roadmap-proposal`, `roadmap-draft-proposal`, `no-action`) and actual activity events become low-contrast, small, truncated, expandable entries. Retain exact raw JSON with safe text rendering/copy and model provenance; unknown JSON/prose remains readable. Every completed *local planning* turn gets a concise accurate outcome paragraph and 1–2 context-grounded follow-up questions (no automated execution). Pending proposals explicitly say **no write yet**; only verified approved persistence may say “updated”. No-action, malformed, error, reject, stale and cancel cannot be presented as success. Status messages between operations should come from actual lifecycle transitions, not a second local/hosted inference.

## Dependency split and validation
| Prompt | One coherent owner | Tier / model | Time target | Checks |
| --- | --- | --- | --- | --- |
| P1 | Known-structured activity discriminator/provenance at local Chat boundary | T2/High | <=8m | strict JSON, proposals, no-action, unknown/malformed and no write |
| P2 | Accessible expandable muted activity renderer in existing ChatPanel | T1/Medium | <=8m | Chat presentation/keyboard/narrow and safe raw rendering |
| P3 | Verified state-to-explanation/questions and real inter-call progress | T2/High | <=8m | lifecycle, approval, cancel, replay, zero extra inference |
| P4 | Integrated authority/restoration/model-cost tests | T2/High | <=8m | changed Chat/Roadmap focused regression only |
| P5 | Real Qwen, browser/native UI and scoped closeout | T3/High | manual | source-bound screenshots, timing and acceptance |

P1 produces a classification seam without changing the validation grammar; P2 only displays; P3 reports outcomes from trusted backend state; P4 tests the seams rather than adding a framework; P5 gathers direct UI proof. If P1/P3 share a helper, reuse it, but keep single-responsibility changes.

## Boundaries / risks
Preserve source-aware preview/approval, exact owner/source revision/hash, persisted raw Chat content, single chat lease, four docks, streaming for ordinary prose, bounded strict JSON retries and local-only routing. User-provided JSON masquerading as tool success must not be trusted. Pending/denied/stale/reload/cancelled turns need true, durable status. `details/summary`, keyboard focus, screen reader label, safe text-only payload, sensible max content, dark/light theme using CURRENT ADR 0016 tokens; reuse ADR 0030 transcript patterns and ADR 0037 usability without global restyle. Avoid raw partial JSON streaming, invented work/progress, new tool grant/provider fallback, extra model requests, broad Chat schema rewrite, Phase 11 redesign and premature qualified Green.

## Prompt efficiency gate
All ordinary prompts target <=8m with the smallest directly touched tests/build output; P4 holds cross-boundary regressions and P5 scoped live UX. Do not put full `npm run check`, whole 16K/32K/64K context comparison, broad security/network sweep or full browser/native matrix into P1–P4. Those belong to the **new complete manual P9–P14 qualification after all P10 corrections**. Preserve all historical Not Green evidence and avoid any `/activate` gate.
