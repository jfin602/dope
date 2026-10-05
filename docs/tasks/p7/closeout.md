# Product Phase 7 — AI Presence evidence closeout

Date: October 3, 2026. **Decision: Not Qualified.** This is an evidence-only `0.7.13` coherence transition, not an owner closeout or a claim that all of Phase 7 is implemented. The Phase 7A Chat and read-only AI Presence slice has substantial direct evidence. ADR 0026 and the [current Phase 7 plan](../../planning/p7/phase-7-plan.md) require AI Center and deterministic role routing (7B/7C) for the full Phase 7 exit condition; the P1–P12 stack did not implement or qualify them. This run changed versions and documentation only.

## Candidate and implementation identities

- Activation: `59c7f72a29dcdecdf9b908176754bfd02179b004`, coherent `0.7.0`.
- P1 `b7e1fbb6e0f0e68e0ec8ac102a3b8b6e1655cb2f` (`0.7.1`); P2 `99e689be3c346b005615bba54c38536a7138c2c9` (`0.7.2`); P3 `d43a527ef3b230394f32b4e32be9ed1f71715d3e` (`0.7.3`); P4 `4ac639be247bd742d1bc9e628aa5d96852b03a25` (`0.7.4`).
- P5 `f1a0812a3a64b1a13922900d06d38e9b8a46aaf1` (`0.7.5`); P6 `9079e602d6efd3d4110e4fcb2e27145781c38544` (`0.7.6`); P7 `00a58787e61964e1db45ca07c0b12a7c2470515e` (`0.7.7`); P8 `b94d4c4cca6d1a5b351c6f9349574ac867bab6fa` (`0.7.8`).
- P9 `74172a35b8f3c80390a46d9c6c1954354b34267f` (`0.7.9`); P10 `93507b1487f9ba004d09cc77b6964ed120a2ae3b` (`0.7.10`); P11 `6315ee67917532a8b10e089f9fb6805f38b1968c` (`0.7.11`).
- P12 initial checkpoint `fd00162782fed7c7372fd9bef359fad782e70ecd`, bounded blocker correction `eafd6b0a506d5046a22f2bd4c6855a1a31063db4`, and clean predecessor HEAD `88fadb62119c97a5bb64378df1988c4b169438d2`, all at `0.7.12`. The [initial P12 record](P12-ai-presence-dogfooding-evidence.md) remains **Not Green**; the [supplement](P12-blocker-correction-evidence.md) closes its three named blockers without rewriting that historical result.
- The initial P12 record names an earlier P1–P11 commit lineage ending at `8c77dde`. The current reachable P1–P11 commits above have the same `package.json`, `apps/`, `packages/`, `test/` and `scripts/` tree at `0.7.11` (`git diff --exit-code 8c77dde 6315ee6 -- package.json apps packages test scripts` passed); the intervening differences are documentation. The direct P12 observations therefore apply to the same predecessor product source, while the historical commit IDs in that record remain as written.
- The implementation commit for this transition belongs to the phase runner and is not yet available in this record.

P1–P11 commit bodies report passing bounded validation and eligibility for the next prompt: P1 5 Chat tests; P2 13 repository tests; P3 12 service tests; P4 14 panel tests; P5 11 ownership tests; P6 38 runtime/registry tests; P7 28 Local/Gemini/seam tests; P8 18 OpenAI/connection/baseline tests; P9 24 composer/connection tests; P10 59 affected tests; and P11 focused Chat/context tests plus a zero-error browser build. These were prompt-level implementation results. Live provider, GUI, restart and package evidence was assigned to P12. The P12 initial and supplemental records below carry those direct results.

## A–H audit

The decisions below apply to the implemented **7A slice**. They do not stand in for 7B/7C qualification.

