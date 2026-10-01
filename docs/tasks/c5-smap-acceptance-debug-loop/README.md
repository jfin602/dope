# Correction 5 — sMap Acceptance Debug Loop Machinery

Status: **GREEN / MACHINERY CLOSED** — see `closeout.md`; P11 remains paused.
Correction folder: `c5-smap-acceptance-debug-loop`
Required unchanged version: `0.5.11`
Activation source: `502416e2d8589132e8b96454ad3b72407406a20b`
Phase context: Product Phase 5 P11 paused / Not Green
Authority: ADR 0018, `docs/software-map-storage.md`, current ARCHITECTURE / PRODUCT-MODEL / stability contract, Phase 5 authority

## Purpose

Install the machinery required to debug one generated-but-unaccepted sMap repeatedly across restarts without regenerating it. The motivating Adaptive SEO review is blocked by deterministic architecture acceptance. This stack does **not** fix that architecture.

## Scope law

In scope:
- durable mutable Architecture Review draft work state;
- restart/reopen recovery of the latest working draft;
- stale-write/revision protection;
- accepted Search Deeper result persistence;
- complete provider-free acceptance diagnostics;
- shared diagnostics across UI/backend/offline checker;
- a non-mutating zero-provider project checker;
- focused restart/isolation/clear-on-accept-or-cancel regression protection.

Out of scope:
- repairing the current Adaptive SEO ownership/root conflict;
- root deduplication or automatic owner selection;
- synthesis prompt/stage/evidence/ownership algorithm changes;
- evidence-to-root materialization changes;
- running Local or Gemini;
- regenerating Adaptive SEO;
- the actual iterative acceptance-debug loop;
- P11 qualification or P12/`0.5.12`.

## Stack

| Prompt | Work | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| P1 | durable mutable review work state + restart recovery | T2 | GPT-6 Sol High | no |
| P2 | complete acceptance diagnostics + offline checker + UI consumption | T2 | GPT-6 Sol High | no |
| P3 | machinery closeout using deterministic fixtures/evidence | T2 audit | GPT-6 Sol Medium | no |

All prompts keep package version exactly `0.5.11`.

## Existing source leverage

Current source already writes `.dope/smap-analysis.json`, stores a `review_required` run, reloads it in `SoftwareMapBackend.attach()`, reopens it in `SoftwareMapController.attach()`, and clears analysis work after successful acceptance/cancellation.

The missing pieces are persistence of the **developer's latest mutable review draft** and a complete deterministic blocker surface.

## Exit

Green means an intentionally invalid review can be edited, persisted, restarted and reopened with the same working draft and same complete blocker set, with no provider call. Acceptance and cancellation clear the work state.

After closeout, run a **separate** iterative debug loop against the preserved Adaptive SEO review until the real acceptance path succeeds. Then resume Phase 5 P11. P12 remains blocked.
