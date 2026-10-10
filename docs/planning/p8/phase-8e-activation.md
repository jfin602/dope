# Phase 8E — Owner Activation

Status: **OWNER-ACTIVATED 2026-10-10 / P1 READY — NOT IMPLEMENTED OR QUALIFIED**

The owner explicitly authorized implementing the existing `docs/tasks/p8e/` P1–P14 stack via `/docs-apply including activating 8e` on October 10, 2026. The earlier P1 attempt stopped at missing activation preflight; zero files changed and no implementation checkpoint exists.

## Entry and version law

- Phase 8D was GREEN at qualified `0.8.33` source `8748cb4870e8cac3d2a5aca4a05623b5f3d747ec` through `docs/tasks/c8-fix/closeout.md`; original P13 Not Green remains historical.
- GitHub main immediately before this activation was `f03adb6339a6f758a4a418e9e450891b9663dc33`, with P1–P14 authored and all actual manifests at `0.8.33`. Inspect the local checkout and preserve existing dirty work.
- P1 advances **all 13 root/app/package manifests** and pinned internal `@dope/*` dependencies from `0.8.33` to `0.8.34` DURING P1 implementation before runner checkpoint. Runner checks but does not bump versions.
- P2–P13 each advance all 13 manifests/internal dependencies one assigned patch from `0.8.35` through `0.8.46`, respecting prior Git-proven checkpoints and safe dirty-tree continuation.
- Manual T3 P14 transitions coherent `0.8.46` to `0.8.47` BEFORE real GUI and final exact-candidate aggregate; checkpoint the source/version separately from final evidence-only Green closeout.
- Activation edits documentation only: never pre-bump to `0.8.34`, generate a root `package-lock.json`, rewrite unrelated locks or reset user work.

## Authority and execution

ADR 0032 and ADR 0028/0029/0031 stay binding. P2 must prove an OS-enforced sandbox before model-issued file/process tools run. No unsafe fallback, permission expansion, hidden hosted egress or premature Local `agentExecution` claim. P14 must truthfully qualify Green/Not Green; 8E activation does not close Product Phase 8 or activate Phase 9.

After syncing this activation and updated P1–P14 prompts to the local checkout, verify `npm run codex:phase:validate -- p8e`, inspect `git status` and current `0.8.33` manifests, then run `npm run codex:phase -- p8e`. Previous P1 changed zero files; restart P1 without fabricating a checkpoint.