| Gate | Decision | Evidence and limit |
| --- | --- | --- |
| A. Chat domain truth | **Green** | P1 contracts and P12 direct create/folder/move/rename/transcript observations retained Chat identity and developer title authority. Completed, failed and cancelled turns had durable distinct states. Chat did not become Project Mind or architecture authority. |
| B. Persistence/service safety and project isolation | **Green** | P2/P3 repository and service guards, P12 restart and second-project replay, and its unchanged canonical file hashes support project-local `.dope/chats/`, recovery and isolation. P12 found no secret-shaped project JSON fields. |
| C. Multi-area ChatPanel/shared repository | **Green** | P4 and P12 opened separate Chats in main, right and bottom panels. The P12 duplicate RPC-channel defect was corrected; the panels used one shared Chat repository and restored their placements. |
| D. One-owner/restoration/race behavior | **Green** | P5 focused guards plus P12 ownership conflict, Back/release/reacquire and process restart observations support one live panel owner per Chat. The P12 repair is included in the `0.7.12` checkpoint. |
| E. Model Runtime/connections/adapters and sMap synthesis | **Evidence Gap** | P6–P8 and focused tests cover Local, Gemini and OpenAI adapter contracts and preserve the sMap synthesis seam. P12 directly completed Local GPT-OSS and Qwen turns; the supplemental replay checked loaded capacity against real LM Studio. No direct hosted Gemini/OpenAI execution or integrated AI Center/role routing was recorded. Existing sMap behavior has automated/regression evidence, not a fresh synthesis qualification. |
| F. Composer/per-turn model/settings/no-fallback/secret boundary | **Green** | P9 and P12 directly exercised two-row composer, saved settings, per-turn Qwen override and durable selected/actual model provenance. The selected GPT-OSS failure stayed failed without a Qwen fallback. P12 isolated provider state and found no secret-shaped fields in project `.dope/`; no cloud credential lifecycle was directly exercised. |
| G. Bounded context/provenance/AI behaviors/auto-title | **Green** | P10/P11 and P12 exercised editor/selection, Project Mind, Architecture, Physical, Flow, Planning and saved-Chat refs; hashes/byte counts and included/omitted/truncated indicators persisted without excerpt bodies. Changed/missing retry context failed explicitly. Ask, Explain, Trace and Find Related paths ran; one Trace failed at the old Local capacity mismatch. The supplement demonstrated a source-evidenced Flow context turn on GPT-OSS with a 3,072-token input budget and explicit omission. Auto-title yielded to developer rename. This does not endorse model answer accuracy. |
| H. Direct GUI/live-model/restart/analysis-isolation/regression/package | **Green for 7A evidence** | P12 recorded direct multi-panel GUI and two real Local models, 55/55 focused tests, `npm run check`, 3/3 restart tests, stable Physical Map input fingerprint across Chat writes, AppImage inspection and native startup. The supplement rebuilt the `0.7.12` AppImage, observed normal window close/exit 0 and the corrected live Local capacity/Flow path. No `0.7.13` product build or package was run: this transition changes version/docs only. No direct 7B/7C or hosted-provider qualification exists. |

## P12 direct and release evidence reused

The initial P12 GUI replay used disposable Dope and Adaptive SEO workspaces. It created nested folders and three Chats, opened three ChatPanels, tested ownership conflicts and restoration, streamed Local GPT-OSS and Qwen, exercised Cancel/Retry and no fallback, and checked per-Chat settings and typed context refs. Browser backend restart restored panels, folders, settings and failed/cancelled statuses. A second project did not show the first project's Chats. Its `SoftwareMapIndex` input fingerprint stayed `d33f94e23eb959f4051e148a3aa3fae39745c57a6e00c7dce73c4a1c716f8a42` across Chat and Planning writes. Canonical architecture, Project Mind and sMap file hashes matched their original copies. The Dope-copy analysis was partial, so its zero-interaction Flow overview did not qualify a useful path.

P12's initial `npm run check`, 55/55 focused Chat/provider tests and 3/3 Electron restart tests passed. Its first AppImage was built and launched, but a normal packaged close was not observed. The later bounded correction changed Local inventory/capacity handling and provider output-token forwarding, passed 23 focused tests, and built a replacement `Dope-0.7.12.AppImage` (SHA-256 `a81a68d742fcfd2924e90e23d284e95637a42988395457f519bd21a6681c7807`). In a full disposable Adaptive SEO copy, the real Local GPT-OSS instance advertised 4,096 loaded context, Dope bounded preview to 3,072 input tokens with a 1,024 output reserve, rejected an over-budget message before persistence, and completed a context-heavy turn on the exact selected model. The Flow query included eight evidenced `receives`/`invokes`/`reads`/`responds` facts. The replacement AppImage reached a ready frontend; a normal window-manager close exited 0 with backend shutdown and no session process left. This was a built-backend/provider and separate native close replay, not a new packaged GUI Chat replay.

## Retained history and residual gaps

- Phase 5 remains **owner-closed for sequencing**, with P11 **Not Green** and P12 unexecuted. Phase 6 remains **owner-closed for sequencing** at `0.6.8`, with P8 **Not Qualified**. Neither is relabeled by Phase 7 Chat evidence.
- The initial P12 **Not Green** finding and its three original blockers remain historical. The supplemental replay resolves the named Local capacity, useful Flow context and packaged normal-close blockers for the corrected `0.7.12` source, without claiming full P12 or Phase 6 requalification.
- Direct hosted Gemini/OpenAI turns and cloud credential lifecycle were not exercised. Model-generated answers included an invented path in an early Local turn; the record does not claim semantic answer quality.
- **Phase-level blocker:** 7B AI Center and 7C role routing are required by ADR 0026 and the current Phase 7 plan but remain outside the implemented P1–P12 slice. The current P13 evidence-only transition cannot qualify that exit condition.

