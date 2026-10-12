# Phase 9 final qualification repair loop — NOT GREEN

**Date:** 2026-10-12 (America/Chicago)  
**Disposition:** **Phase 9 NOT GREEN / NOT QUALIFIED** after five cycles. This is follow-up evidence to the original [P13 closeout](closeout.md), not owner closure or Phase 10 activation.  
**Exact final source/version candidate:** `0.9.35` / `2210a54d72fc0c0c31f617c42da7d4c9ee55fce9`. The original P13 source/version checkpoint remains `7fdf7b3f43d695e12fa3390f7fbad63d90e5cfa5`; the four repair commits followed it at unchanged package version. Documentation is committed separately after this source candidate.

## Five cycles

| Cycle | Source candidate | Full `npm run check` | Direct qualification result |
| --- | --- | --- | --- |
| 1 | `77cacfb3c601454db7532ba720ef03430a3ad087` | Exit 1: History used raw `#336699`, rejected by `dope-theme.test.ts` | Separate History focus RPC fixed the duplicate channel; Phase 5 Planning consumer added to the retained Phase 3 negative guard. |
| 2 | `fb776f2ce27a0e23e6280206d3d06a4f41992912` | Exit 0 | Real History loaded on Dope and disposable projects; the first connected local Qwen explanation exceeded History's 30-second cap. |
| 3 | `e8bb98771a3a65ab0a8df48ea46ecab031410881` | Exit 0 | The panel displayed the projection's actual cross-source chronological order. The 120-second local call completed but rejected Qwen's uncited unknown lines. |
| 4 | `2210a54d72fc0c0c31f617c42da7d4c9ee55fce9` | **Exit 0** | A focused guard kept cited interpretations and omitted uncited unknowns. The first real GUI call on this source still failed output validation. |
| 5 | Same `2210a54d72fc0c0c31f617c42da7d4c9ee55fce9`; no source edit | Cycle 4 check remains the exact-source aggregate | A second explicit click on the same preview produced a genuine local explanation. Further GUI, restart, isolation, stale-target, legacy export, and owner-integrity checks were completed. Remaining gaps below prevent Green. |

The final aggregate compiled and built browser and Electron with zero build errors. Its six test invocations passed **103/103 runner, 11/11 baseline, 1/1 local-install, 409/409 product, 28/28 initialization, and 1/1 IDE** tests: **553/553**, zero failures. `git diff --check` passed. All 13 root/app/package manifests remain `0.9.35` with 20 pinned internal `@dope/*` references at `0.9.35`. `yarn.lock`, unrelated dependencies, and the absence of a root `package-lock.json` were preserved.

## Direct Theia observations

The built browser workbench was used on the real Dope repository and on `/tmp/dope-p9d-p13-gui-kHHVcA`, a disposable Git project. A third empty folder tested missing metadata. These are direct workbench observations. The disposable Chat, Planning Map, accepted Project Mind decision, and pending AgentTask were created through their real owner stores for qualification; the pending task was **not executed**. Its Git commit and modified `example.ts` were real Git state.

- History appeared beside Chat and Work in the right toolbar, with no Sessions launcher. Repeated command activation kept one `#dope-history` panel. The panel displayed globally ordered Git, pending Work, Mind decision, Chat, and Planning entries with event times distinct from the current dirty snapshot's observation time. The disposable commit was separately labeled; exact commit navigation remains explicitly unsupported.
- One-click History owner actions opened the exact saved Chat, Planning Map, accepted Mind decision, and pending task in Work. Normal Explorer opening of `example.ts` recorded project-bound editor focus; after reload, History showed `Last focused editor`, and one-click Continue reopened that exact editor. A separate Mind suggestion Continue opened its exact decision. Direct Work and Explorer actions remained available outside History.
- Switching between the disposable project and Dope showed each project's own owner and Git entries, with no cross-project titles. An empty folder showed `No verified place to continue`, no activity, and three source diagnostics. Temporarily removing the disposable Chat owner file made History reject its stale Open action with `History target or project changed`; the original file was restored byte-identically.
- History remained usable in Dope Dark and Theia Light. The original Dope Dark preference was restored. The command palette opened History by keyboard. These observations do not claim a complete accessibility audit.

## Local understanding and authority

LM Studio on `127.0.0.1:1234` served the loaded local `qwen3-coder-30b-a3b-instruct@q3_k_l` model with 16,384 context tokens. AI Center showed the Background role targeting this exact model with **local-only**, `conversationalText`, zero fallbacks, and no hosted project-data egress. Immediately after backend restart, a History explanation denied with `No eligible connected local conversational model` until the local connection was explicitly reconnected. No hosted model was selected.

The real GUI preview selected one Mind metadata item: **704/4096 bytes**, estimated **176/1024 tokens**, with an exact evidence basis and fingerprint. It displayed no transcript, prompt, diff, secret, or file content. The first live call on the final candidate failed output validation. A second explicit confirmation on the same preview returned the local Qwen connection/model provenance, one deterministic cited fact, and four cited interpretation lines; Unknowns was empty. One model line incorrectly interpreted the preview's privacy notice as saying no model call occurred. That misleading interpretation and the variable validation outcome are retained failures, even though the genuine local invocation succeeded.

Byte hashes of the disposable Chat, Planning, Mind, and pending AgentTask owner files were unchanged after History reads, previews, failed and successful local explanations, navigation, and refresh. The original Git dirty state remained; no AgentRun directory, review, or promotion was created. `history-focus.json` was written only after the separate normal editor-focus action, as intended. The full product suite includes the retirement, hosted-denial, stale-preview, cancellation, and no-owner-write guards. This is bounded authority evidence; no independent packet-level hosted-egress capture was obtained.

The user-invoked offline legacy exporter CLI was run against fresh v1 and v2 `.dope/development-sessions.json` data on this final source. Both exited 0, returned matching SHA-256, preserved original source bytes and an owner sentinel byte-identically, and retained the author note. No Session runtime or UI was observed; the production retirement guards passed in the exact-source aggregate.

## Remaining gaps and decision

**NOT GREEN.** A live completed AgentRun with its actual validation/review/promotion truth was unavailable: the disposable Work panel reported Coding Agent capability unavailable, and only a pending owner task was created. No validation or review result is inferred from that task. The local explanation sometimes fails strict validation, and one successful interpretation was misleading about model activity. Independent hosted-egress observation was not completed. These leave the requested Phase 9-wide chronology, understanding quality, and authority proof short of qualification despite the passing exact-source aggregate and substantial direct GUI evidence.

Historical 9A/9B bounded Green, old 9C P10 superseded/unexecuted, Phase 5 Not Green, and Phase 8 Green are unchanged. There is no p9e. Phase 10 remains inactive; owner closure and Phase 10 activation each require a separate owner decision.
