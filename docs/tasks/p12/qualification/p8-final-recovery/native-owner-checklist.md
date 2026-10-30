# Owner-operated native Pi checklist — verified 0.12.7 package (2026-10-30)

**NATIVE PENDING.** Codex operated only the browser. The packaged artifact is [Dope-0.12.7.AppImage](/home/jfin/dev/dope/dist/linux/Dope-0.12.7.AppImage), SHA-256 `312f23224818699f47c1643ef21475c40ebfb9cef4d81446abb0f897d3afe6f2`, executable and 220,189,104 bytes. Current product HEAD `99907526c65637c7cda3973d3a622f2416974b53` was clean before this pass's documentation edits. Its committed product diff from prior `a679c2b0` has the exact earlier dirty-product SHA-256 `84866ba2b7c54a28a531aff568bda62aff2f0564f9e4031fde73cee0db8d4726`, establishing source equivalence to the already-built artifact. Fresh extraction verified the Pi `1.4.0` worker, 121 locked dependencies and license/notice bytes. Actual installed operation remains unobserved. Browser results and open B3/B4/B6/B8 gaps are in [final-browser-gates.md](final-browser-gates.md).

## Prepare and identify the artifact

From `/home/jfin/dev/dope`:

```bash
sha256sum dist/linux/Dope-0.12.7.AppImage
npm run check:pi-runtime
node scripts/verify-pi-appimage.mjs
node scripts/local-install.mjs list
```

Record the actual hash, release ID, Dope `0.12.7`, bundled Pi `1.4.0`, local Qwen model ID and observed context. If a new package is produced, calculate and record its **new** hash and rerun extraction verification; do not reuse the hash above for new bytes.

## Install and operate

Use the supported local installer with the verified artifact and record its generated build ID:

```bash
node scripts/local-install.mjs install --artifact /home/jfin/dev/dope/dist/linux/Dope-0.12.7.AppImage --note "P12 Pi native qualification"
node scripts/local-install.mjs list
```

1. Launch the installed AppImage from a fresh supported profile without a global Pi installation or separate global Node/npm. Record startup/resource-path errors and whether the packaged Pi worker actually runs. Do not use the checkout browser server as native proof.
2. In AI Center, select the existing local LM Studio connection. Confirm the exact `qwen3-coder-30b-a3b-instruct@q4_k_m`, endpoint `http://127.0.0.1:1234/v1`, loaded context 32768 and actual coding-tool eligibility. Confirm unavailable local model fails without silent hosted fallback. Keep credentials redacted.
3. Complete, reopen and continue one saved no-tool Chat on the local model. Confirm model provenance, prior-turn continuity and no coding tools.
4. In a **fresh disposable Git fixture** with two source modules and a failing targeted test, review the minimum ExecutionGrant and authorize a short Work task. Observe Pi brokered reads/edits/test, final answer, independent Dope validation, and a review hold with no canonical writes.
5. Inspect the exact changed paths, fingerprint and revision. Accept one validated candidate, verify only approved files were promoted, then use a separate fresh candidate to Reject. Confirm no second application of the accepted candidate.
6. Open both decisions through History; restart the installed app and reopen the same Work runs. Confirm status, transcript, validation and decision persistence with no duplicate execution or source promotion.
7. Exercise a local-model interruption/unavailable state and fresh authorized recovery, plus cancellation and stale-source refusal on disposable projects. Record errors and ensure no unreviewed write.
8. Test the supported update and rollback flow with known release IDs, preserving saved Chat/Work and project state. After installing a distinct verified build, use `node scripts/local-install.mjs rollback BUILD_ID --note "P12 native rollback qualification"` for the earlier ID, then `node scripts/local-install.mjs list`. Record the actual old/new hashes and any failure.

Attach screenshots or a concise operation log for each item with source/build identity, actor, grant, run/candidate IDs, model/context and outcome. An observed installed-GUI failure is **NOT GREEN**; unperformed owner operation remains **NATIVE PENDING**. Native evidence alone does not close the B3 successful Planning/live G3 count, B4 expired-grant semantics and remaining live negatives, B6 live near-limit compaction or B8 post-cancel/crash/unload gaps in the [current B1–B9 matrix](b1-b9-matrix.md), or authorize `0.12.8`/Phase 12 closeout. The previously observed browser two-file Work may be reused as browser evidence; this checklist's installed-native Work must be operated independently by the owner.
