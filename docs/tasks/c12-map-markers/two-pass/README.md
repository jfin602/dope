> **SUPERSEDED 2026-11-03 — DO NOT RUN:** [ADR 0049](../../../decisions/0049-roadmap-phase-orchestration.md) / [c12-rm-orch](../../c12-rm-orch/README.md) retire this natural-plan/locked-snapshot→RM1 second inference architecture. D1–D3 remain untouched for historical evidence, but no conversion shim or automatic fallback survives the forthcoming P1 clean cutover. Only the checked shared proposal owners and protective services are reused. Documentation only; local dirty D2 files must be safely reconciled before P1.

# c12-map-markers/two-pass — one Chat turn, two automatic local-model passes

**Owner direction:** 2026-11-03 (America/Chicago), /prompt-ass → /prompt-plan + /prompt-write. **Status: THREE MANUAL PROMPTS AUTHORED, NOT RUN OR QUALIFIED.** Current remote documentation/source reference is `1aeba34f2b37226f59d252a1c74dc45e6d82d563`; local HEAD, uncommitted work and product version must be inspected at every run. Historical M1–M3, M3-R1/R2, F1–F6 and their NOT GREEN reports are preserved. No product implementation, code execution or version/model change is authorized by merely writing these prompts.

## Owner-approved target

A single developer `/roadmap` request starts **two internal inference calls within ONE saved Chat user/assistant turn**:

1. **Natural plan:** Qwen writes a coherent human-readable implementation Roadmap with explicit Phase headings, Gates and observable acceptance criteria. No JSON, RM1, model-created IDs or stage tool choreography. This is a planning artifact, not a canonical Roadmap.
2. **Dope lock:** Once the *final* natural plan completes and passes bounded sanity validation, persist its exact immutable bytes and SHA-256 with the originating project/Chat/execution/owner-revision/source identity, in the **existing Chat authority**, not a new parallel Roadmap store.
3. **Automatic conversion:** Same selected local model and current user execution, a fresh minimal inference context containing only the exact locked plan and the RM1 conversion contract. No previous reasoning/Chat history, re-planning or hidden fallback provider. Exactly one automatic conversion attempt; no third model call/retry loop.
4. **Existing review:** The strict RM1 parser yields the same untrusted typed candidate; the current F3 staged-proposal owner validates it; existing F4 canvas handles selection/pencil/checked Apply, F5 Chat shows a single status card and View in Roadmap. No canonical/Markdown/History write before explicit owner Apply.

The user's **one saved assistant response** shows truthful planning → locked → converting → ready/failed stages and lets them inspect the locked plan. If conversion fails, the locked plan persists as an **inert** saved artifact; a later explicitly requested Retry Conversion is a separate action, not an automatic third attempt. Never treat a saved snapshot as authorization to create/apply a canonical Roadmap without fresh lease/project/source/turn checks.

## Manual prompt order (not codex:phase)

| Prompt | Single primary responsibility | Verification |
| --- | --- | --- |
| [D1 — Natural plan and durable lock](D1-natural-plan-lock.txt) | First pass + secure Chat-owned immutable plan snapshot | T2 focused source/persistence tests, **no browser/Qwen** |
| [D2 — Automatic converter and one-turn bridge](D2-automatic-conversion.txt) | Fresh-context second pass, semantic checks, existing validated proposal + one assistant lifecycle | T2 focused orchestration/authority tests, **no browser/Qwen** |
| [D3 — Codex Browser dogfood entry](D3-codex-browser-qualification.txt) | One real selected-model two-pass run through canvas Apply and Prepare Work | T3 **Codex Browser only**, after stable-host preflight |

**Manual only:** Run each prompt separately in GPT-6 Sol High; no automatic chaining/runner, self-commit, version bump, model/provider/context changes, reset/stash/clean or writes in the owner's actual tower-defense project. D1/D2 target <=8 minutes implementation + focused checks, 10-minute soft and 15-minute hard boundary. Build only changed packages required by tests importing `lib`; no browser server, `npm run build:browser`, full suite or LM Studio inference during D1/D2. D3 uses the existing Dope app in **Codex Browser** (never standalone Chrome) and one integrated run, with at most one narrowly justified repair/retest. Earlier memory/OS crash history requires checking host stability before running D3.

**Source and outcome:** Read [assessment](prompt-assessment.md), [implementation plan](implementation-plan.md), [ADR 0047](../../../decisions/0047-native-roadmap-authoring-and-automatic-sync.md), [native contract](../../../planning/p12/native-roadmap-authoring-contract.md) and [M3-R2 NOT GREEN](../qualification/2026-11-03-m3-r2-manual-closeout.md). Prior reports remain historical, not rewritten. D1/D2 can become **IMPLEMENTED / SOURCE-VERIFIED** only; only D3 can demonstrate real two-pass generation and Roadmap editor dogfood-entry readiness. No whole Phase 12 or Work qualification claim.
