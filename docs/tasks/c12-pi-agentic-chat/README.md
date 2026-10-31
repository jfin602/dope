> **OWNER SCOPE SUPERSESSION (2026-10-31):** The rigid standalone `implementation-plan` and Planning-only `submit_plan` acceptance requirement is retired as a forward product goal; the live attempts remain historically NOT GREEN. [c12-planning-recovery](../c12-planning-recovery/README.md) P1 will clean up this experiment without removing the proven Pi Chat tools, Ask/Allow, History, Work or existing Roadmap editing. This notice documents scope; cleanup is not yet implemented or qualified here. Owner-native qualification remains outstanding.

# c12-pi-agentic-chat — full Pi agentic Chat + Commands Ask/Allow

**Status (2026-10-30): ASSESSED/PLANNED/AUTHORED ONLY. NOT RUN, NOT QUALIFIED.** Version `0.12.7` unchanged. [Forward contract](../../planning/p12/agentic-chat-permissions.md) · [Assessment](prompt-assessment.md) · [Plan](implementation-plan.md).

| File | Scope | Run |
| --- | --- | --- |
| [P1](P1-project-discovery.txt) | Pi Chat source read/list/search | Runner |
| [P2](P2-composer-permissions.txt) | Ask/Allow and command approval | Runner |
| [P3](P3-investigation-commands.txt) | Sandboxed investigation command tool | Runner |
| [P4](P4-agentic-planning.txt) | Planning, activity, Prepare Work | Runner |
| [P5](P5-manual-closeout.txt) | Browser + owner native qualification | MANUAL |

On the owner's actual local checkout: inspect `git status --short`, `git rev-parse HEAD`, coherent `0.12.7` and other active work before running. After distinct approval: `npm run codex:phase:validate -- c12-pi-agentic-chat`, then `npm run codex:phase -- c12-pi-agentic-chat` (P1–P4 only). No /activate. P5 must be operated separately and cannot be marked Green by a headless runner.

Preserve existing ChatPanel, Work/candidate/History authority, P12 prompts/evidence and native owner data. No unrestricted host shell, credential or network access, canonical Chat source writes, silent hosted fallback, model change, package/version bump or self-commit.
