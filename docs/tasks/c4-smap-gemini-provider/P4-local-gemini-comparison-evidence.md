# P4 Gemini-only debugging evidence — interim, Not Green

This records the developer's narrowed request to debug and test **only Gemini**. It is not the Local/Gemini controlled comparison or consolidated P4 qualification. Do not route this evidence to P5 as a completed P4 gate.

## Candidate and controls

| Item | Observed value |
| --- | --- |
| Dope source candidate | `ac9266de92c15fb86c7e764201261e1c594ca3d8` (`0.4.6`) |
| Benchmark | `/home/jfin/dev/adaptive-seo-dope-p8`, clean at `0b26a25107be7d8dfb2210bc7258ccac8603197e` |
| Benchmark remote | `git@github.com:jfin602/adaptive-seo.git` fetch; push `DISABLED` |
| Provider and model | Gemini Developer API; `gemini-3.8-flash` explicitly selected, successfully probed, and used for the UI replay |
| Key source | Supplied through Dope's masked field; saved after successful model discovery in this machine's credential store; value never recorded here |
| Architecture contract | Existing hierarchy-first compact stage contracts and deterministic evidence packet/planner; no provider-specific architecture contract or Local-specific optimization added |
| Packet/view fingerprints | Not captured from the live UI; this limits exact per-call reconstruction |

The machine-stored key remained available after backend restarts; model rediscovery and a new readiness probe succeeded without reentry. The selected Gemini model was the only live synthesis provider tested. No automatic provider switching was observed. The benchmark stayed clean and has no `.dope/` state; the review remained transient and was **not** accepted as canonical architecture.

## Gemini replay and repair trail

1. The first real UI replay failed at System Discovery after about 22 seconds with a short output and an opaque error. The safe failure category was exposed, and Gemini discovery guidance now permits one System for a cohesive product while reserving zero Systems for evidence with no production responsibility.
2. One replay was interrupted by a development browser/plugin-host reconnection loop with 94 optional plugins. Subsequent replays used an empty optional plugin directory, retaining the built-in plugins. This was an environment interruption, not a claimed product fix.
3. The next Gemini replay completed in 46.6 seconds but returned one System and no Subsystems. Inspection of the deterministic packet found 760 items: 378 dependency, 336 semantic, 24 configuration, 21 entrypoint, and one topology. The Subsystem view contained only 20 `package.json` facts because root-manifest System evidence constrained selection to that path. The shared planner now opens production source scope for that case, prioritizes semantic facts, and distributes the bounded view across source areas. The revised view contained 45 facts across 27 paths, including 43 semantic facts and two entrypoints.
4. The next Gemini replay completed in 114.5 seconds with one System, two Subsystems, and six Components. Source navigation opened `src/server/http/app.ts`, but reconciliation reported nine false outside-System questions because the root manifest was treated as an exclusive source area. The deterministic audit now treats it as repository-level evidence.
5. The final real UI replay on the committed source candidate completed in **83.9 seconds**. It returned one System, two Subsystems, five Components, no reported open questions, and no reported unassigned source-backed evidence. The developer did not accept the proposal.

Permanent focused regressions cover root-manifest source selection, manifest ownership audit, the Gemini discovery instruction and safe failure category. After the final repair, the four focused unit files passed **36/36 tests**. The browser build succeeded on the final source. `git diff --check` passed before committing the source changes.

## Final Gemini result

| Stage | Observed provider call | Input tokens | Output tokens | Total tokens | Request bytes | Output bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| System Discovery | 14,455 ms | 14,034 | 336 | 18,002 | 29,310 | 704 |
| System Challenge | 7,204 ms | 2,742 | 508 | 4,883 | 5,685 | 1,065 |
| Subsystem Discovery and later calls | Not captured | Not captured | Not captured | Not captured | Not captured | Not captured |
| End-to-end UI analysis | 83.9 s | — | — | — | — | — |

Gemini supplied the token counts. Its reported total may include token categories beyond visible input and output, so those columns need not sum. Stage planning time, later per-call metrics, call count, cache reuse, and a final packet fingerprint were not captured. The 83.9-second elapsed time is the observed UI run, not a claimed sum of provider calls. No Local runtime/model or Local measurement was taken.

The initial System was retained through challenge. The final hierarchy was:

- **Adaptive SEO** (System)
  - **Backend Application Subsystem**: HTTP Server & Middleware; Data Persistence & Repositories; Integrations & Content Feeds
  - **Frontend Application Subsystem**: Client UI Views & Presentations; Client API Client

Representative lower-level source refs were `src/server/http/app.ts` (`createApp`), `src/server/integrations/ahrefs-service.ts` (`AhrefsService`), `src/client/app/application.tsx` (`App`), and `src/client/api.ts` (`getJson`, `postJson`). The System-level refs were only two root `package.json` start scripts. These are source-backed but thin support for its responsibility statement. A cited source path opened in the editor from the review UI.

## Architecture quality and disposition

One System is plausible for this cohesive repository, and the final hierarchy descends to source-backed Components. The Subsystems are mostly frontend/backend deployment tiers. The benchmark's developer architecture reference describes stronger product boundaries around projects, feeds/source pools, collection, integrations, observations, and opportunities. The generated “Data Persistence & Repositories” combines different domains; “Integrations & Content Feeds” also combines distinct responsibilities. Therefore the Gemini result is **Not Green on architecture quality** despite completing in under eight minutes and reporting no open questions. The UI's absence of questions did not establish a good canonical architecture.

The independent reference documents were accidentally read before the first generated hierarchy was frozen in earlier work; none of their contents was supplied to Gemini synthesis. That procedural imperfection further limits a formal quality comparison.

## Remaining P4 evidence gaps

- No Local live run or same-pipeline comparison was performed under the narrowed Gemini-only request. No diagnostic attribution between shared pipeline, Local runtime, and model capability is possible.
- The final Gemini run lacks complete per-stage timing, token, byte, planning, and cache data. Full no-fallback/cancellation/project-switch and UI/security matrix coverage was not repeated on the final source candidate.
- The full `npm run check`, restart suite, phase validation, Linux AppImage inspection, and native launch were not run for this narrowed debugging pass.
- The generated architecture needs developer correction or further synthesis work before a Green quality disposition. Canonical acceptance remains solely the developer's action.

P4 remains **Not Green / incomplete**. The benchmark is unchanged and clean; Phase 5 remains inactive.
