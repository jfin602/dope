# P9 — AI Center direct qualification evidence

Status: **Green for the P9 direct qualification matrix** on the coherent `0.7.22` candidate. P10 is eligible to perform the evidence-only Phase 7B closeout; this record does not itself make the formal P10 Phase 7B Qualified decision and does not activate or implement Phase 7C.

## Candidate and preflight

- Exact predecessor: clean `0.7.21` commit `d0f8ff2abde4d851f4c3486d80765740fa27c60e`.
- Candidate: the predecessor plus the bounded P9 repairs and evidence in the manual `0.7.22` checkpoint. All 12 live root/workspace manifests and the baseline reference are exactly `0.7.22`; internal `@dope/*` references remain coherent.
- Qualified framework baseline: Theia `1.75.0`, Electron `42.8.1`, React `19.2.8`; no root `package-lock.json` or `npm-shrinkwrap.json` exists.
- Authorities read before direct work: p7b assessment and implementation plan, ADR 0026's 7B/stability boundary, P7 retained P12/P13 evidence, `c7-chat-conversation-ux` closeout, and exact P1-P8 commit results.

| Prompt | Exact checkpoint | Retained result used as preflight |
| --- | --- | --- |
| P1 | `c8e8ecc5694e441e87ec7453d987166c3cceb85e` (`0.7.14`) | AI domain/contracts implemented; 13 focused tests passed. |
| P2 | `3f861c29d852330320adb5f897ee6d9b103c3a68` (`0.7.15`) | Global registry, concurrency and migration implemented; 40 focused tests passed. |
| P3 | `1b8b083b42c80772c5519d44329c0836262f0511` (`0.7.16`) | Credential boundary implemented; 20 focused tests passed; packaged keyring still assigned to P9. |
| P4 | `12becd2eb797db7f921dce68c4f5fe2975e2f99f` (`0.7.17`) | Provider setup/runtime adapters implemented; 31 focused and 11 baseline tests passed. |
| P5 | `2a5086f3843a1385159cd6bd7697cf99e26341b2` (`0.7.18`) | Inventory/health/Test Connection/eligibility implemented; 26 focused tests passed. |
| P6 | `edcfb55579f7967cea7a3d6bac97052f7f8fb34b` (`0.7.19`) | AI Center UI/launcher implemented; focused tests, extension build and browser build passed; no prior GUI claim. |
| P7 | `eaefb041e573d1d908e0e27ece626ce935bfd66e` (`0.7.20`) | Chat convergence implemented; 49 focused tests passed. |
| P8 | `d0f8ff2abde4d851f4c3486d80765740fa27c60e` (`0.7.21`) | Software Map convergence implemented; typecheck and 105 focused tests passed; P9 remained the qualification gate. |

## Isolated setup

- User-global registry and credentials were isolated under `/tmp/dope-p7b-p9-final.mTlK61/config`; two independent Theia configuration roots were used for the concurrent processes.
- Disposable project copies were `/tmp/dope-p7b-p9-final.mTlK61/projects/project-a` and `project-b`. Accepted originals were not modified.
- Process/window A ran without a project on port 3067. Process/window B first ran `project-a` and was then restarted on the copied `project-b`, sharing the same isolated user config throughout.
- LM Studio was the real Local runtime on loopback port 1234. Loaded identifier `p9-gpt-oss` was `openai/gpt-oss-20b` at an actual 4,096-token context.
- No real hosted test credential was present. A generated, isolated environment sentinel exercised environment-source status only; it was not treated as a successful hosted credential and no project evidence was sent to a hosted provider.

## Connection and model identities

No secret value is included here.

| Connection | Stable ID | Provider/result |
| --- | --- | --- |
| Local P9 Primary | `89a302ac-7231-46d4-9186-316d08a2087f` | Local/LM Studio, loopback endpoint, no credential, real Test Connection passed. |
| Local P9 Duplicate Renamed | `19c69519-87a1-4b7a-8496-671dcad3073e` | Independent same-provider duplicate; alias and endpoint changed without changing ID. |
| OpenAI P9 Missing Credential | `75efd64f-e5b7-4f60-afcf-e06b2be196c9` | Distinct OpenAI identity; `OPENAI_API_KEY` missing, normalized to needs-authentication. |
| Gemini P9 Environment | `1ef5e192-410c-46e3-b812-57607232f71b` | Distinct Gemini identity; isolated environment source available, invalid sentinel produced expected degraded provider result. |
| Compatible P9 Session | `82105fc4-e012-433f-84e2-fabf5883811f` | Distinct OpenAI-compatible identity; session source exercised and lost on restart. |
| Compatible P9 Secure | `adf5225a-e84d-42d5-8eb3-8a7ceefc7051` | Distinct OpenAI-compatible identity; secure source survived restart, was removed, and the connection was then removed. |
| Cross Process Winner | `fe4ab4be-0c83-44f8-8aeb-4b36f9178e8f` | Local identity created in process B, observed in process A, then used for the exact Chat repair turn. |

