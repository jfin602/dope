# Correction 11 / M1 — verified guidance repair closeout

**Disposition: NOT GREEN for the scoped browser/local-Q4 UX-003 correction. Phase 11 remains OPEN / NOT QUALIFIED.** The repair made verified, complete Roadmap replacement guidance visible in repeated real browser turns and prevented the observed Planning Map and status errors. The final selected-checkpoint repeat did not complete: LM Studio stopped responding, the turn was cancelled, and the owner reported that LM Studio crashed. The final source therefore lacks the required repeated selected and unselected GUI proof. This result does not replace the historical [P8 NOT GREEN](../../p11/known-issue-closeout.md) or [P3 NOT GREEN](../closeout.md) records.

## Source, scope and implementation

- **Git base:** `d1ee49f042ea652c829bbcc9c33de5a1f1be8e21` on the shared checkout. The M1 product, tests and this report are **uncommitted**. No phase runner or commit was used. The task's claimed committed recovery-contract path, `manual/verified-guidance-repair-contract.md` at `2df4486`, was absent from this checkout; the pasted M1 task and committed P3 record supplied the working contract.
- **Version:** all 13 package manifests and all 20 internal `@dope/*` pins remained `0.11.8`; no version, lockfile, model default, provider permission or hosted fallback was changed.
- **Changed boundary:** the existing capability selector now distinguishes Roadmap source replacement, refresh, status and Objective help from Planning Map link help. The backend composes guidance from that capability and current Roadmap owner/source state, saves it as a backend-owned marker only on a validated `no-action` turn, and omits prior generated Chat history from the help prompt. The Chat presenter shows that marker as **Verified Dope guidance** while leaving the model's strict JSON, activity and local provenance inspectable in the collapsed disclosure. No second inference call or Chat action authority was added.
- **Source checks:** for a recorded `synced` link the backend checks the live linked file and its stored hash before giving available replacement guidance. Missing or changed source yields blocked guidance and a recovery route. Linked-file replacement still requires a human preview and explicit confirmation in Roadmap; a help turn writes no Roadmap or Markdown data.
- **Files:** `packages/chat/src/index.ts`, `packages/theia-extension/src/node/dope-capability-help.ts`, `chat-context-composer.ts`, `chat-backend.ts`, `packages/theia-extension/src/browser/chat-panel-presentation.ts`, and focused tests in `test/unit/dope-capability-help.test.ts`, `roadmap-chat-context.test.ts`, `chat-presentation.test.ts`.

## Real browser and model evidence

The actual Codex in-app browser ran Dope at `http://127.0.0.1:3000`. The served browser bundle and locally built bundle were observed with matching SHA-256 `3afa59ee45d1f2d447bc8fa47378c1f7b7430ce8ac124b75535e` during the GUI run. The explicitly chosen local model was `qwen3-coder-30b-a3b-instruct@q4_k_m`, genuinely loaded by LM Studio with context **32,768**, parallel **1**, GPU offload **27** and seven threads. Completed saved turns report `providerId: local`, that exact model ID and `resolutionSource: explicit-turn`. These settings are only this M1 session's observed profile, not the Phase 10 R6 CPU-only profile or a global default.

The durable [sanitized saved-turn record](m1-saved-chat.json) (SHA-256 `1f97518345787f9404a84a769157152098107aebd71d45a805aea95f673f0512`) contains the exact questions, raw model JSON, verified text, activity outcome and provenance for 15 turns. Browser screenshots of the visible response, collapsed activity and restored Chat were captured in this task's GUI transcript; standalone PNGs were not exported. The unselected disposable project was `/tmp/dope-c11-m1-browser`, saved Chat `905362f5-abca-47fb-be5d-c424b7ac3a3d`. The selected-checkpoint project was the retained P3 fixture `/tmp/dope-c11-p3-browser`, saved Chat `00d3582d-267e-4b12-8a53-58fb5332475e`. Both temporary fixture directories and the browser server were unavailable at the final audit after the local-model interruption, so the earlier source hashes below could not be re-read at closeout.

