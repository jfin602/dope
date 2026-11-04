# P2 ordinary Roadmap Apply History — source verified

**Source basis:** `main` starting at `2cd38783b340ddb482adfbbdaabf4a22a881a631`, version `0.12.7`. This report covers the P2 source changes and the separately documented P1 recovery in the next checkpoint. It does not qualify later visual or native Electron behavior.

Project History now reads verified `RoadmapStore.listRevisions` records and projects one ordinary Apply event for a committed owner-write receipt containing the unique UUID operation IDs written by `RoadmapNativeStageOwner.decide`. Its stable source ID binds Roadmap owner, revision and accepted operation identities. The event uses the archive capture time and actual applied revision, and reports the number of accepted operations. Nested Criteria included in one Gate operation are not counted again. The durable receipt does not record affected Phase/Gate names, so the event does not invent them. Existing reviewed Restore entries keep their own classification. Staging, rejection, source sync and owner writes without a native Apply receipt produce no Apply event. No History writer or canonical mutation path was added.

**Focused evidence:**

- A fresh Roadmap had no Apply entry; staging alone had none. Selected Phase+Gate Apply produced exactly one R1 event for two operations, including two nested Criteria counted within the Gate. A second selected Apply produced a distinct R2 event. Repeated reads and a fresh store/read preserved both IDs and timestamps. A different project root had no Roadmap events.
- Rejection created no new event. Apply All produced one event for its two actual operations. Linked Markdown synchronization after approved Apply left the same single History event and revision. Reviewed Restore added one separate Restore event and retained both earlier Apply entries. A corrupted archived record caused a Roadmap diagnostic and no invented events.
- `npm run typecheck`: PASS. `npm run build:extension`: PASS. Focused History/StageOwner/Restore/controller/worker/publication/sync suite: **74/74 PASS**, including the six real worker cases after P2 integration. The final History test file, with the added Apply All case: **8/8 PASS**. `git diff --check`: PASS.

The original P1 and older P3 NOT GREEN reports remain historical. The later connected browser visual History check and independent native Electron GUI check remain open.
