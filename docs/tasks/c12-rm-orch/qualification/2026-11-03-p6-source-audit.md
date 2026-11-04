# P6 source audit — local implementation, not product qualification

Pre-task HEAD `39a81ab4410e928fdeaf085f39fcdf69e2d562cc` on `main`; clean worktree; manifest version `0.12.7`. The D2 dirty files reported in earlier documentation were absent locally. Runner owns the later checkpoint; this report is not a commit receipt or product GREEN.

## Reachable generation graph

Fresh user Chat submission → `ChatBackend.runTurn` exact `roadmapGenerationCommand` parse → `runGenerationCommand` lease/model/root checks → `prepareGenerationCommand` → one `RoadmapGenerationController` → bounded Pi project tools → `RoadmapGenerationNativeStage` → the shared `RoadmapNativeStageOwner` → validated `roadmap-stage` events → Chat panel/canvas provisional projection. A completed stage becomes one noncanonical Chat proposal. `reviewNativeRoadmap` and `decideNativeRoadmap` perform selected owner review; the checked Roadmap store owns Apply, linked Markdown sync and History. No canonical, Markdown or applied History write occurs on stage.

The only product construction of `RoadmapGenerationController` is in `chat-backend.ts`. Its caller is the exact leading, nonempty `/gen-roadmap` branch of fresh `runTurn`. Retry, ordinary Chat, Planning, Work, model/tool text, legacy aliases and UI button cannot enter it. The retained button fills the composer only. Native `/roadmap` edits and manually edited draft/import flows use their existing checked owners and do not invoke the generation controller. Saved `roadmapAction` and `lockedRoadmapPlan` parsing remains inert for historical Chat readability; lease turnover may mark old offered actions stale.

## Cleanup manifest

Removed the retired offer/strategic review RPCs, Chat controller and frontend review wiring, canvas strategic overlay and CSS, `RoadmapGreenfield` whole strategic preview/accept/reject producer and transient map, obsolete Chat result types and old progress copy, RM1 END marker diagnostic, and the exclusive `chat-roadmap-flow.test.ts` scenario. Updated historical-plan and UI tests; added a source negative guard for the single controller construction site and absent strategic methods. Retained manual draft editing, import/Markdown parsing, protected native staging, saved historical Chat fields, proposal review, revision archive and source-sync owners.

## Validation and limits

On this worktree, 139 focused source/UI/authority tests passed (98 generator/Chat/draft/canvas tests plus 41 publication, native Gate Chat, sync and History tests). Chat, project-intelligence and extension TypeScript builds and browser and Electron builds passed. `git diff --check` passed. The five worker integration cases could not reach assertions: the sandbox denied their local `127.0.0.1` fixture listener with `EPERM`. This is an evidence gap, not a baseline attribution or passing test. Real local-model, connected browser, restart continuation and independent native Electron GUI remain unobserved. P5's documented restart-continuation gap is unresolved. P7 must evaluate actual model behavior, timing and selected Apply/Markdown/reload independently.

The controller already records `startedAt`, `durationMs`, time to first stage, time to review, calls, retries, token usage when reported, and ordered provider progress. Canvas projection is queued asynchronously and does not add model calls or await paint. Source-scope disposition: implementation cleanup complete for traced paths; P6 qualification NOT GREEN because worker integration and restart continuation remain unverified.

Final source SHA-256: Chat backend `e36847b15a0393e16fba5e0ef98c6ab8c045006ab3b74639beb6c5bd808ef21e`; controller `b80c646d6f1b9a66745ddac6e73a327c8cd71dfe9779841d35a4f2ccf5b18de8`; canvas widget `39074cdd18961f7b4b15f46274345472d4bd99673f934c8a8454215e2d657511`; greenfield draft owner `cbaa5342577daf2d995b5f804c7fc69a8cc18508790dba28d823921c5c984af3`.
