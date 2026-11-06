# Phase 13 — Chat output-limit continuation contract

**Authority:** [ADR 0052](../../decisions/0052-chat-generation-limit-continuation.md) (2026-11-06). **Status:** approved design, docs/prompt authoring only, **not shipped/qualified**. **Product version:** 0.13.8 unchanged. **Correction:** [c13-output-limit](../../tasks/c13-output-limit/README.md). Preserve [ADR 0042](../../decisions/0042-chat-reasoning-lifecycle-and-diagnostic-copy.md), [Chat visual contract](../../ui/chat-panel-visual-contract.md), and [ADR 0051](../../decisions/0051-roadmap-work-evidence-lifecycle.md).

## Exact observed regression

The original FireLaunch comprehension run on Dope 0.13.8 / `079f9a8ff121e8b65181bf8711b33f4f6bbf7308` used local GPT-OSS 20B, context window 16,384, output cap 2,048. It issued `list_files` (truncated), `read_file AGENTS.md` (first 4,096 bytes, truncated), `search_text "project description"` (truncated), and `read_file README.md` (first 4,096 bytes, truncated). After 3m32s it ended with `finishReason=length` (2,041 reported final tokens / 2,048 allowance; 5,437 provider total tokens), reported provider text present and saved no answer. Qualification NOT GREEN, delivered-score 10/100. Counts are evidence for that run, not universal provider guarantees.

## Lifecycle and truth

- Keep one canonical Chat/assistant execution owner and IDs. Distinguish `streaming`, `paused-output-limit`, `complete`, `stopped-incomplete`, `cancelled`, `failed`, and `interrupted`, or implement an equivalently explicit backward-compatible state model. A length stop does not become `complete`. Stop under the policy is not a normal successful answer or a hidden failure.
- Preserve exact already observed answer text as a bounded partial-answer projection distinct from committed `assistant.content` and distinct from typed reasoning/provisional/tool activity. A continuation appends only verified novel answer bytes. If only reasoning is available, show the pause without inventing answer text.
- Do not store partial answer text in completed conversation history, implicit next-turn assistant context, automatic title, ordinary search, clean final-response copy or any Roadmap intent parser. Existing diagnostic copy may include its bounded, sanitized, labeled partial text. Only an actual successful completed stop promotes the final answer to canonical content.
- Persist selected model, actual model/provider, finish reason, token usage where available, segment count, source/tool provenance, interruption and explicit owner choices. Old Chat records must parse without migration failures or retroactive completion claims. No secret/provider raw payload leakage.
- Only the active execution owner/lease may change paused state, answer offsets or resume/stop. Reject stale, repeated, wrong-project and wrong-message decisions idempotently. A new user turn must never silently discard a paused turn or use its incomplete text as context.

## Provider/Pi continuation

- Separate context-window budget, per-segment provider `max_tokens` and target final-answer length; never interpret `finishReason=length` as evidence of input-context overflow. Measure provider-reported reasoning/final usage separately where trustworthy; use unavailable labels otherwise.
- Inspect Pi 1.4.0 capabilities and existing Dope session/worker ownership before adding a continuation path. Hold the **same logical session** and already-observed tool results across a bounded pause. Do not achieve apparent continuation by silently re-prompting the original task, cloning the project or replaying file/tool/command effects.
- A resumable chunk may require a bounded explicit continuation instruction **inside the retained Pi session**. Treat it as control material, not a new user authorization. Preserve trusted tool broker, source hashes, Ask/Allow, model identity and actual assistant transcript; reject unsupported continuation honestly instead of faking it.
- Track segment boundaries and novel text to prevent duplicate emission, transcript growth and bogus final concatenation. Tool calls from a resumed segment require ordinary fresh broker authorization, not replay of prior results.
- Keep automatic continuation finite (implementation to set and test a conservative segment/aggregate-token ceiling). At a safety ceiling, stop incomplete or ask for an explicit further decision; never spin or silently overrun. The policy may not enlarge a provider's per-request/model limit.
- Restart/connection drop cannot be called seamless native continuation when its live session is gone. Persist incomplete evidence and truthful interruption; a later *explicit* retry may reconstitute a new execution only if its distinct identity/provenance is clearly marked. Cancellation wins races against resume.

## Owner-facing UX and settings

- Immediately above the Chat composer, show a nonblocking message “Generation limit reached. Stop generating?” and **Stop** / **Continue generating**. The partial answer stays visible with an unmistakable incomplete label. Preserve scrolling, focus, draft, narrow panes, settings sheet, reduced motion and theme semantics. Model/owner switching should not leave a clickable stale banner.
- `Ask each time` is the default for existing/new Chats. `Allow each time` automatically starts bounded same-session continuation, with visible status; if an absolute safety ceiling is reached, show an explicit limit outcome. `Cancel each time` immediately stops generation at this limit and leaves an inspectable incomplete result. Decisions must survive reload as outcomes, not replay as side effects.
- Snapshot policy on Send. No automatic prompts for successfully completed responses. Reasoning-only exhaustion follows the same choice without inventing private reasoning. Command approvals remain separate.

## Answer quality and performance

- Supply concise-answer guidance for ordinary Chat: generally target <=1,000 final tokens, usually <2,000, with an override for explicit detail. Do not hard-stop a user's longer answer for stylistic reasons. No universal increase to `max_tokens`, duplicate summarizer calls, forced second research pass, truncation masquerading as completion, or reuse of partial answer as a source-of-truth summary.
- Record source-verified before/after per-segment output tokens, reasoning tokens where reported, elapsed time, tool calls, provider finish reasons, continuity/duplication checks, and whether an output was completed or merely inspectable. Avoid claiming a speedup without timings.

## Qualification contract

T1/T2 cover serialization/schema compatibility, broker identity, output/usage accounting, reasoning-only length, zero/partial text, duplicate deltas, repeated caps, cancellation races, restarting a paused session, auto policy ceiling, tool non-replay, source/provenance/permissions and unchanged existing successful Chat/Planning/Roadmap paths. T3 is the **single final manual Codex browser** checkpoint: real UI Ask/Allow/Cancel, pause above composer, Stop/Continue, narrow/theme/keyboard/reload, real model length and actual tool trace. Re-run FireLaunch verbatim read-only, never copy/clone/modify the repo. Compare complete-answer survival and factual comprehension against 10/100 independently; separate retrieval quality (which was poor at baseline) from output handling. Preserve previous NOT GREEN without retroactive reinterpretation.
