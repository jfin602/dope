# Product Phase 7 Prompt Assessment

Status: **APPROVED / READY FOR EXECUTION**
Activation source/package baseline: `59c7f72a29dcdecdf9b908176754bfd02179b004`, `0.7.0`
Authority: ADR 0004, ADR 0006, ADR 0022, ADR 0025, Phase 7 plan/activation, PRODUCT-MODEL, ARCHITECTURE, stability contract

## Conclusion

Use nine ordered prompts.

Phase 7 is a durable **read-only AI Presence** stack. Keep pure Chat truth separate from filesystem/backend integration; keep reusable ChatPanel construction separate from ownership/restoration; establish the general conversational Model Runtime before wiring the composer; then integrate bounded project context and AI behaviors before one expensive direct qualification.

| Prompt | Boundary | Tier | Routing |
| --- | --- | --- | --- |
| P1 | `@dope/chat` pure domain/contracts | T1 | GPT-6 Sol High |
| P2 | `.dope/chats/` persistence + service/backend + lease/conflict safety | T2 | GPT-6 Sol High |
| P3 | multi-area ChatPanel + Select Chat organization UI | T2 | GPT-6 Sol High |
| P4 | one-live-panel ownership + restoration/race behavior | T2 | GPT-6 Sol High |
| P5 | conversational Model Runtime + Model Connections + OpenAI/Local/Gemini adapters | T2 | GPT-6 Sol High |
| P6 | transcript composer + per-message model selector + per-Chat settings | T2 | GPT-6 Sol High |
| P7 | bounded context composition + saved-chat search + Ask/Explain/Trace/Find Related + auto-title | T2 | GPT-6 Sol High |
| P8 | Dope dogfooding, multi-model/failure/restart/package qualification | T3 | GPT-6 Sol High |
| P9 | evidence-only Phase 7 closeout | T3 | GPT-6 Sol Medium |

Versions are exactly `0.7.1` through `0.7.9`.

P1-P7 are runner-owned implementation/integration prompts. P8 is a browser/manual handoff and records durable direct evidence. P9 is final evidence-only closeout.

## Current source findings

- The activation baseline is coherent `0.7.0`; ten existing live manifests/internal references and `theia-baseline.test.ts` were advanced without product behavior changes.
- There is no current `@dope/chat` package or durable project Chat service. Create a distinct domain rather than treating Project Mind or Theia/provider session state as conversation authority.
- `packages/contracts/src/model-runtime.ts` is intentionally minimal and structured-generation-first. Its usage provider kind is currently closed to `local | gemini`; Phase 7 needs a future-extensible connected-model descriptor and conversational/streaming capability without breaking structured synthesis.
- `LmStudioSynthesisProvider` and `GeminiSynthesisProvider` are synthesis-scoped adapters. Reuse/refactor transport/runtime primitives where useful, but do not make their Software Map setup/selected model the general Chat connection authority.
- `SoftwareMapController` persists non-secret synthesis choice metadata through application `StorageService`, while entered tokens/API keys are cleared/transient and environment credentials may be used. Follow that safety direction: Chat provider secrets do not belong in `.dope/` or ordinary persisted workbench JSON.
- `@dope/theia-extension` currently has no OpenAI runtime adapter. For the Phase 7 first reference hosted integration, use the current OpenAI Responses API through a provider adapter; provider conversation/response IDs remain adapter metadata and Dope Chat supplies canonical conversation history.
- Node 24 provides `fetch`; adding an OpenAI SDK is not required merely to prove the adapter. If implementation chooses an SDK, justify the dependency and keep its types behind the adapter.
- `frontend-module.ts` already registers WidgetFactory-backed center widgets and singleton views. ChatPanel must be a focused multi-instance WidgetFactory/presentation path rather than adding more state to `dope-workbench.ts` or forcing a singleton `AbstractViewContribution`.
- `ProjectMindWidget`, Software Map widgets/controllers and Planning controllers show the existing workspace-switch/race lessons. Chat gets dedicated controller/widget files and project-generation guards.
- `ProjectMindStore` and Visual Planning storage are prior art for project-root containment, readable JSON, atomic replacement, revisions, locks, corrupt/future fail-closed handling and external recovery. Chat persistence should reuse principles, not copy a canonical Project Mind schema.
- ADR 0019 already excludes ordinary `.dope/` work state from generic physical-analysis inputs. Install a focused regression specifically proving `.dope/chats/` activity cannot affect Physical Map input identity or Planning Map semantic staleness.
- Current frontend/backend communication uses typed JSON-RPC service paths and callbacks. Chat streaming should use typed events/deltas over a dedicated service/client contract, not provider-native SSE/WebSocket objects in browser product state.
- Phase 7 does not require Agent Mind, ProposedAction, Tool Runtime or mutation authority. Do not re-expand scope from older roadmap wording that is no longer in the approved Phase 7 plan.

