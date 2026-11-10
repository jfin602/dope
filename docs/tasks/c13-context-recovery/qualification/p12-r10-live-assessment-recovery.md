# P12-R10 — live GPT-OSS Assessment recovery

**2026-11-09 America/Chicago — entry BLOCKED.** The required owner-configured GPT-OSS instance is unloaded. The one permitted live Assessment has not been submitted. The owner was asked to load `openai/gpt-oss-20b` MXFP4 at 16,384 context and parallelism 1; R10 may resume at this same preflight only after owner confirmation. No model load or reconfiguration was performed here.

## Exact source and R9 lock

- Initial and current product HEAD: `9b74f7d66c29553c0aa2609517c1dbc60f5a5bc5` (`r9`), tree `bd5c883f66b9c80eff38cb9b563a0298cbfe8769`, `main...origin/main`, clean worktree at entry. SHA-256 of `git archive --format=tar HEAD` is `9ab704dbb0fd4652c83239ca165a66bc25fdba4b119842468d755e48c4e175c9`. R9's formerly uncommitted implementation and report are in this commit. Product version is `0.13.11`.
- Current source contains shared T1/T2/T3 validation, pre-persistence tier rejection, revision and lease bound legacy-invalid tier correction, immutable valid tiers, saved-state `finishReady`/`blockedBy`, eight consecutive non-progress limit, independent 128-event ceiling, guarded project/source/owner checks, and `continue:true` guidance. GPT-OSS request configuration remains `temperature: 1`, `top_p: 1`, with Pi reasoning support. This is source inspection, not live verification of provider parameters.
- Rebuilt `@dope/chat`, `@dope/theia-extension`, and `@dope/browser` successfully on this HEAD. The affected R9 matrix passed **128/128** locally against current compiled outputs. No full product suite was run.

| Current artifact | SHA-256 |
| --- | --- |
| `apps/browser/lib/frontend/bundle.js` | `9311e318988eddb660c2e9575ceaf368f939efe4b85947728146b268e2f03239` |
| `apps/browser/lib/backend/main.js` | `cafb1e9bd569d49c31e93d4f528c896010b1c1d4841498bbbc25a452b8093547` |
| `packages/theia-extension/lib/node/incremental-assessment.js` | `48e61b2deae938cb1fd86ba9393e23941a64f30a5e7af13c33648ec4d42b87a7` |
| `packages/theia-extension/lib/node/prompt-draft-store.js` | `9bed3996d78dd9545b9e66ca045703324866eb9284c40580534b7450a606b481` |
| `packages/theia-extension/lib/node/prompt-authoring-stage.js` | `b82111f719ec8d90d6eae8369c0697d78c6e3d09e8a8ad398fd883ad4d54ee27` |
| `packages/theia-extension/lib/node/chat-backend.js` | `7128c176db1f90c8d08a7093efb16e191cd197403c33186c67d97424223234c7` |
| `packages/pi-runtime/worker.mjs` | `4afe5deababef69c5a8d8c2d6ef8ea7e002a73bfb86eef7a23b51ea3ac5ce121` |
| `packages/theia-extension/src/node/prompt-authoring-stage.ts` | `6d0f442253fff52ad091eb432f3dd6016371e96d2e8612d799b0455173ef16e4` |
| `packages/theia-extension/src/node/incremental-assessment.ts` | `807fbfd932c99bf020a3aeac841d516a378aa5b69864ef853533e7ee3172b5dc` |
| `packages/theia-extension/src/node/prompt-draft-store.ts` | `f8cf31b4a89f9bd81ea04c64fadaecfae21791b00622e0a6bd616f0f4825944c` |
| `packages/theia-extension/src/node/chat-backend.ts` | `ec4e13481b5298e1e37819691dcc749b2506dfdf34227badea946c6afc853e22` |
| `packages/pi-runtime/worker.mjs` source | `4afe5deababef69c5a8d8c2d6ef8ea7e002a73bfb86eef7a23b51ea3ac5ce121` |

The browser backend PID `165212` listens on `127.0.0.1:3000` from `/home/jfin/dev/dope/apps/browser`. HTTP-served `/bundle.js` hashes to `9311e318988eddb660c2e9575ceaf368f939efe4b85947728146b268e2f03239`, exactly matching the rebuilt frontend. The browser tab has not been opened because model preflight is blocked.

## Model and fixture preflight

`lms ps` reports **no models loaded**. LM Studio's `/api/v1/models` lists the installed `openai/gpt-oss-20b` MXFP4 variant, with no loaded instances. Its unloaded metadata cannot prove a 16,384 context or parallelism 1 for an actual instance. Dope AI Center verification, Auto-to-Low binding and live requested sampling remain pending. LM Studio listens on `127.0.0.1:1234`; no second loaded model was reported. At preflight the host had about 19 GiB available RAM, zero swap and 6.8 GiB free disk. No instability was observed.

Fresh tracked-clean disposable fixture: `/tmp/dope-p12-r10-clamp-trW8SXvU`, fixture HEAD `8d099d3a06765cbf00e401203c5dfcf583f05291`. It has no `.dope/` state or `docs/tasks/clamp-api-correction/`. The guide is 6,584 bytes and has required late acceptance beyond byte 4,096. The five tracked bytes match R8:

| Fixture file | SHA-256 |
| --- | --- |
| `src/clamp.js` | `2866677a4450ab1204005da2ab0cf28e203a590b16a8755ec0f867c295ca0827` |
| `test/clamp.test.js` | `c5faeb988f856efacf18a711239ef9d29ba3b9382f032980b3090351dd7ea696` |
| `package.json` | `2a7e453fb2d7914158c7e72a2b66b27e162694200ed8caafa656c53ba6051c8a` |
| `docs/late-guide.md` | `fd4d4c8f3d132b2875ee9fff6fdc6aa0b08d65ff61d4cb4f422857e442763767` |
| `RELEASE_NOTES.md` | `a5b8f34b1383ec2bf8065b70e34f31a0bb6e8b373d6e2de00791a2e0dbf9d55d` |

## Live qualification ledger

| Required evidence | Current result |
| --- | --- |
| Actual loaded model/runtime/context and Dope AI Center | **BLOCKED: no loaded instance** |
| Connected browser Chat/user/assistant/execution/draft IDs | Not created |
| Actual outgoing sampling and provider completion | Not observed |
| Five brokered reads and 0–4096 / 4096–6584 guide continuation | Not run |
| Accepted/rejected findings, scope, risks, dependencies, T1/T2/T3 | Not run |
| Consecutive recovery behavior, `finishReady`, `blockedBy`, `nextAction` | Not run live; R9 deterministic evidence only |
| `assessment_finish` and sealed AssessmentRecord count | Not run; zero R10 records |
| Checked `/prompt-plan` entry and reload | Not run |
| LM Studio log interval, parser/context evidence | No R10 provider interval |
| Canonical publication, Plan, Prompt Stack, Work, Roadmap or version changes | None made by R10 preflight |

**Current verdict: R10 entry BLOCKED; live qualification not attempted.** Historical P12, R3, R6 and R8 remain NOT GREEN; R9 retains its scoped headless PASS. The single R10 Assessment attempt is unused. Do not infer live success or provider stability from the current source and deterministic tests.
