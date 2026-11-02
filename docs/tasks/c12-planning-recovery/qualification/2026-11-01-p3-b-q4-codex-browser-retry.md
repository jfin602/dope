# P3-B Q4 UI integrity — Codex browser retry, 2026-11-01

**Q4 GREEN in the owner-approved Codex in-app browser scope.** The owner stopped connected Chrome testing because it caused system instability and explicitly directed the Codex browser as equivalent evidence for this gate. This is a forward browser substitution for Q4; it does not relabel the [earlier interrupted Chrome attempt](2026-11-01-p3-b-q4-ui-integrity.md) or claim a Chrome replay.

## Exact source and setup

- Clean entry `main` at `7182e59299a90292d64d55b49c8e8d07f2259fad`, version `0.12.7`. Its only change after product source `9600cf460f372299501267a5a9828d413af53562` was evidence documentation. No Q4 product or test code changed.
- The same final-source browser build was served at `127.0.0.1:3000` in the Codex in-app browser. Disposable schema-2 project `/tmp/dope-p3b-q4-retry-iV9SWX` had Roadmap revision 1 with two Phases and Gates G1/G2; all Gate and Phase qualification statuses were Unknown. Roadmap was the active center tab beside the saved Chat.
- The previously selected local LM Studio `qwen3.5-9b` Q4_K_M was restored at 16,384 context and parallel 2 after the host restart. AI Center refreshed its existing connection; Chat Commands remained Ask. The current turn used protected `/roadmap`.
- The earlier final-product-source **130/130** focused UI, protected skill, canvas/viewport, selected context and budget tests passed, as did `npm run typecheck`, `npm run build:browser`, `npm run build:electron`, and `git diff --check`. Only documentation changed after those checks; no Q1–Q3 or full-suite replay was run.

## Visible Q4 smoke

| Check | Codex browser observation |
| --- | --- |
| Proposal and shared preview | One real protected Gate `gate-g1` purpose edit produced one full-width card in the originating assistant response. It named Gate G1 in Phase B and showed `Check first phase → Verify readiness criteria before implementation begins`. The active center Roadmap canvas automatically showed the same bounded provisional purpose, explicitly `Proposed · Not applied`; G1, G2 and their Phases did not display Green. `View in Roadmap` retained the existing center editor and focused the affected Gate. |
| No write before approval | Canonical revision stayed **1** and `.dope/roadmap.json` SHA-256 stayed `78d0b28ca4e2d7a72af38958c202f8c50934ace6ec967b891ac4f71769309749` before and during preview. |
| Narrow layout | The Chat dock was observed at about 280 px and the center editor was narrowed to about 495 px by dragging the splitter. The long Gate title wrapped in both card and canvas. Proposal text remained legible, all three action buttons stayed reachable, and the Roadmap remained navigable. |
| Keyboard and focus | Tab traversed the diagnostic disclosure, View, Apply and Reject controls. Focus had a visible outline. Enter expanded/collapsed diagnostic and Gate details and later activated Reject; Space activated the Roadmap zoom button and `View in Roadmap`. Escape closed the Roadmap details overlay while leaving Chat intact. |
| Canvas navigation | G1 was focused and its details expanded/collapsed with the preview visible. Zoom out and Shift+Right pan moved the canvas. The panned viewport remained stable on a later observation; the preview did not recenter repeatedly. One proposal card and no notification duplicates were present. Existing focused viewport tests cover saved camera and reduced motion. |
| Reject and history | Tab reached Reject and Enter decided it. The overlay cleared, the card became compact `Rejected · no change` without Apply/Reject, and revision/hash remained **1**/`78d0b28c…69309749`. After page reload, the saved Chat retained the compact non-actionable card and expandable review basis; no provisional overlay returned. Text selection succeeded, and an expanded transcript scrolled down and back normally. |

**Q4 GREEN in the owner-approved Codex browser scope.** No product defect required repair. The native Electron GUI remains an independent evidence gap. The historical Chrome interruption remains NOT GREEN for that attempt.
