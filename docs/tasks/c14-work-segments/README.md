# c14-work-segments — Segmented Work conversation

Status (2026-11-25): **P1 implemented on dirty local source; independent P2 retry NOT GREEN; P2-R1 repair prompt authored only / NOT RUN**. Product version `0.13.11` unchanged. This is a forward correction to the completed `c14-work-redesign` scope, not a replay or edit of its executed P1–P4 prompts or qualification records.

Authority: [Work conversation amendment](../../ui/work-conversational-session-contract.md#forward-amendment--2026-11-25-one-work-conversation-multiple-pi-sessions), [ADR 0030](../../decisions/0030-chat-work-ui-and-agentrun-transcript-presentation.md#forward-amendment--2026-11-25-segmented-work-conversation), [workflow](../../workflow.md#forward-work-conversation-segments--2026-11-25-documentation-design), and the owner's 2026-11-25 request. Preserve `c14-work-redesign` P4's scoped browser PASS and its uncommitted report/screenshots as historical evidence.

| Prompt | Purpose | Operation |
| --- | --- | --- |
| [P1](P1-implement-segmented-work-conversation.txt) | Implement one Work conversation with ordered fresh Pi segments, same composer, inline authority and focused tests | Separate manual implementation task |
| [P2](P2-independent-browser-closeout.txt) | Independently qualify the finished implementation in a real connected browser | Separate manual browser closeout, only after P1 |
| [P2-R1](P2-R1-repair-and-replay.txt) | Repair P2's preserved-evidence and composer defects; run a targeted real-browser replay, then hand off to an independent full P2 retry | Later manual correction, authored only |

The original owner-selected stack had exactly two prompts. P2-R1 is a later repair request and does not rewrite those prompt bytes or their results. P1 is one cross-layer implementation deliverable rather than an eight-minute runner slice; give it sufficient time and report PARTIAL/BLOCKED honestly if it cannot finish safely. Validate prompt grammar before use, but do **not** invoke `codex:phase` or auto-run a follow-on task. The owner starts each prompt deliberately. Neither prompt authoring nor implementation grants Roadmap GREEN, Phase completion, a version advance, or a qualification PASS. Runner/agent self-commit is not part of this manual route.

The independent [P2 retry report](qualification/2026-11-25-p2-independent-browser-retry.md) found that a verified no-effect Pi denial could start a new same-conversation segment, but the earlier Error disclosure, full final text and visible run ID disappeared from the aggregated transcript. It also observed a misleading recovery-required state, a disabled Review button after typing, a provider-error follow-up, and an empty model selector after backend restart. The [first P2 attempt](qualification/2026-11-25-p2-independent-browser-blocked.md) remains a separate blocked record. P2-R1 requires a narrow source repair and targeted browser replay; final P2 qualification remains independent on the repaired exact source.

At authoring, local HEAD was `5a067c1875ba4018e9c9c784d7237115b79d508d` with owner-dirty c14 Work UI/test edits, the c14 README, and untracked P4 report/screenshots. The three approved forward design documents are also dirty. P1 must inspect the actual tree again and preserve all of this work; remote main is not a substitute for local source.
