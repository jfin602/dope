# Pi provider recovery — cycle 1 (2026-10-30)

**Disposition: NOT GREEN.** Chat reached the bundled Pi worker and the selected local Qwen after the path repair, but the observed Chrome turn was interrupted before a completed answer. Work continuation was not retested in this cycle. The original P8 report remains unchanged.

## Source and diagnosis

- Source HEAD: `3073099d245d492a0ca34f5abd46a3298d2c442a`, dirty with this recovery's source, test, and evidence files. Effective Dope version: `0.12.7` unchanged. Bundled Pi: `@earendil-works/pi-coding-agent` `1.4.0`.
- Model: AI Center's enabled local LM Studio connection `21d03643-2aca-407e-b090-af59979b6c2f`, endpoint `http://127.0.0.1:1234/v1`, model `qwen3-coder-30b-a3b-instruct@q4_k_m`, loaded context `32768` as reported by `lms ps` and the prior P8 AI Center probe.
- Direct LM Studio `/v1/chat/completions` returned `ready` for a one-word request. A standalone Pi worker `open` plus no-tool `turn` returned `ready` from the same model. These controls did not qualify the Dope GUI.
- The live browser backend bundle used `apps/browser/lib/backend/main.js` as `__dirname`, but `resolvePiWorkerPath` only searched relative to the unbundled extension layout. A Chrome turn failed immediately with `Bundled Pi runtime unavailable`. This confirmed a current browser-backend path defect; the P8 Work failure may have another cause.
- Repaired `packages/theia-extension/src/node/pi-runtime-host.ts` with a second fixed development layout for the Theia browser/Electron backend bundle. Added layout coverage to `test/unit/pi-runtime.test.mjs`. The first attempted browser rebuild used stale compiled extension output and produced `Bundled Pi worker unavailable`; this was caught before qualification. The extension was then compiled before rebuilding the browser bundle.
- Verified the updated worker path literal in `apps/browser/lib/backend/main.js`, SHA-256 `31df4400001ce62c8c05bc4496f6ba159150b832963e97e364f9064c300f1de3`, and restarted the browser backend.

## Validation and real Chrome observation

- `npm run typecheck`: PASS.
- `npm run test:pi-runtime`: 8/8 PASS after the extension compile.
- `corepack yarn workspace @dope/theia-extension build`: PASS.
- `corepack yarn workspace @dope/browser build`: PASS.
- Connected Codex Chrome tab at `http://127.0.0.1:3000/#/tmp/dope-p8-ts-1bUVkx` showed the disposable fixture. AI Center was refreshed and showed `LM Studio ready · 1 usable model`. The saved Chat selected the exact Qwen model and sent `Reply with exactly one word: ready`.
- Chrome showed `Assistant working`, and the backend spawned `/home/jfin/dev/dope/packages/pi-runtime/worker.mjs`. `lms ps` changed from `PROCESSINGPROMPT` to `IDLE`. The Chrome control channel then detached while reading the final result. A fresh Codex Chrome tab showed the saved assistant turn as `failed · Interrupted before completion`; the durable Chat record has the same status. No successful answer was visible.
- No screenshot was exported to the repository. The browser accessibility observations and durable Chat execution `dd7d717c-5cbb-45ca-9210-f89844c9e5a9` are the evidence. No console/network no-egress claim was made.

## Cycle 1 classification

| Area | Result |
| --- | --- |
| Chat | NOT GREEN — worker startup fixed, but no completed visible answer. |
| Work provider continuation | BLOCKED — not launched after the interrupted Chat turn. |
| Root cause | PARTIALLY IDENTIFIED — browser worker path confirmed; Chat interruption and P8 post-tool Work failure remain unresolved. |

The next cycle must use a fresh connected Chrome tab to test a completed first and follow-up turn. The fixed worker path alone is not Chat qualification.
