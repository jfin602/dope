# P2 source-bound qualification — NOT GREEN

Date: 2026-11-02. Pre-task local HEAD: `3cbb49b7dc32038189158901e2465bb20ab7e34d`. Product version remains `0.12.7`. All P2 changes are uncommitted for the phase runner. No canonical project data was edited; tests used temporary disposable projects.

## Implemented candidate

- Native `roadmap_stage` now has ordered `expectedStage`, explicit final `done`, phase-only strategy, stable operation IDs, bounded readback, and a dry-run schema-2 projection. Canonical writes retain their three-action limit.
- Native `/roadmap` turns obtain one server-validated proposal from staged operations, with saved Chat projection and the same proposal ID available to the existing canvas provisional presentation. The preview is explicitly non-actionable in P2. Accepted-index response text cannot create an authoritative proposal.
- The saved projection retains up to 64 changed entities, 48 steps, and all bounded Gate criteria rather than silently omitting the tower-defense fixture's changes.

## Observed checks

- `npm run build:extension`: PASS.
- `npm run build:browser`: PASS.
- `npm run typecheck`: PASS.
- `npm run check:pi-runtime`: PASS.
- `node test/unit/roadmap-native-stage.test.ts`: 4/4 PASS, including five ordered Phases, four Gates with Criteria in three Phases, stable staged IDs, saved proposal parse/reopen, phase-only and negative cases, and unchanged `.dope/roadmap.json` SHA-256.
- `node test/unit/roadmap-proposal-presentation.test.ts`: 2/2 PASS.
- `node test/unit/roadmap-chat-panel.test.ts`: 6/6 PASS; `roadmap-canvas.test.ts`: 16/16 PASS; `chat-backend.test.ts`: 16/16 PASS; `chat-panel.test.ts`: 34/34 PASS; `chat-repository.test.ts`: 15/15 PASS; `roadmap-gate-store.test.ts`: 7/7 PASS; `pi-model-bridge.test.ts`: 11/11 PASS.
- `git diff --check`: PASS. Local manifest still reads `0.12.7`.

## Blocking and unobserved

- `node test/unit/roadmap-gate-chat.test.ts`: 3 PASS, 1 FAIL. Its saved-Chat mutation test expects the retired response-parser proposal path; the current protected native route correctly stops when its fixture supplies no native broker. Replace this legacy test with native tool-driven Chat coverage and verify the complete turn before P2 can pass.
- `npm run build:electron`: FAIL during native dependency rebuild because system `libsecret-1.pc` is unavailable for `keytar`. This does not indicate a TypeScript failure; Electron build qualification remains a gap.
- Actual selected local-model staging, live Chat/canvas preview behavior, and active/background/closed Roadmap tab transitions were not exercised in a connected UI. The deterministic fixture cannot establish those results.
- Revision-zero greenfield draft generation still uses the existing reviewed draft route. The native P1 stage owner requires an accepted schema-2 owner at revision 1 or later; revision-zero cutover needs a separate safe owner design before claiming native greenfield coverage.

Disposition: **P2 NOT GREEN. STOP.** No Apply or Reject implementation, product version change, or implementation commit is claimed.
