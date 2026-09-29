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

The initial September 28, 2026 request approved Phase 2 documentation/planning. The subsequent explicit instruction "Proceed with Phase 2 despite Phase 1 being Not Qualified" supplies the separate sequencing waiver. `docs/planning/p2/activation.md` records the decision and coherent committed `0.2.0` source; the p2 stack is eligible for execution. Phase 1 failures and all Phase 2 qualification rules remain intact.

Before execution, verify the recorded waiver, reachable activation source `a7bf2cf4e5b6a7ce70dec8e5989ddee17dae4781`, coherent baseline/applicable predecessor version and clean intended tree. The documented qualification-or-waiver entry condition is satisfied; do not require Phase 1 Green as an additional prerequisite. Do not rely on version markers to prove qualification. P1 advances `0.2.0` to `0.2.1` only through successful implementation and checks.

After activation, p2 P1-P4 are runner-owned; P5 is the manual interactive GUI handoff; P6 is evidence-only closeout. Versions are `0.2.1` through `0.2.6`. A successful manual P5 is committed exactly as `0.2.5` before resuming closeout; an incomplete GUI run remains a checkpoint, not a success marker. The final P6 audit remained Not Qualified; the owner later accepted the retained gaps for sequencing and closed Phase 2 without relabeling them Green.

## Phase 3 activation

Product Phase 3 uses execution folder `p3` and coherent package baseline `0.3.0`. The owner explicitly closed Phase 2 for sequencing on September 28, 2026 while preserving its Not Qualified audit and evidence gaps. `docs/planning/p3/activation.md` records the Phase 3 authorization and activation source.

P3 versions are `0.3.1` through `0.3.6`. P1-P4 were runner-owned, P5 was the direct interactive Planning dogfood handoff, and P6 was evidence-only closeout. Phase 3's `0.3.6` applicable-scope audit remains Qualified in `docs/tasks/p3/closeout.md`, but its live Planning runtime was subsequently removed by completed correction `c3-remove-planning-instruments`. Historical Phase 1/2 Not Qualified evidence remains intact.

The Phase 3 product runtime contained no AI provider. ADR 0006 now applies to future Phase 6 AI Presence; it never authorized OpenAI/Codex/local-model integration in Phase 3.

## Phase 4 activation

Product Phase 4 uses execution folder `p4` and coherent package baseline `0.4.0`. The completed `c3-remove-planning-instruments` closeout is the entry gate; no additional Phase 3 compatibility work is required.

P4 versions are `0.4.1` through `0.4.6`. P1-P4 are runner-owned implementation/integration prompts, P5 is the direct interactive "Dope maps Dope" GUI handoff, and P6 is evidence-only closeout. P5 must inspect the real Dope repository through the actual Theia GUI and trace representative physical relationships/violations to source evidence; automated/headless checks do not replace its direct interaction evidence.

Phase 4 has no model/provider runtime and no target/planning graph. It must preserve the distinction between developer-authored architecture declarations/constraints (canonical project state) and extracted physical graph/index data (rebuildable derived state). Phase 5 introduces Visual Software Planning; Phase 6 introduces AI Presence.

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

Current aggregate commands:
- `npm run test:runner` exercises the phase-runner regression suite.
- `npm run test:baseline` checks Theia/version/composition invariants.
- `npm run test:product` builds the Dope extension packages and runs current Project Mind/product unit suites.
- `npm run test:ide` runs the IDE discovery fixture.
- `npm test` composes runner, baseline, product and IDE suites.
- `npm run typecheck` builds current domain packages and typechecks the Theia extension.
- `npm run check` composes typecheck, all current tests, browser build and Electron build.
- `npm run test:restart` remains separate integrated restart/process evidence.

Phase 4 prompts must add software-model/code-analysis suites to the real aggregate commands as capabilities land. Do not treat unit/build success as direct GUI or packaged-native qualification.

## Closeout truth

A closeout audits evidence and decides whether the bounded gate qualifies.

Foundation Spike 0 closeout decides whether Theia qualifies as the substrate.

It does not owner-close future product phases or qualify future model/provider integration.
