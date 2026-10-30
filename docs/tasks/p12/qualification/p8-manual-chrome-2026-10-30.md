# P8 manual Chrome qualification — 2026-10-30

**Disposition: NOT GREEN.** This is a real Google Chrome / local Qwen observation, not a Phase 12 or Pi stack closeout. Owner-operated native AppImage qualification is pending. No P8 product repair, version bump, historical prompt edit, deployment, or commit was made.

## Source and preflight

- Dope HEAD: `e39981ad66052f62ba2e92bf49207156626dc05d`, clean before and after this manual run. Actual manifest version `0.12.7`; P8's assigned `0.12.8` was not applied after the failed gate. `main` was seven commits ahead of `origin/main` at preflight.
- The Phase 11 owner close is explicitly narrow; its broader Bridge/Work/Hunts/G3 failures remain historical. The coherent version-only `0.12.0` baseline is `e02a46447a460ee43f20ac65078238427468a81c`.
- P1–P3 implementation is present in commits `d24b8c34`, `8bd5e82e`, and `8a0e2348`; the P4–P7 qualification records remain limited as written. P7 reports no produced or launched AppImage.
- Installed `@earendil-works/pi-coding-agent` version `1.4.0`; `packages/pi-runtime/package-lock.json` SHA-256 `08fdea274c46717d78883dc9d1aec559d7eefac759658fe0baded70175833a70`. `npm run check:pi-runtime` passed: 121 integrity-locked packages and reviewed licenses.
- The browser service was launched from this checkout with `corepack yarn workspace @dope/browser start` and listened at `http://127.0.0.1:3000`. Real connected Chrome displayed the app. Served `bundle.js` SHA-256 `6df2d2c4fc57b7c2d859f1cfc40a1a40d0d68d53ccda4414ca7a777576242a1f` matched `apps/browser/lib/frontend/bundle.js`. This checks served bytes, not a fresh rebuild or package provenance.
- LM Studio was initially off. In Chrome, AI Center displayed `LM Studio degraded · No usable models`, `Health: degraded`, endpoint `http://127.0.0.1:1234/v1`, and `Connection check failed`. The existing local service was started, and the installed `qwen3-coder-30b-a3b-instruct@q4_k_m` was loaded CPU-only at context `32768`, parallel `4`. `lms ps` and AI Center then showed it ready; AI Center's synthetic tool probe reported `Local tool capability: supported` and `agentExecution: yes (adapter-known) · context 32768 (loaded)`. This is eligibility evidence, not a successful Work run. The separate Codex connection remained visible and was not selected for this run.

## Operated Chrome evidence

The selected Chrome URL was `http://127.0.0.1:3000/#/tmp/dope-p8-ts-1bUVkx`. The persistent tower-defense project was observed only as the initial restored tab; no disposable test or write was run there. A separate Git TypeScript checkout fixture was created at `/tmp/dope-p8-ts-1bUVkx`, final fixture baseline `e1887f754e5e690562a1bda9b33a77f40140b457`, version `0.0.1`. It contains `src/pricing.ts`, `src/shipping.ts`, `src/checkout.ts`, and `test/checkout.test.js`. The three baseline tests failed, deliberately. Codex authored the failing fixture and tests but did not repair its source.

The fixture initially lacked Dope's required `docs/tasks/` folder and package version. Work displayed `Phase Stack could not attach to this project`; source-bound read-only diagnosis found `captureSequenceEvidence` rejected the missing version. After those fixture prerequisites were committed and Retry was used, Work attached and showed `No Prompt Stacks found in docs/tasks/` and `No saved Work yet`. This initial fixture setup failure is not treated as a product failure.

An existing saved ChatPanel was created in the disposable project. Two ordinary no-tool turns failed:

1. `Follow Interactive` produced the Chrome accessibility text `Error: No eligible role execution completed` and saved an assistant turn marked `failed · Conversation failed` with Qwen model identity.
2. Explicit `LM Studio · qwen3-coder-30b-a3b-instruct@q4_k_m` selection produced another saved `failed · Conversation failed` turn, with provenance `.../qwen3-coder-30b-a3b-instruct@q4_k_m → local/qwen3-coder-30b-a3b-instruct@q4_k_m`.

