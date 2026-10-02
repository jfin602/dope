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

## Issue and feature registry workflow

Registry commands update the root issue/feature logs directly. They are bookkeeping commands, not substitutes for `/docs-review`, implementation planning, or qualification evidence.

### /issue <input>

Treat the supplied input as a reported product/repository problem and turn it into a complete new entry under **Open Issues** in `known-issues.md`.

- Generate a pseudo-random unique 4-character issue ID using the registry's restricted Base32 alphabet.
- Use the current date in the title: `### ID — YYYY-MM-DD — Issue title`.
- Write a complete entry from the available evidence and conversation context, normally including status, summary, observed behavior/context, expected behavior, relevant safety/authority boundaries, regression coverage, and user/developer impact when applicable.
- Preserve the user's report as the source of the problem statement. Distinguish observed facts from suspected causes or proposed fixes, and do not invent evidence.
- If the input is actually a product idea/general enhancement rather than a defect, route it to `/feature` instead of recording it as an issue.
- Apply the registry update directly, report the assigned ID, and include the complete final Markdown entry exactly as written to `known-issues.md` in the response as normal formatted Markdown text. Do not wrap the entry in a code block.

### /feature <input>

Treat the supplied input as a proposed product/repository capability and turn it into a complete new entry under **Proposed Ideas** in `feature-ideas.md`.

- Generate a pseudo-random unique 4-character feature ID using the registry's restricted Base32 alphabet and prefix it with `+`.
- Use the current date in the title: `### +ID — YYYY-MM-DD — Feature title`.
- Write a complete entry from the supplied idea and relevant context, normally including status, summary, description/behavior, constraints or boundaries, potential uses/value, and open questions when genuinely unresolved.
- Include enough detail that the entry can later feed `/docs-review` and implementation-prompt planning without pretending the idea is already approved architecture or implementation scope.
- Do not invent implementation evidence or silently promote the feature into roadmap authority.
- Apply the registry update directly, report the assigned `+ID`, and include the complete final Markdown entry exactly as written to `feature-ideas.md` in the response as normal formatted Markdown text. Do not wrap the entry in a code block.

### /resolve <ID>

Resolve the registry entry identified by its permanent ID. The ID determines which registry and lifecycle apply.

- Plain `ID`: locate the matching entry in `known-issues.md`, move it from **Open Issues** to **Resolved Issues**, set status to `Resolved YYYY-MM-DD`, and add/update a concise resolution summary plus the strongest available validation/evidence. Preserve the original ID, report date, and title.
- `+ID`: locate the matching entry in `feature-ideas.md`, move it from **Proposed Ideas** to **Shipped Ideas**, set status to `Shipped YYYY-MM-DD`, and add/update a concise shipped summary plus the strongest available validation/evidence. Preserve the original `+ID`, proposal date, and title.
- Use the current conversation and repository evidence to describe the resolution. Do not fabricate implementation or validation details merely to make the entry look complete.
- If the entry is already resolved/shipped, do not duplicate or reuse it; report its existing terminal state.
- If the ID does not exist, make no registry mutation and report that it was not found.
- `/resolve +ID` means the feature was completed/shipped. Deferred, rejected, superseded, or abandoned ideas require an explicit disposition rather than being falsely marked shipped.

## Implementation planning workflow

/prompt-ass -> /prompt-plan -> /prompt-write <folder>

Do not jump from a substantial idea directly to implementation prompts.

### /prompt-ass

Owns task decomposition, preserved behavior, dependencies, prompt order, deferred work, risks, model routing, and required evidence.

For every executable prompt, classify validation as T1, T2 or T3. Design stacks so expensive evidence is concentrated into explicit integration/qualification gates rather than repeated after every implementation step. Ordinary implementation prompts should target <=8 minutes and be split when coherent implementation plus T1 validation is unlikely to fit inside 15 minutes.

### /prompt-plan

Inspects actual source/tests and traces producers/consumers, state ownership, framework adapters, authority boundaries, persistence, UI/domain seams, likely files, failure modes, and validation.

Identify the smallest affected test surface from actual producers, consumers and package boundaries. Separate focused implementation evidence from evidence that can only be established at integration/qualification. Identify expensive commands and justify any required T2/T3 execution.

### /prompt-write

Distills the accepted plan into the smallest precise execution brief.

