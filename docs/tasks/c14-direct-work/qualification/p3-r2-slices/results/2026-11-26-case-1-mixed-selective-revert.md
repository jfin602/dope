# P3-R2 case 1 — mixed selective Revert

**Date:** 2026-11-26, America/Chicago. **Selected case:** 1, mixed selective Revert. **Case verdict:** PASS on the repaired, rebuilt browser source for the stated two-file ownership and receipt assertions. **P3-R2/P3 remain NOT GREEN.** This session did not attempt case 2, run the phase runner, commit product source, change version `0.13.11`, or award Roadmap progress. Native Electron was not observed.

## Source, runtime, and fixture

- Product HEAD `328043fe18274514f68cd49bdf3a10dfec3b3241`, version `0.13.11`, with preserved owner dirty work. Pre-repair `git diff --binary` SHA-256 `34ef9ac56e06dd0b211d258c54ae1881f5ea198674cec26057e916a3b0ffe107`; browser frontend `b7fd4e75185b87749c875f5174481f5707dfd4c9ea955536a91e7ce3b3b66180`; backend `36bb3f10136a2b6f7d15a4893ee5493ce62dc8fac378e2824767cf5d3b59e63c`.
- After the narrow UI repair, tracked diff SHA-256 `b98cf7641ab9b797c054fb2acd28a655bbbe2230e0744e7acb697affbdd4b5a8`; rebuilt browser frontend `82e2754895e88b1c012391cfe7bbf1d40d0a121c1f80b9131a6a7837b61379f3`; unchanged backend `36bb3f10136a2b6f7d15a4893ee5493ce62dc8fac378e2824767cf5d3b59e63c`. The browser server was restarted after the rebuild. `git diff --check` passed. Focused Work selection, Direct journal, and History tests passed **44/44**; browser/node builds completed with zero errors. No full `npm run check` is claimed for this new source epoch.
- Fresh disposable fixture `/tmp/dope-p3-r2-mixed-7H9SZ7` and replay clone `/tmp/dope-p3-r2-mixed-replay-7H9SZ7` shared clean fixture HEAD `3cd72f80b047ae9e1f0812870c70cc828d6c992b`. Initial `src/main.ts` SHA-256 `b23ea54a6afd3b5c745b63858721b1375c781dc30f6222c73bc597c7b9ec3d21`; `src/theme.ts` `01a375f281aa06a949ffcef881e564c518ab82b03ae1879138961294ad6ec2d7`. The fixture's `node --test test/fixture.test.mjs` passed before Work. `.dope/` was ignored by the disposable fixture only.
- Connected Dope browser `http://127.0.0.1:3000/` with real local Pi 1.4.0 and LM Studio `openai/gpt-oss-20b`, loaded context 16,384, parallelism 1. AI Center refreshed the loaded model and verified `agentExecution: yes (adapter-known)` before each source epoch's Work. Each Start reviewed Direct mode, the disposable project, exact task/model, `read_file`, `list_files`, `edit_file` only, and Dope-owned required validation `node --test test/fixture.test.mjs`; no command tool was selected. The Coding Agent role remains temporarily on this local model for the next P3-R2 session.

## Initial live attempt and demonstrated defect

Run `fd102e03-1a4a-42e9-8da9-a995a54d6247`, journal `c28c6ad0-8ede-4105-86a5-e6581eae8034`, session of the same run: saved transcript sequences 31, 37, 45 show completed brokered `edit_file` effects at 19:02:49, 19:02:51, 19:02:56 UTC. The first call edited `src/main.ts`; the next call malformed `src/theme.ts`; the third corrected it. Final agent after-hashes were `c5ff3a2560d3aa1c631834ac97440802c28415ddfe4e08ada8193a9340e71f9b` and `be9c9ebd59d2ad5dbe749e98dddb73c40e5aa9bd1cc6737196bb944ad5dd9d30`. Finish passed Dope validation, and Review initially marked both paths applied with their exact original and after hashes.

An independent Python owner process then changed **only** `src/main.ts` to hash `a75ebbf10fd22d6b4a1ff8e741729b4943e574e2b0b07bd579fb05a5d01365d0`; `src/theme.ts` stayed at its agent after-hash. Refresh showed main conflict and validation no longer applicable. The old aggregate button sent only the safe theme path. It restored theme to its exact original hash and preserved the owner main bytes, but the journal recorded only one revert and History said **2 applied · 1 reverted · 0 revert conflicts**. That omitted the visible conflict from the saved receipt.

