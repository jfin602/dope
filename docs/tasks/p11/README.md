# p11 — Initial known-issue usability repair stack

**Current state:** P1–P7 were run and committed in order through `8cad838` / `0.11.7`. [Manual P8](known-issue-closeout.md) advanced the uncommitted candidate manifests to `0.11.8`, passed one 738-test aggregate and found the initial U1–U9 tranche **NOT GREEN** in direct browser use. The exact reported Chat help wording still fails; native GUI and other specified gaps remain. **Phase 11 product is NOT QUALIFIED / OPEN.** The P8 operator did not commit; the runner owns any checkpoint commit. **Date:** 2026-10-16.
**Authoring source:** main `b60afd4` at coherent `0.11.0` version-only baseline. The last directly qualified product is Phase 10 `0.10.16` / `af2b0f0` under approved R6 scope, not a newly validated 0.11.0 product.
**Goal:** Address UX-001 Roadmap source replacement; UX-002 no-action response visibility; UX-003 accurate Dope-aware guidance. Related P1 investigations on loader/overlays are **not** automatically defects or included in this stack.

| Prompt | Assigned version | Tier | Model | Browser |
| --- | --- | --- | --- | --- |
| [P1 — Validate explicit Roadmap replacement preview](P1-replacement-preview.txt) | `0.11.1` | T2 | Sol High | no |
| [P2 — Commit approved Roadmap source replacement safely](P2-replacement-commit.txt) | `0.11.2` | T2 | Sol High | no |
| [P3 — Expose safe Change linked file in Roadmap Markdown](P3-replacement-ui.txt) | `0.11.3` | T1 | Sol Medium | no |
| [P4 — Surface validated no-action message as Chat reply](P4-no-action-readable.txt) | `0.11.4` | T1 | Sol Medium | no |
| [P5 — Define concise verified Dope UI help capabilities](P5-capability-guide.txt) | `0.11.5` | T1 | Sol Medium | no |
| [P6 — Ground Chat guidance in actual available Dope actions](P6-capability-grounding.txt) | `0.11.6` | T2 | Sol High | no |
| [P7 — Regress Roadmap replacement and helpful Chat together](P7-known-issue-integration.txt) | `0.11.7` | T2 | Sol High | no |
| [P8 — Initial known usability repairs closeout and hunt handoff](P8-initial-repair-closeout.txt) | `0.11.8` | T3 | Sol High | yes (manual) |

## Workflow and authority

Use `npm run codex:phase:validate -- p11` **locally before** any implementation. The runner processes P1–P7; P8 is its only final **manual** T3 closeout/handoff, not an automatically accepted phase completion. Under docs/workflow.md, the owner's later explicit Run of an authored stack authorizes implementation; **no /activate gate**. Prompt authorship is not an execution order. **Do not auto-run P8** or a manual hunter in the headless runner. Agents edit versions as part of their work; the runner alone stages and commits successful prompts. Agents must not self-commit.

**Corrected mandatory version contract:** P1 must change coherent manifests from `0.11.0` to `0.11.1`; each subsequent P2–P7 agent must advance all 13 Dope package `version` fields and all 20 internal `@dope/*` dependency pins to its own assigned `0.11.N`. P8 is a manual GUI closeout and its operator owns any eventual transition to `0.11.8`. **The runner NEVER bumps package versions; it validates the root version after Codex returns and commits only a successful prompt.** Each agent must edit the manifests itself before exiting, run `node --test test/unit/theia-baseline.test.ts` and `git diff --check`, and preserve lockfiles and unrelated fields. P8 may be marked Not Green/Evidence Gap if actual live proof is unavailable. Do not call its success **Phase 11 product Green**: Phase 11 intentionally remains open for recurring [manual Hunt → Triage → Repair → Verify](../../planning/p11/phase-11-plan.md) through [usability-hunt-manual.md](usability-hunt-manual.md), [coverage matrix](../../planning/p11/panel-usability-matrix.md) and [issue ledger](../../planning/p11/usability-issue-ledger.md). Future new findings should become individually assessed/authorized `c11-<slug>` correction stacks at then-current unchanged version, not an arbitrarily expanded p11 runner stack.

## Historical: resumed failed P1 without losing completed source work

The first P1 run changed `packages/project-intelligence/src/node/roadmap-store.ts` and added `test/unit/roadmap-replacement.test.ts` but left root at `0.11.0`. The post-turn runner guard stopped: **Expected package version 0.11.1; found 0.11.0.** No P1 checkpoint commit was made. This is a failed version contract, not a reason to discard the source/test changes.

Check `git status --short`. Obtain this documentation-only prompt patch without overwriting uncommitted product files, validate `npm run codex:phase:validate -- p11`, then rerun `npm run codex:phase -- p11` interactively. At the dirty-tree prompt, continue **only after verifying the changed files belong to this unfinished P1**. Corrected P1 explicitly preserves and finishes those edits and bumps all 13 manifests/20 pins. **Do not reset, stash, clean or skip to P2**, and do not claim P1 passed until the runner successfully creates its versioned checkpoint commit. If updating the docs conflicts with local modifications, resolve that conflict deliberately first.

## Critical existing seams

`roadmap-store.ts` already has safe moved-file same-bytes relink and approval, **not replacement of an intact wrongly selected file**; preserve both operations as distinct concepts. `chat-panel-presentation.ts` already has muted raw JSON activity but **generic no-action summaries** that omit `message`; do not build a second chat system. `chat-context-composer.ts` currently instructs Objective editability; short versioned capability-aware advice must be grounded in actual registered Dope controls. All writes are Dope-owned, approval/revision-safe, and manual operation works without AI.

## Gates

- **Initial repair:** P1–P3 authority/GUI Roadmap replacement, P4 validated readable no-action prose, P5–P6 grounded Dope help, P7 focused combined regression.
- **Initial T3:** P8 U1–U9 on a real disposable project with exact-source/version, user-visible screenshots/errors, old-file unchanged, new source/restart, Q4 provider selection, Chat one-owner/permissions, and one exact-candidate aggregate.
- **Long-term:** After P8, repeated diverse manual hunts, persistent deduplication/coverage, bounded repairs and final owner closeout. Two different clean broad hunts alone never guarantee product Green.

## Efficiency

All P1–P7 have **one coherent scope**, minimum source/lib builds and selected direct tests, expected <=8m with 10m soft / 15m hard ceiling. Full `npm run check` occurs only in manual P8 if justified, not once per prompt. P8 T3 may take longer and requires real GUI tools. No invented timing or Green from authored docs. Do not execute the phase merely by reading this README.
