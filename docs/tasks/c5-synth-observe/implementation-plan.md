# Correction 5 Implementation Plan — Synthesis Observability and Dry Run

Status: **PLANNED / QUEUED**
Correction folder: `c5-synth-observe`
Current unchanged-version baseline: `0.5.11`
Assessment: `prompt-assessment.md`
Authority: ADR 0012/0014 amendments and correction README

## Shared preflight

Read BOOT/AGENTS, ADR 0012/0013/0014/0016, current Software Map storage/workflow/roadmap authority, this correction README/assessment/plan, and affected source/tests. Confirm the active `c5-smap-acceptance-debug-loop` has closed or is otherwise explicitly disposed, its edits are integrated, the Adaptive SEO review remains preserved, and the current package version still matches this correction's unchanged-version baseline. Do not overwrite concurrent work or start this stack on an incoherent working tree.

The affected flow is: stage cache/provider attempt -> orchestrator progress event -> backend terminal/run state -> controller setup/readiness -> sMap widget/CSS. Dry run is a separate read-only backend service operation over the same deterministic collector and saved-run reader; the frontend only renders its bounded result. Software Map owns these contracts; Theia owns presentation. `.dope/smap-analysis.json` remains work state, never canonical architecture.

## P1 — Retry truth and recovery controls (T1)

Trace every caller of the stage cache and progress event path before editing. Compute automatic retry eligibility once in `SynthesisStageCache.run()` and make the emitted attempt status agree with whether the loop will continue. Distinguish a malformed structured-output envelope from architecture/content validation failures; if classification is uncertain, stop and offer manual retry. Emit the next attempt's start/number without inventing a denominator. Keep every attempt in the ledger and retain safe failure classes only.

Make the sidebar heading depend on terminal run state, not a failed attempt. Show retrying, recovered, exhausted and cancelled states with concise safe text. Color the stage list through semantic theme tokens and retain visible text labels/contrast in other themes. Put manual retry within the selected model section with a model-bearing label; disable it during analysis and until the selected model has passed its test. Preserve distinct **Restart analysis** and **Retry failed stage** actions. Keep old checkpoint provider/model labels visible after a model change.

Likely files: `packages/software-map/src/reconciliation.ts`, possibly `hierarchical-synthesis.ts` for a narrow typed event refinement, `packages/theia-extension/src/browser/software-map-controller.ts`, `software-map-widget.ts`, `dope.css`, and focused synthesis/UI tests. Avoid a second progress store, a broad design-system abstraction or a new dependency.

Focused regression: malformed result followed by a successful same-model retry never reports terminal failure; transient retry shows attempt progression; architecture/content failure stops without automatic retry; exhausted failure enables manual retry; changed Gemini model disables retry until probed; valid checkpoints and provenance survive that retry; no cross-provider fallback or secret leakage. Build only affected packages, run focused synthesis/UI tests, `git diff --check`, and version/no-root-lock checks.

## P2 — Read-only generation dry run (T2)

Add one typed service operation and a small bounded report. Reuse `SoftwareMapIndex.collectEvidence()` and `validateArchitectureEvidencePacket()` for current repository facts; use `readSynthesisRun()` and a separate in-memory checkpoint validator for saved failed-run inspection. Do not mutate the backend's live cache. Report current input fingerprint, evidence/document summary, safe collection/validation errors, saved completed/failed work and only *known* pending stages. Label future stages that depend on model output as untested. If an analysis is active, report that dry run is unavailable rather than race or alter it.

Expose **Dry run (no model calls)** in synthesis setup with its result or safe error. Guard late responses by project/request generation. No provider configuration, capability probe, token estimation through a provider, model request, proposal creation, `.dope/` write or saved-run replacement occurs. Do not duplicate the acceptance checker or print raw document/evidence content by default.

Likely files: `packages/software-map/src/service.ts`, `packages/theia-extension/src/node/software-map-backend.ts`, `packages/theia-extension/src/browser/software-map-controller.ts` and `software-map-widget.ts`, plus focused initialization/UI tests. The deterministic collector and saved-run reader should be reused, not copied. Test fresh and failed runs, safe error handling, active-run rejection, project switching, zero provider calls and byte-for-byte unchanged project files; include a saved review specimen to prove it is untouched. Build affected packages, run those focused tests, `git diff --check`, and version/no-root-lock checks.

## P3 — One browser check and closeout (T2)

Use the smallest existing controlled browser path. Observe a retrying attempt without terminal-failure wording, a terminal failure with its model-coupled retry action, another model requiring a successful probe, text plus semantic color states under Dope Dark and one alternate theme, and fresh/failed dry-run reports. Verify dry run does not trigger a provider request or modify project files. If the current browser harness cannot drive a retry, record the exact Evidence Gap; do not add a production debug endpoint solely for qualification.

Run only the focused P1/P2 regressions and affected builds if their source changed after those prompts. Record commands, browser observations, provider-call count and file-state evidence. Write `closeout.md`, update this correction README's status, preserve historical Not Qualified synthesis evidence and the existing P11/P12 routing. Green requires every approved exit criterion; otherwise state Not Green or Evidence Gap precisely.

## Deferred

Full provider comparison, architecture-quality scoring, AppImage/native packaging, broad restart matrices and the separate Adaptive SEO acceptance-debug loop remain outside this correction.
