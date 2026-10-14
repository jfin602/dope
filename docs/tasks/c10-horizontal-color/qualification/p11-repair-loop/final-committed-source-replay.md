# P11 final committed-source browser replay — 2026-10-14

**Disposition: SCOPED GREEN / QUALIFIED** for `c10-horizontal-color` P11 at exact product source `a06cf33e03c4f651b1f7e15b37920fd1d906748e`, package `0.10.16`. The owner accepts browser-only evidence for this scoped correction. This does not qualify Phase 10 or replace its fresh manual P9–P14 campaign.

## Source and fixture

- Main repository HEAD was exactly `a06cf33e03c4f651b1f7e15b37920fd1d906748e`, with a clean tree before this documentation-only replay. The commit contains the two repaired product/test files, `roadmap-canvas-widget.ts` and `roadmap-semantic-zoom.test.ts`, plus cycle-2 evidence. The two-file binary diff SHA-256 is `88c651ab1eefe62ca8f5a40459cb213f07a09808d6d93e68fbc2146c694bdb8d`, matching the tested cycle-2 candidate exactly.
- No server was running at entry. The existing browser build was made at 10:21:43 local, after the repaired widget source at 10:20:59 and before the source-equivalent commit at 10:49:39. Its minified bundle contains the repaired shared `roadmapVisibleGraph` result passed to `renderFlow`, `renderImplementationSummary`, and the displayed count. The running server's `bundle.js` SHA-256 matched the local build byte for byte: `c54cb1e1a2d53c1ef1248b9ac93934761fa584982ca5b341a169016ae3ced46a`. The live browser opened `http://127.0.0.1:3000/#/tmp/dope-c10-p11-final-RodZqF/project`, so this replay used the repaired bundle, not a stale server.
- The disposable linked fixture retains revision 1. Its Markdown SHA-256 stayed `30909c31ea5662766c3fd8eec049dee7a1c5e0dcfb78860019906db8a6027d35`; `.dope/roadmap.json` stayed `cda1cecc60c96e5315222d4afa2b850536781378ce6156b7e4705ccc6b6a46ed`. The fixture itself remains at its earlier `bbf662a` checkout; its stored Roadmap and linked Markdown are the source-equivalent disposable data used in cycle 2. The application source is the main repository's `a06cf33` build.
- `c10-better-planning` P5 is separately **SCOPED GREEN / OWNER-ACCEPTED** at `824eaa1` under its own closeout. No Chat code changed in the P11 repair.

## Direct browser result

Counts below are rendered `.react-flow__node` elements and the visible status label, not hidden descendants. No Refresh was clicked between disclosure actions.

| Action | Rendered nodes / displayed checkpoints | Phase 10 prompt nodes | Rendered edges | Result |
| --- | ---: | ---: | ---: | --- |
| Initial linked Roadmap | 42 / 42 | 0 | 40 | PASS |
| Select Phase 10, View Prompts | 58 / 58 | 16 | 56 | PASS |
| Hide Prompts, immediately | 42 / 42 | 0 | 40 | PASS |
| View Prompts again | 58 / 58 | 16 | 56 | PASS |
| Hide Prompts again, immediately | 42 / 42 | 0 | 40 | PASS |

After each collapse, zero rendered Phase 10 prompt nodes and zero rendered Phase 10 prompt connectors remained. The count changed on the same interaction without Refresh. Two new browser captures document the source-bound expanded and immediately collapsed states: [expanded](evidence/final-committed-expanded.jpg) (SHA-256 `ce1865172170edc95e5ee86ea3ba53d5dc042606e37f9cae3fbbf38dca972d7a`) and [collapsed](evidence/final-committed-collapsed-immediate.jpg) (`a27c717c232a1bcaedd79c09e545a41622f6129c89a1dd0632c2c4c7d7695ae3`).

The focused regression smoke passed: zoom with prompts collapsed kept 42/42, zero Phase 10 prompts and zero generic task-stack cards. The current Phase 10 camera remained readable; the inspected c10-better-planning correction connector routed outside card text. Linked Markdown and Roadmap revision/hash did not change.

## Reused evidence and limits

Cycle 2 already passed **21/21 focused tests**, `npm run build:browser`, `git diff --check`, the direct disclosure/count browser replay and unchanged linked-source hashes. Its tested two-file diff is exactly the committed diff. The earlier committed P11 browser evidence passed the initial camera, connector routing, explicit prompt disclosure and source navigation, stored dependency rendering, keyboard/theme and narrow-editor checks, and presentation authority safeguards. None of those unchanged gates was rerun here. The Electron build and 30/30 focused checks are older source-bound evidence, not new tests on `a06cf33`. `npm run check` was not run; manual Phase 10 P14 owns the final aggregate.

The full Phase 10 P9–P13 browser/native/model/authority/egress families remain unqualified. The former P11 native and reduced-motion limitations remain historical evidence; the owner's browser-only acceptance applies to this scoped P11 result. Historical manual P9 three-cycle, P16 and P19 **NOT GREEN** results remain intact. Phase 10 is **NOT GREEN / FULL QUALIFICATION PENDING**, not owner-closed; Phase 11/12 remain inactive.

**Next action:** begin the fresh manual Phase 10 qualification matrix, P9–P13, then P14's sole final exact-source aggregate and disposition.
