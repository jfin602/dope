# Correction 11 / M1 — supplemental recovery qualification

**Disposition: SCOPED GREEN for UX-003 in the Codex in-app browser with the explicitly selected local Q4 model. Phase 11 remains OPEN / NOT QUALIFIED.** This is a new equivalent-fixture run after the prior M1 selected-checkpoint repeat was cancelled. It does not replay the lost P3/M1 fixtures or relabel the original [P8](../../p11/known-issue-closeout.md), [P3](../closeout.md), or [M1](m1-closeout.md) **NOT GREEN** records.

## Source and runtime identity

- **Product candidate:** clean `main` at `e69d7e5bbe16b882939102fd8593c538d327fc6b` before this evidence write. The commit contains the M1 product, focused tests and original closeout. No product source, manifest, lockfile, provider role or default changed during this run. All 13 manifests and 20 `@dope/*` pins remain coherent at `0.11.8`.
- **Browser:** actual Dope ChatPanel in Codex in-app browser tabs at `http://127.0.0.1:3000/`. The newly started browser backend listened on loopback as PID `27013` and stayed live. Served `/bundle.js` and local `apps/browser/lib/frontend/bundle.js` both had SHA-256 `3afa59ee45d1f2d447bc8fa47378c1f7b7430ce8f4dd7894541eac124b75535e`. This is the bundle recorded in the original M1 run and contains the committed M1 implementation; no rebuild was needed in this unchanged-source recovery.
- **Local model:** LM Studio at `127.0.0.1:1234` reported `qwen3-coder-30b-a3b-instruct@q4_k_m` genuinely loaded with context `16,384`, parallel `1`; its running llama process had `--n-gpu-layers 0`. The Chat UI connection was `LM Studio` at `http://127.0.0.1:1234/v1`, reported ready after a connection test. Each of five tested turns explicitly selected the Q4 model; saved execution records show `providerId: local`, exact model identity and `resolutionSource: explicit-turn`. The Chat prompt budget displayed at most about `844/4864` estimated tokens; LM Studio requests allowed `1024` output tokens, within the loaded 16K context for these turns. No second inference session, hosted fallback or model profile change was used.
- **Health:** a bounded direct no-action-style preflight returned `READY` with HTTP 200 in `0.331` seconds. A final request returned `READY` with HTTP 200 in `0.125` seconds. LM Studio, llama-server and browser backend remained running; the final memory check showed about 16 GiB available. Current-run LM Studio logs show prompt processing and completion for all five browser requests without a current-run error or cancellation. Earlier log failures and the original M1 cancelled turn remain separate history. Time to first visible model token was not measured; the UI showed its waiting state before each completed response.

## New disposable fixtures and saved evidence

The [sanitized saved Chat evidence](m1-recovery-saved-chat.json) (SHA-256 `0c6acd164ae454bc015ae9c71ee59fb4ec2db19f86d4d68fc9c1afff6f9c8cc2`) preserves exact questions, raw JSON, backend-owned guidance markers, activity, context refs and model provenance. No old `/tmp` fixture or original Chat was reused.

| Fixture | Owner and Chat | Initial and final Roadmap state |
| --- | --- | --- |
| Selected: `/tmp/dope-c11-m1-recovery-5HbJmh` | Project `f0e71e39-1e49-46aa-bca8-6a01f12e790b`; saved Chat `e0d76bcb-6761-45d3-968d-a317fc237c2e` | Revision 1; synced `docs/roadmap/wrong-roadmap.md`; selected source-backed checkpoint `roadmap:docs/roadmap/wrong-roadmap.md#phase-1` |
| Unselected controls: `/tmp/dope-c11-m1-control-xzmJYJ` | Project `33f90365-ef07-4bb8-9d44-c4227a5b98a7`; saved Chat `e51dd91e-00f4-464d-b9a0-9d49d260aede` | Revision 1; synced same linked Markdown bytes; Chat showed `Following active selection: none` |

Both fixtures had a separate supported replacement candidate, `ROADMAP.md`. The selected workbench retained its Roadmap selection after reload, so a second fresh project with byte-identical Markdown files supplied a genuinely unselected control. Each import was previewed and manually accepted before Chat testing; the import diagnostic named three absent optional project sources, but mapped one active, editable checkpoint and reported synced status. No replacement preview was confirmed during the Chat tests.