The Local inventory contained `p9-gpt-oss`, `openai/gpt-oss-20b`, the two known Qwen IDs and the embedding ID. Only the two loaded-instance aliases were eligible conversational models. Direct eligibility returned both at a minimum known context of 4,096 and none at 4,097. The duplicate connection's `qwen3-coder-30b-a3b-instruct@q3_k_l` preference remained disabled after refresh.

## Direct A–J matrix

| Item | Decision | Direct observation and focused support |
| --- | --- | --- |
| A — launcher/singleton/no project | **Green** | The no-project process showed the bottom-left `AI Center` action. It opened one center AI Center tab; invoking it again revealed the same tab rather than creating another. The launcher contained no account/profile action. The focused workbench guard confirms Accounts remains linked under Settings through the supported menu API. |
| B — registry/global scope | **Green** | Created two Local connections with independent IDs. Editing the duplicate from the loopback IP to `localhost` and renaming it retained ID `19c69519-…`. Disable/Enable, model Disable and Refresh were exercised. Secure credential removal plus registry Remove advanced the global revision and disappeared live from the second project's AI Center. The same registry identities appeared with no project, in `project-a`, and after switching the backend to copied `project-b`; neither project contains registry files. |
| C — multi-window/process | **Green** | Two backend/window processes shared the isolated user config. Creating `Cross Process P9` in one appeared in the other without restart. A staged writer at revision 25 lost to a winner at revision 26; the stale mutation was rejected and reload returned revision 26 with alias `Cross Process Winner`, rather than overwriting it. The focused store integration independently passed external-event, two-process race and abandoned-lock cases. |
| D — credentials | **Green** | Session-only status became available, Replace was exercised, and the other process could not see that process-memory secret. After restart the session source was missing. Environment status reported the declared Gemini variable available. OS-secure status was available in both processes and remained available after restart; Remove changed it to missing before its connection was removed. Electron `42.8.1` performed a real keytar set/get/delete round trip (`true/true/absent`). A secure-store-unavailable focused guard proves persistent save is rejected rather than falling back. A four-sentinel search over registry, both projects, logs, qualification outputs and the repository returned no match. |
| E — providers/inventory | **Green** | Local/LM Studio discovery and real Test Connection completed on `p9-gpt-oss`; the final UI displayed `Last test` and the backend recorded the exact model, latency and provider-reported usage. The synthetic request carried no project data. LM Studio reported 4,096 loaded context; direct `findEligibleModels` accepted 4,096 and rejected 4,097. OpenAI, Gemini and OpenAI-compatible setup remained distinct. No hosted Test Connection was attempted because no explicit real hosted credential was available. |
| F — health/models | **Green** | Refresh Models and Reconnect were exercised. The duplicate's disabled Qwen model remained disabled through refresh. Direct UI states included unknown, checking, ready, needs-authentication, degraded and disabled; actionable connection failure drove the launcher warning behavior guarded by the focused tests. Known missing model retention and absence of open-tab polling passed focused inventory tests; connection creation schedules one bounded check. |
| G — Chat repair | **Green** | In `project-a`, Chat defaulted exactly to `Cross Process Winner · p9-gpt-oss`. Disabling that connection made the existing Chat report `Default model unavailable`, disabled Send and offered `Manage AI connections`; no other ready model was substituted. AI Center repaired/reconnected the model and `Return to Chat` selected the originating panel. The exact prompt `Reply with exactly: P9 CHAT OK` completed as `P9 CHAT OK` with durable provenance `fe4ab4be-…/p9-gpt-oss → local/p9-gpt-oss`. |
| H — Software Map boundary | **Green** | Focused browser/backend convergence tests prove that generic Test Connection does not mark synthesis ready, hosted evidence consent is project/target scoped, the exact selected target must pass its feature probe, credential/target changes invalidate readiness, and Local warm-up occurs before the first repository-evidence request. No hosted synthesis or quota was used. |
| I — restart/isolation | **Green** | Restart recovered global non-secret connections, model inventory/preferences and the disabled model preference. Session secret disappeared; secure and environment sources behaved as defined. Restarting the project process against copied `project-b` showed the same global connections. The only project-local files created by this qualification are Chat files under `project-a/.dope/chats`; no connection, model, role or routing file exists in either project's `.dope/`. |
| J — 7C absence | **Green** | AI Center exposed Connections and Models only—no Roles surface or role policy. The versioned registry's top-level keys are exactly `connections`, `models`, `revision`, `version`; source/state scans found no Follow Interactive migration, fallback-routing policy or role file. The exact Chat turn and Software Map tests remain explicitly selected-target, no-fallback behavior. |

