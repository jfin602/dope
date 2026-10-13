# Product Phase 7 Prompt Assessment

Status: **PHASE 7A P1-P12 READY / P13+ REASSESS AFTER P12**
Activation source/package baseline: `59c7f72a29dcdecdf9b908176754bfd02179b004`, `0.7.0`
Authority: ADR 0004, ADR 0006, ADR 0022, ADR 0025, ADR 0026, Phase 7 plan/activation, PRODUCT-MODEL, ARCHITECTURE, stability contract

## Conclusion

Use the existing P1-P12 as the Phase 7A execution/qualification stack. The prior 13-prompt assessment remains valid through P12, but ADR 0026 supersedes the written P13 closeout. After P12, reassess the actual runtime/registry/UI implementation and regenerate the contiguous P13+ continuation for AI Center, roles/routing, integrated qualification and one new final closeout.

| Prompt | Boundary | Tier | Model |
| --- | --- | --- | --- |
| P1 | pure `@dope/chat` domain + service DTOs | T1 | GPT-6 Sol High |
| P2 | `.dope/chats/` repository/store + analysis isolation | T1 | GPT-6 Sol High |
| P3 | Chat service/backend/RPC lifecycle | T2 | GPT-6 Sol High |
| P4 | multi-area ChatPanel + selector | T2 | GPT-6 Sol High |
| P5 | live ownership + restoration | T2 | GPT-6 Sol High |
| P6 | conversational Model Runtime contracts + connections registry | T2 | GPT-6 Sol High |
| P7 | Local + Gemini conversational adapters | T2 | GPT-6 Sol High |
| P8 | OpenAI conversational adapter | T2 | GPT-6 Sol High |
| P9 | composer + per-turn model + Chat settings | T2 | GPT-6 Sol High |
| P10 | bounded context composer + saved-chat retrieval | T2 | GPT-6 Sol High |
| P11 | Ask/Explain/Trace/Find Related + auto-title + integrated browser build | T2 | GPT-6 Sol High |
| P12 | direct GUI/live-provider/restart/package qualification | T3 | GPT-6 Sol High |
| P13+ | **TBD after P12: AI Center + roles/routing + integrated qualification + final closeout** | TBD | TBD |

P1-P12 versions remain exactly `0.7.1` through `0.7.12`. P13+ remains in the same `0.7.<prompt-number>` family and is assigned only when the continuation is regenerated after P12.

## Why these splits are efficient

- P2 owns filesystem correctness only; P3 consumes it through typed service/RPC instead of debugging store + Theia wiring at once.
- P6 establishes the generic runtime/registry once; P7 reuses existing Local/Gemini transports; P8 adds the new OpenAI path without making one prompt touch three provider implementations plus core contracts.
- P10 owns context collection/budget/provenance; P11 consumes that stable seam for user-facing AI behaviors and title generation.
- P12 is the Phase 7A live-provider/direct-GUI/restart/package gate. The regenerated continuation should reuse that evidence where valid, then add only the new AI Center/routing evidence required by ADR 0026 before final integrated closeout.

## Current source constraints

- `model-runtime.ts` is structured-generation-first and currently narrows usage provider kind to Local/Gemini; general Chat needs future-extensible connected-model identities while preserving sMap structured generation.
- existing LM Studio/Gemini classes are synthesis-scoped; their transport/runtime mechanics may be reused, but sMap prompts/selection are not Chat authority.
- no OpenAI product adapter exists yet; Node 24 `fetch` is sufficient unless implementation can justify an SDK.
- current WidgetFactory patterns support custom center widgets; ChatPanel needs a multi-instance factory with focused files, not more state in `dope-workbench.ts`.
- ProjectMindStore/Visual Planning storage provide prior art for containment/revision/locks; Chat must preserve its own domain and nested folder semantics.
- typed JSON-RPC/callback patterns already exist; browser state must receive normalized Chat/runtime events, never provider-native stream objects.

## Security/authority constraints

- provider tokens/API keys are environment/session secrets, never project Chat state or ordinary plaintext StorageService;
- selected-model failure never falls back silently;
- Phase 7 tools are read/context only;
- conversation never becomes Project Mind/Architecture/Planning/physical truth implicitly.

## Execution-efficiency rules

Every implementation prompt uses the shared preflight below. Do not reread the full roadmap/ADR set unless the prompt explicitly names a decision or current source contradicts the accepted plan.

Shared preflight:
- read BOOT, AGENTS, this assessment/plan, the current prompt, the immediately preceding p7 commit/result, and only the directly affected source/tests;
- require reachable activation baseline `59c7f72a29dcdecdf9b908176754bfd02179b004`, the expected predecessor version, clean intended Git state, Node 24, no root package-lock, Theia 1.75.0, Electron 42.8.1 and React 19.2.8;
- preserve Phase 5/6 historical evidence and the Phase 7 read-only authority boundary.

Testing rule:
- ordinary prompts run focused tests plus the narrowest affected package build/typecheck;
- do not run browser builds merely for reassurance; P11 owns the first integrated browser build and P12 owns aggregate/browser/Electron/package qualification;
- no live provider calls before P12;
- phase validation is run before Phase 7A execution and again in P12; the regenerated P13+ continuation is separately validated before it runs;
- after a repair, rerun only evidence invalidated by that repair.