| File | Selected before = after SHA-256 | Control before = after SHA-256 |
| --- | --- | --- |
| `.dope/roadmap.json` | `5ce30bf82b0f2625a49a19428e60aa6a6c99cf0dc7ab73a96f465939c8d77194` | `b73a4c63331b8760b9d78c24b0e1e9a07145e8ddcd733b4b7dc9fed553bb4747` |
| `docs/roadmap/wrong-roadmap.md` | `8d1c698217a1f47801c0c250baff873b94995617b47bc99b2253fbdc2e3e3140` | Same SHA-256 |
| `ROADMAP.md` | `b8285c942d465bbf255ed38ebe8df8ee7479a4a929ef157b4ca62c75381af1f5` | Same SHA-256 |

Expected saved Chat files changed as the requested conversation was recorded; no help-only turn changed either Roadmap owner or either Markdown file.

## Direct browser gates

| Gate | Observed result | Decision |
| --- | --- | --- |
| Selected exact wording, turn 1 | `I linked the wrong Roadmap, how do I change it?` completed in **9.178 s**. Visible **Verified Dope guidance** said open Roadmap → Roadmap Markdown and setup → Change linked file, select the intended project Markdown, review the replacement preview and affected content, explicitly confirm, retain the old file on disk, and that Chat cannot directly change the link. It identified the recorded source as synced and said nothing changed. Saved activity is `roadmap-change-file`, `no-action/no-action`, complete local Q4. Expanding the disclosure showed the original strict `{"type":"no-action",...}` JSON. | **PASS** |
| Selected exact wording, turn 2 | The identical question with the same selection completed separately in **4.439 s**. The visible complete verified procedure, capability ID, validated no-action and explicit local Q4 provenance matched turn 1. No Objective-edit detour or claim of applied change appeared. | **PASS** |
| Unselected exact wording | Fresh control Chat visibly showed no active planning selection. The same question completed in **4.926 s**, with the full verified procedure, `roadmap-change-file`, `no-action/no-action`, and explicit local Q4. | **PASS** |
| Synced-state refresh | `How do I refresh or sync the current Roadmap?` completed in **7.442 s**. The visible verified response stated the recorded state was **synced**, named Refresh Roadmap and the setup view, and said refresh does not approve source changes. It did not claim a conflict. Saved capability was `roadmap-refresh`; outcome was no-action. | **PASS** |
| Planning Map isolation | `How do I change a Planning Map link?` completed in **5.399 s**. The visible verified response stated that no direct link-edit procedure is verified, directed inspection of the Planning Map's relationship and owner, and explicitly said Roadmap source replacement does not edit Planning Map links and Objective editing is not a prerequisite. Saved capability was `planning-map-link`; outcome was no-action. | **PASS** |
| Saved Chat restoration | Reloading the selected project restored the same saved Chat ID after its 60-second lease expired. Both completed turns, verified guidance labels, collapsed original-JSON disclosures, context markers and model provenance reappeared. The brief lease message was a transient restoration delay, not a lost turn. | **PASS** |
| No unauthorized write | Before/after hashes above and both final owner revisions remained unchanged at 1. All five turns were validated `no-action`; no approval, Roadmap replacement or Chat action authority was granted. | **PASS** |

## Validation and limits

- **New focused validation:** `node --test test/unit/dope-capability-help.test.ts test/unit/roadmap-chat-context.test.ts test/unit/chat-presentation.test.ts` passed **16/16**, exit 0, on the unchanged committed source. The served browser bundle matched the local M1 build, and both browser and model remained operational throughout the direct run.
- **Applicable prior aggregate:** the original [M1 closeout](m1-closeout.md) records one captured `npm run check` exit 0 with **740/740 tests**, typecheck, browser build and Electron build on the final M1 product source. That product and test source was committed in `e69d7e5`; this recovery started clean at that HEAD and made no product edit. The aggregate and builds were **not rerun** here. An Electron build is not native GUI evidence.
- **Not run here:** stalled-turn cancellation, a longer-context/GPU profile, native Electron GUI, hosted/Codex parity, full source-state negative matrix, long-term model stability, unrelated usability issues, and the separate manual Usability Hunter. The earlier M1 cancelled selected turn remains cancelled in its original record. This recovery supports only the stated browser/local-Q4 UX-003 scope.

**Decision:** all mandatory supplemental recovery gates passed at committed product `e69d7e5` / `0.11.8`, so the UX-003 verified-guidance correction is **SCOPED GREEN** for this browser/local-Q4 workflow. Phase 11 remains OPEN / NOT QUALIFIED. The separate Hunter may now begin under its own manual authorization, starting with History → exact continuation → Work status/review; it was not run by this qualification.