Include only validation commands justified by the accepted tier. Do not append `npm run check`, `npm test`, restart, packaging or all-build commands as boilerplate. State deferred qualification evidence when relevant, and keep ordinary executable prompts small enough for the <=8-minute target / 15-minute budget.

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

## Execution-time and validation discipline

Routine implementation prompts target **<=8 minutes** wall time, have a **10-minute soft ceiling**, and a **15-minute hard execution budget**. The budget covers inspection, implementation, focused validation and final reporting.

Qualification, dedicated integration gates, browser/manual evidence gates, packaging qualification and closeout audits may exceed the ordinary implementation budget when their approved purpose genuinely requires it.

An implementation prompt approaching its budget must not start another expensive broad validation step merely for reassurance. Preserve completed work, run the smallest remaining validation necessary for the changed surface, and defer explicitly identified broader evidence to the designated integration/qualification gate.

Runtime limits must never be satisfied by weakening correctness, deleting required tests, concealing failures or claiming unexecuted evidence.

### Validation tiers

**T1 — Focused implementation validation** is the default for ordinary implementation prompts.

Run:
- tests added or changed by the prompt;
- focused tests covering directly affected behavior;
- affected-package/domain typecheck where applicable;
- an affected build only when compilation/output boundaries changed;
- cheap permanent architecture/regression guards applicable to the change;
- `git diff --check` and required repository/version coherence checks.

Do not run `npm test`, `npm run check`, all builds, packaging, restart or broad unrelated suites by default.

**T2 — Integration validation** is used only at an explicitly planned integration prompt or when the change crosses multiple existing subsystem/package boundaries.

Run T1 plus the affected multi-package/integration suites, appropriate aggregate product tests, and relevant build/restart evidence when the changed behavior requires it. T2 is not the default merely because a task is a correction.

**T3 — Qualification / release validation** is reserved for explicitly identified qualification, release, packaging, browser/native evidence and closeout gates.

This is where full aggregate validation belongs, including `npm test` / `npm run check` when applicable, browser/Electron builds, restart/process evidence, packaging/native launch, direct GUI evidence, broader matrices and final candidate qualification.

### Validation escalation

Start at the lowest sufficient tier.

Escalate only when:
- the approved prompt is explicitly an integration/qualification gate;
- focused evidence exposes a plausible cross-cutting regression;
- a changed public/shared contract materially affects broader consumers;
- the applicable stability contract requires integrated evidence for the specific claim being made.

Record why escalation occurred.

Passing broad validation earlier in the same prompt must not be rerun after an unrelated edit unless that edit could invalidate it. After a focused repair, rerun the smallest test capable of proving the repair, then repeat only broader evidence actually invalidated by the repair.

Permanent regression guards should normally be cheap and focused. A regression guard does not imply whole-product qualification on every prompt.

These rules apply prospectively to newly authored executable prompts. Completed/historical prompts remain unchanged. A not-yet-executed stack is revised under this policy only when explicitly reviewed/regenerated; do not silently rewrite an active execution contract.

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

The Phase 3 product runtime contained no AI provider. ADR 0006 now applies to future Phase 7 AI Presence; it never authorized OpenAI/Codex/local-model integration in Phase 3.

## Phase 4 activation

Product Phase 4 uses execution folder `p4` and coherent package baseline `0.4.0`. The completed `c3-remove-planning-instruments` closeout is the entry gate; no additional Phase 3 compatibility work is required.

P4 versions are `0.4.1` through `0.4.6`. P1-P4 are runner-owned implementation/integration prompts, P5 is the direct interactive "Dope maps Dope" GUI handoff, and P6 is evidence-only closeout. P5 must inspect the real Dope repository through the actual Theia GUI and trace representative physical relationships/violations to source evidence; automated/headless checks do not replace its direct interaction evidence.

Phase 4 has no model/provider runtime and no Planning Map. It must preserve the distinction between developer-authored architecture declarations/constraints (canonical project state) and extracted physical graph/index data (rebuildable derived state). Phase 5 introduces Visual Software Planning; Phase 6 introduces provider-free Flow over the Physical Map; Phase 7 introduces AI Presence.

### September 29 sMap amendment and correction gate

ADR 0008 changes the canonical architecture-feature vocabulary to **Software Map (sMap)**, **Physical Map**, and **Planning Map**, and fixes the default workbench placement.