The UI did not expose a deeper Chat runtime error. Neither turn supplied a completed answer, so no one-inference G3 claim or successful no-tool Chat/Planning claim is made.
On later navigation to AI Center, the saved ChatPanel displayed `Chat ownership lease was lost; select the Chat again.` The chat still appeared in the saved Chat list; a successful continuation was not demonstrated.

For Work, Chrome displayed `Coding Agent target: LM Studio · qwen3-coder-30b-a3b-instruct@q4_k_m (local, observed context 32768 tokens)`. The explicit reviewed grant allowed workspace read/write/process/test/build, project create/modify and Git inspect; it denied Git write/history, network, secrets, private state, outside root, destructive, system, package admin, project delete and rename. The required validation was `node --test test/checkout.test.js`. Work run `4a195fe7-f77d-4f71-b65d-15bfa2dade48` began at `2026-10-30T11:27:31.430Z` with local Qwen provenance. Its durable event sequence was run start, provider status, project command start, project command complete, and failed status at `11:28:27.143Z`. The real brokered `validation-1` command failed in 268 ms; all three tests failed. The UI then said `Agent run failed`, `Required validation: unavailable · 0 changed files`, `Provider or candidate did not reach validation`, and `provider-error · Agent execution failed`. There was one command event, no read/edit event, no candidate diff, and no review hold. The fixture's tracked source remained unchanged; only `.dope/` is untracked durable Chat/Work state. The run was not retried or repaired by Codex.

Chrome screenshots were captured during AI Center, the failed Chat, and failed Work views in this task. The accessibility text above is the exact relevant browser observation; screenshot files were not exported into the repository, so no durable image hash is claimed. No network monitor was attached, and no project-data no-egress claim is made.

## B1–B9 disposition

| Gate | Status | P8 evidence and limit |
| --- | --- | --- |
| B1 Bundled distribution | EVIDENCE GAP | Pinned Pi and integrity check passed in checkout; P7 did not produce or launch an installed AppImage. No fresh-profile or no-global-dependency GUI proof. |
| B2 Model auto-wiring | EVIDENCE GAP | Cold/offline failure and recovery, exact local model, endpoint and loaded 32768 context observed. Disabled/unknown model and credential policy were not qualified end to end. |
| B3 Default routing | NOT GREEN | Both `Follow Interactive` and explicit local Qwen ordinary Chat turns failed; Planning and one-inference G3 behavior were not demonstrated. Codex was visible but unused. |
| B4 Tool authority | EVIDENCE GAP | Grant scope was reviewed in Chrome and one brokered test command executed. Path, symlink, credential, foreign root, network and no-grant negatives were not live-operated. |
| B5 Product continuity | EVIDENCE GAP | Failed Chat and Work records persisted; no candidate accept/reject, successful continuation, History and restart sequence was possible. |
| B6 Context | EVIDENCE GAP | Actual loaded Qwen context was 32768; repeated-turn and compaction behavior were not exercised successfully. |
| B7 Fresh AppImage | NOT GREEN | P7 recorded no produced or launched AppImage. Owner native evidence is still absent. |
| B8 Recovery | EVIDENCE GAP | AI Center recovered from offline to ready. Cancellation, crash, server interruption during a run, double-submit, source drift and restart were not qualified. |
| B9 Real work and GUI | NOT GREEN | Real Chrome and local Qwen/Pi ran, but the agent made zero source changes, did not repair the multi-file bug, and produced no review candidate. Native GUI remains pending. |

## Owner native handoff and next qualification boundary

The owner must independently install and operate the packaged AppImage on equivalent source, then provide exact AppImage hash, Dope/Pi versions, model ID and loaded context, plus observed AI Center, saved Chat, Work tool events, candidate review, History, restart and failure recovery. P7's build record cannot substitute for this. A new source-bound Chrome P8 run must first resolve or independently dispose of the observed Chat and Work failures and then exercise candidate reject/accept and the required negative paths. Only after passing B1–B9 and explicit owner signoff can the first Pi stack receive scoped Green. Phase 12 remains open pending the separate tower-defense real-use repair track.
