# Part A final qualification — 2026-11-01

**Disposition: PART A CHROME GREEN for the bounded browser scope.** This does not qualify the native Electron GUI, Part B publication, Phase 12, or earlier C12 P4 results. Product version remains `0.12.7`.

## Source and scope

- Starting local `main`: `42330f014ce293ff9a30f28c17b1e91ed977bc7b`. This record is committed with the Part A source it evaluates.
- Remote `origin/main` was `2483d51f4e4da15dbc958e7b431c60ae87f177ce` at preflight. No pull, rebase, reset, push, or remote reconciliation was performed.
- The referenced ADR 0045 and `c12-roadmap-publish-ux` README were absent from this checkout. The available P12 hybrid proposal contract and actual source governed the bounded work.
- Separate staged `c12-roadmap-element-context` qualification and `test/unit/roadmap-canvas.test.ts` changes were excluded from this Part A commit. No Part B publication API or behavior was added.

## Connected Chrome evidence

The real Dope browser app ran at `127.0.0.1:3000` against disposable project data. Saved Chat and Roadmap state came from Dope's backend and repository. No DOM state or Chat message was injected.

| Case | Result | Evidence |
| --- | --- | --- |
| Q1 Failed | Pass, deterministic backend fixture shown in Chrome | An actual `decidePlanningProposal` call reached a deliberately failing Roadmap writer. The saved card showed **Failed · no change**, expanded to the writer error, had no Apply/Reject controls, and did not show Applied. A repeat approval was unavailable; Roadmap stayed at revision 1. |
| Q2 Cancelled | Pass, deterministic backend fixture shown in Chrome | A pending proposal was cancelled through `ChatBackend.cancelTurn`. Saved Chat showed a compact expandable **Cancelled** card after reload, with no approval controls. Repeat approval was unavailable and Roadmap stayed at revision 1. |
| Q3 Superseded | Pass, deterministic backend fixture shown in Chrome | Two distinct valid proposals were generated in one saved Chat. The older one became **Superseded** when the successor arrived. Its card survived reload without actions; its original approval was unavailable. The successor retained only its own proposal identity before a separate simulated writer failure. |
| Q4 Narrow layout | Pass in Chrome at 900×720 | Chat remained docked beside a reduced editor. The live long Gate title wrapped in the pending review and, after rejection, in a compact card: title height 91px and scroll width equalled client width. Saved cards also had no horizontal overflow. Expanded failed details exposed the reason and bounded diff; Chat remained vertically scrollable and text selection worked. No duplicate historical cards or floating review remained after the decision. |
| Q5 Keyboard and accessibility | Pass in Chrome | Tab reached historical **Details** and pending Apply/Reject. Enter and Space opened/closed Details; focus used a visible solid outline. Tab reached Reject and Enter rejected the live pending proposal. Historical cards had zero approval buttons. Escape closed focused Chat settings after its exit animation without losing a Chat draft; Escape on the composer alone preserved its draft. Cards carried named regions and readable status text. Existing reduced-motion CSS disables Roadmap motion and settings animation. |
| Q6 Regression | Pass, live end to end on final source | Local `qwen3.5-9b` produced a real proposal at Roadmap revision 5. Keyboard Reject wrote a saved **Rejected · no change** card, with no action controls. Roadmap still displayed Gate G1's old title, a Planned unpublished Phase, 0/2 qualified Gates, and a solid accepted Phase border. The redundant card-count/revision footer was absent; the editor remained usable. |

Q1–Q3 are **backend-authoritative deterministic fixtures rendered and revisited in connected Chrome**, not live model outcomes. Q4–Q6 include a fresh live local-model proposal and user-interface decision on the final built source. Earlier Part A live Applied/Rejected, reload, restart, linked-source, and conflict observations remain supporting history; this replay does not relabel unrelated qualification gaps.

## Final source checks

- Focused repository, Roadmap Chat, presentation, and canvas tests: **32/32 pass**.
- `npm run typecheck`: pass.
- `npm run build:browser`: pass, zero browser/node build errors.
- `npm run build:electron`: pass, zero browser/node/electron build errors. This is a build result, not native GUI parity.
- Working and staged `git diff --check`: pass.

The native Electron GUI was not manually replayed. No Phase 12 Green or published Markdown behavior is claimed.
