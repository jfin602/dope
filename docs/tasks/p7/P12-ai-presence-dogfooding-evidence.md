# P12 — AI Presence dogfooding and qualification evidence

Status: **Not Green** at the manual `0.7.12` checkpoint. This is a completed evidence record, not a Phase 7 qualification claim.

## Candidate and setup

- Predecessor: clean `0.7.11` commit `8c77dde675f43f64e2c7001c2757d4c89097eb29`; Phase 7 activation `59c7f72` is reachable. P1–P11 are the consecutive `0.7.1`–`0.7.11` commits `8900111`, `ce60c08`, `337142d`, `1901030`, `1ea0477`, `cf9b7ec`, `fd7888e`, `9c3f758`, `b24c2cf`, `b1114e0`, `8c77dde`. Their earlier prompt results are implementation evidence, not substituted for this direct pass.
- Candidate: source/manifests advanced to `0.7.12`, with P12 GUI-discovered corrections and this evidence in the manual `0.7.12` checkpoint. Runtime checks were run after the final production repair. The later restart-test edits only update assertions for the retained compact Software Map UI.
- Disposable workspaces: `/tmp/dope-p7-qualification-9qzsPm/dope-p7` (Dope source) and `/tmp/dope-p7-qualification-9qzsPm/second-project` (Adaptive SEO source). Dogfooding did not write the two originals. Original Dope Git was clean at preflight; the Adaptive SEO original already had untracked `.dope/` and `MODULES.md`.
- The Dope copy began with `.dope/architecture.json`, `.dope/project-mind.json`, `.dope/smap.json`; GUI work added `.dope/chats/` and `.dope/planning-maps.json`. The second copy began with `.dope/architecture.json` and `.dope/smap.json`; its GUI added only its own `.dope/chats/`. The copies omit `node_modules`, generated builds and some fixture build outputs; a missing analyzer fixture was restored before the input-fingerprint comparison. The resulting Dope GUI analysis was **partial** with unresolved-module diagnostics. It published a 10,410-node Architecture view, but this is not a fresh qualification of Phase 4–6 map quality.
- Provider state was isolated under `/tmp/dope-p7-qualification-9qzsPm/config` and `/tmp/dope-p7-qualification-9qzsPm/theia-config`. No secret-shaped JSON field (`apiKey`, `accessToken`, `secret`, `credential`) was found under either disposable project's `.dope/`. No cloud account was configured.

## Connected model matrix

| Connection | Model | Direct result |
| --- | --- | --- |
| Local LM Studio `LM Studio P12`, loopback port 1234 | `openai/gpt-oss-20b` | Genuinely loaded; streamed/completed turns in the primary Chat. A later selected-model turn failed as `Local generation failed` at an 8,188/8,192-token preview while the local loaded context was 4,096 tokens. The persisted attempt stayed `failed` with GPT-OSS as both selected and actual model. |
| Same local connection | `qwen3-coder-30b-a3b-instruct@q3_k_l` | Genuinely loaded; completed turns in the **same** primary Chat and a second Chat, including a retry with three restored sources and a Find Related retry with Planning/Physical sources. Durable actual-model provenance names Qwen. |
| Same inventory | Qwen Q4 and embedding model | Listed, not used as conversational qualification evidence. |

The local models sometimes gave inaccurate answers without source context. In particular, an early ChatPanel question produced a nonexistent Dart path. This is recorded as model-output quality, not evidence that Dope supplied that path.

## Direct matrix

