# IG-R4 independent live browser closeout — 2026-11-08

**Verdict: BLOCKED — connected Codex browser unavailable.** This session did not run the required live GPT-OSS 20B or connected-browser qualification. IG-R3's deterministic prerequisite passes on the current checkout, but it cannot establish any IG-R4 live gate. The c13-incremental-generation correction is **not ready for owner technical closeout** on this evidence.

## Source and prerequisite

- Starting and final product HEAD: `825806c67eaf4cf42306ec9200515cc6f33fa95f` on `codex/ig-r3-headless-recovery`, clean at entry. Its parent `eb0fcda3c796b38c88a45799f35efc4c4ccc7fc9` is the IG-R3 implementation; HEAD adds only its qualification report. Product version remains `0.13.11` across the root and 12 workspace package manifests.
- Read `BOOT.md`, `AGENTS.md`, `docs/workflow.md`, ADR 0055, the incremental proposal contract, and the P6, R1, R2 and IG-R3 qualification reports. P6 and R2 remain **NOT GREEN**, R1 and IG-R3 remain headless PASS, and historical R3B remains PARTIAL. No prior verdict or executed prompt was edited.
- Inspected the actual IG-R3 diff, provider-compatible object tool schemas in `packages/pi-runtime/worker.mjs`, its one-use same-session terminal continuation, ChatBackend's authoritative `finishPermitted` check, assessment/plan validation, staged prompt diagnostics, controller source/lease/replay checks, deterministic prompt composition, and existing Docs and prompt publication owners. This is source inspection, not a live behavior claim.
- Built `@dope/contracts` then `@dope/theia-extension`: PASS. The exact nine IG-R3 focused test files passed **81/81**, zero skipped or failed. `npm run check:pi-runtime` passed: Pi 1.4.0, 121 integrity-locked packages. No source repair was made.
- Local source/build SHA-256 values after those builds: `packages/pi-runtime/worker.mjs` `0c9bfaef00552411d1cf1a230399e18b7f637c6b62f047c0df9d348db97cc536`; compiled `chat-backend.js` `41fc6c9a39bbcc50d2a3fdd60adbf427dbe0b35c49273d69528b1d4fd2362c50`; compiled `pi-conversation-runtime.js` `5095582fd90a0c43ce47079912d81dca658f6b258006755ea0d4e42d519e87f1`. These are **local file hashes, not served host hashes**.

## Mandatory environment blocker

The tools available to this Codex session provide no connected browser control, page inspection, interaction or screenshot capture. `open_in_codex` can display a browser tab but cannot control or inspect the application. A local Chrome/Puppeteer run would be supplemental only and cannot meet the task's explicit connected Codex browser requirement. Therefore no browser host was started or asserted as the tested build, and no local Chrome observation was substituted for connected-browser evidence.

The selected AI Center connection, `openai/gpt-oss-20b` model, endpoint, context and output limits were **not independently verified in IG-R4**. No browser URL/session, served frontend/backend/worker hashes, provider usage, inference time, or connected-browser screenshot exists for this run. Earlier R2 values are historical and are not carried forward as current facts.

## Gate disposition

| Gate | IG-R4 result | Evidence limit |
| --- | --- | --- |
| A — source-grounded assessment and ten-step plan | **BLOCKED** | No native Chat turn, brokered source reads, saved assessment or plan. |
| B — large three-target Docs generation and finish | **BLOCKED** | No live staging, `proposal_finish`, continuation count or review-ready Docs card. |
| C — ten-prompt stack and finish | **BLOCKED** | No live P1–P11 stages, composed files, `proposal_finish` or Prompt Stack candidate. |
| D — Docs review, revision, Reject and Accept | **BLOCKED** | No ready candidate or native browser review; no canonical Docs application or History receipt. |
| E — Prompt review and publication | **BLOCKED** | No ready candidate or guarded R3B publication; no Work discovery receipt. |
| F — denial, restart and recovery | **BLOCKED** | IG-R3's focused source tests pass; the requested live denial and restart cases did not run. |
| G — UI and usability | **BLOCKED** | No connected-browser UI evidence, screenshots, input/theme checks or Electron parity. |

The primary A–C checkpoint is **BLOCKED**. No disposable clamp fixture was created; therefore there is no baseline commit, target hash or candidate hash to report. No proposal revision, rejection, acceptance, canonical file write, publication journal, applied-only History entry, Work grant/Run, Roadmap Gate award, Phase advancement or version change was performed in IG-R4. These are actions absent from this run, not independent proof of the application's behavior under live inference.

## Exit

There were zero IG-R4 repair cycles and zero live model calls. The exact remaining mandatory blocker is access to a connected Codex browser capable of opening and interacting with the freshly built Dope host. On a future independently authorized live run, record served build identities and the selected model first, then run Gates A–C before the remaining review, publication, denial and UI gates. Do not resume Phase 13 recovery R3/R2/R4, start Work, award Roadmap/Phase GREEN or advance the product version from this result.