The already-running P5 direct GUI qualification is not restarted or rewritten solely for this decision. After successful P5, insert a bounded Phase 4 correction at the unchanged then-current package version (expected `0.4.5` after P5). The correction must rename live package/symbol/UI surfaces away from the legacy software-architecture `model` terminology, move the sMap inspector into its own left Activity Bar/primary-sidebar surface, preserve the right secondary sidebar for future Agent Mind/chat, and add permanent regression guards. It must not implement the Phase 5 visual map canvas.

P6 closeout runs only after that correction is Green.

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

A correction keeps the current package version unchanged, repairs the defect, installs permanent executable regression coverage, proves the repair at its assigned validation tier, and preserves historical failure evidence. Broader affected-system qualification belongs in an explicit T2/T3 gate unless the repair itself crosses boundaries that require immediate integration evidence.

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

The existence of an aggregate command does not make it the default validation command for an implementation prompt. Use aggregate commands only when the assigned validation tier justifies them.
- `npm run test:runner` exercises the phase-runner regression suite.
- `npm run test:baseline` checks Theia/version/composition invariants.
- `npm run test:product` builds the Dope extension packages and runs current Project Mind/product unit suites.
- `npm run test:ide` runs the IDE discovery fixture.
- `npm test` composes runner, baseline, product and IDE suites.
- `npm run typecheck` builds current domain packages and typechecks the Theia extension.
- `npm run check` composes typecheck, all current tests, browser build and Electron build.
- `npm run test:restart` remains separate integrated restart/process evidence.

Phase 4 prompts must add software-map/code-analysis suites to the real aggregate commands as capabilities land. Do not treat unit/build success as direct GUI or packaged-native qualification.

## Closeout truth

A closeout audits evidence and decides whether the bounded gate qualifies.

Foundation Spike 0 closeout decides whether Theia qualifies as the substrate.

It does not owner-close future product phases or qualify future model/provider integration.

## September 30, 2026 — synthesis coverage/review correction gate

The owner closes `c4-synth-improvements` early after P4 as **Not Qualified**. P4's real Gemini run and package/restart/native evidence remain valid evidence; P5 is cancelled and must not be treated as executed or Green.

The successor `c4-synth-coverage-review` implemented provider-attempt retention/retry handling, MODULES/README document authority, coverage diagnostics/recovery, typed zero-Component dispositions, and branch-local **Search Deeper**, then directly qualified the center review in P5. P6 was stopped at the developer's request and pushed as `c059f67a5fd85c81183ba09044e550462c9000a1`.

The owner closes `c4-synth-coverage-review` as **Not Qualified** after P6. P7 is unexecuted and remains historical. The owner accepts the implemented synthesis/review capability as the baseline for sequencing without converting missing evidence to Green. The final Adaptive SEO replay met the <=8-minute objective and produced materially more useful responsibility boundaries, while zero useful Components, unresolved coverage, incomplete Dope/small-fixture qualification and skipped aggregate/package/native checks remain explicit gaps.

The previously queued fresh Local/Gemini provider-comparison correction is **deferred off the pre-Phase-5 critical path**. It is not Green and is not executed by this sequencing decision. It may be reconsidered later when provider optimization or AI Presence requires controlled comparative evidence.

The mandatory current correction is `c4-smap-storage` at unchanged `0.4.6`.

Its streamlined sequence is:
1. persistence-boundary audit plus only necessary bounded repair/permanent regression guards;
2. short copy/reopen/restart portability qualification plus Dope dogfood initialization;
3. evidence-only closeout.

P2 should prove the storage invariant directly rather than repeating synthesis qualification: initialize a controlled repository, restart, copy/open it at a different root, discard machine-local state, rebuild derived Physical Map state, prove a copy without `.dope/` is uninitialized, prove project isolation/fail-closed corrupt state, and initialize Dope's existing canonical declaration through the real acceptance path. Do not run live provider comparison, multi-repository architecture scoring, AppImage/native packaging or broad browser qualification unless a P1 repair materially makes that evidence necessary.

If `c4-smap-storage` closes Green, route directly to a fresh Product Phase 5 `/docs-review`. Do not reopen closed synthesis corrections merely to improve scores before visual-map work.

## October 1, 2026 — Phase 5 activation

