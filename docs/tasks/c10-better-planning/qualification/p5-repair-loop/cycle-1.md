# c10-better-planning P5 repair cycle 1 — 2026-10-14

## Candidate and scope

- Repository HEAD: `9b1533ca47e87b219bf3443b7f580206b822c41b`; package version `0.10.16`.
- HEAD began clean. This cycle produced uncommitted changes in `packages/theia-extension/src/browser/chat-panel-widget.ts` and `packages/theia-extension/src/browser/dope.css`. The final product diff identity, including the later cycle 2 trace, is recorded in `summary.md`.
- Disposable project: `/tmp/dope-c10-p5-07RhiZ`; saved Chat `7b8c56d7-1929-4758-8df8-6b6f4c1ebd4a`. Historical P5 NOT GREEN at `320f9bd` was retained.

## Reproduction and repair

The confirmed product defect was the failed local planning response's ordinary prose: it was rendered in a `pre` with `white-space: pre`. At a narrow right dock its 193 px box had 1,374 px scroll width, clipping the response. The existing transcript and composer fit. I gave this one raw output block a class and used semantic Theia colors, inherited font, `pre-wrap`, and `overflow-wrap: anywhere`. A second narrow inspection showed the Chat title cramped, so the existing header was allowed to wrap with an 8ch minimum title width. No planning/domain behavior or provider routing changed in this cycle.

At a 215 px dock the repaired prose box measured 181 px client and scroll width; transcript 205/205; composer 189/189. The failed prose, long tokens, collapsed structured JSON, header, composer and scroll remained usable. Dark and light browser captures: [narrow prose](evidence/browser-narrow-prose.png), [light theme](evidence/browser-narrow-light.png). The saved Chat restored after browser restart. Wide layout was observed before narrowing. Other Chat placements were not exercised.

## Independent observations

- **Provider accounting:** A real explicit local `qwen3-coder-30b-a3b-instruct@q3_k_l` no-action turn through LM Studio used exactly one `POST /v1/chat/completions` at 09:18:33 local. LM Studio reported 2,057.62 ms prompt evaluation / 467 tokens, 1,602.09 ms generation / 23 tokens, 3,659.71 ms total / 490 tokens. No second commentary request appeared. The connection was local `http://127.0.0.1:1234/v1`; no hosted fallback was observed.
- **Progress:** browser Send at 14:18:32.945Z; `Working` and `Waiting for local model…` observed by 14:18:34.019Z (1.074 s); validated no-action visible by 14:18:37.753Z (4.808 s). The brief `Validating` state was not independently captured here; cycle 2 adds backend timestamps.
- **Clipboard:** X11 CLIPBOARD readback, independently compared byte for byte with saved raw assistant content, passed for roadmap-intent (118 bytes, SHA-256 `5ae32147a796b46ba203d4f36410156a9f42ef239e842b9c535a85083ecb11cf`), ordinary no-action (147 bytes, `0d1291db798bcc1a2ec48cf0ec022be20ab6332f408652b9586d33b253f05331`), and quotes/backslash/newline no-action via keyboard Copy (73 bytes, `89a517028795c7b0e3f153be6da4e10f4b37333a3ba7f9a0c1ad0cb453a84b96`). UTF-8 was valid; no extra Markdown or model request appeared. The in-app browser's virtual clipboard reader returned empty, so OS clipboard was the independent source.
- **Native:** The standard Electron workspace start reached `plugin-ext` error `TypeError: i.split is not a function` and left a spinner. Investigation found a functional alternate launch from `apps/electron` using `theia start <disposable-project>` without the `--plugins` argument. `wmctrl` independently identified window `0x05e00004`, WM_CLASS `dope`; X11 input and `xwd` capture controlled it. The saved Chat reopened after releasing its browser lease. It showed collapsed/expanded activity and wrapped prose in a narrowed dock. Native Copy readback matched the 73-byte saved no-action payload. Final rebuild and replay follow in cycle 2.

## Checks actually run

- `npm run build:browser` — PASS.
- `corepack yarn workspace @dope/browser build` — PASS.
- `npm run build:electron` — PASS before the cycle 2 backend-only trace change.
- `node --test test/unit/chat-presentation.test.ts test/unit/chat-panel.test.ts test/unit/roadmap-chat-panel.test.ts` — 31/31 PASS.
- `git diff --check` — PASS.
- `npm run check` — NOT RUN, per P5 tier.

| P5 gate | Cycle 1 result | Limit |
| --- | --- | --- |
| A narrow Chat | PASS on right dock | Other placements not run; native final rebuild pending. |
| B provider count | PASS | One local no-action turn directly counted. |
| C progress | PARTIAL | First UI timing captured; backend transition trace and approval pending. |
| D clipboard | PASS | Three required raw forms, including keyboard Copy, matched saved bytes. |
| E native Electron | PARTIAL | Real window controlled; final source replay pending. |

Earlier P5 approval, rejection, stale, cancellation, saved Chat, and strict JSON evidence remains relevant because this cycle changed presentation only. No source commit was made.
