# R2 repair cycle 1 — live RoadmapService foreign-owner denial

**Disposition: GROUP 1 GREEN / QUALIFIED.** This is a supplemental R2 result on 2026-10-15 (America/Chicago). Overall R2 remains **NOT GREEN** pending Repair Group 2. R4, R5 and R6 were not run; Phase 10 remains Not Green and not owner-closed.

## Source and service boundary

Local `main` was clean at `65173d7763563b8032662299fd85057d9ed7a59d`, three commits ahead of stale `origin/main` (`e529fe3f4e5be6db4a322d347b4d0af9b1c38bcd`). The exact qualified product source `687721ee720122c5f01ca8ff6ee2b3a92b65b950` is its ancestor. `git diff 687721e..HEAD -- packages apps package.json yarn.lock` was empty. No remote reset, sync, source change or version change occurred; package version remains `0.10.16`.

The prior R2 Socket.IO probe opened a socket but did not speak the registered service protocol. Actual frontend registration uses `ServiceConnectionProvider.createProxy` in `packages/theia-extension/src/browser/frontend-module.ts`; backend registration uses a per-connection `RpcConnectionHandler` for `/services/dope/roadmap` in `packages/theia-extension/src/node/backend-module.ts`. The supported transport is a token-cookie-validated Socket.IO `/services` connection, Theia `initialConnection`, `ChannelMultiplexer.open('/services/dope/roadmap')`, and `RpcProxyFactory` with Theia MsgPack extensions. An ordinary Socket.IO event to the service path cannot invoke `RoadmapService`. The first diagnostic client iteration also needed Theia's error-extension registration to decode a service rejection; this was a harness issue, not a product defect.

After rebuilding the extension and browser app, a separate browser backend ran at `127.0.0.1:3001`, PID **103088**, from `apps/browser/src-gen/backend/main.js` with disposable `THEIA_CONFIG_DIR=/tmp/dope-r2-g1-config`. The client obtained the normal first-page `theia-connection-token` cookie; its value was never printed or retained. No privileged credential, bypass, diagnostic endpoint or production project was used. [Backend startup/connection log](repair-cycle-1/evidence/backend.log) records the app process, two service connections and closure of the Roadmap channel. The [live client](repair-cycle-1/evidence/live-roadmap-rpc.mjs) uses Theia's installed transport/RPC classes; the [result](repair-cycle-1/evidence/live-rpc-result.json) records request responses and file states without the cookie or raw approval token.

## Valid service request and disposable owners

The live connection called `RoadmapService.read` on project A and received project ID `fab0950d-2d12-40f0-99ee-f7b8185d10e4`, revision **1**, checkpoint `roadmap:ROADMAP.md#phase-1`. It then called `attach` for A and B and a valid `preview` for A with its owner, revision and linked-source fingerprint. The preview returned the same owner and revision, `requiresApproval: true`, a document diff and a token (only its SHA-256 is retained). Both files remained unchanged. This proves the channel delivered a valid request to the running service and returned the result before any hostile test. The second valid app connection was used only to test connection-scoped handle rejection.

| Disposable owner | Root | Project/owner ID | Revision | Linked Markdown SHA-256 | `.dope/roadmap.json` SHA-256 |
| --- | --- | --- | ---: | --- | --- |
| A | `/tmp/dope-r2-g1-tFefy8/project-a` | `fab0950d-2d12-40f0-99ee-f7b8185d10e4` | 1 | `a257bafe189bc02d07c4551a65b253fa8f51bca2d95ba7f2f210b31a72fa591d` | `8a1536630fd655a17bd7b146e287c95e0a3dc54df52254553fe2f696ffce65d2` |
| B | `/tmp/dope-r2-g1-tFefy8/project-b` | `a4077f9f-3654-4196-919e-1adb61d86153` | 1 | `b05adc8f981004c67a1d2e3afc1c02cb94ebbdd1fdde7f957daf1fb9f369de02` | `dbcebde1b22b029fe3c1eeebb7193d0ff13435f0f6f510942816463a4eb59a44` |

