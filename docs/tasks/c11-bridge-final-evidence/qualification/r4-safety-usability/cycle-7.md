# R4 final recovery cycle 1 — full-plugin browser runtime (2026-10-21)

**Disposition: PASS for the bounded full-plugin reload/restart replay; historical crash cause remains unresolved.** This is the first of the three newly authorized cycles. Browser actions were automation-operated. No Dope product, test, version, saved run or fixture source was changed.

## Source and runtime

- Checkout HEAD `76a53035be7a221ca34d7f60ea5717a517f94d7a`, version `0.11.8`; worktree was clean before this record. The prior R4 six-file repair and cycles 1–6 are committed in `76a53035`; the attachment's dirty SHA `12ba7bee...` is historical, not the present dirty basis.
- Node `v24.21.0`, npm `11.19.0`. Current compiled backend `apps/browser/lib/backend/main.js` SHA-256 `909d5df05c001430a3633cf315bb3ddc1f7836fc5b5f32a59c59c2611e16b214`; browser bundle SHA-256 `4510fa68dffca4f6e76f92f8b566f28b52ae7f009969c6528085392b6b8335ff`. No build was needed before replay because the compiled bundle matched the committed prior cycle-6 identities.
- Supported full-plugin launch was `node lib/backend/main.js --plugins=local-dir:../../plugins --port=3001 --hostname=127.0.0.1` from `apps/browser`. Port 3001 isolated this replay from an existing smaller backend on 3000. First PID `379478`, deliberate restart PID `382906`. Startup accepted **94 plugins** from the local full-plugin directory (91 top-level local plugin folders plus defaults). Both processes listened on 127.0.0.1:3001.
- Actual Codex in-app browser tab opened `http://127.0.0.1:3001/#/tmp/dope-r3-target-relink-20261020-zW68mI`. It selected completed Work run `659646a0-3664-4352-aefb-d52d7b9c4ef2`, opened its durable transcript, and displayed saved candidate accepted / four files applied / required validation passed. Three bounded page loads, including two explicit reloads after the transcript was open, restored the Work and transcript with the same run ID. The first backend was deliberately stopped; the second started with the same full-plugin arguments. One further browser reload restored the same Work and transcript. PID `382906` was still listening after that replay.

## Crash diagnosis and limits

Prior cycle 5/6 full-plugin SIGSEGV reports are real. Existing coredumps from full-plugin PIDs `359161` (Node 24.21) and `361110` (Node 24.12) were examined with GDB. The former faulted through `Napi::details::CallbackData...::Wrapper` in `apps/browser/lib/prebuilds/linux-x64/pty.node`; the latter through the same callback wrapper in `apps/browser/lib/backend/native/keytar.node`. Both had invalid low instruction pointers (`0x4060`, `0x5376`) and no Dope TypeScript frame. These are native addon boundary faults, not evidence of a Work/History/transcript exception. The precise lifetime or ABI cause is **not established**; the two different addon sites and the bounded successful current replay do not justify a speculative Dope lifecycle patch.

The restart log recorded a stale terminal attach warning and ordinary plugin activation warnings, with no backend exception or exit. Logs: `/tmp/dope-r4-final-full-plugin.log`, `/tmp/dope-r4-final-full-plugin-restart.log`; GDB traces: `/tmp/dope-r4-full-plugin-gdb.log`, `/tmp/dope-r4-full-plugin-gdb2.log`. Prior coredumps and reports remain untouched. This cycle establishes stability only for the observed full-plugin startup, reload and deliberate restart sequence. It does not establish long-term reliability, identify the native fault's root cause, or qualify the smaller backend as a substitute.

No source repair or targeted test was warranted by the current observed behavior. Cycle 2 will use the running full-plugin backend for genuine saved Markdown and hostile-content browser checks.

## Later same-campaign correction (2026-10-21)

After the bounded replay above, another supported 94-plugin process (PID `389530`) crashed with **SIGSEGV / exit 139** during the same R4 campaign. Its core (`/tmp/dope-r4-full-plugin-gdb3.log`, SHA-256 `0038e7905d132e6e86d6948e2b64fe27172042a2b62f4e910530b86a57ff2f4b`) faults at invalid address `0x4300` from a background `pty.node` exit-callback path. This later observation **supersedes cycle 1's bounded PASS as evidence of full-plugin reliability**. It does not establish the underlying native-addon lifetime or ABI cause. Cycle 9 records the resulting R4 NOT GREEN verdict; no speculative source patch was made.
