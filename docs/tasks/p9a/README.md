# Phase 9A — Session Identity and Persistence

Status: **PROMPT STACK AUTHORING / NOT ACTIVATED OR IMPLEMENTED**
Entry: Phase 8 owner-closed Green at `0.8.47` / `bcc5cb8`. Phase 9 remains NOT ACTIVATED.
Execution folder: `p9a`. **Clean `0.9.0` baseline is now committed** at `e250a07` under the owner's version-only approval (`docs/planning/p9/baseline.md`). The last qualified product source remains `0.8.47` / `bcc5cb8`. **Phase 9 implementation activation is still pending.** Prompt targets P1–P6: `0.9.1`–`0.9.6`.

9A owns only provider-free DeveloperSession identity, project-local storage, lifecycle, backend RPC, restart and project isolation. **9B** owns links to Chats/Planning/Work; **9C** UI; **9D** rich resume/closeout; **9E** real GUI Dope Builds Dope and full product aggregate. A session is optional and never an authorization or AI-execution source.

| Prompt | Version | Scope | Tier | Model | Browser |
| --- | --- | --- | --- | --- | --- |
| P1 | 0.9.1 | Domain/parser/service contracts | T1 | GPT-6 Sol High | no |
| P2 | 0.9.2 | Safe atomic project-local store | T2 | GPT-6 Sol High | no |
| P3 | 0.9.3 | Revision-checked lifecycle | T1 | GPT-6 Sol Medium | no |
| P4 | 0.9.4 | Backend project RPC/handles | T2 | GPT-6 Sol High | no |
| P5 | 0.9.5 | Focused restart/security integration | T2 | GPT-6 Sol High | no |
| P6 | 0.9.6 | Scoped 9A qualification and closeout | T2/manual | GPT-6 Sol Medium | no |

**Version law:** Each prompt, including manual P6, must coherently advance all 13 root/app/package manifests and pinned internal `@dope/*` dependency references to its target patch. The runner checks versions but does not bump them. The owner-approved coherent `0.9.0` baseline is established; P1 must still wait for explicit Phase 9 implementation activation. Do not bump versions from these documents.

**Efficiency:** P1–P4 target <=8 minutes implementation + focused test (10-minute soft, 15-minute hard). P2 safety may justify extra time, never weaker filesystem checks. P5 owns bounded cross-boundary/restart tests; P6 audits final 9A evidence. Build only touched package outputs when compiled-lib tests require them; register new tests once in `test:product`. No per-prompt `npm run check`, `npm test`, browser/Electron/native builds, model calls or GUI. 9E owns full GUI/aggregate.

After **separate owner implementation activation** on the already-committed `0.9.0` baseline, validate `npm run codex:phase:validate -- p9a` and run `npm run codex:phase -- p9a`. P6 decides 9A GREEN/NOT GREEN only; it does not close Phase 9 or activate 9B.
