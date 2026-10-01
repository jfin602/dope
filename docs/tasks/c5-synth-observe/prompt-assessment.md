# Correction 5 Prompt Assessment — Synthesis Observability and Dry Run

Status: **PLANNED / QUEUED**
Correction folder: `c5-synth-observe`
Current unchanged-version baseline: `0.5.11`
Authority: ADR 0012/0014 amendments, ADR 0013/0016, correction README and current Software Map contracts

## Conclusion

Use three ordered prompts. P1 repairs retry truth and recovery controls with focused tests (T1, GPT-6 Sol High, no browser). P2 adds a read-only generation dry run through existing evidence and saved-run readers (T2, GPT-6 Sol High, no browser). P3 checks the resulting sidebar in a browser once and records closeout evidence (T2, GPT-6 Sol Medium, browser required).

This stack is queued separately from `c5-smap-acceptance-debug-loop`. Execute only after that correction's current work is coherent and its closeout has disposed the active gate. Do not absorb its acceptance checker or alter the preserved Adaptive SEO review. The current package is `0.5.11`; if the version or P11 gate changes before execution, recheck routing and version before running prompts rather than silently applying the old baseline.

## Source findings

- `SynthesisStageCache.run()` in `packages/software-map/src/reconciliation.ts` retains attempts and checkpoints. It retries classified transient Gemini failures up to three attempts and one `StageResultFailure` once. The progress callback currently labels the first malformed result `failed` even though the loop retries it. The parser failure class also combines malformed output with invalid architecture/content, so P1 must make retry eligibility match ADR 0014 rather than merely recolor the callback.
- `HierarchicalSynthesisOrchestrator` emits provider-independent `AnalysisProgressEvent`s. `SoftwareMapBackend` emits the terminal `failed` stage after the run stops and exposes persisted `resumable` stage, model and completed-checkpoint provenance. The UI should derive terminal state from that run state, not from an individual call's status.
- `SoftwareMapWidget.renderProgress()` already builds the stage list and attempt list; `dope.css` has the sMap surface but no status-specific progress styling. Keep the rendering semantic, accessible and theme-token based.
- `SoftwareMapController.changeGeminiModel()` clears readiness, `probeGemini()` restores it, and `retryFailedStage()` reuses saved checkpoints. The existing retry button sits outside the model section. P1 should couple the action to the selected/tested model without changing the provider-neutral resume contract.
- `SoftwareMapIndex.collectEvidence()` calls the deterministic collector; `validateArchitectureEvidencePacket()` validates its packet. `readSynthesisRun()` reads the project-local saved run. `planArchitectureEvidence()` needs a provider capability and token counter, so a zero-provider dry run must not claim to plan every later call or estimate model success.
- The active acceptance-debug correction owns mutable review work and a separate offline acceptance checker. P2's dry run concerns generation inputs and failed-run inspection, not acceptance validity or review mutation.

## Preserved behavior and boundaries

- Developer acceptance alone establishes canonical architecture; no progress or dry-run result becomes project truth.
- No automatic provider/model fallback, raw provider error, API key, raw prompt or hidden reasoning in UI/progress/report.
- Automatic retry repeats the same request/model and is bounded. Manual model change requires a fresh successful capability test; valid ancestor and independent checkpoints retain original provenance.
- A dry run makes no provider calls, writes no project or `.dope/` state, does not replace an active/saved run, and does not create a proposal. Its report labels model-dependent work untested.
- Preserve current Phase 5 planning and the active acceptance-debug correction's scope; no Adaptive SEO regeneration or package version advance.

## Main risks

1. Misclassifying invalid architecture/content as malformed output and retrying it automatically.
2. Calling a failed attempt a failed run while another attempt is pending.
3. Losing checkpoint reuse or making model selection silently change a running request.
4. Letting dry-run reads mutate the shared cache, touch credentials, overwrite saved work, or imply that a model will succeed.
5. Hard-coded colors that fail under alternate themes or color-only state communication.

## Evidence and routing

P1 leaves permanent focused cache/progress/controller tests and an affected extension build. P2 adds backend/controller dry-run tests proving fresh and failed reports, zero provider calls and unchanged project files, with affected builds only. P3 performs one direct browser pass of text/color states, model-coupled retry and dry-run reporting, then writes a truthful closeout. No whole-repo `npm run check`, AppImage packaging, multi-repository architecture scoring or live provider comparison is part of this stack.

Green requires the behavior in the correction README's Exit section. If a browser retry state cannot be driven through an existing controlled path, record the specific Evidence Gap rather than add production debug hooks or call the stack Green.
