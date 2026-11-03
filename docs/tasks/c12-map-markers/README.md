# c12-map-markers — compact Roadmap markers recovery (manual, 3 prompts)

**Owner decision:** 2026-11-03 (America/Chicago). **Status:** FORWARD DOCS + THREE MANUAL PROMPTS AUTHORED ONLY, NOT RUN OR QUALIFIED. Baseline reference: Dope `0.12.7`; inspect the **actual local** branch/dirty source before each prompt. Product code, model/provider selection and package version are unchanged by this documentation authoring.

## Why this targeted correction exists

The owner completed/ran the [fast Roadmap F1–F6](../c12-rmr-man/fast/README.md) manual sequence. [F6 closed NOT GREEN / DOGFOOD HOLD](../c12-rmr-man/fast/qualification/2026-11-03-f6-manual-closeout.md): the first Qwen3.5-9B typed-JSON generation took 3m14s but yielded reasoning only, **zero final draft**, and no reviewable graph. A bounded 4,096-token repair was built, but the retest was interrupted by an operating-system crash and testing stopped at the owner's direction. **The exact failure cause and actual token accounting were not established; do not claim JSON overhead alone caused this.** F1's partial benchmark remains historical. Do not rerun or rewrite any F*.txt or old R4 reports.

**Design:** Prefer one completed, strict, compact Roadmap Markers v1 answer to a verbose nested JSON output. The parser converts marker lines to the **same existing `UntrustedTypedRoadmapCandidate`** consumed by F3's `stageTypedRoadmapDraft` and checked `RoadmapNativeStageOwner`. No freeform saved Chat parsing, second model pass, model-operated staging calls, new Roadmap owner, auto-Apply, or change to canvas/Chat review. Native granular tools remain for later edits.

```text
RM1
P|Foundation|Initialize the PixiJS world
G|Waypoints|Move enemies along a fixed route
C|Enemies visit every waypoint in order
P|Combat|Implement one defensive tower
G|Projectile Attack|Target enemies and respect a cooldown
C|Projectiles damage enemies when they collide
END
```

The example is a format demonstration, not a complete tower-defense plan. `RM1` and `END` are required exactly once. Each `P` has a title/objective, `G` has a title/purpose under a Phase, and `C` has one observable sentence under a Gate; Dope derives its internal Criterion title deterministically. No arbitrary prose, unknown markers, unescaped `|`, blank/missing required fields, invented dependencies, IDs, source hashes or model-provided approval/evidence. Invalid/incomplete output never becomes reviewable. Actual internal staging operation limits differ from textual Criteria count: Criteria are nested in a Gate create.

## Three prompts — run separately, in order

| Order | Prompt | Responsibility / tier |
| --- | --- | --- |
| M1 | [Strict marker parser](M1-marker-parser.txt) | T1, deterministic grammar → existing validated untrusted candidate; focused parser/stage tests only |
| M2 | [Wire one-pass generation](M2-generation-integration.txt) | T2, switch model-facing greenfield completion to markers; bounded completion/finish diagnostics and authority regressions, no GUI/Qwen |
| M3 | [Codex Browser-only qualification](M3-codex-browser-qualification.txt) | T3, one real selected-local-model Roadmap → canvas Apply → accepted Gate/Prepare Work proof after host stability and explicit clearance to resume testing |

**Execution:** Copy one prompt manually into GPT-6 Sol High. M1/M2 target <=8 minutes implementation plus focused source tests (10 soft, 15 hard) and **must not launch Chrome/Codex Browser, a server or live Qwen inference**. Build only changed TS package outputs needed for tests that import `lib`; never `npm run check`/`npm test`/browser build by default. M3 uses **one Codex Browser surface**, never standalone Chrome, and no repeated model runs merely for speed comparison. Reconcile the already dirty F2–F6 local files; no reset/stash/clean/force push/self-commit/owner-game mutation. Earlier OS crash and owner STOP are not retroactively cleared by prompt authoring: require confirmation of stable host and express owner authorization to resume **before M3 runs**.

**Exit:** M1/M2 may report source-verified scope only; M3 alone can observe a complete >=5-Phase, per-Phase Gate + testable Criterion MVP Roadmap, no-write-before-Apply, checked subset, linked Markdown/reload and accepted Gate → Prepare Work entry. Missing evidence = NOT GREEN and DOGFOOD HOLD. No Phase 12, owner-native Electron, or whole Work Green claim. Preserve existing no-source-write, lease/revision/source, History and evidence-bound Gate qualification rules. See [ADR 0047](../../decisions/0047-native-roadmap-authoring-and-automatic-sync.md) and [native contract](../../planning/p12/native-roadmap-authoring-contract.md).
