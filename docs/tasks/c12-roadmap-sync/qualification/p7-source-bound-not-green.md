# P7 source-bound result — NOT GREEN

Date: 2026-11-02 America/Chicago. Pre-task and final HEAD: `8544824bf956524a92efe76d0e2ce7ab6cf937e6`; initial tree clean. Product version remains `0.12.7`. All P7 changes remain uncommitted for the phase runner.

The existing Roadmap toolbar now has accessible icon-only Undo/Redo for verified archived revisions. The read-only historical graph uses the exact fetched snapshot after SHA-256 and owner/revision checks. A bottom strip identifies selected/current revisions, earliest stored baseline, as-of status/evidence, a checked structural comparison, disabled Confirm Restore pending P8, and Return to Current. History mode hides and blocks current canvas pencils, Inspector, source and review controls; current Chat proposals stay available for a later manual View. The old Inspector “Undo last edit” button is removed. No code-editor shortcut was added.

## Observed checks

- Four-revision cursor test: Undo/Undo/Redo/Redo, both disabled bounds, late baseline and malformed list fail closed: PASS.
- Disposable four-snapshot integration test: exact as-of Phase titles and unchanged canonical Roadmap and independent Markdown bytes after list/fetch/projection: PASS. Existing archive tests cover hashed records, corruption, wrong owner and restart.
- `node --test` on history navigation, revision archive, canvas, Inspector and viewport: **5/5 files PASS**.
- `npm run typecheck`, final `npm run build:browser`, `git diff --check`: PASS.
- `npm run build:electron`: FAIL during native dependency rebuild because system `libsecret-1.pc` is unavailable for `keytar`. Extension TypeScript compiled; Electron build completion and native GUI are not claimed.
- `roadmap-semantic-zoom.test.ts`: 5/6 assertions PASS; one pre-existing source-text assertion still expects a `displayedCount` sequence absent at the P5 baseline. The P5-Q1 evidence records this same failure. No semantic zoom behavior change was made by P7.

Final SHA-256: canvas widget `54145003ada024b9ef500922e9870dcbcd26202245868d9322ed5afaa63a19d2`; navigation helper `3874bca6568d28f96224cf1430932d0f4c49d9904a581190fd0ff045e592e60c`; Inspector widget `04e4eefac188809c1a3f221c5a5fc735103506f67743b9f21f37a3b0aa28a635`; CSS `155673ae52d36470841d5575f97d85c4e7b0334f960491cddd82a287731e1089`; navigation test `3e7ac466e7aad4af427547cb61494e609884c24eca485ece37b4df5e5cd99622`.

## Remaining qualification

No connected UI replay was performed for multi-owner manual/Chat/link revision navigation, narrow layout, focus, keyboard, pan/zoom, reduced motion, concurrent head and terminal Chat card behavior. Existing source tests cover parts of those contracts, but do not prove the P7 interaction matrix. Electron build is blocked as above. **P7 NOT GREEN**; do not create a runner PASS marker or advance to P8 from this record. Confirm Restore remains disabled.