The narrow repair in `chat-panel-widget.ts` now sends all unreverted paths, including conflicted ones, when at least one path can safely revert; `directBatchRevertPaths` in `work-selection-controller.ts` supplies the reviewed path list. The backend already records each requested path's safe `reverted` or `conflict` result. A focused regression checks the mixed path selection and the all-conflict no-action case. No broker or restoration guard was relaxed.

## Rebuilt-source replay

The first replay run `ef1c8dc1-d320-4cc6-ad87-da005c9839a5` failed after one completed `src/main.ts` edit and a later read. It did not satisfy the two-file case. Review retained the applied effect; explicit source-checked Revert restored main to its original hash and clean Git. Its failed status, one applied/one reverted, and validation `not-started` remain in the saved raw records.

The clean same-case replay run `8b39be1d-9193-4790-b467-2b50ee10588d`, task `3cafe001-005c-4b3f-b0af-a623fc38b7ff`, journal `474c6e3b-cbed-4171-b214-3ab7f2470a09`, completed separate brokered `edit_file` calls at transcript sequences **17** (main, 19:09:21 UTC), **31** (theme, 19:09:30 UTC), and **42** (theme correction, 19:10:11 UTC). The malformed intermediate theme edit and explicit in-run correction message are preserved. At Finish, Review showed two applied files, before/after hashes as above, and **required validation applies to current source**; the run's Dope-owned validation status was `passed`, snapshot fingerprint `b635a34c3ffce9439ba092d02a49cb685869e1e03491322822ebd7b43381d3c8`.

After Finish, a separate Python owner process changed only `src/main.ts` to `a75ebbf10fd22d6b4a1ff8e741729b4943e574e2b0b07bd579fb05a5d01365d0`. Refresh showed `src/main.ts · conflict`, `src/theme.ts · applied`, and validation **no longer applicable**. One aggregate **Revert Agent Changes** action on the rebuilt UI produced:

| Path | Review and journal result | Final SHA-256 |
| --- | --- | --- |
| `src/main.ts` | `conflict`; owner after-agent bytes preserved | `a75ebbf10fd22d6b4a1ff8e741729b4943e574e2b0b07bd579fb05a5d01365d0` |
| `src/theme.ts` | `reverted`; exact original bytes restored | `01a375f281aa06a949ffcef881e564c518ab82b03ae1879138961294ad6ec2d7` |

Final fixture Git status had only `M src/main.ts`. The saved run and journal each contain one `conflict` receipt with the changed identity/hash reason and one `reverted` receipt. Refreshed connected History showed **Direct Work: completed · 2 applied · 1 reverted · 1 revert conflicts · validation passed**. History's `validation passed` is the historical Dope result; Review correctly says that result no longer applies to the changed current source. No Work run remained active.

## Saved evidence and limits

Raw run, journal and originating transcript records are under [`evidence/p3-r2-slices/2026-11-26-mixed-revert`](../../evidence/p3-r2-slices/2026-11-26-mixed-revert/). SHA-256: initial attempt journal `4b0bcc3e0e6d809a73b18fed7373f671e7a851f3b8f41c8f455d53c118617c5e`, run `eb77c4dc73a2228301f4eca562a951bc633549d4f21e7e9314b40eb19dbc7592`, transcript `84d2ea878c8d46763f967e619eb7341fc0c61d63efdbd8abc9f7105fd3dbac8b`; failed replay journal `5ddbc1a9fe20dc439ab53d18c92e04291c0d7e905ec90733cc1e134cfa824bc3`, run `96fb4aa1ec02f03dd2cb0d3b6b6c985265d2c460d0e3c5becef8e78ce51371b8`, transcript `4bd311a47bab8eb2124d29c1ab29bc13aad4b34e0d5cdb9cebf70dd7c56c3210`; passing replay journal `d326199ef33910839d40cfaf72f40ab9e33611494d503a7b18c9e388905b35e2`, run `25b9463642f621979edfdd8601e6084a82cc3dd3744ba942256b460f8de43eb4`, transcript `cb52eccda8b987f23a7d5f89dfca0a3c4d55727c978fea43fe0cdd913d6e3db4`. Derived read-only History status snapshot `b7dfadfb84206d34bff06e5d4c27067478c3af25ee8f9b0a650c6af3b1401f0b`.

The connected browser displayed Review and History statuses during this session; its screenshot API exposed image bytes but no local screenshot file export path. No PNG or screenshot SHA is claimed. The saved transcript, journal, run and History status files support the case's file attribution and count assertions. The previous P3-R2 files remain unchanged.

**Next unfinished case:** 2, stale same-path review with a screenshot that visibly contains the changed-source/fresh-review message. Do not infer case 2 PASS from this session.
