# c6-edit-architecture P4 closeout

Result: **Not Green (time-boxed evidence gap)**, 2026-10-02, unchanged `0.6.7`. This does not relabel Phase 6 P7 or unblock P8.

## Candidate and prerequisites

- Activation baseline: `b447d925ee4c12891ff072f235368e7b29a6854d`; Green `c6-smap-outline` predecessor: `ac7fd5a29fb9d6dca4fc2f137f8fdef7f2a20439`.
- P1 `fa507faa49658b3589f9649a2e6285582230dccf`: reported Green after 65 focused tests and builds. P2 `f456b269765fdd12fbb42a0ed02b03ffb67e1e41`: reported Green after 40 focused tests and browser build. P3 `9791819c80ca60ec59f08fbff2316508879a1552`: reported Green after 70 focused tests and browser build. These are the retained implementation results, not rerun P4 evidence.
- Exact P4 candidate: clean `9791819c80ca60ec59f08fbff2316508879a1552`, package `0.6.7`. Source reference `/home/jfin/dev/adaptive-seo-dope` at `0b26a25107be7d8dfb2210bc7258ccac8603197e` was copied to `/tmp/dope-edit-architecture-p4.N2BtRr` without `node_modules`. Source `.dope/architecture.json` SHA-256 `b5a09a50397149f589a80c2f9987ec66c0023a85c75ad98b4a973ebd1d370208`; marker `b35801cb0d6ea2100c7fa47c28f2e75b186dab8ff9fae28cdf7fff446b4bc583`. Both source hashes stayed unchanged.

## Short gate and direct browser evidence

- User requested under five minutes and explicitly allowed skipping lengthy tests. `npm run check` was **not run**. `git diff --check`, exact root/internal `0.6.7` references, no-root-lock, and `npm run codex:phase:validate -- c6-edit-architecture` passed. No tiny fix was made.
- Initialized Software Map displayed Open Physical Map, Refresh Software Map, and Edit Architecture. The editor opened in the center; repeated activation retained one tab. No Edit Hierarchy label was observed.
- Accepted Adaptive SEO Service name, purpose and three roots matched the source canonical declaration; Customer PHP Feed Rendering and its root loaded. Full ID/dependency round-trip was not manually inspected.
- Blank System name yielded deterministic `invalid_name` and disabled Save. After repair, a purpose edit left both canonical hashes unchanged. Discard removed it. Repeating the edit and using Save changed only the copy's architecture and marker hashes to `375aba5bd3d9c47a42642179b69b5d3defdd7e4ad82817e153e0c7f287ebbfb0` and `23d7dc1817b4baec613883c1bb4b0544adb13ac4661770cc04357c49662c9d2c`. Analysis published generation 1, **partial**, 4419 nodes and 0 violations; the omitted dependencies in this fast copy caused many source diagnostics. Reload reopened the saved purpose with no unsaved draft.
- The editor kept Customer PHP Feed Rendering selected after the left outline selected Adaptive SEO Service and the Physical Map opened with that System selected. The center map displayed the selected System. The reverse map-to-outline reveal was not replayed.
- Local provider at `127.0.0.1:1234` was unavailable. Gemini model discovery succeeded using the existing machine key. `gemini-2.5-flash` readiness returned HTTP 404; explicitly selected `gemini-3.5-flash` passed readiness. A real accepted-map Search Deeper call on Customer PHP Feed Rendering produced a branch-local preview with two proposed components and observed links to `src/server/installations/generated-php-installation.ts`. Before Accept, canonical hashes were unchanged. Accept modified the editor draft only; canonical hashes remained unchanged. The resulting proposal had an `ambiguous_root` blocker because three draft boundaries claimed the same file. The refinement was discarded; no refinement was saved.
- The copy's `.dope/` contained only `architecture.json` and `smap.json` after editing/Search Deeper; no accepted edit/history or `smap-analysis.json` file appeared.

## Decision and routing

This short pass proves the exercised GUI save and real provider preview paths. **Full P4 Green is withheld** because the required aggregate `npm run check` gate, full canonical ID/dependency comparison, and another-project isolation replay were omitted for the requested time limit. The accepted refinement's ownership conflict was correctly blocked at Save and remains a useful manual review finding, not a silent canonical write. Keep P7 Not Green and P8 blocked; carry the separate native/package shutdown blocker and complete the omitted P4 evidence before claiming this correction Green.

## Follow-up: conflicting refinement guard

The subsequent focused correction prevents an accepted-map refinement with overlapping implementation roots from entering the draft. The previous live proposal assigned `src/server/installations/generated-php-installation.ts` to the Subsystem and its proposed Components, which canonical Architecture cannot represent as unique ownership. The editor now keeps such a result in preview and reports `ambiguous_root` before mutating the draft. No ownership is inferred or silently reassigned.

The browser bundle built successfully and all 31 Software Map UI tests passed, including a permanent same-file regression and a valid-refinement path. In a fresh browser replay on the same disposable copy, Gemini `gemini-3.5-flash` passed readiness and produced a one-Component proposal from the same source file. Clicking Accept refinement displayed the ownership diagnostic while keeping the preview, original editor branch, disabled Save, and both copy hashes unchanged. The source reference hashes also remained unchanged. `git diff --check` passed. The broader P4 evidence gaps above remain open, so this follow-up does not change the **Not Green** result or P7/P8 routing.

The reference file contains both `validDeliveryOrigin` and `generatePhpInstallation`. Current Architecture roots are project-relative paths with longest-prefix ownership, not symbol selectors. Giving the parent `src/server/installations` would also claim unrelated installation files. This source layout therefore has no separate evidenced path for the proposed Component; the truthful current representation is a leaf Subsystem until the implementation gains a separate source path or a future approved symbol-level ownership contract.
