# P3 second aggregate failure — manual cycle 1 (2026-10-18)

**Result: PASS for exact test B on the uncommitted P1 + P2 + P3 candidate.** The owner's direct P3 task was treated as the manual Run for this family. This does not change the original P15 **NOT GREEN** verdict or qualify the full Bridge, native GUI, or Phase 11. No commit, version bump, headless phase run, or full aggregate occurred.

## Source and preserved failure

- Entry checkout was `main` at `7fa2707a58b44602cd9725c6f0ab94cc0881a962`, 15 commits ahead of `origin/main`. Original P15 source `11e1f761dda1dafead6f3c3ada072bedc9eeb389` is in local history. P1 product and adjacent test edits plus P2's test A assertion were uncommitted at entry; P1/P2 qualification records were also untracked. No other work was reset, stashed, cleaned, overwritten, or committed. All 13 product manifests and 20 internal `@dope/*` pins still read `0.11.8`.
- The original P15 closeout and evidence were already committed at entry HEAD, contrary to the older remote authoring note. Their SHA-256 values remained `df884d326dad0577d29f1ead90e57e24e28274f531efc720a92579eb5eabe2b1` and `64672af40a5befcf1f78236e14b0999970ff5db6d272abb1befef45b04308b42`. Original `/tmp/dope-p15-check.log` remained present with SHA-256 `db23402f2850d6d6254aedfd0a62001beecf6bdeb83ceca1abb68b00c714c53f`; P1/P2 had independently copied it before their edits. No original P15 or P1–P15 authored file was changed.
- The original command was `npm run check`; its `test:product` first stage ran `npm run build:extension && node --test ... test/unit/roadmap-chat-panel.test.ts ...`. That stage had **623 pass / 2 fail**. Log lines 981–991 identify the distinct *second* failure: `test/unit/roadmap-chat-panel.test.ts:140:1`, **“Bridge request remains bound to the selected Prepare Work checkpoint and map revision.”** At line 154, the test expected the Bridge request object (`projectId: 'project'`, `checkpointId: 'checkpoint'`, Roadmap revision 4, map `map` revision 3, branch `system`); actual behavior was an exception, **“Prepare Work and select its current linked Planning Map first.”** Test A was the separate `roadmap-chat-drafts.test.ts` failure at log lines 958–979 and remains independently dispositioned by P2.
- At P15 source, test B's Git blob was `ed3fa998ad93ef32fa39b731769900c469b3164b` (SHA-256 `0028c48539832049fdcb4280f7c7a15dbe4bbb876e54e085f96a2285ea7bde6e`), and `chat-planning-selection.ts` was blob `c9489f990727395845a76171d53a50b7a37e8187` (SHA-256 `109aa15488a0b501bc734fab93d2cd184f949a2b28eecb19c7a4f0ab5d98c10d`). The current P1 browser source SHA-256 was `dece0685f5b4e61318c25b62b55978e3595a0d9211a88b0ac36d5d3e22160d98` and was not changed in P3.

## Observe and diagnose

`corepack yarn workspace @dope/theia-extension build` passed before isolation, refreshing the compiled `lib` imported by this unit test. The exact current-source test B invocation was:

```text
node --test --test-name-pattern='Bridge request remains bound to the selected Prepare Work checkpoint and map revision' test/unit/roadmap-chat-panel.test.ts
```

It reproduced **0 pass / 1 fail** with the same exception, now at compiled `chat-planning-selection.js:50`. The changed P1 identity code had not made this fixture valid, and stale compiled output was excluded. Inspection showed the fixture's Roadmap Planning Map link lacked the required `basis`. `RoadmapInspectorModel.prepareWorkBlockedReason` correctly blocks an incomplete link before `ChatPlanningSelection.bridge` returns a request. The fixture also used the same artificial ID for independent Roadmap and Planning owners. This was fixture drift, not evidence that the accepted basis/owner security rule should be removed or that P1's browser handoff failed again.

## Bounded repair and focused replay

The only code/test path changed in P3 was `test/unit/roadmap-chat-panel.test.ts`; the new P3 qualification records and two repair-stack indexes were also written. The fixture now supplies a Planning basis and a separate `planning-project` owner ID consistently in its link, selected map, collection, and Prepare Work context. The positive assertion still requires the exact Bridge request. A new negative removes the link basis and requires rejection; the existing map-revision-change negative remains. No assertion was deleted, skipped, or relaxed and no P3 product code changed. Final test file SHA-256: `b1574ff8133095ae4d09918fc9439eb5db567be1ac3761c1c933561f0d117d3e`.

| Check | Observed result |
| --- | --- |
| Extension build before isolated replay | PASS |
| Exact test B before fixture repair | FAIL, 0/1, same original exception |
| Exact test B after fixture repair | PASS, 1/1, including missing-basis and changed-revision negatives |
| `node --test test/unit/roadmap-chat-panel.test.ts test/unit/roadmap-chat-drafts.test.ts test/unit/roadmap-planning-links.test.ts test/unit/prepare-work-navigation.test.ts` | PASS, 10/10; includes original test A and wrong-owner, changed-revision, changed-basis, same-root/different-owner, stale and no-owner-write checks |
| `git diff --check` | PASS |
| `npm run check` | NOT RUN; P5 owns the final stable-source aggregate |

The focused tests use fake owners/models and did not invoke a live model, hosted provider, browser GUI, or Electron GUI. Adjacent owner tests wrote only their disposable temporary project fixtures; P3 made no write to a user's canonical project. Fresh manual GUI observation is **NOT RUN in P3** because this repair changed only the unit fixture; P1's prior real-browser result remains separately source-bound and no new GUI or native parity claim is made. No service or model setting was changed. The relevant security negatives above are focused code tests, not live-process or network-egress evidence. There were no additional P3 repair cycles.

**Handoff:** Test B is independently PASS at this candidate, and test A plus relevant adjacent owner checks still pass. Original P15 remains NOT GREEN. P4's independent native GUI and P5's single full qualification remain separate, unrun gates.
