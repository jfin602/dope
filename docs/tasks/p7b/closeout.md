# Product Phase 7B — AI Center closeout

Status: **QUALIFIED / CLOSED** for Phase 7B at coherent `0.7.23` (October 4, 2026). Product Phase 7 remains **ACTIVE / NOT FINAL**: Phase 7C role policies and routing are outstanding. This is an evidence-only closeout of the `0.7.22` P9 candidate plus the version/documentation transition; it does not rerun P9's T3 matrix or authorize 7C behavior.

## Exact implementation and evidence lineage

Pre-task HEAD: `8cd79061c4887575253cd93d92e3e90aab24da46` (`0.7.22`, P9 manual checkpoint). The phase runner, not this task, owns the `0.7.23` commit.

| Prompt | Version | Exact checkpoint | Retained result |
| --- | --- | --- | --- |
| P1 | `0.7.14` | `c8e8ecc5694e441e87ec7453d987166c3cceb85e` | Domain/contracts; 13 focused tests passed. |
| P2 | `0.7.15` | `3f861c29d852330320adb5f897ee6d9b103c3a68` | Registry, concurrency/migration; 40 focused tests passed. |
| P3 | `0.7.16` | `1b8b083b42c80772c5519d44329c0836262f0511` | Credential boundary; 20 focused tests passed. |
| P4 | `0.7.17` | `12becd2eb797db7f921dce68c4f5fe2975e2f99f` | Provider setup/runtime; 31 focused and 11 baseline tests passed. |
| P5 | `0.7.18` | `2a5086f3843a1385159cd6bd7697cf99e26341b2` | Inventory, health, testing/eligibility; 26 focused tests passed. |
| P6 | `0.7.19` | `edcfb55579f7967cea7a3d6bac97052f7f8fb34b` | AI Center/launcher; focused tests and extension/browser builds passed. |
| P7 | `0.7.20` | `eaefb041e573d1d908e0e27ece626ce935bfd66e` | Chat convergence; 49 focused tests passed. |
| P8 | `0.7.21` | `d0f8ff2abde4d851f4c3486d80765740fa27c60e` | Software Map convergence; typecheck and 105 focused tests passed. |
| P9 | `0.7.22` | `8cd79061c4887575253cd93d92e3e90aab24da46` | Direct qualification matrix Green after bounded P9 repairs; see `P9-ai-center-qualification-evidence.md`. |

## A–H audit

| Item | Decision | Evidence and scope |
| --- | --- | --- |
| A — domain identity/lifecycle/provider independence | **Green** | P1's `@dope/ai` contracts and P9's duplicate Local connection, independent OpenAI/Gemini/compatible identities, stable ID on edit, reversible Disable/Enable and Remove; model preference survives refresh. No provider-native identity owns the connection. |
| B — global registry/revision/concurrency/migration | **Green** | P2's versioned machine-local store and migration tests; P9's shared no-project/two-project inventory, two-process live propagation and revision-25 stale writer rejection against revision 26. No registry state was written in either project. |
| C — credential sources/no plaintext | **Green** | P3/P9 exercised session-only loss on restart, environment status, OS-secure persistence/removal across processes and a native Electron keytar set/get/delete; unavailable secure store rejects persistence. Four secret sentinels were absent from scanned registry, projects, logs, outputs and repository. This is bounded negative evidence, not a universal claim about all possible secrets. |
| D — provider setup/runtime/locality | **Green** | P4/P9 covered distinct Local/LM Studio, OpenAI, Gemini and OpenAI-compatible setup/activation and explicit Local-versus-hosted classification. Real Local execution succeeded; hosted credential and paid hosted execution were not available and are not claimed. |
| E — inventory/health/Test Connection/eligibility | **Green** | P5/P9 covered refresh, retained disabled/known models, normalized health, real synthetic Local Test Connection with latency/usage, and filter-only eligibility at 4,096 but not 4,097 context. Generic testing does not establish feature-specific readiness. |
| F — singleton/launcher/no-project | **Green** | P6/P9 directly opened and reopened one AI Center center tab using the bottom-left launcher in a built browser window with no project. Settings retains account access; the launcher warns only on actionable state. Packaged native launcher clicks were not separately observed. |
| G — Chat and Software Map convergence | **Green** | P7/P8/P9 show Chat repair via AI Center and return to its originating panel, exact-model real Local Chat turn with durable provenance, and explicit no-fallback when the selected connection is disabled. Software Map consumes central identities while retaining selected target, project/target hosted consent, structured-output probe, warm-up and synthesis strategy; generic Test Connection cannot grant synthesis readiness. |
| H — integrated isolation/restart/release/package | **Green** | P9 exercised two independent backend/window processes, global live updates/stale rejection, session/secure restart semantics, no-project and copied-project isolation. Its final-source 140/140 focused suite and `npm run check` passed; `npm run package:linux` emitted the `0.7.22` AppImage with keytar, which reached a ready no-project frontend. This transition advances version/docs only; it does not assert a rebuilt `0.7.23` package or a native launcher interaction. |

## Residuals and disposition

- No explicit real hosted credential existed for P9: paid OpenAI/Gemini Test Connection, hosted synthesis and hosted quota were not observed. Provider setup/credential status and feature-consent guards were tested without sending project data. Retain this as bounded evidence, not a passing hosted execution claim or a blocker under the P9 gate.
- The native AppImage started to frontend `ready` and its secure keyring was exercised under Electron `42.8.1`; the native Electron window was not exposed for a separate launcher click. The browser application supplied direct launcher/singleton/no-project UI evidence. Do not conflate these observations.
- P9's three repairs (optional Local credential default, Chat reveal, and bounded 64-token synthetic probe) are part of its `0.7.22` checkpoint, not new P10 fixes. No role policy, role UI, fallback, delegation or routing was introduced or qualified.
- Retain Phase 5 owner-closed P11 Not Green/P12 unexecuted, Phase 6 owner-closed P8 Not Qualified, Phase 7A P12/P13 and `c7-chat-conversation-ux` results exactly as recorded in their own closeouts. This Phase 7B decision does not reclassify any of them or declare Product Phase 7 Green.

**Decision:** All A–H are Green within the stated 7B gate and evidence limits. Phase 7B is **Qualified / Closed**; Product Phase 7 remains **Active / Not Final**. Next route: `/docs-review` for Phase 7C authority and prompt planning (or the already-promoted `p7c` prompt-planning route if approved); do not execute 7C implementation as part of this closeout.
