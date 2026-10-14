# c10-roadmap-qualify — Phase 10 final Roadmap qualification correction

> **Required entry gate (2026-10-14):** Complete the entire horizontal/color correction including the targeted semantic zoom fix and P11 live proof, THEN `../c10-better-planning/` P1–P5. Only afterward rerun **all five** manually executed P9–P13 families, followed by P14. Old P9 Not Green does not reset or become cycle 4. No `/activate` requirement.

**Status (2026-10-14):** P1–P8 implementation committed. Historical manual P9 completed three cycles **NOT GREEN**. Fresh complete manual P9–P14 qualification **DEFERRED** until all of c10-horizontal-color and c10-better-planning have completed their scoped gates. Phase 10 NOT GREEN / NOT OWNER-CLOSED, version `0.10.16` unchanged.
**Mode:** Correction 10. **Fixed package version: `0.10.16` UNCHANGED**, all 13 root/app/package manifests and 20 pinned `@dope/*` references.
**Exact entry:** `71d91efb3668e57816bb031f82ab309acea17cfc` product source, subsequent `c620bc0a3be714b7dc329dc5c872a064b1f8003a` P19 evidence-only commit. P19 passed 671/671 automated tests and both builds but **NOT GREEN** live. Original P16 remains **NOT GREEN**. Phase 10 not owner-closed; Phase 11/12 inactive.
**Authority:** ADR 0036 (2026-10-13 amendment), `docs/planning/p10/phase-10-plan.md`, `prompt-assessment.md` and `implementation-plan.md`.

## Correction stack

| Prompt | Responsibility | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| [P1 — Intent contract](P1-local-intent-contract.txt) | Compact source-aware model intent, nested strict validation, editable capabilities | T2 | GPT-6 Sol High | no |
| [P2 — Local context](P2-local-context-budget.txt) | Adaptive measured context, bounded output and NEXT-turn refresh | T2 | GPT-6 Sol High | no |
| [P3 — Relink](P3-linked-document-relink.txt) | Explicit safe moved-file relink | T2 | GPT-6 Sol High | no |
| [P4 — Recovery](P4-document-recovery.txt) | Conflict/crash fault replay and bounded repair | T2 | GPT-6 Sol High | no |
| [P5 — Greenfield](P5-greenfield-completion.txt) | Manual and saved Chat greenfield acceptance | T2 | GPT-6 Sol High | no |
| [P6 — Chat lease](P6-chat-lease-restoration.txt) | Reproduce/recover Chat lease across restart | T2 | GPT-6 Sol High | no |
| [P7 — Spatial UI](P7-roadmap-ui-gates.txt) | Touch/keyboard/prompt navigation and layout gates | T1 | GPT-6 Sol Medium | no |
| [P8 — Integration](P8-qualification-integration.txt) | Cross-owner/adversarial and shared-Markdown handoff regression integration | T2 | GPT-6 Sol High | no |
| [P9 — Runner handoff](P9-roadmap-qualification-closeout.txt) | **Manual browser-required handoff only; see manual P9–P14 below** | T3 | GPT-6 Sol High | **yes** |

## Adaptive local context — default evaluated in manual P11

P2 removes the fixed 4,096-total-token ceiling from local Roadmap planning and uses the verified loaded model context with task-sized context, consistent preview/send/retry accounting, explicit omission diagnostics and bounded JSON output separately from reserved generation tokens. P2 does **not** select a permanent 16K/32K/64K default. **Manual P11** compares the same actual local model/quantization/runtime at loaded **16K, 32K and 64K** across real narrow/large/multi-turn tasks, latency, memory and stability; record limitations and choose the smallest reliably sufficient profile only after measuring. 4K is optional narrow compatibility stress, neither a production maximum nor a full-workflow requirement. Missing comparisons remain an evidence gap, not a fabricated winner. Preserve real local-only and approval/security boundaries.

## Codex ↔ Dope linked Markdown acceptance

Codex CLI and Dope may alternate on **one accepted linked Markdown file in the same local project working tree**. Codex edits the source directly; Dope watches/compares, shows the exact external difference, and requires **Apply source changes** for supported non-conflicting mappings. Dope edits require its existing deterministic preview/approval and minimal document patch; Codex sees the updated source on a fresh file read/turn. Different clones require Git exchange. `.dope/` owns checkpoint IDs, links/graph, layout and sync state; Markdown does not independently own those fields or historical Green/Not Green decisions. Unsupported prose remains source-owned/read-only, and ambiguity, stale edits, move/relink and conflict remain fail-closed review flows—not automatic reconciliation.

