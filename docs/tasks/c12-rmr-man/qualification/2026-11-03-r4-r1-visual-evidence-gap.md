# c12-rmr-man R4-R1 — connected Chrome visual closeout, EVIDENCE GAP / NOT GREEN

**Date:** 2026-11-03 (America/Chicago)  
**Scope:** R4-R1 provisional Roadmap creation styling only. This is a new closeout; the [original R4 Gate A NOT GREEN record](2026-11-03-r4-gate-a-not-green.md) is unchanged.  
**Verdict:** **R4-R1 PARTIAL / NOT GREEN.** The implementation builds and focused source tests pass, but a backend-validated proposal was not delivered to the connected Chrome app. No created Phase, nested Gate/Criterion, edit, or removal was visually qualified.

## Exact source and browser basis

- Branch `main`, Git HEAD `07e8ed7e75fa48bca9d67d0cf7005cfec3ae30ff`, product version `0.12.7`.
- Preserved the four entry product changes: modified `packages/theia-extension/src/browser/dope.css` and `roadmap-canvas-widget.ts`; untracked `roadmap-proposal-cards.ts` and `test/unit/roadmap-proposal-cards.test.ts`. No product source, provider, model, permission, or version was changed in this attempt. The tracked `git diff --binary` SHA-256 was `2300d034e6130460350575c36c223580ef99cd4e9734ffc23833dffffabfac77`. The product dirty snapshot SHA-256, computed from that diff followed by sorted `\0UNTRACKED\0` path/byte records for the two untracked files, was `c6e802ac9bf75cf43f4bd3d554a735b58b52cffc95c2eb27985ecd9fda4f9fe1`.
- `npm run build:browser` passed on this source. The original Dope server stopped during the rebuild and was restarted from the rebuilt outputs. Local and HTTP-served `apps/browser/lib/frontend/bundle.js` SHA-256 both `51e06903e82141827b1a355c658c84f9905be2b91529e7fa3fdc8fbe325070ee`; bundle CSS both `72635d6954c94f6527530a1bf02978b24bbf7346f8d99aeb8db92cc518970ac6`. Backend `apps/browser/src-gen/backend/main.js` SHA-256 `c439e8af210e6533a8650785a633240a90d34698847ffe0a1f8a3412b8d46db1`. These hashes establish the served build, not a rendered proposal.
- Connected Google Chrome browser ID `2`, fresh tab `528924226`, `http://127.0.0.1:3000/#/tmp/dope-r4-r1-visual-20261103`. The tab was reloaded after the server restart; its DOM referenced `http://127.0.0.1:3000/bundle.js`, and the actual Roadmap center editor opened. Disposable project `/tmp/dope-r4-r1-visual-20261103` contained only a minimal package manifest and TypeScript file before opening. The owner project was not opened or modified.
- Focused final-source command `node --test test/unit/roadmap-canvas.test.ts test/unit/roadmap-proposal-cards.test.ts test/unit/roadmap-spatial-canvas.test.ts test/unit/roadmap-status-truth.test.ts test/unit/roadmap-viewport.test.ts test/unit/roadmap-chat-panel.test.ts test/unit/roadmap-history-navigation.test.ts` passed **51/51**. The proposal-card tests use `RoadmapNativeStageOwner` validation and render the resulting Phase, Gate and Criterion markup, plus edit/removal presentation. They are source-level evidence, not Chrome appearance evidence. `git diff --check` passed.

## Visual gate disposition

| Gate | Outcome |
| --- | --- |
| V1 new Phase appearance | **Gap.** No accepted live staging operation reached this Chrome tab; no card screenshot exists. Source tests assert normal Phase hierarchy, title/objective, `Proposed · Not applied`, `Awaiting Gates`, and absence of `none →`, internal Order/Dependencies, Planned, or GREEN. |
| V2 nested Gate and Criterion | **Gap.** No stage 2 operation or live nested screenshot. The source test validates a `gate.create` batch and nested Gate/Criterion markup, but not layout in Chrome. |
| V3 existing edit and removal | **Gap.** The source test checks an existing Gate purpose diff and removal ghost; no disposable connected Chrome edit/removal fixture was shown. |
| V4 interaction and safety | **Partial.** Empty Roadmap editor opened on the rebuilt source. The canonical `/tmp/dope-r4-r1-visual-20261103/.dope/roadmap.json` and linked `ROADMAP.md` were absent both before and after this check. No Apply control was exercised and no stage was delivered, so this absence does not prove preview no-write behavior. Pan/zoom during updates, expansion, camera, focus, cancellation, project isolation, reduced motion, and narrow layout remain unobserved. |

**Accepted staging operation IDs/sequences:** none. **Chrome card screenshots:** none. **Observed product-owned visual defects:** none, because no provisional card appeared. The prior cancelled Stage 1 screenshot belongs to the older bundle and is not reused as a PASS for this source.

## Blocking condition and next action

The connected app's production `roadmap-stage` delivery is invoked inside `ChatBackend.runTurn` after `roadmap_stage` succeeds in a protected Chat tool turn. The available deterministic `RoadmapNativeStageOwner` fixture runs in a separate test process and does not deliver events to this live Chrome session. The only selected live Chat model visible in the prior session was Qwen; this R4-R1 request explicitly excludes running it. No validated deterministic driver connected to this running app was available in this attempt. Injecting browser DOM or synthetic stage events would not satisfy the qualification contract.

Provide or implement a bounded, authorized controlled staging driver that invokes the existing protected native owner and normal event bridge for a fresh disposable Chat turn. Then capture V1–V4 in Chrome, including exact accepted IDs/sequences, screenshots, before/after canonical and Markdown hashes, and browser bundle identity. Reuse the 51 passing tests if product source remains identical; rebuild and rerun affected checks if a demonstrated visual defect is repaired.

**Implementation:** Implemented for the source-level R4-R1 styling change; no repair made in this attempt.  
**Verification:** **Evidence Gap / NOT GREEN** for mandatory connected Chrome visuals and interactions.  
**Progression:** **Hold** R4-R1 closeout. This record does not authorize R4-R2 automatically, qualify R3/R4 live staging, change historical NOT GREEN results, or imply broad Roadmap/Phase 12 Green.