Product Phase 4 is owner-closed for sequencing and the bounded package-only closeout transition established `0.5.0` at `016bd8780e89081dfdb5746eae981183dc945baa`.

`c4-color-theme` is GREEN / QUALIFIED at unchanged `0.4.6`. The architecture-synthesis corrections retain their original Not Qualified evidence; the deferred Local/Gemini comparison remains off the Phase 5 critical path.

Product Phase 5 — Visual Software Planning is active. Documentation authority is `docs/planning/p5/activation.md`, `docs/planning/p5/phase-5-plan.md`, and ADR 0017. Implementation planning follows the ordinary `/prompt-ass -> /prompt-plan -> /prompt-write p5` workflow.

Phase 5 is intentionally provider-free. Prompt stacks must not pull general AI Presence, Agent Mind, ProposedAction, authority/delegation or Phase 3 Planning compatibility forward. T3 qualification must exercise the human-driven Physical Map -> Planning Map -> transformations -> WorkItems -> implementation -> re-analysis -> reconciliation loop.

## October 2, 2026 — Phase 5 owner closeout and Phase 6 baseline

The owner explicitly closed Product Phase 5 for sequencing from retained `0.5.11` source after P11 remained Not Green and P12 was not executed. `docs/tasks/p5/closeout.md` records the disposition. Owner acceptance of these gaps is a sequencing waiver, not retroactive Green evidence.

Closeout transition `710edb362f9881ab41215705db4f08d8daca6293` advances all live manifests/internal references and baseline assertions to coherent `0.6.0`.

Product Phase 6 — Flow is active under ADR 0020 as amended by ADR 0021 and `docs/planning/p6/activation.md`. Flow is provider-free and is a Physical Map projection over existing identities/evidence, not a fourth durable map.

Before implementation, use the ordinary documentation workflow:

`/docs-review -> /docs-apply -> /prompt-ass -> /prompt-plan -> /prompt-write p6`

Do not require Phase 5 P11/P12 Green as an additional sequencing prerequisite; the owner waiver is the entry disposition. Do not erase or rewrite Phase 5 evidence.

## October 2, 2026 — Phase 6 Flow plan applied

Phase 6 documentation review is approved/applied at coherent baseline `0.6.0`.

Authority:
- ADR 0020;
- `docs/planning/p6/activation.md`;
- `docs/planning/p6/phase-6-plan.md`.

The approved phase stack is:
- P1 `0.6.1`: physical flow domain/evidence contracts — T1 — GPT-6 Sol High;
- P2 `0.6.2`: generic TypeScript internal-call extraction — T1 — GPT-6 Sol High;
- P3 `0.6.3`: supported Express/PostgreSQL/external boundary vertical slice — T2 — GPT-6 Sol High;
- P4 `0.6.4`: Flow query/path aggregation and generation guards — T2 — GPT-6 Sol High;
- P5 `0.6.5`: directional projection + deterministic layered layout — T1 — GPT-6 Sol High;
- P6 `0.6.6`: Architecture/Flow UI + edge provenance/source navigation — T2 — GPT-6 Sol High;
- P7 `0.6.7`: Adaptive SEO direct browser/T3 qualification — GPT-6 Sol High — Browser required;
- P8 `0.6.8`: evidence-only closeout — GPT-6 Sol Medium.

Prompt files are not created by `/docs-apply`. Next workflow is `/prompt-ass -> /prompt-plan -> /prompt-write p6`.

Phase 6 truth rule: dependency/import/reference relationships alone cannot be emitted as Flow. Deterministically resolved invocation/boundary/state interactions are valid execution Flow; data annotations require separate evidence.

## October 2, 2026 — Phase 6 renamed from Data Flow to Flow

ADR 0021 amends ADR 0020. Product Phase 6 is now **Flow**.

Flow is an application-level behavioral/execution projection of the Physical Map, not a compiler CFG and not a fourth durable map. Deterministically resolved invocation, boundary, state and external-interaction facts form the base execution path. Data/payload/type/schema semantics are optional evidence-backed enrichment.

The existing P1-P8 version/decomposition remains valid with renamed/reframed scope. The ten Phase 6 Flow decisions are resolved and promoted into authority; the temporary worksheet is retired and the stack may proceed through `/prompt-ass -> /prompt-plan -> /prompt-write p6`.
