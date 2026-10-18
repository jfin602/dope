# P2 first aggregate failure — manual cycle 1 (2026-10-18)

**Result: PASS for exact test A on the uncommitted P1 + P2 candidate.** The owner explicitly authorized the manual P2 Run in this task. This does not change original P15 **NOT GREEN**, qualify test B, the full Bridge, or Phase 11. No commit, version bump, headless phase run, or full aggregate occurred.

## Source and preserved failure

- Entry checkout: `main` at `7fa2707a58b44602cd9725c6f0ab94cc0881a962`, ahead of `origin/main` by 15 commits; original P15 source commit `11e1f761dda1dafead6f3c3ada072bedc9eeb389` is present in history. The P1 identity repair was already uncommitted in six browser source files and five adjacent tests, including one new browser helper and its test. P1 documentation was also dirty. The test and backend paths below were clean at P2 entry. No other repair process was started by P2.
- Product version remains coherent `0.11.8` across 13 product manifests and 20 internal `@dope/*` pins. The tracked restart-extension test fixture has its independent `1.0.0` version and is not a product manifest. No manifest, pin or lockfile changed.
- Original P15 [`closeout.md`](../../../c11-planning-bridge/closeout.md) SHA-256 `df884d326dad0577d29f1ead90e57e24e28274f531efc720a92579eb5eabe2b1`; [`evidence.json`](../../../c11-planning-bridge/qualification/p15-manual/evidence.json) SHA-256 `64672af40a5befcf1f78236e14b0999970ff5db6d272abb1befef45b04308b42`; `/tmp/dope-p15-check.log` SHA-256 `db23402f2850d6d6254aedfd0a62001beecf6bdeb83ceca1abb68b00c714c53f`. All three matched the prior P1 hashes and were copied before mutation to `/tmp/dope-p2-preserved-2026-10-18.lUyZ7s/` with matching hashes. Original tracked P15 files and prompt/checkpoint history were not edited.
- Exact original invocation: `npm run check`, whose `test:product` stage (preserved log lines 217–218) ran `npm run build:extension && node --test` including `test/unit/roadmap-chat-drafts.test.ts`. First 625-test group: 623 pass, 2 fail. The first failure was `test/unit/roadmap-chat-drafts.test.ts:60:1`, **“selected saved Chat previews one noncanonical draft edit; approval, stale, foreign and fallback gates”**, failing at line 113. `assert.rejects` expected `/requires a local model/`; actual was `Error: Bridge and greenfield Chat planning require a selected local model`. The full original stack/assertion is in preserved log lines 956–979. This was present on P15 source; the later passing test does not erase it.
- Original P15 test blob SHA `65b64975d502005c0fbe4c09e6995dfa24f8d734` (file SHA-256 `d95a05554cb0cc367d359dbefb585a172474f1dc7d31d3a38a9afd3eaa297a09`) and backend source blob SHA `8ea3daa3945d4e690c3f7be44b9ace85a38bbbe4`. Both were byte-identical at P2 entry. Backend source SHA-256 `8cb1c890618f7acfe7b66e5620e80c18d63dc87a8ebb2a6540d67378f160b40a`; it remained unchanged throughout P2.

## Observe and diagnose

`corepack yarn workspace @dope/theia-extension build` passed, regenerating the compiled `lib` consumed by the test. The smallest isolated invocation was:

```text
node --test --test-name-pattern='selected saved Chat previews one noncanonical draft edit; approval, stale, foreign and fallback gates' test/unit/roadmap-chat-drafts.test.ts
```

It reproduced the **same** assertion on the P1 candidate: 0 pass / 1 fail, with the same expected regex and actual backend error at compiled `lib/node/chat-backend.js:477`. Stale `lib` is therefore not the cause. P1's browser owner-identity changes do not affect this node backend error.

The test submits an explicitly selected hosted model for a greenfield draft even with hosted-project-data consent. `ChatBackend.runTurn` rejects it before model generation because Bridge and greenfield planning require a selected **local** provider. The test then checks `hostedCalls === 0`; that safety check remains. P8 introduced the broader Bridge + greenfield wording while preserving the local-only gate. The old regex asserted obsolete wording, not a different authority rule or a product regression.

## Bounded repair and focused replay

One assertion in `test/unit/roadmap-chat-drafts.test.ts` was updated from `/requires a local model/` to `/Bridge and greenfield Chat planning require a selected local model/`. This matches the current rejected-operation message more precisely. No test was deleted, skipped, or relaxed; the hosted-call count and other stale/foreign/approval assertions remain. There was **no product code change** for test A and no redundant P1 edit.

| Command / check | Actual result |
| --- | --- |
| Extension build before isolation | PASS, compiled package output refreshed |
| Exact test A before assertion repair | FAIL, 0/1, original wording mismatch reproduced |
| Exact test A after assertion repair | PASS, 1/1 |
| `node --test test/unit/roadmap-chat-drafts.test.ts test/unit/bridge-local-proposal.test.ts` | PASS, 7/7, including selected-local/no-hosted, foreign/stale owner, malformed/partial/no-action and draft approval gates |
| `git diff --check` | PASS after patch |
| `npm run check` | NOT RUN; P5 owns the stable final aggregate |

The post-repair focused output included:

```text
✔ selected saved Chat previews one noncanonical draft edit; approval, stale, foreign and fallback gates (439.649469ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0

✔ Bridge preparation rejects foreign and stale owner context before inference (0.357488ms)
✔ saved Chat Bridge turn uses exact selected local model and never calls a hosted provider (57.644056ms)
✔ selected saved Chat previews one noncanonical draft edit; approval, stale, foreign and fallback gates (418.219551ms)
ℹ tests 7
ℹ pass 7
ℹ fail 0
```

The seven-test command also passed its four other listed Bridge/draft cases. Node emitted a nonfatal module-type warning. The final P2 test SHA-256 is `0146f1162900ff8166236b4bda0e736b0e98be4698cb40937649f039a06c736d`. The one-line P2 diff is independently visible in Git on top of entry HEAD; all P1 uncommitted product/test paths were left intact.

## GUI, services, and scope

No new browser or native GUI action was needed to classify this backend unit assertion; GUI replay is **NOT RUN in P2**. P1's separate [real-browser record](../p1-identity/cycle-1.md) remains its own source-bound evidence, not a fresh P2 observation. These tests used mock model connections and made no real local or hosted inference; no service/model setting was changed and no network-egress claim is made. The negative verified here is that the hosted generator was never called in the selected saved Chat draft test, plus the adjacent foreign/stale/partial-output tests. Original test B remains for independent P3 observation and replay.

**Handoff:** P2 test A PASS on this uncommitted candidate. P3, P4 and P5 remain separate, unrun families. Original P15 remains NOT GREEN; Phase 11 OPEN / NOT QUALIFIED; Phase 12 inactive.
