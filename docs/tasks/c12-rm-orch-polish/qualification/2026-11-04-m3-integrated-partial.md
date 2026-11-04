# M3 integrated cleanup and connected-browser pass — PARTIAL / NOT GREEN

**Basis:** `main` starting and ending HEAD `300b4a3b28405977adebe1fde16400f4f95e3a2c`, product `0.12.7`. The tree was clean at entry. The two-file product/test change below and this report are uncommitted. The original P3, M1, and M2 NOT GREEN reports remain unchanged. No runner, live model, owner project, native Electron GUI, provider setting, version change, or self-commit was used.

## Focused repair

Response info repeated a `Broker receipts` disclosure after the final response even though the same durable tool outcomes are projected into the single reasoning/activity timeline. Removed that UI-only duplicate from `chat-panel-widget.ts` and added a source regression assertion in `chat-presentation.test.ts`. Saved `execution.toolEvents`, activity ordering, diagnostic Copy with Reasoning, and broker/approval owners were not changed. Product/test diff SHA-256: `d6cb5eebf7c79b840402c367dc8e6f73b363f658dcfb5069db5f5055eb87b658`.

Source inspection found the current proposal-tab, bulk-action, and response-footer CSS selectors still reachable. The remaining `Tool calls:` text in `chat-panel-presentation.ts` is part of the diagnostic copy artifact, not an extra Chat dropdown; it was retained.

## Exact-source checks

- `npm run typecheck`: PASS. `npm run build:browser`: PASS. `git diff --check`: PASS.
- Source generation/StageOwner/Chat backend/Pi bridge/History/publication/sync/linked-store suites: **106/106 PASS**.
- Focused Chat presentation, proposal cards, real Pi worker, and History suites: **40/40 PASS**, including six worker cases and one checked selected Apply.
- `roadmap-local-model.test.ts`: one direct run **17/18** due to fixture cleanup `ENOTEMPTY` after the hosted-consent case; serial rerun **18/18 PASS**. The failure did not show a source assertion failure, but remains unattributed rather than silently counted as a first-run pass.
- Final browser bundle SHA-256 and served `/bundle.js` SHA-256 both `10ca4d09d7b787dcd494726e488533543bbdbc5589bfd1e58035630dcc4adf33`.

## Connected Codex Browser observations

- On the rebuilt exact bundle, the disposable saved reviewed fixture `/tmp/dope-m2-roadmap-keQMXf` showed one assistant card `Roadmap · Partially applied` with **1 Applied, 1 Rejected** operation. Expanded response info showed no `Broker receipts` disclosure. The response footer remained the last assistant-message child. The saved activity disclosure still contains actual `roadmap_read` and `roadmap_stage` outcomes, and no separate Tool calls list appeared.
- The canonical canvas showed one accepted Phase with two Gates and one Criterion each, `Planned`, and **0 of 2 Gates qualified**, preserving the distinction from GREEN. Project History showed exactly one `Roadmap Apply: 1 accepted operation (R4)` event and one Chat event, with no extra Markdown-sync event. The linked `PLAN.md` bytes matched the auto-sync journal target hash `e7cac9ee7ec548e71934eb4a5803af408c3553386b58cd047a33f32447b61013`; the journal reported `synced`. The raw index retains its intentional `pending-sync` intent and the owner read overlays the verified journal status.
- A separate static preview rendered the final React Phase/Gate/Criterion/Correction components and final CSS in connected Browser. Seven review tabs exposed accessible Select, Apply, Reject labels, including an expanded Criterion. Dark and alternate light color variables and a narrow 760px viewport showed attached 30px icon controls without right-edge clipping in that preview. The preview did not exercise live React Flow, backend decisions, or the real Theia alternate theme. Reduced-motion loader rule exists in the final CSS; browser emulation was not observed.
- The browser offered Copy with Reasoning, but browser clipboard readback was empty and paste reported no virtual clipboard data. Copied bytes are **unverified**; this repeats the M2 evidence gap.

## Mandatory gaps and disposition

No valid **live pending** two-Phase proposal was available in the disposable browser workspace. Therefore individual/group/descendant/selected/all Apply and Reject, checked preview Confirm/Cancel, dependency closure, stale lease/source negatives, live next-Phase loader, inactive-tab/historical mode, keyboard focus flow, browser zoom, and final-source M1 tab geometry in React Flow remain unobserved. The static preview is visual guidance only. Live cancelled/stale Chat, a genuine non-Dope Theia theme, reduced-motion emulation, and clipboard contents also remain unobserved. Native Electron, Qwen throughput, and full tower-defense MVP are separate gates.

**Disposition:** M3 is **PARTIAL / NOT GREEN** because the mandatory combined connected-browser matrix did not pass. The smallest follow-on is one disposable, valid pending two-Phase source-bound proposal on this exact candidate, followed by the missing M1 decision/loader/theme/keyboard matrix and clipboard verification. Preserve the historical reports and do not issue a GREEN closeout marker from the passing source checks.