## Disposition and next action

**Not Qualified.** Keep Phase 7 active. The owner should route a bounded Phase 7 continuation for AI Center, role routing and their direct integrated qualification, then perform a final evidence audit; alternatively the owner may explicitly dispose of the missing scope for sequencing without calling this qualification Green. Do not create Phase 8 prompts from this record.

P13 transition checks: `node --test test/unit/theia-baseline.test.ts` **3/3 pass**; `npm run codex:phase:validate -- p7` **pass**; exact root/10-workspace `0.7.13` versions and internal `@dope/*` references, Theia `1.75.0`, Electron `42.8.1`, React `19.2.8`, and no root `package-lock.json` **pass**; `git diff --check` **pass**. P12 owns the broader T3 run; no product suite, build, live provider, GUI, restart or package replay was run for this version/documentation transition.

## Post-closeout documentation amendment — c7-chat-conversation-ux

The P13 **Not Qualified** decision above remains historical evidence and is not reopened or relabeled. After this evidence-only transition, direct product review approved one bounded Phase 7A presentation/organization correction before 7B/7C continuation: `c7-chat-conversation-ux` at unchanged `0.7.13`.

The correction covers fixed Chat header/transcript/composer layout, a unified composer surface, right-aligned developer bubbles, neutral safe-Markdown assistant output, compact execution metadata, scroll-follow behavior that respects manual scroll-away, and durable editable ten-color Chat identity with deterministic migration/defaulting. It preserves read-only authority, explicit model selection/no-silent-fallback, context provenance and all evidence recorded above.

Current next route:
`/prompt-ass -> /prompt-plan -> /prompt-write c7-chat-conversation-ux`

After that correction is qualified, continue with bounded 7B AI Center, 7C role routing, integrated qualification and a later final Phase 7 evidence audit.

## Final Phase 7 disposition after 7B/7C

The **Not Qualified** P13 decision above remains truthful historical evidence for the earlier 7A-only state and is not rewritten.

Subsequent Phase 7 work completed and qualified:
- `c7-chat-conversation-ux` at unchanged `0.7.13`;
- Phase 7B AI Center, Qualified / Closed at `0.7.23`;
- Phase 7C deterministic role policy/routing, with Green integrated qualification at `0.7.31`;
- the final P9 Phase 7 audit.

The planned P9 `0.7.32` version/documentation transition did **not** materialize. No `0.7.32` candidate, package or artifact is claimed. The actual final Phase 7 source/version is therefore **`0.7.31`**, and Product Phase 7 is **QUALIFIED / CLOSED** on that actual source.

A later presentation-only Color Scheme Change commit remains on the same `0.7.31` package line. It does not create a new Phase 7 version claim.

### Post-closeout grounding correction

Direct Chat use exposed a separate read-only grounding defect: a normal repository question may reach the model with Chat history and manually attached context only, without deterministic repository/map evidence. Earlier evidence already recorded at least one invented Local-model path and explicitly did not claim semantic answer quality.

The approved `c7-chat-project-grounding` correction at unchanged `0.7.31` adds deterministic project-scoped grounding and an anti-fabrication contract without reopening Phase 7 routing or adding Phase 8 mutation authority.

The correction must be qualified separately. A Green correction supplements this closeout; it does not relabel historical P12/P13 observations.

## Owner-approved Phase 7 closeout — 2026-10-05

The owner explicitly approves Product Phase 7 closeout on the actual coherent `0.7.31` source.

This owner disposition confirms the roadmap transition from Phase 7 to the post-closeout correction / Phase 8 sequence. It does **not** rewrite historical evidence:
- the original P12 Not Green record remains historical;
- the P13 `0.7.13` Not Qualified audit remains historical;
- Phase 5 and Phase 6 retained qualification gaps remain unchanged;
- the nonexistent planned `0.7.32` transition is still not claimed.

Owner closeout status: **OWNER APPROVED / QUALIFIED / CLOSED**.

`c7-chat-project-grounding` remains a separate post-Phase-7 correction at unchanged `0.7.31`. It is not implicitly Green by this owner approval and must retain its own qualification result. Phase 8 should not absorb that correction's scope.
