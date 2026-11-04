# M1 Roadmap review tabs — PARTIAL / NOT GREEN

**Basis:** `main` HEAD `90b22f26a55ad626b039973f403dde81aeb62163`, product version `0.12.7`, clean at entry. M1 product and test changes are uncommitted. No model/provider settings, real owner workspace, or package version changed. No M2 or runner closeout was started.

## Entry gate

The P3 checkpoint report remained PARTIAL because socket-backed worker cases had failed to start under `EPERM` and a local-model fixture had intermittent cleanup failures. Before M1 edits on the unchanged P3 HEAD, the exact-source combined worker/local-model suites passed **24/24**, including the serial two-Phase worker, source/revision drift, cancellation, and cleanup cases. This resolves that local execution blocker for this entry; it does not rewrite P3's historical report or establish browser/native qualification.

## Implementation

One reusable `ProposalControlTab` now appears at the upper-right border of proposed Phase, Gate, Criterion, and Correction/change cards, with checkbox, check, and X controls. It stays outside the card content, uses Theia theme surfaces and focus/semantic tokens, and exposes labels, tooltips, selected, disabled, and busy states. The control is suppressed below 0.8 zoom, where transformed hit targets would fall below 24 screen pixels; the always-visible canvas toolbar offers a zoom-in action.

The canvas maps visible entities to pending operation IDs, including embedded Criteria owned by a Gate operation. Direct decisions and selected bulk decisions close over required pending creators or descendants and enter the existing checked `reviewProposal` preview. Confirmation remains a separate action. Shift activation selects or reviews a Phase with pending descendants; keyboard Shift+Enter/Space uses the same scope. The four selected/all actions remain in a compact icon toolbar with counts in accessible labels and tooltips. The existing preview shows changed entities, omitted counts, and explicit Confirm/Cancel.

## Verification

- Final `npm run build:browser`: PASS, including extension TypeScript build and browser/backend bundles. Final bundle SHA-256 `45eecbc50bc63e29c72c814edcc78583d206674ed808ff501dbb0ebd848e6dcc`; a separate local Theia server on port 3001 served the identical `/bundle.js` hash. The earlier server on port 3000 was not interrupted.
- Final focused proposal selection/card, StageOwner, publication, Markdown sync, and History suites: **61/61 PASS**. `git diff --check`: PASS. Final M1 product/test diff SHA-256: `4f495aa4f07365d870de9dcc31740991fadbd073cecdcf05722946910c1004a0`.
- Connected Codex Browser opened the separately served exact bundle and a disposable `/tmp/dope-m1-review-aNhnE0` workspace. No pending proposal existed there. A static preview rendered from the actual React component and CSS was inspected in dark and alternate light colors; screenshots in this task's browser transcript show top-right attachment for Phase/Gate/Correction and an expanded Criterion. Those screenshots predate the final spacing and hit-target adjustment and are **visual guidance only**, not exact-final-source or live review proof.

## Missing mandatory evidence

The connected Dope workspace had no valid pending source-bound proposal. No live element selection, direct checked preview, Confirm/Cancel, selected/all decision, partial Apply/Reject, stale lease/source, synced Markdown, History, keyboard order, pan/zoom, narrow viewport, or screen-reader behavior was observed on the final source. The temporary static preview server stopped before the attempted narrow recheck. No final-source screenshot pass is claimed. The owner's active tower-defense workspace was not used to manufacture state, and no live Qwen inference was launched for this visual task.

**Disposition:** M1 implementation is source-verified but browser qualification is **PARTIAL / NOT GREEN**. Stop before M2. A later manual pass needs a disposable valid pending proposal on this exact product diff, rebuilt/served bundle identity, and the full browser matrix in M1 before GREEN or progression.
