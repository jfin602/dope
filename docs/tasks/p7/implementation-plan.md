# Product Phase 7 Implementation Plan

Status: **PHASE 7A P1-P12 READY / P13+ REPLAN REQUIRED BY ADR 0026**
Activation source/package baseline: `59c7f72a29dcdecdf9b908176754bfd02179b004`, `0.7.0`
Authority: Phase 7 plan/activation, ADR 0004/0006/0022/0025/0026, prompt assessment

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
- phase validation is run before execution and again in P12; after P12 the regenerated P13+ continuation must be validated before execution;
- after a repair, rerun only evidence invalidated by that repair.

## P1 — Chat domain + service DTOs (`0.7.1`) — T1
Create `@dope/chat` pure contracts/parsers/helpers, including Chat/message/execution/settings/context refs/folder semantics and provider-neutral ChatService DTO/client contracts. No filesystem/Theia/provider code.

## P2 — ChatRepository persistence (`0.7.2`) — T1
Implement `.dope/chats/` readable nested persistence, revisions/atomic writes, containment, locks/leases/recovery, moves with stable identity, interrupted-turn recovery and explicit `.dope/chats` physical-analysis isolation. No Theia RPC.

## P3 — Chat service/backend (`0.7.3`) — T2
Implement ChatService operations/events and dedicated Theia backend/RPC over the P2 repository. Keep transport thin and provider-free.

## P4 — ChatPanel + selector (`0.7.4`) — T2
Add multi-instance ChatPanel in left/right/main/bottom, Select Chat/Chat states and folder/chat organization projection. No composer runtime yet.

## P5 — ownership/restoration (`0.7.5`) — T2
Add one-live-panel-per-Chat registry, backend lease integration, focus-existing/release and supported restoration/race handling.

## P6 — Model Runtime + connections (`0.7.6`) — T2
Extend provider-neutral conversational contracts and add the application Model Connections registry/service, connected-model inventory and secret-safe configuration. No provider implementation changes beyond compilation adapters needed for the new interface.

## P7 — Local/Gemini chat adapters (`0.7.7`) — T2
Generalize existing Local/Gemini runtime transports for conversational streaming while preserving Software Map synthesis behavior and selection.

## P8 — OpenAI chat adapter (`0.7.8`) — T2
Add the first-reference OpenAI Responses API conversational adapter behind P6 contracts. Keep Dope Chat authoritative and provider response/session IDs optional adapter metadata.

## P9 — composer + Chat settings (`0.7.9`) — T2
Implement transcript, always-present two-row composer, per-turn connected-model selector, send/cancel/retry lifecycle and persistent per-Chat model/context settings.

## P10 — bounded context composer (`0.7.10`) — T2
Compose typed/bounded current file/selection, Project Mind, Architecture/Physical/Flow, Planning and saved-Chat context with project guards, budgets and durable provenance. Saved-chat retrieval is deterministic/bounded.

## P11 — read-only AI Presence behaviors (`0.7.11`) — T2
Wire context toolbar actions plus Ask/Explain/Trace/Find Related and non-blocking automatic titles through the common Chat path. Run the first integrated browser build here.

## P12 — qualification (`0.7.12`) — T3
Directly dogfood multi-panel durable Chat, multiple real models where available, no-fallback failure, context/provenance, restart/isolation and package/native exact-candidate behavior. Own the broad aggregate checks.

## P13 — superseded closeout slot
The previously written `0.7.13` evidence-only closeout is superseded by ADR 0026 and must not execute. After P12, reassess the actual P6-P12 Model Connections/runtime/UI implementation and regenerate a contiguous P13+ continuation for Phase 7B AI Center, Phase 7C role routing, integrated qualification and exactly one new final Phase 7 closeout. Preserve already-executed P1-P12 history; do not disguise the follow-on as a correction stack.

## Expected production shape

```text
@dope/chat -> Chat domain + ChatRepository + ChatService
@dope/contracts -> structured + conversational Model Runtime contracts
@dope/theia-extension
  -> Chat backend/context adapters
  -> Model Connections + provider adapters
  -> multi-instance ChatPanel/composer/settings
```

No provider-native canonical conversation, mutation/delegation, or Phase 8 background alignment. Phase 7B/7C extend this production shape with AI Center over the same Model Connections registry plus user/application-scoped `AIRolePolicy`; they must not create a second provider store or weaken Software Map/Phase 8 authority constraints.
