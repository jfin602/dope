# /prompt-ass — p10 Unified Roadmap & Local-First AI Planning

**Date:** 2026-10-12 (America/Chicago)
**Status:** SOURCE-INSPECTED / ASSESSED / NOT OWNER-ACTIVATED
**Entry:** Phase 9: owner-closed Green at qualified 0.9.35 source af3447c; Phase 10 coherent version-only 0.10.0 baseline 2fc3b93c01ed56b5c848e80181d630c390f3e551. Phase 10 DESIGN APPROVED only, not owner-activated or qualified.
**Activation gate:** separate explicit owner-approved `docs/planning/p10/activation.md` is REQUIRED before P1. Neither baseline nor this request authorizes implementation.

## Actual source and risk findings

- **Sources/ownership:** `docs/roadmap/mvp-roadmap.md`, phase plan/closeout Markdown, `known-issues.md`, `ProjectMindStore`, `PlanningStore` remain independent facts. A new Roadmap index may own stable checkpoint IDs and explicit links, not another copy of writable phase prose. Source hashes/unsupported grammar must prevent loss or fabricated Gate Green.
- **Mutation:** Project Mind, Planning Maps, Chat, Work, History and evidence have separate owners and revisions. `ProjectPlanningActions` uses root handle+expected revision, deterministic schema/dependency validation, per-owner atomicity, affected-object notifications, explicit approval and honest cross-owner partial outcomes.
- **UI:** source `frontend-module.ts`, `physical-map-widget.ts`, `software-map-widget.ts`, `planning-map-controller.ts` are existing patterns. The Roadmap belongs in center; checkpoint details/editing in a Software Map-style left inspector; Ideas/Issues detached. ADR 0016 October 12 restrained-orange, keyboard, narrow and alternate-theme isolation mandatory.
- **Chat:** Existing `ChatPanelWidget`, `ChatPanelController`, `ChatOpenOwners`, `ChatService`, `ChatRepository`, `ChatContextComposer` and `ChatBackend` are the *only* Chat runtime. Extend typed evidence and finished-turn proposal orchestration, not new Roadmap Chat mode/provider/transcript. Same saved Chat and lease must work left/right/bottom/center, including real center split without auto-open/reposition.
- **Local model/security:** 4,096 total input+instructions+output reserved when measured supported; strict JSON without tools, one action at a time, bounded retries/cancel. Model output is untrusted; it cannot run files/commands/AgentTask/MCP/hosted fallback or approve historical gates. P16 must prove genuine connected LM Studio and no silent egress, not mock-only.
- **Mind/Planning/History:** Mind Notes/Ideas/Questions/Decisions remain discoverable/recoverable and editable by original owner before any launcher retirement. Planning Map adoption/rebase/WorkItem status stay independent; History remains read-only and old Session evidence stays historical.

## Task partition

| Prompt | Target | Tier | Model | Smallest coherent seam |
| --- | --- | --- | --- | --- |
| P1 | 0.10.1 | T2 | GPT-6 Sol High | Read-only Roadmap source inventory |
| P2 | 0.10.2 | T2 | GPT-6 Sol High | Revision-safe project-local Roadmap store |
| P3 | 0.10.3 | T2 | GPT-6 Sol High | Shared validated planning action boundary |
| P4 | 0.10.4 | T2 | GPT-6 Sol High | Project Mind Ideas and external Issues references |
| P5 | 0.10.5 | T2 | GPT-6 Sol High | Planning Map basis-safe references |
| P6 | 0.10.6 | T1 | GPT-6 Sol Medium | Truthful checkpoint and branch projection |
| P7 | 0.10.7 | T1 | GPT-6 Sol High | Center Roadmap tab and accessible graph UI |
| P8 | 0.10.8 | T1 | GPT-6 Sol High | In-place checkpoint detail inspector and manual editing |
| P9 | 0.10.9 | T1 | GPT-6 Sol Medium | Ideas and Issues pools with safe promotion |
| P10 | 0.10.10 | T2 | GPT-6 Sol High | Reuse ChatContextComposer for roadmap evidence |
| P11 | 0.10.11 | T2 | GPT-6 Sol High | Selection Follow and Pin in normal ChatPanel |
| P12 | 0.10.12 | T2 | GPT-6 Sol High | Preview and apply untrusted conversational proposals |
| P13 | 0.10.13 | T2 | GPT-6 Sol High | Small-context local planning transport and JSON fallback |
| P14 | 0.10.14 | T2 | GPT-6 Sol High | Protect Project Mind access before navigation retirement |
| P15 | 0.10.15 | T2 | GPT-6 Sol High | Cross-owner and Chat safety integration |
| P16 | 0.10.16 | T3 | GPT-6 Sol High | Manual real UI/local model qualification and Phase 10 closeout |

**Dependency order:** P1 source preview -> P2 durable identity -> P3 validated actions -> P4/P5 owner adapters -> P6 projection -> P7–P9 manual UI -> P10–P13 existing Chat/local planning -> P14 safe Mind navigation -> P15 targeted T2 integration -> P16 independent manual T3.

**Efficiency audit:** Each P1–P14 ordinary action is one owner/UI/Chat seam, <=8 minute target including focused tests (10 soft/15 hard); security/revision cross-owner T2 justifies bounded extra. P15 is dedicated integration, P16 sole real GUI/full aggregate with permitted longer duration. Source-compiled test dependencies only, add each new test to root test:product once, avoid unconditional npm run check on P1–P15. Existing Git source paths are inspection starting points, not guaranteed APIs. If framework prevents actual center split/local inference, report NOT GREEN rather than introducing a special Chat or silently dropping a gate.

**Outcome:** 16-contiguous prompt stack, versions 0.10.1–0.10.16, final manual P16; documentation only. Neither Phase 10 implementation nor owner closeout/Phase 11 activation is authorized.