P8 owns focused disposable shared-file regression; **manual P9** now owns the **required real Codex CLI → Markdown → Dope UI → Markdown → fresh Codex read**, repeat/restart and conflict/relink replay with hashes, stable IDs, revisions and evidence. No new prompts or second sync service. Mock Codex-like edits alone do not qualify a live handoff; missing Codex/GUI evidence is Not Green / Evidence Gap.

## Prequalification presentation dependency — c10-horizontal-color

`../c10-horizontal-color/` **P1–P6 is implemented and committed** through `ddbac418` (P1–P5 product source `f5b705691`); its P6 closeout is implementation-only and **does not** qualify Phase 10. The committed baseline now includes left-to-right phases, correction/support branches, six status treatments, the full editor canvas and contextual source/inspector/pool overlays. Manual P9/P10 must exercise affected source/creation/approval overlays, P12 tests browser/native visuals, Chat docking and legacy v1 selection/disclosure (not old vertical placements), P13 checks false Green/approval authority, and P14 qualifies the coherent final source. The superseding 2026-10-14 route additionally requires completing remaining visual repair and c10-better-planning before the fresh full qualification.

## Manual browser qualification P9–P14 (outside runner)

P1–P8 are committed runner checkpoints. To avoid forcing browser-tool work through the CLI runner, keep the root P9 as its **single final manual handoff file** for parser compatibility. The actual qualification prompts are authored under `manual/` and must be run individually in the browser-enabled interactive environment, **not** through `npm run codex:phase` or artificial Git prompt checkpoints:

| Manual prompt | Family | Execution |
| --- | --- | --- |
| [P9 — Linked Markdown/Codex](manual/P9-markdown-codex-handoff.md) | Genuine Codex → Dope → Codex → Dope, source reconciliation, import/relink/conflict | T3/manual, up to 3 cycles |
| [P10 — Local AI](manual/P10-local-ai-planning.md) | Valid local-model approval, next-turn freshness, manual/Chat greenfield | T3/manual, up to 3 cycles |
| [P11 — Context](manual/P11-context-profiles.md) | Measured 16K/32K/64K comparison and preferred/default-deferred decision | T3/manual, up to 3 cycles |
| [P12 — UI and Chat](manual/P12-interface-chat-electron.md) | Real browser and native Electron, Roadmap, saved Chat four docks and restart | T3/manual, up to 3 cycles |
| [P13 — Authority and egress](manual/P13-authority-egress.md) | Security, stale/foreign denial, historical status, whole-app network observation | T3/manual, up to 3 cycles |
| [P14 — Final closeout](manual/P14-final-qualification-closeout.md) | Reconcile families on exact product SHA, one full aggregate, final Green/Not Green | T3/manual, sole final disposition |

Each P9–P13 group stops early on Green, records append-only `qualification/loop-N-*/cycle-N.md` and its family matrix, and commits any narrow product-source repair separately. After three unsuccessful cycles, preserve the blocker without claiming Green; independent later groups can still gather evidence if safe. P14 checks invalidation from subsequent repairs before reusing earlier evidence and is the **only** writer of the terminal `closeout.md`. No second Chat/sync implementation, phase bump, separate activation or new runner grammar.

## Shared manual qualification readiness and evidence reuse

Before manual P9, verify actual local HEAD/status against current GitHub `main` (at review: `ddbac418`; recheck on execution), version `0.10.16`, completed `c10-horizontal-color` source, disposable Git project(s), actual Codex CLI, local LM Studio/model, browser control, independently observable native Electron window, and full relevant-process/network tracing. Record tool availability/limits and reusable fixture IDs, paths, hashes, model configuration and stable source SHA in `qualification/readiness.md` when manual execution begins. Unavailable instrumentation is a **BLOCKED evidence gate**, not a new pre-P9 activation ceremony or a reason to stop unrelated safe testing.

Use one non-destructive linked-project fixture across P9→P10→P11→P12/P13 when its state is coherent; isolate crash, unsafe-path and destructive denials in separate disposable copies. Reuse source-specific prior PASS evidence if later repairs did not touch the tested producer/consumer, mapping, configuration or UI; document the reuse rationale and rerun only invalidated proof. **One cycle = a bounded family pass with possible focused repair, not an individual assertion or setup retry.** Every P9–P13 family has up to three such cycles, stopping early on Green. P12 executes UI/canvas and Chat/native sub-sections inside one family. P10 owns real action/greenfield correctness; P9 owns linked-file semantics; P12 owns presentation/interaction; P13 owns cross-owner/security and whole-app egress (prefer tracing the real successful P10 call contemporaneously). P14 performs the one exact-candidate aggregate after source stabilization.