## Bounded P9 repairs

Direct qualification found three small 7B defects. No 7C policy, routing, role or delegation work was added.

1. A new optional-credential Local connection incorrectly defaulted the form to Session-only, producing a false missing-credential state. The form now offers and defaults to explicit `none` for optional providers; secret input is hidden for `none`.
2. `Return to Chat` used widget activation, which found the originating Chat but timed out when that widget did not accept focus, leaving AI Center visible. It now uses the shell's reveal operation. The repaired browser round-trip and exact real-model turn passed.
3. The Test Connection reserve of eight tokens allowed GPT-OSS reasoning to consume the entire response and return no visible text. The still-bounded synthetic probe now reserves 64 output tokens. The real Local probe then completed; its request remains one `Reply with OK.` message with no project data.

The existing provider-setup test was aligned with the P5 inventory controller so it exercises central model reconciliation and current registry revisions rather than bypassing the authoritative inventory path.

## T3 validation and package evidence

| Evidence | Result |
| --- | --- |
| Focused 13-file AI/registry/credential/provider/AI Center/Chat/synthesis convergence suite | **140/140 pass** on final production source, serialized with `--test-concurrency=1`. |
| Real LM Studio eligibility exercise | **Pass**: `p9-gpt-oss` and `openai/gpt-oss-20b` eligible at 4,096; none eligible at 4,097. |
| `npm run check` | **Pass** once on the final source: typecheck; runner 95/95; baseline 11/11; local-install 1/1; product 289/289; Software Map initialization 28/28; IDE 1/1; browser and Electron builds each finished with zero errors. |
| `npm run codex:phase:validate -- p7b` | **Pass**; P1-P10 grammar/version sequence is valid, P9 is browser-required at `0.7.22`, and P10 is the manual closeout. |
| `npm run package:linux` | **Pass**. Its packaging script rebuilt Electron by design and emitted `dist/linux/Dope-0.7.22.AppImage`. |
| AppImage inspection | ELF x86-64, executable mode 755, 191,070,029 bytes, SHA-256 `87cb23635de99983680ffc786f444d668ae1f2d125bf5396ac35d3a0ac83efb4`; packaged `resources/app.asar.unpacked/lib/backend/native/keytar.node` is present. |
| Native AppImage launch | **Pass for isolated no-project startup**: packaged backend listened, 91 plugins deployed, and the frontend reached `ready`. The process was then stopped from its qualification terminal. |
| Electron secure store | **Pass** under Electron `42.8.1`: OS keyring set/get/delete round trip succeeded and deletion left the entry absent. |
| Version/framework/no-lock/diff checks | All live versions/internal references are `0.7.22`; Theia `1.75.0`, Electron `42.8.1`, React `19.2.8`; no root lockfile; `git diff --check` is part of final checkpoint validation. |

## Recorded limits and residual evidence

1. **Recorded credential absence, not Not Green:** no explicit real OpenAI or Gemini test credential was available, so no paid hosted Test Connection was made. The prompt explicitly permits this outcome. Setup validation, credential-source behavior, distinct provider identity, consent and feature-probe boundaries were still exercised without substituting project data.
2. **Native UI observation limit:** the AppImage reached a ready no-project frontend, and Electron-native secure persistence was exercised independently, but the enabled computer-use surface did not expose the native Electron window for a second launcher click. The required bottom-left launcher/singleton interaction was directly exercised in the built browser application. This does not block P10, but P10 should retain the distinction rather than calling the packaged launcher separately observed.
3. No Phase 5, Phase 6, P12/P13 or `c7-chat-conversation-ux` retained result was rerun or reclassified. Product Phase 7 remains active and not final because 7C is absent.

## P10 eligibility

The P9 direct matrix is Green on one coherent `0.7.22` candidate. P10 is eligible to advance to `0.7.23` and perform its evidence-only A-H audit. It must decide the formal Phase 7B Qualified/Not Qualified status from this evidence, retain the two recorded limits above, preserve all historical qualification results, and must not implement 7C.
