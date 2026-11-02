# C1 — Pi prompt diet

**Disposition: GREEN for deterministic prompt composition and regression scope.** No live model or browser qualification was needed: the only product change shortens redundant ordinary Chat prose. It does not change Roadmap grammar, Work instructions, tool definitions, context selection, budgets or authority checks. Byte savings are measured provider-request bytes, **not token savings**.

## Source and measurement boundary

- Entry/final committed HEAD: `35c0e3fc12ddd34e6fdfbd95f19af64d58aed3e0`, branch `main`, package version `0.12.7`. Entry working tree was clean. Final C1 files are uncommitted; no other source was modified.
- Read `AGENTS.md`, `BOOT.md`, `docs/workflow.md`, C0 architecture/risk/measurements and C2-R6 closeout. C2's scoped Green and R4-B's separate visual gap remain as recorded.
- `node scripts/measure-c1-prompt.mjs` opens the actual bundled Pi worker with its isolated resources and registered tools, intercepts the exact OpenAI-compatible serialized request at `fetch`, and returns only component labels, UTF-8 byte counts and hashes. The provider is synthetic and performs no inference. Fixtures use no private prompt or project source. The fixture digest was identical before and after (`44240c31f15bb1d7b0ee068d28581895e99e69c35482c77536ef15c8fbfb7b27`). Work's fixed prompt is mirrored from its current source template; selected Roadmap content is a small synthetic identity fixture. These sizes are representative first requests, not a production-session distribution or exact-token measurement.
- Pi's SDK combines its base prompt and Dope system messages into one provider system message. The intercepted request includes the base prompt, Dope instructions, current Skill and grammar when applicable, history, user/context payload and real tool schemas. The composer preview alone excludes the Pi base prompt and tool schemas.

## Composition audit

| Path | Provider-bound composition | Observed overlap and decision |
| --- | --- | --- |
| Ordinary Chat | Pi base prompt; Dope Pi grounding/root reminder; user turn; five Chat read/search/approved-command tool schemas. | Pi's base prompt already directs evidence-driven tool use. Dope's reminder repeated this at length. Condensed the reminder while retaining successful-read grounding, path-versus-content distinction, attachment truth and read-only authority. |
| Project-aware Chat | Same system/tools, plus saved complete exchange(s) under the existing history budget and a file question; source arrives through brokered tool results. | No automatic source body is inserted for local Pi. History selection and tool schemas were left intact. |
| Protected Roadmap | Current `/roadmap` Skill system instruction; Pi/root reminder; schema-2 Gate grammar; selected Roadmap identity/context in the user message; five Chat tool schemas. | Skill body is 885 bytes and Gate grammar is 4,345 bytes in this fixture. Some reviewed-action language overlaps, but both layers bind different contracts. No grammar or Skill edits were justified without a live protected proposal check. |
| Work | Pi base prompt; one user prompt with task ID, HEAD, candidate SHA-256, Dope review authority and approved command ID/kind; five Work tool schemas. | Fixed reference is 378 bytes in this fixture. Basis, grant and validation language remains useful; no safe independent deletion was established. |

The current Roadmap grammar still defines the exact schema-2 envelope, action types and required fields, temporary IDs, source revisions, linked Markdown limits, review semantics and no-action path. Protected `/roadmap` binding and all backend parsing/approval checks remain unchanged. Work still binds the candidate and approved commands and Dope still controls execution, validation and promotion. Source reads/search/paging and command-output continuation remain available. No tool ceiling, output limit, history algorithm, compaction rule, context router or tokenizer estimate changed.

## Before and after: UTF-8 provider request bytes

| Scenario | Before | After | Saving | Saving % | Messages | Tool schema bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Ordinary Chat | 2,945 | 2,795 | 150 | 5.09% | 2 | 1,885 |
| Project-aware Chat | 3,107 | 2,957 | 150 | 4.83% | 4 | 1,885 |
| Protected Roadmap | 8,586 | 8,436 | 150 | 1.75% | 2 | 1,885 |
| Work | 2,810 | 2,810 | 0 | 0.00% | 2 | 2,112 |

The unchanged fixture digest, message counts and tool-schema byte counts establish a like-for-like comparison. Pi merges all system instructions: its serialized system content fell from **793 to 643 bytes** in ordinary/project-aware Chat and **6,118 to 5,968 bytes** in protected Roadmap. Work stayed **83 bytes**. The Dope Pi instruction including the fixed fixture root fell from **493 to 343 bytes**; that alone accounts for each 150-byte request reduction. User/context and history content bytes did not change (ordinary user 58; project-aware history 73 and user 84; protected user/context 267; Work user payload 407 as serialized by Pi). No component increased. Exact model tokenizer counts and current provider-reported usage were unavailable for these offline fixtures. Historical C2 records include provider-reported **3,622** input tokens for Q1 Chat at `5e1d2de` and **4,735** for a later Q1 replay at `82a8aab`; those runs used different source/turns and are not C1 before/after token evidence.

## Implementation and qualification

- Condensed `PI_CHAT_INSTRUCTION` in `chat-context-composer.ts`. The instruction still states that files are not automatically read/attached, file claims require successful read/search results, a path is not content, attachments must be real and project tools are read-only without separate authorization. The existing composer charges this shorter string through its unchanged conservative serialized-byte budget.
- Added a composer regression for the budgeted Pi message and updated two Roadmap tests that matched the prior wording exactly. The tests continue to verify tool discovery and protected context placement.
- `npm run build:extension` passed. Focused Chat, Skills, Roadmap action/context, Pi worker and Work tests passed **45/45**. Roadmap local budget/strict JSON tests passed **21/21** in a separate run. A combined run saw an intermittent `ENOTEMPTY` temporary Chat-directory cleanup race in `roadmap-local-model.test.ts`; an isolated first rerun hit the same race in another case, and the subsequent isolated run passed 21/21. This was a test-fixture cleanup failure, not a prompt assertion failure; no product change was made for it.
- Existing tests cover protected Skill identity, selected-context fail-closed behavior, schema/no-action/approval semantics, Work command and candidate boundaries, read/search tools, exact history/compaction and budget checks. This is deterministic qualification only. No local-model call, browser workflow or native GUI check was run.

## Remaining overhead and C3 readiness

The 4,345-byte Roadmap grammar and 885-byte protected Skill remain the largest audited static Chat blocks. They carry high-risk action and linked-source contracts; a future reduction would need a bounded live proposal check. Five tool schemas cost 1,885 Chat or 2,112 Work bytes before any tool result, but removing schemas would remove capability. Saved history and large source results can dominate later turns; C1 deliberately did not change their selection or summarize them.

C3 may assess explicit context recovery/compaction on its own authorization and evidence, using the current C2 retrieval contract. C1 does not qualify C3 or justify changing the conservative provider-input reserve.