Each independently imported a distinct `ROADMAP.md` checkpoint and stored owner index. Both checkpoints were `not-green` with empty dependencies and planning links. The two inventories consisted only of the linked Markdown and Roadmap owner file; no pending approval, Work or AgentTask file existed. The fixtures were created under a fresh temporary parent by supported `RoadmapStore.acceptImport`, not by editing owner JSON. The script retained complete before/after SHA-256 inventories, revisions, statuses, dependencies, links and pending-creation state **after each** hostile operation.

## Hostile requests and no mutation

All twelve hostile requests reached the verified RoadmapService RPC and received a service error. None timed out or returned an accepted result. The [per-request evidence](repair-cycle-1/evidence/live-rpc-result.json) contains the exact sanitized responses and A/B states after each attempt.

| Request | Observed denial |
| --- | --- |
| A handle with B owner, preview and apply using A's otherwise valid token | `Foreign or disposed planning handle` |
| B handle with A owner, preview and apply using A's token | `Foreign or disposed planning handle` |
| A owner with stale revision | `Stale or foreign planning owner revision` |
| A owner with B's linked-source fingerprint | `Stale or unsupported linked Roadmap section` |
| A owner requesting B's checkpoint and fingerprint | `Stale or unsupported linked Roadmap section` |
| A apply with valid preview token but no approval | `Planning preview or approval required` |
| A and B handles reused on a second valid app connection | `Foreign or disposed planning handle` for each |
| A handle after `detach`, preview and apply | `Foreign or disposed planning handle` for each |

For the four mismatched owner/handle operations, the denial is the `ProjectPlanningActions.binding` authority category, reached through the running app bridge before any write. The stale, foreign-source/checkpoint and no-approval categories are separate safeguards and are not mislabeled as owner-binding proof. The disconnected/unauthenticated 403 observation from R2 cycle 1 remains separate and is not used as a security pass here.

After every hostile request, both Markdown and owner SHA-256 values equaled the table above; both revisions stayed **1**, checkpoint statuses stayed `not-green`, dependencies/links stayed empty, and no new files appeared. The valid same-owner read/preview was equally nonmutating. Foreign preview returned no token; foreign apply with A's valid token was denied; both owners' `undoToken` calls returned no token; the disposed A handle could not use its former valid token. No pending write authority or approval was retained. The final states again matched both baselines exactly.

## Repair and validation

**Product defects discovered: none. Product source repair commits: none.** The R2 transport timeout was caused by the diagnostic client using the wrong protocol, so no product authorization rule or service registration was weakened. The live client is retained as qualification evidence and is the only new executable file.

- `npm run build:extension` passed. [Log](repair-cycle-1/evidence/extension-build.log).
- `corepack yarn workspace @dope/browser build` passed with browser and node builds at zero errors. [Log](repair-cycle-1/evidence/browser-build.log).
- Focused `ProjectPlanningActions`, Roadmap store, owner-links and document-patch tests passed **22/22**. [Log](repair-cycle-1/evidence/focused-tests.log).
- Focused Roadmap integration and qualification integration tests passed **2/2**. [Log](repair-cycle-1/evidence/integration-tests.log).
- The final rebuilt app served the valid read/preview and all twelve explicit denials. No complete `npm run check` or manual phase runner was used.

No product implementation or shared Chat/Roadmap/UI seam changed after R3's qualified source, so no R3 assertion was invalidated and no R3 matrix was repeated. R3 remains Green only for its recorded interface scope. [Evidence hashes](repair-cycle-1/evidence/manifest.sha256) bind this repair record's artifacts.

## R2 handoff

Group 1's live connectivity, foreign-owner denial, cross-project non-mutation, token safety and focused regression gates are **GREEN**. The remaining R2 acceptance work is **Repair Group 2**: a genuine current-source Q4 model-generated greenfield proposal, explicit approval, persistence/restart and fresh saved-Chat continuation. Do not infer that result from this authority run or from R2's earlier failed provider turn. Overall R2 remains **NOT GREEN** until Group 2 qualifies. Do not proceed to R4, R5, R6 or Phase 10 owner-close.
