# /prompt-ass — Phase 8E assessment

Date: 2026-10-09
Disposition: **ASSESSMENT COMPLETE / OWNER-ACTIVATED 2026-10-10; PREVIOUS P1 PREFLIGHT STOPPED WITH ZERO IMPLEMENTATION**
Prerequisite: 8D Green at version 0.8.33, qualified source 8748cb4870e8cac3d2a5aca4a05623b5f3d747ec, c8-fix P6 cycle 2. Original p8d P13 Not Green is retained.
Owner-authorized versions: 0.8.34 through 0.8.47, with 13 coordinated manifests and pinned internal dependency references advanced by each assigned prompt; docs alone do not change packages.

## The critical design split

The existing Dope AI Center Local connection has LM Studio model discovery, conversational inference and loaded-context metadata, but toolCalling/agentExecution remain unknown. A model producing tool-shaped text does not confer agent permissions. The existing Codex adapter is the *only* registered/allowed AgentExecutionAdapter. Local execution must add a narrow tool-brokering runtime with enforceable host containment, and only then expose capability.

Qualified Dope invariants must remain identical across providers: AgentTask, AgentRun, AgentTaskSequence, optional WorkItem origin, accepted ExecutionGrant, ExecutionWorkspace -> frozen CandidateDelta -> Dope-owned candidate validation -> Authority/ToolExecutor authoritative promotion, candidate review, durable transcript, cancellation, restart, Git/checkpoint and project identity. No background work, new permission class, canonical local state or silent local-to-hosted fallback.

## Implementation order and dependencies

- P1 (T1/High): strict normalized model tool-request/result schema and bounded fail-closed parsing, no execution.
- P2 (T2/High): **mandatory OS sandbox availability and adversarial proof**, isolated launcher and fail-closed absence. Required before any real local tool runs.
- P3 (T2/High): brokered project-workspace read/list tools, symlink/private-state/cwd denial.
- P4 (T2/High): create/modify against disposable candidate only, no project/Git writes.
- P5 (T2/High): brokered test/build process with OS confinement, sterile environment, no network; do not mistake an allowlist for kernel enforcement.
- P6 (T1/Medium): one bounded LM Studio `/v1/chat/completions` tool-turn transport with strict response validation/cancel, reusing approved local endpoint configuration.
- P7 (T1/Medium): actual loaded context/reserves and bounded request/tool-result budget.
- P8 (T2/High): finite multi-turn tool use coordinator with transcript observations, terminal/cancel/failure truth.
- P9 (T2/High): Local AgentExecutionAdapter lifecycle, cancel/dispose and dedicated task resources.
- P10 (T2/High): zero-project-data Local agent tool-loop probe and AI Center adapter-known eligibility, invalidate on load/reconfig.
- P11 (T2/High): deterministic role/exact-target selection and backend DI across Codex/Local, preserve hosted consent.
- P12 (T1/Medium): existing Work controls local eligibility and explicit model choice, no UX redesign.
- P13 (T2/High): source-backed cross-boundary tests, deny matrix and no-regression coverage; register new files in product aggregate once.
- P14 (T3/High, browser=yes): real Qwen/LM Studio or other actually tool-capable local model and disposable Git project, developer-controlled candidate review, denial/cancel/restart, comparative Codex evidence and final exact-source aggregate + closeout.

## Security-dependent sequencing / fail-closed exception

P2 is a security prerequisite, not a cosmetic spike. Until OS-level file/process/network isolation is proved on the actual supported host, do not claim Local agent eligibility, run model-issued commands or route Work/phase stacks to it. A refusal / Not Green is better than an unsandboxed fallback. This exception may exceed ordinary prompt timing; must not be split in a way that permits an unsafe partial implementation.

The existing `ExecutionWorkspace` is an isolated *clone* for candidate provenance but **does not by itself sandbox child processes**. The agent broker must enforce process isolation (including local loopback denial), symlink containment, private HOME/environment, Git-control denial and limits at runtime. The model endpoint stays reachable only through the trusted host transport, not from sandboxed tools.

## Validation economy / model routing

Implementation prompts each prove only the seam they add using nearest tests and changed-package compile required by lib imports; no whole-product build each prompt. Sol Medium for pure transport/context/Work UI, High for authority/persistence/OS/tool state. P2/P13 integrations and P14 GUI/release are separately justified larger gates. Every prompt states exact deferred capabilities and prior-source preservation. P14 is exactly one final closeout with all Green/Not Green truth, no premature activation/Phase 9. Actual implementation wall-time remains unmeasured until run.
