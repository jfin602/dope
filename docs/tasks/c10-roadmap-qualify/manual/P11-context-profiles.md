# Manual P11 — Fast Q4_K_M context selection

> **2026-10-15 owner-approved execution contract:** **Current 2026-10-15 fast P11 owner routing:** Q4_K_M is the explicit local planning reference, 32K is the provisional starting point, and P11 is a **15-25 minute target / 30-minute hard-stop** short 16K/32K matched comparison with actual 64K feasibility attempt. P11 selects a **provisional** winner, not a qualified production default. P12 must collect longer real Chat/Roadmap/restart evidence for that exact model/context; P13 must collect selected-model security, authority, cancellation, locality, resource and process-egress evidence; P14 alone reconciles the result on the final source and confirms or defers the context default. Do not demand the former repetitive full workload matrix at all three profiles. Q3 P11 cycles 1-2 remain truthful and the only remaining authorized P11 cycle is 3; P10 remains NOT GREEN, version stays `0.10.16`, no silent default/provider/role change or Phase 10 owner-close.

**Manual T3 / browser-enabled / GPT-6 Sol High.** Not a phase-runner job; no `/activate`, no extra runner checkpoint or version bump.

## Preflight and cycle authority

Read BOOT.md, AGENTS.md, current ADR 0036, the Phase 10 plan and task README, plus `qualification/post-correction-rerun-1/loop-3-context/cycle-1.md` and `cycle-2.md`. Verify HEAD, build actually running in the browser, dirty worktree and model inventory. Prior P11 Q3_K_L 16K cycles 1-2 uncovered real context/budget defects and resulted in source repairs; they **are not** Q4 data. P10 recorded real approved Q3 writes and fresh next-turn evidence but its complete three-cycle family remains NOT GREEN due to unrelated live proof gaps. Before proceeding confirm that cycle 3 has not already been used. This is **cycle 3**, with no silent extension/restart of the three-cycle cap.

## Fast qualification test: 15-25 minutes, 30-minute hard stop

**Use only the exact Q4_K_M artifact `qwen3-coder-30b-a3b-instruct@q4_k_m` for this same-model comparison.** Begin from George's historically practical 32K, but do not assume it will win. Codex operates the existing `lms` CLI (`lms ls`, `lms ps --json`, `lms load --help`, `lms unload --help`). Estimate each profile's load memory with `lms load 'qwen3-coder-30b-a3b-instruct@q4_k_m' --context-length N --estimate-only` for `N=32768,16384,65536`. Load sequentially with explicit context and `--parallel 1` if supported; verify the **actual loaded model, Q4 quantization and capacity** in LM Studio CLI/REST and the corresponding Dope model selection/capability. Unload only experiment-owned instances; do not interrupt another user's model. A requested window or estimate is never proof of loaded capacity.

| Order | Budget | Required observation |
| --- | --- | --- |
| 1. **32K baseline** | 6-8 min | Verify loaded Q4 32768, run one real selected-checkpoint strict local intent in the existing saved Chat, Dope-computed edit preview, **explicit approve**, linked Markdown/owner revision change, and **fresh Q4 next turn** grounded in the new revision/hash. Record pending/no-write and final outcome. |
| 2. **16K comparison** | 3-5 min | Verify Q4 16384; run one identical narrow prompt and one context-heavy project/Roadmap planning request where actual usable context or explicit truncation matters. |
| 3. **32K comparison** | 3-5 min | On Q4 32768 compare the **same** narrow and heavy requests; reuse 32K baseline only where fixture/input truly match. Observe context included, validity, usefulness and latency. |
| 4. **64K feasibility** | 3-7 min | Estimate resources, attempt an **actual** Q4 65536 load if safe, verify loaded capacity and run a short probe if feasible. Record genuine load rejection separately from estimate risk, unattempted/timeout or insufficient large-task testing. |
| 5. **Selection record** | 3-5 min | Compare quality, strict-output behavior, actual/estimated input, omissions, first token/status and completion times, memory/stability and any runtime differences. Pick provisional smallest reliably sufficient context **or UNDECIDED**. |

Time budgets are targets, not a reason to fabricate missing data. Stop by 30 minutes with explicit blockers if loads, browser controller or inference stalls. Do not spend another hour repeating full suites. A headroom comparison is uninformative if all prompts fit 16K; report that limitation. A 64K estimate alone cannot establish actual load failure, and a brief successful 64K smoke does not prove it outperforms 32K for large tasks.

Keep model artifact, Dope source, fixture, parallelism, GPU placement, KV cache, Flash Attention and input/output budgets comparable; record deviations. George's GPU Offload 26 denotes layers, not `lms --gpu 0.26`. Separate cold loads from warmed inference, uncontrolled timing from controlled timing and exact token counts from conservative estimates. Do not silently switch to Q3, invoke hosted fallback, alter global AI Center/Chat preferences or auto-apply model proposals. Failed strict intent must fail closed.

## Status, evidence and P12/P13 handoff

Record P11 cycle 3 in `qualification/post-correction-rerun-1/loop-3-context/cycle-3.md`, `comparison.md` and a family summary. Include actual product/source/fixture SHA and bytes/revisions, model/load/capacity provenance, estimate/actual outcome of each profile, prompts/input sizes, pass/fail/no-action truth, approved/fresh turn, latency, pressure/errors and a **PROVISIONAL SELECTED**, **UNDECIDED**, or **NOT GREEN / INCOMPLETE** selection disposition. Keep historical cycles untouched. Do not claim full P11 default Green merely from this short pass.

- **P12:** Use the explicitly selected Q4 model/context for longer real saved Chat/Roadmap workflows, multi-turn freshness, restored Chat and backend-restart UI, docks, measurable context/latency/stability and browser + independent Electron evidence. Keep all existing P12 UI/native gates.
- **P13:** Use the same exact loaded Q4 model/context for direct foreign-owner/no-write/stale/denied/cancel authority checks and instrumented successful local inference/whole-app egress, including context-related retries/resource observations. Keep all P13 safety gates.
- **P14:** Reconcile P11's limited profile comparison **plus** P12/P13 winner-specific direct observations on the final committed source. Confirm the context default only if critical evidence is sufficient, otherwise mark it provisional/deferred without claiming full Phase 10 Green. Verify the separately outstanding P10 browser-restart/foreign-owner/historical-label evidence where actually obtained. P14 alone runs full `npm run check`.

No extensive full multi-profile workload rerun is mandatory. Rerun only evidence invalidated by source changes. If the existing P11 cycle budget expires with an unresolved blocker, preserve NOT GREEN and request explicit owner authorization for any later supplemental evidence instead of inventing a fourth cycle.

**Final response:** exact tested SHA, elapsed time, 16K/32K/64K observations/limits, Q4 approved and fresh-next-turn result, provisional context choice or undecided, record paths and P12/P13 follow-up gates.