| Item | Observation |
| --- | --- |
| A — Chats/folders | Created `Qualification` and nested `Qualification/Architecture`, plus three Chats. The primary Chat automatically became “Purpose of the Dope Repository in One Sentence”, then developer rename to `P12 architecture question` set `titleSource: developer`; later model turns did not overwrite it. Moving it from the nested folder to `Qualification` retained ID `d8e914e1-b774-406d-978b-4289ee204a76` and transcript. Selector showed last-interaction dates and ordered recently active Chats ahead of older entries. |
| B — panels | Opened distinct ChatPanels in main, right, and bottom areas with separate Chats. Initially a second panel exposed a duplicate RPC-channel error; a per-panel Chat service path fixed it. Selecting an already owned Chat in another panel reported “Chat is already open in another panel” and left the existing owner. `Back / Chats` released the primary Chat; reopening it in bottom acquired it, and a subsequent center selection again reported the existing owner. Three panels restored after browser process restart. |
| C — settings/composer | Top-right Chat settings persisted the primary default GPT-OSS, source permissions and saved-Chat retrieval. The two-row message/context/action plus model/send composer stayed present. A per-turn Qwen selection initially sent to stale GPT-OSS despite the selector label; rerender-on-selection fixed it. A later turn persisted Qwen in `selectedModel` and `actualModel` while the Chat default remained GPT-OSS. |
| D — real models | Real LM Studio GPT-OSS and Qwen both completed in primary Chat. Streaming, Cancel and Retry were exercised. A canceled second-Chat attempt remained `cancelled` after restart; reattaching its original editor, selection and saved-Chat sources allowed a successful contextual retry. No provider-native session state was restored or required. |
| E — failure authority | The selected GPT-OSS Trace turn failed with `Local generation failed` while Qwen was connected. `.dope/chats` kept the attempt `failed`, selected/actual GPT-OSS, and its two included context refs; no Qwen fallback answer or context transfer appeared. The 8,192-token app preview exceeded this LM Studio instance's loaded 4,096-token context, a real model-capability/budget mismatch to retain as Not Green. |
| F — context | Attached current editor `chat-panel-presentation.ts`, its `0–48` selection, a Project Mind item, canonical Architecture `physical-model`, Physical Map `physical-model`, Flow participant `physical-model`, draft Planning Map `map-f5306209-70a3-4bd5-9018-eb9e0077b087`, and a retrieved saved-Chat excerpt. Durable user messages retained included typed refs, content hashes/byte counts where applicable, and no excerpt body. The large Flow query reported truncation and omitted Planning context explicitly; a separate Find Related request included Planning plus Physical context. A nonexistent file preview displayed `ENOENT`. After a canceled file-grounded turn, changing only the disposable `package.json` made Retry fail explicitly with “Retry context changed or missing”; the file was restored byte for byte. A retry with absent original refs after restart was likewise rejected, and succeeded only when reattached. |
| G — AI behaviors | Ask was invoked on a project question and canceled; Explain completed with Project Mind and Architecture refs. Trace created a source-backed user turn, but GPT-OSS failed at the local context limit. Find Related used Planning/Physical refs; GPT-OSS was canceled after partial streaming, then Qwen completed its contextual retry. No canonical architecture, Project Mind or sMap metadata mutation followed these actions (hashes below). These are behavior-path observations, not a quality endorsement of model interpretations. |
| H — restart/isolation | Restarting the browser backend and reloading restored folders, Chat titles/order/settings, three panel placements and ownership, and canceled/failed transcript statuses. A second project opened with no first-project Chats; creating Chat `9aa28610-676a-44f0-a7c7-3748699f60d6` there left the first project's three Chat IDs unchanged. The three-test Electron `test:restart` suite passed after updating its obsolete pre-compact-sidebar assertions. |
| I — analysis isolation | `SoftwareMapIndex` on the same disposable source tree returned identical physical `inputFingerprint` before and after Chat writes, moves, messages and Planning creation: `d33f94e23eb959f4051e148a3aa3fae39745c57a6e00c7dce73c4a1c716f8a42`. The new Planning Map basis stored that same fingerprint and remained draft without a stale marker after Chat activity. A temporary file edit used for stale-context checking was restored. |
| J — existing product | Opened/selected an ordinary TypeScript editor, the Project Mind view, left Architecture inspector, center Physical/Flow views and a new draft Planning Map. The disposable dependency-light analysis was partial and its Flow overview exposed one participant with zero evidenced interactions. This pass does not revise retained Phase 5 P11 / Phase 6 P8 Not Green/Not Qualified history or their accepted gaps. |