## Execution preflight

Starting this selected stack via the runner is sufficient implementation authorization; no separate `/activate` command or activation record is needed. Reconcile actual local HEAD/version/dirty tree safely before mutation. Native Electron window controls/capture, browser+touch/keyboard-equivalent actions and network/process-tree observations remain mandatory P9 T3 qualification evidence, not a pre-P1 implementation gate. A process launch or Electron build is not sufficient. Do not weaken T3 qualification due to missing tooling.

After local checkout contains the authored files, validate runner syntax:
```sh
npm run codex:phase:validate -- c10-roadmap-qualify
```
This is a grammar/compatibility check for the already authored stack, not a command to launch the manual qualification or a replacement for P14's exact-source validation.

**P1–P8 have already been committed. Do NOT rerun the implementation stack to begin qualification.** The root P9 remains a browser-required runner-grammar handoff only; execute `manual/P9` through `manual/P14` individually with the browser-capable environment. Implementation agents do not self-commit; actual manual repairs require deliberately separate product commits. Never rerun `p10` or `c10-roadmap-create-sync` to fix this.

## Preservation / pass law

No version bump, yarn.lock/dependency churn, root package-lock or hidden model fallback. Do not overwrite/delete any unrelated dirty checkout files or the historical P16/P19 closeouts. Source-backed unsupported Markdown remains read-only; valid model intent must go through deterministic IDs/hashes, ProjectPlanningActions preview and human approval. No separate Chat or Work runtime, no implicit prompt execution or status Green. Manual P14 can declare final Green only after all live gates on exact committed source: accepted model proposal → preview → approved linked Markdown/graph write → *fresh next turn*, real greenfield/import/recovery, one saved Chat in every dock, canvas/mouse/touch/keyboard, independent egress and actual native Electron GUI, plus final aggregate. Even if correction qualifies, Phase 10 owner-close is a **separate** decision.

See [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md) and historical [P19 closeout](../c10-roadmap-create-sync/closeout.md).

### Full-canvas Roadmap overlay coverage (current prequalification direction)

The separately completed `../c10-horizontal-color/` correction is **P1–P6**, committed through `ddbac418`: P3 makes the Roadmap a full-editor canvas with compact toolbar and floating Ideas/Issues, P4 moves linked Markdown/import/creation/relink/conflict/recovery into contextual overlays, P5 reuses the existing inspector editing/approval model in an in-canvas overlay, and P6 performs implementation-only closeout. Confirm it is implemented and checkpointed on the actual final source BEFORE claiming any affected manual UI gates. Revisit P9 (real Codex-to-Dope source/status overlay), P10 (manual/Chat greenfield and approval overlay), P12 (native+browser overlay/readability/Chat), P13 (no hidden approval, false Green or silent write), and P14 (source-evidence reconciliation). Do not add a sixth family, relax context/egress/native gates or allow the correction closeout to replace manual P14.

## Qualification review amendment — connected, readable imported roadmap (2026-10-13)

First live browser import after completed `c10-horizontal-color` exposed flat correction placement, no visible connectors, label-only status colors, and an initial fit-all zoom that made the 31-checkpoint Roadmap unreadable; the 9 diagnostic references need categorical inspection. Treat these as **open P9/P12 family defects, not new qualification families**.

- **P9:** exercise linked Markdown and task discovery with exact numeric `c<phase>[-slug]` convention association, including c10→10/c100≠10, valid explicit parent, conflict, missing phase and multiple corrections; classify all currently observed unresolved references rather than guessing cause.
- **P12:** directly observe a legible first-load current-phase-centered camera and persisted user camera, true left→right phase progression, separate upper correction and lower prompt branches, visible **progression vs phase-membership vs real dependency** connectors, full-card six-state tint with accessible focus/noncolor cues, and gentle active/selection motion or static reduced-motion alternative. Repeat browser and independently visible native Electron, including narrow split/restart/theme/semantic zoom.
- **P13:** visual association, animated line, completed prompt and waiver must never synthesize a stored dependency, approval, canonical status or false Green.
- **P14:** require these presentation behaviors and prior five family proofs on one final exact committed product SHA before Green; otherwise retain Not Green.

