# P3-B Q1 action correctness — 2026-11-01

**Q1 GREEN on this source. P3-B Core remains NOT GREEN pending Q2–Q4.** This qualification applies the owner-approved [reduced four-gate contract](p3-b-reduced-gate-contract.md). Historical P3-B/H3/P2 NOT GREEN reports retain their original results. B-R2 protected Chat publication was not touched or run.

## Source and runtime

- Clean entry `main` at `d04e758261eaf03800f1967c5bd5691201063556`, version `0.12.7`. Product code was unchanged during Q1; the attributable changes are this contract/report, forward README/scope references and one owner-path test. Final local commit identifies the report/test tree. No push, pull, rebase, reset, stash, provider setting, version or dependency change.
- Connected Chrome used a fresh disposable unlinked schema-2 project `/tmp/dope-p3b-q1-RLOrbU` with isolated final-source Dope server on `127.0.0.1:3022`. Built browser bundle SHA-256 `6dc48d15d84778f66e34647ce191ee1b8299e222d23476ae6a5a188ca90121a3`. Selected LM Studio `qwen3.5-9b` through AI Center; Chat Commands Ask. Phase A contained G1 and its Initial check; Phase B contained G2 and its Other check. All qualification statuses were Unknown.
- The first protected model turn was interrupted when the isolated backend stopped before completing; the canonical file did not change. A fresh protected turn on the restarted isolated server produced the valid proposal below. No failed-turn Retry was used.

## Deterministic action and safety coverage

The current `ProjectPlanningActions` specification contains 19 supported types: five Phase, six Gate, four Criterion and four Correction. The new owner-path test previews and applies each type at its checked revision, verifies no file write during preview, and asserts resulting parent/order/content plus unrelated Gate preservation. Existing focused tests cover project/owner/invalid identity, stale revision, approval token, denied/rejected proposal, one to three action envelopes, a three-action related create, a later invalid action leaving the whole batch unchanged, invalid parent/dependency/cycle, duplicate identity and source-owned linked mutation denial. Chat proposal tests exercise reviewed preview, Reject no-write, Apply, stale and superseded decisions, and linked structural reference detection. Validated proposal projection tests cover before/after entities, dependencies, deletion, criterion creation and bounded overflow. No action schema or 1–3 limit changed.

Final-source focused schema-2 owner, store, protected Chat/approval, preview projection, canvas and viewport suites passed **68/68**. `npm run typecheck`, `npm run build:browser`, `npm run build:electron` and `git diff --check` passed. Electron was built, but its native GUI was not inspected.

## Connected Chrome approval

The fresh `/roadmap` turn requested exactly two actions: `gate.reparent(gate-g1, phase-b, order 0)` and `criterion.add(gate-g1, Parent relationship verified)`. The real model returned a backend-validated proposal at revision 5. Chat showed both steps and three changed entities. Before approval, the active center Roadmap tab displayed a provisional G1 under Phase B with both criteria, an accepted G1 still under Phase A, and G2's proposed order change. The new criterion appeared on G1; there was no orphan or duplicate accepted Gate. `View in Roadmap` retained that view. All Gate statuses stayed Unknown.

| Point | Canonical revision | `.dope/roadmap.json` SHA-256 |
| --- | ---: | --- |
| Before request | 5 | `fa21291cd0ffa3423fdb5910cf3369fd12744964fdb98b2ca3a225c5a303467a` |
| During validated preview, before approval | 5 | `fa21291cd0ffa3423fdb5910cf3369fd12744964fdb98b2ca3a225c5a303467a` |
| After Chat Apply | 6 | `7b2b68284686ca64bd21b872923d0fbb420425842b93c65e23528a1a6bff0231` |

After approval, canonical G1 belongs only to Phase B at order 0; G2 remains under Phase B at order 1, with its purpose and criterion unchanged. G1's original purpose/criterion remained, and the new testable criterion was attached at order 1. Phase A has no accepted Gate, Phase B has two. Both Gates and both Phases remain Unknown. The provisional overlay disappeared. After a browser reload, Chat retained a compact Applied revision-6 card; its expanded details truthfully list both action steps and the validated before/after entities. No canonical write occurred before Apply.

## Disposition

**Q1 GREEN.** Deterministic coverage establishes the supported action families and atomic no-write/approval path, and the connected Chrome run proves one real protected multi-action Gate reparent plus Criterion add approval. No product defect requiring repair was found. Q2 authority/lifecycle, Q3 protected skill/context and Q4 Chat/Roadmap UI integrity still require independent exact-source qualification before P3-B Core can be GREEN. B-R2 Chat publication and native Electron GUI remain unverified.
