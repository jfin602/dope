# D3 Codex Browser closeout — 2026-11-03

**Verdict: NOT GREEN / DOGFOOD HOLD.** One authorized baseline on the selected local Qwen model failed during the first natural-planning pass. There was no completed final plan to lock, so automatic RM1 conversion, canvas review, checked Apply, reload of an accepted Roadmap, and Prepare Work could not be qualified. No repair or retest was run. Owner follow-up after the baseline explicitly prohibited code edits.

## Source and entry

- Local HEAD `d6b55b7ed78f559e6b807aa70c5bb1119e7b571a`, product `0.12.7`; clean entry and exit working tree before this report. No product code, model, provider, version, lockfile, or owner tower-defense source changed.
- D1 lock and D2 orchestration are committed. Focused repository, local-model, backend, typed-stage, and two-pass tests: 71/72 passed together; the single failure was `ENOTEMPTY` while removing a temporary Chat directory. That same test passed when rerun alone. This is source evidence, not browser qualification.
- `npm run build:browser` passed once. Built `chat-backend.js` SHA-256 `9723c0cd2e35b1cbd47e9579377da7f89bec32faacd98f05cb5c3063efe84580`; `roadmap-local-model.js` `ba3d04f2578dae1f4d6ab0e85739ed71124e4e035bffcdf3a0bbb9493da07e33`; frontend bundle `23fc1b02dadd087f0c742beadfbe00cfc33919bd9a739766f002f7da5c8a8249`; backend bundle `d88dc2a6e9a18b1c0a87968ea4f47e4ec15add0efb12032bdf8c15d0b5ac9b64`. HTTP-served frontend bytes matched the built frontend hash. One browser server was started after the build at `127.0.0.1:3000`; the backend file hash is not an independent in-memory attestation.
- The fresh disposable project was `/tmp/dope-d3-tower-CKwkEp`, with only `package.json` and `src/game.ts` as project source. Their SHA-256 hashes were `2e4267740cc6be1ba7585feab7f330f5e01a144e008da82f11322ecd18ad5372` and `fd2937f394039202e67720ed94904478e87598e5ca311de304a33519197fbe43` before and after. Host memory available was about 7.7–9 GiB during entry checks; the previous OS crash did not recur in this run.
- One Codex in-app Browser tab showed the disposable project and active Roadmap canvas. AI Center showed the Interactive role pinned to `LM Studio · qwen3.5-9b`, ready, local-only, zero configured fallbacks; LM Studio showed the model loaded at 16,384 context tokens with provider-reported local reasoning. The saved Chat used Follow Interactive, Ask commands, 8,192 input budget and 1,024 saved output reserve. Dope's Roadmap path requested 4,096 output tokens. No setting was changed.

## Browser observation and persisted evidence

The exact D3 tower-defense `/roadmap` brief was submitted once in the existing saved Chat. The Codex Browser accessibility view showed one user entry and one working assistant entry, natural-planning progress, and visible reasoning activity. It did not show a final natural plan or a second-pass transition. At **5m54s** the assistant ended in Error: `finishReason=length`, `providerFinalText=absent`, 3,924 reasoning tokens, 172 reported final tokens, 4,528 total tokens, 4,096 requested output tokens, measured context 16,384. Provider input-token usage was unavailable. These are first-pass diagnostics; second-pass wall time, usage, and finish reason are unavailable because it never ran.

The saved Chat has exactly one user message and one failed assistant message under Chat `9ae5d75b-ab0a-4379-9620-5bb66bc7ab1a`, assistant `e3cc64a7-cf54-498d-acc4-20af59e36d85`, execution `2f6a2437-de00-47a9-abe3-81303c53d277`. It records a failed planning activity and **no `lockedRoadmapPlan` or proposal**. The UI response-info panel showed the selected `qwen3.5-9b` target and role-policy resolution. The browser tab became unavailable after the task interruption, so a browser reload check was not completed; the persisted Chat was read independently from the disposable project after the failure.

The disposable root after failure contained `.dope/chats` and `.dope/history-focus.json`, with no `.dope/roadmap.json` or `ROADMAP.md`. No applied Roadmap revision, Gate evidence, Markdown publication, or Work execution was observed. No model output received approval authority.

| Gate | Result | Evidence |
| --- | --- | --- |
| Q1 pass 1, completed natural plan and lock | **FAIL** | The only model call exhausted its output limit without a completed provider final answer. Saved assistant has no plan lock. |
| Q1 pass 2, same-model isolated conversion | **EVIDENCE GAP / NOT RUN** | There was no locked input. Source tests exercise the isolated two-call path; no live second call occurred. |
| Q2 faithful RM1 proposal | **EVIDENCE GAP** | No RM1 conversion or staged candidate. Counts, ordering, and mechanics cannot be compared. |
| Q3 canvas and compact Chat review | **EVIDENCE GAP** | Active Roadmap canvas stayed empty; no proposal review controls became applicable. |
| Q4 checked Apply, Markdown, reload | **EVIDENCE GAP** | No valid subset existed to approve; canonical Roadmap and Markdown files were absent. |
| Q5 accepted Gate → Prepare Work | **EVIDENCE GAP — DOGFOOD HOLD** | No accepted Gate existed. No Work action was started. |
| Q6 source/negative authority | **PARTIAL PASS** | Focused D1/D2 tests passed apart from a transient test cleanup race that passed alone; this live failed turn produced no lock, proposal, canonical file, or Markdown file. Browser cancellation and stale-lock revival were not separately exercised. |

## Historical comparison supplied by the owner

After this run, the owner supplied `/home/jfin/Pictures/look.png`, a **historical 2026-11-02 screenshot**, and asked for no code edits. It shows a completed **2m13s** Chat answer from an earlier, shorter PixiJS tower-defense request, with phase headings and detailed implementation checklists; the visible portion includes Phase 1 through the start of Phase 4. The owner reports that the then-current parser copied only phase titles to the canvas. The screenshot supports the narrower observation that useful structured planning prose existed quickly while the old projection discarded much of its detail. The screenshot does **not** establish the full unseen answer, explicit Gate/observable-Criterion equivalence, or a validated current schema-2 proposal. It is separate from the D3 model run and cannot turn this failed result Green.

## Qualification state and progression

- **Implementation:** D1/D2 committed and focused-source verified; D3 made no code repair.
- **Verification:** **NOT GREEN.** The selected local model failed before the durable-lock boundary. Two-pass generation and the downstream review/apply/dogfood path remain unqualified on this source.
- **Progression:** **DOGFOOD HOLD.** Smallest observed blocker: first-pass output budget consumed predominantly by reasoning before a complete final natural plan. The historical screenshot suggests preserving a concise completed natural plan and its full detail is worth reassessing, but it does not authorize a fallback parse or another model run. F6, M3, and M3-R2 remain separate NOT GREEN history. Native Electron, Work execution, and whole Phase 12 are not claimed.
