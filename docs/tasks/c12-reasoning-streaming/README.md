# c12-reasoning-streaming — Chat activity, final answers and diagnostic copy

**Owner decision:** 2026-10-31. **Status:** DOCS APPLIED / ASSESSED / PLANNED / PROMPTS AUTHORED ONLY; NOT RUN / NOT QUALIFIED. **Package:** 0.12.7 unchanged.

**Decision:** Reasoning/provisional output is visible while working and persistently inspectable but is not the final assistant answer and must never contaminate next-turn context. Completed answers are visually primary after reasoning collapses; cancelled turns show no invented final. Right-click on any Dope-owned Chat/related transcript Copy control exposes a scoped **Copy with Reasoning** option, with normal left-click semantics preserved.

[ADR 0042](../../decisions/0042-chat-reasoning-lifecycle-and-diagnostic-copy.md) · [Assessment](prompt-assessment.md) · [Plan](implementation-plan.md) · [Existing agentic Chat permissions](../../planning/p12/agentic-chat-permissions.md).

| Prompt | Execution | Scope |
| --- | --- | --- |
| [P1](P1-stream-activity-contract.txt) | Runner | Typed provider/Pi stream classification, terminal semantics and bounded saved activity |
| [P2](P2-chat-activity-presentation.txt) | Runner | Distinct live/collapsed activity UI, cancellation, context/reopen/scroll regressions |
| [P3](P3-copy-with-reasoning.txt) | Runner | Shared right-click context menu and clean/diagnostic scoped serializers |
| [P4](P4-manual-browser-closeout.txt) | **MANUAL, Codex browser** | Live exact-source UX, cancel/reasoning/context/copy and separate owner-native qualification |

**Operator:** On the owner's actual checkout, confirm HEAD, dirty changes and active C12 planning-recovery work before invoking anything. Run `npm run codex:phase:validate -- c12-reasoning-streaming` first, then with separate explicit owner Run invoke `npm run codex:phase -- c12-reasoning-streaming`. The default runner executes P1-P3 and stops; **do not use --closeout**. Perform P4 separately with the in-app Codex browser and capture actual observed evidence. No /activate. No automated browser claim, no self-commits in prompts; runner owns passing implementation commits.

**Required negative replay:** a cancelled src/counter.js increment(1) turn with twelve repeated provisional/reasoning paragraphs is one inspectable, bounded activity, zero fake final answers, excluded from future context and clean copy, available via right-click Copy with Reasoning. Test provider-exposed thinking where available, text-only providers, successful final, interruption, redaction, truncation, old-chat restore and per-turn chronological copying. A missing provider thinking channel means **not available**, never fabricated.

**Authority:** This is a ChatPanel and streaming correction, not a new Chat, Work, Pi loop, Roadmap owner, document writer, security grant or feature version. Preserve the c12-planning-recovery manual cleanup and historical failed Planning evidence, existing agentic Pi tool/Ask/Allow security, source provenance, History, Work candidate flows and independent native qualification gaps. Do not change any project Roadmap data.
