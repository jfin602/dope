# P7 local Qwen sMap evidence — Not Qualified

**Disposition (2026-09-29): Not Qualified.** The owner stopped this qualification to rework the approach. P8 and Phase 5 remain closed. The successful local model response was schema and reference valid, but its proposed architecture was too weak to accept; the corrected prompt's next live run was cancelled at the owner's direction. No canonical architecture was accepted or published.

## Candidate and controlled state

- P6 handoff and P7 starting commit: `7552111fb6f1f757800b0e83f614112100635850` on `main`; preflight tracked Git state was clean. P7 source is that commit plus the four uncommitted repair/test files listed below and this evidence file. There is no P7 commit or qualified package.
- Root and app version remained `0.4.6`.
- Preflight `.dope/architecture.json`: 2,608 bytes, SHA-256 `b2356b71e27131607e4e46f93d6a6eac5626d225a5486cde65883f31ba713928`. `.dope/smap.json` was absent. The existing architecture declaration was kept out of the deterministic synthesis packet.
- For browser exercises, the project-local architecture was temporarily set aside to expose the uninitialized path. After cancellation, `.dope/architecture.json` matched the preflight backup byte for byte and `.dope/smap.json` remained absent. Git has only the intended P7 source/test/report changes; no preexisting tracked change was displaced.

## Local reference path and direct browser observations

- LM Studio OpenAI-compatible endpoint: `http://127.0.0.1:1234/v1`. The browser session used `http://127.0.0.1:1235/v1`, a local forwarding observer for request-order and payload-size evidence. It forwarded to LM Studio without changing the selected model. No cloud provider or token was used.
- Model discovery returned and the user interface selected `qwen3-coder-30b-a3b-instruct@q4_k_m` (Qwen3-Coder-30B-A3B-Instruct family). The structured JSON capability probe passed.
- Opening the browser workbench offered **Analyze Project** while uninitialized. **Not now** left the map uninitialized, the marker absent, and the architecture hash unchanged. The sMap button allowed re-entry.
- Observed request order on the successful run: discovery at 21:01:57 UTC, structured probe at 21:02:02, synthetic warm-up at 21:02:27, then the architecture packet at 21:02:29. The observer recorded request kind, model, size, and digest; it did not supply the existing canonical architecture to the model. The complete deterministic packet remained on the Dope side for final reference validation.
- The initial full packet was about 215 KB (426 evidence items); the 227,802-byte request received LM Studio HTTP 400: `request (95870 tokens) exceeds available context size (32768)`. A compact provider presentation then sent all facts with short aliases and a path dictionary while retaining the full packet for validation. The successful request was 50,178 bytes, with compact user-payload SHA-256 `e5f51a4dadda86a249856a3751bec9af1eb438b3ec330a1d52b15ad930c4f413`. Its 355 transmitted facts comprised 11 topology, 30 framework, 36 entrypoint, 74 configuration, 52 dependency, and 152 semantic facts over 84 paths. The packet input fingerprint recorded for that run was `a07503aa69eb7e260194191da75781541032bc857a0e08d68692654b28025210`.

## Proposal and provenance

LM Studio returned HTTP 200 after about seven minutes. Dope parsed the JSON against the proposal schema and resolved its hard aliases against the exact server-side packet before showing the review state. The response proposed only two root Systems, **Browser System** and **Electron System**, each at confidence `0.95`; it proposed no Subsystems or Components. Both Systems used the same 20 hard refs (`e1`–`e20`), including unrelated contract, test fixture, and Electron facts for the Browser System. Its questions asked whether additional subsystems existed and what their dependencies were. This is a concrete semantic quality failure despite syntactically valid refs; the two root nodes were not accepted as Dope's canonical architecture.

The review displayed model rationale alongside source-backed facts. Browser inspection followed framework refs for the Software Map view in `packages/theia-extension/src/browser/software-map-widget.ts` and its frontend view contribution in `packages/theia-extension/src/browser/frontend-module.ts` to the source editor; a backend source ref opened `packages/theia-extension/src/node/backend-module.ts`. These refs resolved, but the proposal did not use a backend/RPC or DI framework fact to support a meaningful boundary. Framework registrations were evidence, not architecture authority.

An invalid draft with blank canonical IDs kept **Accept** disabled. The proposal was cancelled; no correction was accepted, no canonical architecture or marker was written, and the UI returned to uninitialized. Rename, reparent, add/remove, child movement, valid acceptance, publication timing, initialized restart/Refresh, and manual-declaration paths were not completed.

## Warm-up failure and repairs

A controlled observer failure returned HTTP 503 during warm-up. The request sequence stopped at warm-up: no architecture packet followed, no proposal or marker appeared, and the architecture hash was unchanged. The browser showed an error and recovery controls. The UI initially retained a misleading passed-probe readiness flag; the controller now clears it after a failed setup so retry requires a fresh probe. A regression check covers this behavior.

Direct runs exposed three additional local-provider defects: full packet overflow of the Qwen context window, a 120-second synthesis timeout, and Node fetch's effective header timeout during long inference. The provider now sends a compact alias/path presentation, validates expanded refs against the full packet, allows 900 seconds for synthesis, and uses Node's HTTP transport with an explicit abort timeout. Provider regression checks cover compaction, reference mapping, fact priority, and timeout. The successful live run replayed the compact-packet and transport path. The last prompt revision prioritized topology/framework facts and requested a bounded System/Subsystem/Component hierarchy; its live Qwen request began at 21:14:37 with 50,411 bytes and compact payload SHA-256 `568fbcf1eef77d0d0c891a86a7387a8feb2b69dda1d545c290491acd1bc85f7a`. It was cancelled before response when the owner stopped qualification. The UI returned to uninitialized, and the browser server and observer were stopped.

Uncommitted repair files:

- `packages/theia-extension/src/node/lmstudio-synthesis-provider.ts`
- `packages/theia-extension/src/browser/software-map-controller.ts`
- `test/unit/lmstudio-synthesis-provider.test.ts`
- `test/unit/software-map-ui.test.ts`

## Checks, package, and evidence gaps

- A full `npm run check` and `npm run codex:phase:validate -- c4-smap-synth` passed before the final prompt-order/transport revision. After that revision, `npm run build:browser` and the focused LM Studio provider test passed (9/9). Earlier focused provider/UI checks passed (20/20). `git diff --check` passed at closeout.
- An AppImage was built at `dist/linux/Dope-0.4.6.AppImage` before the final source revision: mode `755`, 189,216,182 bytes, SHA-256 `d67e73a874bd1500889a6d6152f87e4304e92b621522db85178b6862768cb039`. Inspection found embedded version `0.4.6`, Software Map/backend/frontend composition, and no general Agent Runtime string. This artifact is **stale relative to the final uncommitted repairs**. Native launch/readiness/close was not observed.
- `npm run test:restart`, a final aggregate check/phase validation, final corrected AppImage build and native launch, IDE smoke checks, accepted-draft publication/restart, and manual-declaration initialization remain evidence gaps. The successful proposal did not establish a meaningful hierarchy or relevant backend framework reasoning. The last prompt revision has no completed live response.

**Gate:** P7 is unqualified. Do not use this evidence to advance P8 or Phase 5.
