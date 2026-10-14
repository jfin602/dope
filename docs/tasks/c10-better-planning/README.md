# c10-better-planning — readable local planning Chat

**2026-10-14 status:** AUTHORED ONLY / NOT IMPLEMENTED / NOT QUALIFIED. **Mode:** Correction 10. **Package:** `0.10.16` unchanged.
**Authority:** ADR 0016/0030/0036/0037, Phase 10 plan, this assessment and plan.
**Goal:** The existing ChatPanel should never leave a *completed local planning turn* as only a naked `roadmap-intent` / `no-action` JSON message. Make trusted machine activity compact, gray and expandable; present an accurate short final explanation with useful questions, and lightweight event-backed progress, without a second model call.

| Prompt | Primary scope | Tier | Model | Browser required |
| --- | --- | --- | --- | --- |
| [P1 — Activity contract](P1-machine-activity-contract.txt) | Classify already validated local structured results and preserve raw/provenance | T2 | GPT-6 Sol High | no |
| [P2 — Compact activity](P2-compact-chat-activity.txt) | Existing ChatPanel collapsible activity presentation | T1 | GPT-6 Sol Medium | no |
| [P3 — Outcomes/progress](P3-outcomes-and-progress.txt) | Verified turn summaries, next questions and real state updates | T2 | GPT-6 Sol High | no |
| [P4 — Integration](P4-planning-integration.txt) | Cross-seam safety, restart, locality and zero-extra-inference tests | T2 | GPT-6 Sol High | no |
| [P5 — Live closeout](P5-live-chat-closeout.txt) | Scoped real Qwen/browser/native proof and one correction closeout | T3 | GPT-6 Sol High | **yes** |

Contiguous P1–P5; P5 is the **only** final correction gate. Implementation P1–P4 may run through the existing phase runner, but P5 must be run manually with actual browser/native tools. Running the stack supplies authorization; **no `/activate` command** or activation-only gate. Runner/user manages commits; implementation agents must not self-commit. Verify actual local source/version/dirty state before any mutation. `npm run codex:phase:validate -- c10-better-planning` is a grammar check, not evidence of behavior.

**Trust contract:** Strict single JSON local model output remains buffered/validated; proposals do not execute tools or write before human approval. A model intent means “proposed / awaiting review” until an independently confirmed apply; rejection/error/cancel/stale/no-action must be described truthfully. Unrecognized or malformed JSON stays visible rather than being silently hidden. Original raw payload remains inspectable and copyable. Never emit invented disk checks or success messages. Progress comes from actual Chat/action lifecycle events, not an extra model generation per tool call. Preserve one saved dockable Chat, revision/hash/approval authority, local-only inference and project isolation.

**Qualification dependency:** Complete `c10-horizontal-color` including the outstanding targeted semantic-zoom disclosure repair and P11 visual closeout, then this stack P1–P5. Only **after the entire correction chain completes** run a **fresh full manual Phase 10 qualification** in `c10-roadmap-qualify/manual/P9`–`P13` (all five families) and P14 final exact-source aggregate. The historical three-cycle P9 NOT GREEN remains immutable, as do P16/P19 NOT GREEN. Phase 10 stays NOT OWNER-CLOSED; Phase 11/12 inactive.

**Efficiency:** P1–P4 target <=8 minutes implementation and focused validation (10 soft / 15 hard); no repeated full npm check, full browser/Electron builds or broad model context comparison. P5 scoped live smoke is the manual T3 exception. Manual P14 owns the one aggregate after all correction and full qualification gates. No package bump/lockfile churn.