Canonical-state comparison after GUI activity: `.dope/architecture.json` SHA-256 `b2356b71e27131607e4e46f93d6a6eac5626d225a5486cde65883f31ba713928`, `.dope/project-mind.json` `276e6c651603f03f09f5faf0c5181ae70b31fe5ebb69645483fbfadfd2f1b2a2`, `.dope/smap.json` `3ab8a3a8640459c940683c1ae6532aa5166b83f9dd15f3a9ed6986a9203e907b`; each exactly matched the source original. The Planning Map was new disposable draft state, not canonical adoption.

## T3 commands and package

| Evidence | Result |
| --- | --- |
| Focused Phase 7 10-file Chat/connection/provider suite | **55/55 pass** on the repaired candidate. |
| `npm run check` | **Pass** on the final production source; includes typecheck, product/baseline tests, browser build and Electron build. No separate browser/Electron rebuild was run after it. |
| `npm run test:restart` | **3/3 pass** after updating the old Software Map label, Refresh selector and collapsed-outline test steps. The first two passed before that test-only repair; the affected third test was rerun narrowly before the final complete suite. |
| `corepack yarn workspace @dope/electron package:linux` | **Pass** using the Electron build from `npm run check`; emitted `dist/linux/Dope-0.7.12.AppImage` (183 MB), SHA-256 `e69fbf29d1bd67f2fc596e586a7406ff37d150e3702808d1a62a5aad0f493fc0`. |
| AppImage inspection | ELF x86-64 AppImage extracted successfully. Embedded `app.asar/package.json` reports `@dope/electron` `0.7.12`, Theia `1.75.0`, React `19.2.8`; package Electron is `42.8.1`. No root `package-lock.json`. |
| Native AppImage launch | **Pass for startup** with isolated config/profile and disposable Dope workspace: backend and frontend reached `ready`, and the packaged plugin batch deployed. The native window was unavailable to the enabled computer-use app inventory, so **normal window close of this AppImage was not observed**. The process was stopped with `SIGTERM`. The separate unpackaged Electron restart test exercised normal app close. |
| `npm run codex:phase:validate -- p7`, `git diff --check`, exact manifest checks | Recorded in the final checkpoint validation below. |

## Not Green and evidence gaps

1. **Not Green — model input-capability mismatch.** Dope preview allowed an 8,188-token request while LM Studio had GPT-OSS loaded at 4,096 context; the selected model failed. Failure was honest and did not fall back, but the real connection was not usable at the previewed budget. A bounded correction or explicit owner disposition is needed before claiming full live-model qualification.
2. **Evidence Gap — packaged normal close.** The `0.7.12` AppImage reached a ready native frontend, but the available computer-use interface exposed no native app window for a close action. `SIGTERM` confirmed process exit, not a normal GUI close. The unpackaged `test:restart` normal-close result does not establish AppImage normal close.
3. **Evidence Gap — useful Flow interaction on the dependency-light Dope copy.** Architecture and Flow views opened and Flow refs composed, but that copy's analysis was partial; the selected overview had zero evidenced interactions and the Flow context was truncated. This is not evidence of a complete Flow trace or Phase 6 requalification.

P13 is eligible to perform its evidence-only `0.7.13` audit against this coherent checkpoint. It must retain **Not Qualified** unless these gaps receive new direct evidence, a bounded Phase 7 correction, or explicit owner disposition; P13 itself should not invent repairs or Green evidence.

## Final checkpoint validation

- `npm run codex:phase:validate -- p7`: pass.
- `git diff --check`: pass.
- Root/workspace package versions and the live baseline references: `0.7.12`; Theia `1.75.0`, Electron `42.8.1`, React `19.2.8`; no root `package-lock.json`.
