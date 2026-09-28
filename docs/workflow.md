# Repository Workflow

Status: CURRENT WORKFLOW CONTRACT

Dope adopts the mature repository workflow pattern proven in George while using Dope-specific product and architecture contracts.

## Session bootstrap

Read BOOT.md, AGENTS.md, and the narrowest relevant current docs before substantial repository-aware work.

## Documentation workflow

/docs-review -> explicit approval -> /docs-apply

/docs-review investigates current repository/doc state, identifies conflicts/gaps, and proposes a bounded documentation change.

/docs-apply applies only the approved documentation change and keeps authority docs mutually consistent.

Do not silently convert discussion into repository authority.

## Implementation planning workflow

/prompt-ass -> /prompt-plan -> /prompt-write <folder>

Do not jump from a substantial idea directly to implementation prompts.

### /prompt-ass

Owns task decomposition, preserved behavior, dependencies, prompt order, deferred work, risks, model routing, and required evidence.

### /prompt-plan

Inspects actual source/tests and traces producers/consumers, state ownership, framework adapters, authority boundaries, persistence, UI/domain seams, likely files, failure modes, and validation.

### /prompt-write

Distills the accepted plan into the smallest precise execution brief.

Do not copy planning analysis wholesale.

## Repository implementation model routing

Forward-looking implementation-prompt baseline is GPT-6 Sol.

New executable prompts use:
- GPT-6 Sol Medium: default for ordinary implementation, focused refactors, tests, docs implementation, and ordinary closeout
- GPT-6 Sol High: architecture-sensitive work, broad behavior, difficult debugging, persistence/authority/security boundaries, framework integration, or work that materially benefits from deeper reasoning
- GPT-6 Sol XHigh: exceptional escalation for unusually ambiguous or failure-prone work

Do not use Terra for new Dope prompts.

Do not use XHigh as the routine default.

Historical/compatibility labels retained inside the ported runner keep their original meaning. New Dope prompts must not use them.

The runner maps GPT-6 Sol labels to gpt-6-sol and requires Codex CLI >= 0.155.0.

This section governs how the Dope repository is currently built.

It is not a product-runtime architecture decision.

Use of Codex/GPT-6 Sol in the development workflow must never be interpreted as requiring Dope itself to depend on OpenAI, Codex, one model family, or one provider. Product runtime provider independence is governed by ARCHITECTURE.md and ADR 0004.

## Planning philosophy

> Plan richly; prompt sparsely; validate rigorously.

## Phase runner

Dope ports the George/Petri phase runner into:
- scripts/codex-phase.mjs
- scripts/codex-phase-core.mjs
- scripts/validate-codex-phase.mjs

Validate:

npm run codex:phase:validate -- <folder>

Run implementation:

npm run codex:phase -- <folder>

Run implementation plus closeout:

npm run codex:phase -- <folder> --closeout

The runner owns prompt parsing, concrete model/reasoning routing, Codex compatibility checks, Git staging/commit boundaries, package-version verification, resume semantics, browser/manual handoff gates, and run artifacts.

Implementation agents must not create commits when invoked by the runner.

## Phase 0

Dope explicitly supports p0 for Foundation Spike 0.

Package versions for p0 prompts are 0.0.<prompt-number>.

The repository starts at 0.0.0.

The final prompt in every phase stack is a closeout prompt.

Foundation Spike 0 is a Theia substrate qualification. It does not need implementation prompts for actual model/provider integration merely because the repository runner itself uses Codex.

## Phase 1

Product Phase 1 uses execution folder `p1`.

Its explicit activation baseline is package `0.1.0`. The phase runner therefore expects:
- no completed prompts -> `0.1.0`;
- P1 -> `0.1.1`;
- P2 -> `0.1.2`;
- and so on.

Phase 1 qualifies Dope as an Electron IDE through combined evidence: P4 proves packaging/native launch and P5 directly exercises the real Theia GUI on the Dope repository, using browser-hosted workbench or Electron. Headless/CDP-only evidence cannot substitute for P5 interaction.

## Phase 2 preparation and activation

The September 28, 2026 owner request approves Phase 2 documentation, assessment, planning and prompt writing. It does not authorize running p2 or waive the Not Qualified Phase 1 prerequisite. `docs/tasks/p2` is prepared, execution blocked. Grammar validation is safe now: `npm run codex:phase:validate -- p2`.

Before execution, resolve Phase 1 qualification and reconcile its evidence with the approved Phase 2 docs, or record a separate explicit owner sequencing waiver with retained failures. Activation is a separate recorded change: exact parent/activation SHA, coherent `0.2.0` versions for root/all workspaces/internal dependencies/baseline tests, committed clean tree. Do not rely on runner version markers to prove qualification.

After activation, p2 P1-P4 are runner-owned; P5 is the manual interactive GUI handoff; P6 is evidence-only closeout. Versions are `0.2.1` through `0.2.6`. A successful manual P5 is committed exactly as `0.2.5` before resuming closeout; an incomplete GUI run remains a checkpoint, not a success marker. See `docs/tasks/p2/README.md` for the prerequisite and commands.

## Prompt metadata

Every prompt contains exactly one canonical model recommendation:
- Recommended configuration: GPT-6 Sol Medium.
- Recommended configuration: GPT-6 Sol High.
- Recommended configuration: GPT-6 Sol XHigh.

Every prompt contains exactly one:
- Browser required: yes.
or
- Browser required: no.

Use yes only when direct browser/GUI execution or visual evidence is genuinely required and cannot be completed truthfully by the ordinary CLI runner.

Browser-required prompts are manual handoff points.

## Corrections

Use c<phase>-<slug> for bounded repairs.

A correction keeps the current package version unchanged, repairs the defect, installs permanent executable regression coverage, runs broader affected-system validation, and preserves historical failure evidence.

A later pass does not erase an unexplained earlier failure.

## Material-gate rule

Return Planning needed only when the approved plan no longer safely fits current source, a trust/authority/security boundary is unresolved, framework reality invalidates approved architecture, or proceeding would silently change approved scope.

Routine cleanup and bounded repository hygiene should normally be repaired and validated.

## Evidence

Evidence states:
- Green
- Not Green
- Evidence Gap

Evidence Gap is not a pass.

Implementation completion and qualification are separate claims.

Owner acceptance of a gap is a waiver, not retroactive Green evidence.

## Stability questions

Every substantial task should answer:
1. What user-visible or aggregate behavior could accidentally change?
2. Which product/architecture boundaries must remain invariant?
3. What can only be proven through integrated framework/model/process/UI evidence?
4. What baseline is used?
5. What durable project knowledge should be updated?
6. Did UI/framework convenience accidentally become canonical product state?
7. Did implementation convenience accidentally create provider/model coupling?

## Test-command truth

At bootstrap:
- npm run test:runner exercises the ported phase-runner regression suite
- npm test currently aliases runner tests only
- npm run typecheck checks the TypeScript test/bootstrap surface
- npm run check composes typecheck plus runner tests

Product prompts must add explicit commands for product behavior they introduce.

Do not describe npm test as Theia, UI, provider, packaging, or integration qualification until it actually includes that coverage.

## Closeout truth

A closeout audits evidence and decides whether the bounded gate qualifies.

Foundation Spike 0 closeout decides whether Theia qualifies as the substrate.

It does not owner-close future product phases or qualify future model/provider integration.