| Requested browser wording | Direct observation | Gate |
| --- | --- | --- |
| “I linked the wrong Roadmap, how do I change it?” with no checkpoint | Unselected turns 1, 2 and 12 completed. The visible verified answer gave Roadmap → Roadmap Markdown and setup → Change linked file, intended project Markdown selection, preview and affected content, explicit confirmation, old file retained on disk, and Chat's no-action limit. Raw model JSON remained in the collapsed activity. Turn 13, while the disposable old source was temporarily absent, visibly blocked replacement and named Relink Markdown and Refresh. | **PASS** for observed turns; final-source breadth incomplete |
| Same exact wording with selected checkpoint | Selected turn 1 completed with the full visible procedure. Selected turn 2, attempted after the last backend source adjustment, stalled waiting for LM Studio, then was cancelled. Its activity is `cancelled`; it has no verified answer. The owner reported an LM Studio crash. | **BLOCKED** repeat / final-source qualification |
| “I selected the wrong Roadmap.” | Unselected turn 3 showed the full source-replacement procedure. | **PASS** observed turn |
| “Replace the linked Roadmap.” | Unselected turn 4 showed the full source-replacement procedure, despite the raw model answer omitting the full path. | **PASS** observed turn |
| “Switch the Roadmap document.” | Unselected turn 5 showed the full source-replacement procedure, despite the raw model answer omitting several steps. | **PASS** observed turn |
| “How do I refresh or sync the current Roadmap?” | Unselected turn 6 said the recorded source was `synced`, named Refresh Roadmap and the setup view, and did not claim conflict or approval. | **PASS** observed turn |
| “How do I edit this checkpoint Objective?” | Unselected turn 7 gave the Objective inspector, preview/save and approval route; it did not relink Markdown or apply an edit. | **PASS** observed turn |
| “How do I change a Planning Map link?” | Unselected turns 8 and 11 said Chat has no verified direct link-edit procedure. The later response explained that Roadmap source replacement does not edit a Planning Map link and Objective editing is not a prerequisite. No unrelated action was recommended. | **PASS** observed turns |
| “What is the current Roadmap status?” | Initial unselected turn 9 correctly said `synced` but omitted owner/checkpoint facts, so the status summary was refined. Repeated turn 10 showed owner revision **1**, one active checkpoint “Product Phase 1 — Wrong source,” and recorded `synced` source state. | **PASS** repeated turn; early response incomplete |

The turns were iterative: early observations preceded the status and live-hash refinements. The final source was directly exercised in the unselected missing-file browser turn and focused tests, but the selected exact-wording final replay was cancelled. Prior successful turns cannot be relabelled as a complete final-source GUI matrix. Reloading the real browser restored saved user/assistant messages, visible verified text and collapsed raw activity. No hosted/Codex model was substituted when LM Studio failed.

## No-write and validation record

The unselected fixture remained at Roadmap owner revision **1** in the observed run. Before and after the browser turns and restored temporary missing-file check, recorded SHA-256 values were:

| Disposable project file | Observed unchanged SHA-256 |
| --- | --- |
| `.dope/roadmap.json` | `21321139508a362de5c28937ea089dc743cb6b30e01c5c9f495db43892e47f1d` |
| `docs/roadmap/wrong-roadmap.md` | `75ddf7be000db7e889c459b1bf0aaebfb70f60dbe25e3757d96990bff70deee7` |
| `ROADMAP.md` | `7dfec5021bc222e88e9cf39097e21542a69b3ba5c0748f8e351a85d97b817cdc` |

The selected P3 fixture was exercised for one completed no-action answer and one cancelled turn; no approval or source-replacement control was used. Its owner revision **1** and old-source preservation were observed during the run, but the temporary fixture was unavailable for a final hash audit. The cancelled turn made no proposal or write. No cross-project or native GUI conclusion follows from these fixtures.

Focused affected-package builds and regression tests passed after the repair, including the final 16 focused tests for capability selection, context, saved presentation and source-state recovery. `npm run build:browser` passed. The first `npm run check` process produced passing build/test output but its completion status was lost during the local interruption. A captured `npm run check` rerun **passed, exit 0**: all six test groups reported **740/740 passing**, with typecheck, browser and Electron builds passing. An Electron build is not native GUI qualification. `git diff --check` passed. Unit cases cover malformed strict output and contradictory model claims; neither is claimed as a live local-model negative turn.

## Acceptance gates and disposition

| Gate | Result |
| --- | --- |
| Complete verified source-replacement guidance in observed real browser turns | **PASS** for completed turns |
| Consistent repeated exact wording in selected and unselected contexts at final source | **BLOCKED** by LM Studio crash and cancelled selected repeat |
| Synced/missing-source state and safe recovery without false conflict or write | **PASS** in observed browser turns and focused tests |
| Planning Map/Objective isolation and inspectable raw model output | **PASS** in observed browser turns |
| Saved Chat restoration, explicit local model, strict no-action, no-write on observed fixture | **PASS** in observed browser turns and source checks |
| Final-source automated aggregate | **PASS**, `npm run check`, 740/740 tests and builds |
| Full final-source GUI qualification of all nine wordings and negatives | **NOT RUN** after the model crash |
| Native Electron GUI and hosted/Codex parity | **NOT RUN**; separate evidence gaps |
| First separate manual Usability Hunter | **NOT RUN** |
| Phase 11 product qualification | **NOT QUALIFIED / OPEN** |

**Next action:** after LM Studio is stable, repeat the selected and unselected exact question and adjacent status/Planning Map controls against this final uncommitted source, with the served bundle hash and before/after project hashes captured again. Qualify only if the whole targeted browser/local-Q4 contract directly passes. Keep native/hosted evidence and the separate manual Hunter independent. No commit or version bump is implied by this M1 report.
