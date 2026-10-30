# P6 context and recovery qualification — 2026-10-29

Pre-task HEAD: `8fc2e8f886bf5012a6ee493357f7c2dbf2dea3ca` (`0.12.5`). The P1–P5 implementation commits are present through this HEAD; P4 and P5 qualification records remain scoped automated evidence. P6 implementation and the assigned `0.12.6` manifests are uncommitted for the phase runner. No Git commit or HEAD mutation was made here.

The pinned Pi Coding Agent 1.4.0 API was checked against the installed SDK: `session_before_compact` can return a custom `CompactionResult`; `CompactionPreparation` exposes the exact messages and prior summary, a cut point and projected tokens; Pi supports configured reserve and recent-token thresholds. Dope now uses that hook in an isolated in-memory Pi session. It deduplicates **identical** old entries, verifies exact reconstruction, keeps the prior summary and exact message contents, and records SHA-256 of the original and compacted projections. It refuses compaction if the result exceeds 12,000 bytes, fails to shrink materially, or would retry an interrupted turn. Pi cannot replay a Work tool after an overflow. The canonical Dope Chat and Work transcript, grant, candidate, validation, and review remain outside Pi.

Work receives an exact task/source HEAD/candidate fingerprint reference. Dope records initial and final candidate SHA-256, a delta SHA-256, provider-reported usage when supplied, and compaction identities when triggered. Chat persists the canonical request-context SHA-256 and Pi original/compacted SHA-256 in the saved assistant execution only when compaction occurred. The worker accepts one turn per open session and one reply per tool call. The host bounds input and streamed deltas, discards late tool replies after disposal, and reports a safe context error when exact compaction cannot proceed. Tool output returned to Pi is capped at 1,024 characters; Dope's command transcript remains separately authoritative.

## Focused evidence

| Scenario | Result | Measured scope |
| --- | --- | --- |
| Short no-tool Chat | PASS, synthetic loopback Local response | 1 model call, 0 tools; 13 ms test case; provider token usage unavailable |
| Near-limit Chat compaction | PASS, synthetic loopback Local response | 4,096 configured fixture window, 21,003 input bytes, Pi preparation reported 4,936 projected tokens before compaction; 1 model call, 0 tools; 56 ms measured turn (58 ms test case); provider token usage unavailable. The next model request retained the exact approved constraint and source marker. This is not real-model requirement recall. |
| Work tools and candidate | PASS, synthetic loopback Local response | 5 model calls, 4 brokered tools (read, edit, failed test, passing test); candidate-only mutation, exact source/delta fingerprints and command statuses; roughly 4.1 s fixture case including disposable clone/setup. Provider token usage unavailable. |
| Safe refusal | PASS | Repeated identical entries compact; a unique small entry and overflow retry are refused. Current-user/system Chat context over budget is rejected before inference. |
| Cancellation, host failure, resume | PASS in focused fixtures | Cancel during a tool, late callback ignored; worker start failure is explicit; a fresh Chat turn rebinds once without replay; stopped Local refresh refuses and later fresh refresh rebinds. |
| Stale candidate, project/run revocation, History | PASS in existing adjacent fixtures | Changed authoritative basis and revoked callback are rejected; new store/runtime instances reopen saved Work/History identity and review state. This is not a live GUI project switch. |

`npm run build:extension`, the eight focused Pi/Chat test files, the Pi dependency integrity check, and `git diff --check` passed. The focused files include 7 Pi worker, 6 model bridge, 6 conversation, 2 Work execution, 1 Work/History, and adjacent Chat parser/repository/backend coverage. The suite uses deterministic adapter and loopback fixtures; timings are test-case wall time, not model latency.

## Evidence gap

LM Studio at `127.0.0.1:1234` refused the connection, so no loaded local Qwen at 32,768 was verified. **Real-model token counts, short/near-limit timing, post-compaction requirement recall, and real-model compaction are NOT TESTED.** The Q4/32,768 profile remains a scoped reference, not a default. A direct supervised-host start in this sandbox reported `Bundled Pi worker exited`; direct pinned-worker SDK fixtures passed. Native app restart, live LM Studio stop/restart, live project switch, and P8/B1–B9 remain unqualified. No Phase 12 or Pi Green is claimed.
