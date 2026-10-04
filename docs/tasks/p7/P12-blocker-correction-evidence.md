# P12 blocker correction — supplemental evidence

Status: **Green for the three requested P12 blockers** at unchanged package `0.7.12`. This supplements, and does not change, the historical **Not Green** P12 record. Replay used the full disposable `/tmp/dope-p7-blocker-replay.j13VRh/adaptive-seo-dope` copy; the original Adaptive SEO workspace was not modified.

## Root cause and correction

Local Chat previously discovered only OpenAI-compatible `/v1/models` IDs and advertised every ID as conversational without a context capacity. `ChatContextComposer` consequently used the Chat policy fallback of 8,192 input tokens even when LM Studio had selected GPT-OSS loaded with a 4,096-token context. The Local adapter now joins those IDs conservatively to LM Studio native `/api/v1/models` LLM keys or loaded-instance IDs, uses the minimum known positive `loaded_instances[].config.context_length` for any instance that may execute, and marks embeddings, unloaded models and unknown-capacity models unusable for Chat. It never uses theoretical `max_context_length` as loaded capacity.

Normal Chat turns now pass the positive `reservedOutputTokens` through the provider-neutral request to Local `max_tokens`, Gemini `maxOutputTokens`, or OpenAI Responses `max_output_tokens`. A zero reserve continues to omit the provider limit. The existing context composer algorithm and policy defaults are unchanged.

Changed source: `packages/contracts/src/model-runtime.ts`, `packages/theia-extension/src/node/conversational-providers.ts`, `packages/theia-extension/src/node/chat-backend.ts`, and `packages/theia-extension/src/node/openai-conversational-provider.ts`. Focused guards: `test/unit/conversational-providers.test.ts`, `test/unit/chat-context-composer.test.ts`, and `test/unit/openai-conversational-provider.test.ts`. No Flow or shutdown product code changed.

## Focused automated validation

- `@dope/contracts`, `@dope/chat`, and `@dope/theia-extension` workspace builds passed.
- Five focused test files (`conversational-providers`, `model-connections`, `chat-context-composer`, `chat-backend`, `openai-conversational-provider`): 23 distinct tests passed. An initial test-only assertion failed because automatic title generation made a second request; the affected `chat-context-composer` file then passed 5/5. The Local provider file passed 7/7 after the final inventory guard. No unrelated suite was run.
- `npm run package:linux` passed once, including its Electron build. New `dist/linux/Dope-0.7.12.AppImage` SHA-256: `a81a68d742fcfd2924e90e23d284e95637a42988395457f519bd21a6681c7807`.
- Exact root/workspace versions and internal `@dope/*` references remained `0.7.12`; no root `package-lock.json`; `git diff --check` passed.

## Live Local capacity and useful Flow context

LM Studio native inventory initially had no loaded models. The already installed `openai/gpt-oss-20b` was loaded at 4,096 context for this replay. Native inventory then reported one loaded LLM instance, ID `openai/gpt-oss-20b`, with `config.context_length: 4096`. Dope's real Local connection exposed that model as usable with `contextWindowTokens: 4096` while the unloaded Qwen models and embedding did not become usable Chat models.

The disposable Adaptive SEO copy's accepted Architecture and fresh Physical Map produced generation 1, `project:root`, input fingerprint `58fc8593deff6dc19603466388be8380ce5a44237c85d892370e9a14a215b845`, partial analysis without errors, 4,420 nodes, 2,501 Flow facts, and 135 Flow endpoints. The GET `/api/workspaces/:workspaceId/projects/:projectId/opportunities` input's bounded downstream query returned eight source-evidenced facts: `receives`, `invokes`, three `reads`, and three `responds`. The query itself was not truncated.

The live Chat replay used the same Dope backend connection, composer, repository, and selected model path as the product. Chat `maxInputTokens` was 8,192 and `reservedOutputTokens` was 1,024. Preview budget was **3,072** input tokens, with **3,068** estimated used. The selected Flow context was truncated to 8,892 bytes and an additional repository file was explicitly omitted by the budget. The composed text retained the route handler, `AdaptiveRepository.list`, all four interaction kinds, and evidence IDs. A 10,000-character user message was rejected with `Message exceeds selected model input budget` before any Chat message was persisted.

The context-heavy turn completed on the exact selected GPT-OSS model without fallback. Its durable user message retained a `flow` reference to the GET opportunities endpoint with `projectId: project:root` and generation `1`; the assistant execution recorded selected and actual `openai/gpt-oss-20b`. The provider limit for this normal turn was the same positive 1,024-token reserve used in preview; focused provider tests verify the native request fields. This replay was through the built Dope backend services against the real LM Studio runtime and full project copy, rather than the packaged GUI.

After the replay, the GPT-OSS instance was unloaded to restore LM Studio's initial all-unloaded state.

## Packaged normal close

Launched the newly built AppImage with isolated profile/config and the disposable Adaptive SEO workspace. Its backend and frontend reached `ready`. The real X11 window (`0x06400004`, main PID `205654`) received `wmctrl -ic`, a normal window-manager close request. The AppImage main process exited **0** without SIGTERM or kill. The log reported `Stopping backend contributions` followed by `All backend contributions have been stopped`; no processes from that AppImage mount or isolated profile remained. The pre-existing separate Dope session was left running.

Residual blocker among these three gates: **none**. This one-off does not requalify all of P12 or Phase 6 and does not revise the historical P12 evidence.