No new runner stack, version bump, /activate gate, or extra P9–P13 family. Keep historical P16/P19 Not Green and all completed implementation artifacts.

## Post-P9 continuation and owner-requested requalification (2026-10-13)

Historical manual P9 has now **completed three cycles / NOT GREEN**, with genuine shared-file/Codex roundtrip evidence retained and a remaining contradictory `c4-color-theme` source status. The owner subsequently asked for a runnable **same-folder** `c10-horizontal-color` continuation: original P1–P5 remain completed, historical manual P6 evidence is archived, new P6–P10 implement convention-based phase attachment, visible relation lines/vertical lanes, six whole-card tints, readable default camera and subtle reduced-motion animation, and new browser-required P11 checks actual appearance on browser and native Electron. The current stack is documentation/authored only until executed; never advertise a visual Green before P11 records it.

After that implementation and visual verification, the owner explicitly wants a **fresh P9 requalification**. Preserve `qualification/loop-1-markdown/cycle-1`–`cycle-3` and the historical NOT GREEN family summary; record the fresh attempt separately under `qualification/loop-1-markdown/requalification-1/` with new exact source/fixtures. The old three-cycle result is not renamed or extended to an invisible cycle 4. Reuse unaffected real shared-file proofs only where justified and redo invalidated topology/import GUI assertions. Resolve or openly retain the separate `c4-color-theme` source contradiction before P9 Green; a convention-derived parent, tinted card or animated edge never authorizes historical status. P12/P13/P14 are still independently mandatory for final Phase 10 qualification.

## 2026-10-14 — Mandatory full post-correction Phase 10 qualification

**Current disposition:** Phase 10 NOT GREEN / NOT OWNER-CLOSED, unchanged version `0.10.16`. Historical P16/P19 NOT GREEN and three completed manual P9 cycles NOT GREEN remain source-bound immutable evidence; passing code tests or visual implementation checks never elevate them.

**Strict order:** finish the entire `docs/tasks/c10-horizontal-color/` correction, including its observed automatic zoom/task-stack disclosure defect and real P11 visual closeout; then execute and scope-close `docs/tasks/c10-better-planning/` P1–P5 (one saved ChatPanel, validated structured activity disclosure, factual outcome/questions and low-cost event-backed progress). Before execution confirm local HEAD, dirty tree, version and non-overlapping mutations. No `/activate` gate, no automatic prompt execution. A correction failing required gates remains NOT GREEN and is repaired/explicitly dispositioned before full qualification begins.

**Then rerun ALL five manual families** `docs/tasks/c10-roadmap-qualify/manual/P9` (real Codex↔Dope↔Codex↔Dope linked Markdown), P10 (verified local planning intent/approval/fresh next turn and better Chat narration), P11 (actual loaded 16K/32K/64K profile quality and latency, including commentary overhead), P12 (browser/native Electron and one ChatPanel in four docks, activity disclosures/accessibility/restart), P13 (stale/foreign/no-write/authority/whole-app egress). **Manual P14 alone** runs final exact-source aggregate and declares correction Green/Not Green. This is a **new full campaign**, not a P9-only requalification or reuse of old family summaries in place of real new runs. No sixth family or browser loops through the phase runner.

**Evidence preservation:** save new family cycles under `docs/tasks/c10-roadmap-qualify/qualification/post-correction-rerun-1/loop-N-*/`, not the old `qualification/loop-1-markdown/cycle-1..3`; the new campaign gives each family up to three focused cycles, with real first observation and only seam-invalidated retests after subsequent repairs. Reuse granular source-equivalent assertions **within** the new campaign only with explicit rationale. P14 requires five new summaries and a stable exact committed final product SHA. Qualified correction still does not owner-close Phase 10 or activate Phase 11/12.

**Security/inference law:** local strict single-JSON `roadmap-intent`, `roadmap-proposal`, `roadmap-draft-proposal` and `no-action` remain bounded model proposals, NOT executable tool authority. Show trusted raw envelope as accessible muted collapsed activity, followed by one short accurate paragraph and one or two relevant next questions for completed local planning turns. “Proposed / awaiting approval; no write yet” is required before approval; report success only from confirmed approved changes. Error/stale/reject/cancel/no-action remain honest. Progress should originate from real lifecycle events, never extra required commentary inference or hidden hosted fallback.
