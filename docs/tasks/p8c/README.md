# Product Phase 8C — Sequential Task / Phase-Stack Execution

Status: **GREEN / QUALIFIED / CLOSED** at `0.8.20`; see [P7 closeout](closeout.md).
Execution folder: `p8c`
Product slice: Phase 8C — Sequential task / phase-stack execution
Starting product version: `0.8.13`
Qualified Phase 8B source: `bd0b6ff`
8B docs-only closeout: `c11756e`
Version range: `0.8.14` -> `0.8.20`

## Goal

Replace the useful sequential behavior of the external phase runner inside Dope using provider-neutral AgentTaskSequence orchestration over the already-qualified Phase 8B Agent Runtime and ADR 0028 mutation boundary.

8C imports a real prompt stack, executes implementation tasks in order, creates verified Dope-owned checkpoint commits, stops honestly at failures/manual gates and resumes from durable sequence state plus Git truth.

## Stack

| Prompt | Version | Boundary | Tier | Model | Browser |
| --- | --- | --- | --- | --- | --- |
| P1 | 0.8.14 | AgentTaskSequence domain + PhaseStackAdapter import | T1 | GPT-6 Sol High | no |
| P2 | 0.8.15 | Sequence persistence + Git/version resume reconciliation | T2 | GPT-6 Sol High | no |
| P3 | 0.8.16 | Sequential execution + capacity retry | T2 | GPT-6 Sol High | no |
| P4 | 0.8.17 | Dirty-tree basis + Dope-owned checkpoint commits | T2 | GPT-6 Sol High | no |
| P5 | 0.8.18 | Manual/browser gates + external completion reconciliation | T2 | GPT-6 Sol High | no |
| P6 | 0.8.19 | Minimal Phase Stack workbench | T1/T2 | GPT-6 Sol Medium | no |
| P7 | 0.8.20 | Phase 8C dogfood qualification and closeout | T3 | GPT-6 Sol High | yes |

## Entry gate

Phase 8B is Green / Qualified for the corrected direct AgentTask scope at `0.8.13`. The 8C implementation must reuse ExecutionWorkspace -> CandidateDelta -> Authority/ToolExecutor promotion and must never restore provider-direct project mutation or provider-owned Git commits.

Before execution:

`npm run codex:phase:validate -- p8c`

## Scope law

8C owns sequence/import/resume/checkpoint orchestration. It may add Dope-owned staging/commit only after successful 8B promotion and validation.

8C must not add WorkItem delegation, DevelopmentSession, multi-agent orchestration, local-agent qualification or Phase 10 alignment.

## Closeout routing

P7 closes Phase 8C only. The next step is a fresh Phase 8D General Scoped Delegation docs review.