## Architecture decisions

### One Chat domain

Create `packages/chat` / `@dope/chat`.

It owns provider/framework-independent Chat identity, messages, settings/context policy, folders/path metadata, message/turn status, context-reference provenance, deterministic ordering, title-source semantics, strict parsing/validation and service DTOs.

Do not make Chat a `ProjectArtifact`. Do not make provider response IDs or panel/widget IDs Chat identity.

### Persistence shape

Persist beneath `.dope/chats/` with real nested organization folders and stable Chat IDs independent from paths. Exact bundle/file format may be selected during implementation, but it must be readable, versioned, safely movable, atomic/recoverable and support transcripts/settings without one global provider-owned database.

User messages are committed before provider execution. Assistant turn state must distinguish pending/streaming/complete/failed/cancelled so restart/provider failure cannot fabricate a complete answer. Avoid rewriting durable storage for every streamed token; persist lifecycle boundaries/final content and recover interrupted pending turns honestly.

### Panel shape

`ChatPanel` is presentation only. Use stable per-instance IDs/options so multiple panels can exist in `left`, `right`, `main`, and `bottom`. Provide explicit supported commands/actions to open a new ChatPanel in each area. Selector/folder changes update every panel through the shared service.

A frontend open-owner registry handles same-workbench focus/reveal. Backend/store revision/lease safety handles cross-window/process duplicate writers. Layout restoration cannot create a second active writer.

### Model connections and runtime

Extend the ADR 0022 runtime rather than replacing it.

Introduce provider-neutral connected model descriptors/capabilities and conversational streaming requests/events. Preserve structured generation for sMap. The general Model Connections registry is application/user state and separately configured from Software Map synthesis.

Reference adapters:
- OpenAI: Responses API, stateless with respect to Dope Chat identity; discover/list usable models conservatively and stream visible response text/usage/errors.
- Local/LM Studio: OpenAI-compatible local model discovery/chat transport, reusing safe endpoint/token/readiness concepts without importing sMap synthesis instructions.
- Gemini: existing SDK transport generalized behind the same conversational capability boundary.

No adapter fallback. A selected model failure remains that turn's visible failure until the developer explicitly chooses Retry/another model.

### Context composition

Chat context is bounded application orchestration, not provider memory.

Frontend contributes current editor/selection as explicit workspace-scoped context. Backend/application adapters resolve Project Mind, Architecture/Physical Map/Flow, Planning and saved-Chat references through their existing service/domain authorities. Every included item gets a typed provenance reference. Validate project/path identity before reading source.

Saved-chat retrieval in this phase may be deterministic lexical/title/content search with strict result/token bounds; semantic embeddings are not required.

### Automatic titles

After the first successful exchange, attempt a small title request using the same selected runtime/model for that exchange only. It must not block the chat and must not switch providers on failure. Fall back deterministically to a bounded first-user-message title. Once `titleSource=user`, never auto-overwrite it.

## Preserved behavior / non-goals

- Preserve sMap synthesis behavior and explicit synthesis provider selection.
- Preserve Project Mind, Architecture, Physical Map, Flow and Planning authority/persistence.
- Preserve ordinary IDE/workbench layout and existing map/panel behavior.
- No provider-native conversation as canonical state.
- No plaintext project credential persistence.
- No mutation-capable Chat tools, process/Git actions, autonomous coding or Phase 8 background alignment.
- No automatic promotion from Chat into canonical project state.
- No all-chat bulk injection into model requests.

## Validation concentration

P1 uses T1. P2-P7 use bounded T2 only where contracts cross persistence/backend/presentation/runtime/context seams; each prompt must still use the smallest focused command set. P8 alone owns aggregate `npm run check`, restart, real-provider GUI, phase validation, AppImage/native evidence and exact-candidate multi-project replay. P9 reuses valid P8 evidence and reruns only the coherence-transition minimum.
