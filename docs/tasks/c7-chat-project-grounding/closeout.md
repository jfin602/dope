# Correction 7 — Chat Project Grounding: P3 closeout

Decision: **Not Green** (2026-10-04). Product Phase 7's retained `0.7.31` closeout is unchanged. This decision applies only to `c7-chat-project-grounding`; Phase 8 remains gated on a completed correction qualification.

## Exact candidate

- Package version: `0.7.31` in the root and all 11 workspaces; all internal `@dope/*` references remain `0.7.31`. No root lockfile or shrinkwrap was introduced.
- P1/P2 source HEAD: `fa7a0c9263d45f515647d5725eacdfba7160f756d` (`c7-chat-project-grounding/P2`), preceded by P1 `0ed50c9fbb8a0159f797c5c35999ded355e7392c`.
- P3 source candidate: that HEAD plus the uncommitted changes to `packages/chat/src/index.ts`, `packages/theia-extension/src/node/chat-project-grounder.ts`, and `test/unit/chat-project-grounding.test.ts`. SHA-256 of `git diff --` those three paths: `a6c048fda87d234415c5652cc384d6fc4c05af359f21f8d3f2ce7ce770a2b96d`. No Git commit was created.
- Qualification used a disposable full Dope copy at `/tmp/dope-c7-p3-ZJbCCm/project-a`, a second disposable project at `/tmp/dope-c7-p3-ZJbCCm/project-b`, the browser app, and a real local LM Studio `openai/gpt-oss-20b` model. The first project had an external sentinel file and an inside-project symlink to it for containment probes.

## Automated evidence

| Gate | Result |
| --- | --- |
| Focused grounding/context/routing/presentation suite: `node --test test/unit/chat-project-grounding.test.ts test/unit/chat-grounded-turn.test.ts test/unit/chat-context-composer.test.ts test/unit/chat-interactive-routing.test.ts test/unit/chat-presentation.test.ts` | **20/20 pass** on the final source repair. |
| `npm run check` | Passed on the initial P2 candidate and after the first P3 repair. The latter run included runner 95/95, baseline 11/11, local install 1/1, product 292/292, Software Map initialization 28/28, IDE 1/1, and typecheck/browser/Electron builds. It was **not rerun after the final source lookup repair**, so the exact final candidate lacks the aggregate gate. Logs: `/tmp/dope-c7-p3-check.log`, `/tmp/dope-c7-p3-check-after-repair.log`. |
| `npm run codex:phase:validate -- c7-chat-project-grounding` | Passed before closeout. |
| Version/internal references/no root lock; `git diff --check` | Passed on the P3 source candidate. |

## Direct browser and model evidence

Each completed project-fact turn was inspected in the captured actual local-model request and persisted Chat turn refs. The browser displayed distinct `Auto context (N)` entries with project-relative labels. A plausible model answer alone was not counted.

| Question without manual context | Observed result and evidence |
| --- | --- |
| `what is in test/?` | Auto directory evidence listed actual `fixtures/`, `integration/`, `unit/`; model answered within that bound. Automatic refs persisted. |
| `what is at the repository root?` | Auto root directory listing reached the model and refs; completed answer named actual entries. One earlier attempt was cancelled by a browser reload and was not counted. |
| `does package.json exist?` | Auto file contents reached the model and refs; model answered yes. It also overstated that it had complete contents while quoting a shortened view, an answer-calibration residual. |
| `does src/definitely-not-real.ts exist?` | Auto absent-file evidence reached the model and refs; model answered absent. |
| `where is Chat persistence implemented?` | Initial live answer hallucinated source files from broad search results. A bounded repair added source-path priority and a 12 KiB implementation excerpt. Replay request included `packages/chat/src/node/chat-repository.ts` source and automatic refs; the answer correctly identified `ChatRepository` and `.dope/chats`. |
| Canonical Architecture purpose of the Software Map core subsystem | Auto canonical Architecture purpose reached the model and refs; answer matched it. An extra map selection on `core` was unrelated but did not change this answer. |
| Current Physical Map generation and completeness | Current disposable-project map evidence reached the model and refs; answer reported generation 1 and partial completeness, matching the browser index. |

Adversarial live turns covered `../host-secret.txt`, `/tmp/`, an absolute external sentinel path, generic `.dope/`, the symlink to the external file, a nonexistent project file, and a nonexistent Physical Map node ID. The repaired request/evidence path supplied an explicit `grounding-status` rejection or unavailability ref for these probes. The captured model requests contained neither the external `HOST_SECRET_SENTINEL_9fe2` nor private `.dope/` content. Model wording often said it lacked evidence rather than using the word “rejected”; the explicit rejection was in visible Auto context. A stale map after source mutation was covered by the focused test, not a live browser turn.

Manual context was also exercised: attaching `README.md` produced a `manual:file:README.md` persisted ref alongside automatic project orientation, and the local turn completed. The answer reflected the README's stale Phase 7A wording, a source-content limitation rather than missing attachment.

## Repair and state boundaries

The first observed defect was missing explicit request evidence for unsafe paths. The repair added a typed, persisted `grounding-status` Auto context block for rejected/unavailable requests, kept rejected absolute paths out of ref labels, and failed a nonexistent map identity explicitly. The second was insufficient implementation-source evidence for the Chat persistence question. The repair ranks bounded source paths and attaches a bounded source excerpt. Focused regression tests now cover both defect classes. No mutation tools, role policy change, or new authority were added.

Canonical files in the disposable project matched their starting hashes after the Chat turns: Architecture `b2356b71e27131607e4e46f93d6a6eac5626d225a5486cde65883f31ba713928`, Project Mind `276e6c651603f03f09f5faf0c5181ae70b31fe5ebb69645483fbfadfd2f1b2a2`; Planning Map storage was absent before and after. Reanalysis produced the same Physical Map input fingerprint before and after: `cef193d62e67ebd9fe5f7372c38d604660793987b865a249a201fa91d79beaec` (generation 1, partial completeness in each fresh index).

## Open qualification gates and residuals

- No direct second-project switch proved absence of prior Auto context/root-fact leakage. Focused project-handle isolation tests passed, but they do not replace this P3 browser gate.
- Retry with unchanged evidence and retry after mutating referenced evidence were not directly run. Focused retry tests passed; live persisted-turn behavior remains unqualified.
- No live Interactive-routed turn, exact-model failed turn, or hosted-egress probe was completed in this P3 pass. Focused routing tests and retained Phase 7 evidence remain, but this correction's direct regression gate is incomplete.
- The final source lookup repair needs the aggregate `npm run check` gate. The model's `package.json` answer overstated excerpt completeness.

Complete these bounded P3 gates against this exact source candidate, rerun only gates invalidated by any further repair, and update this decision before routing a fresh Phase 8 Scoped Delegation `/docs-review`.

## Owner sequencing waiver — 2026-10-05

The owner explicitly accepts the retained P3 qualification gaps above **for sequencing into Product Phase 8 only**.

This does not change the correction decision:
- `c7-chat-project-grounding` remains **Not Green**;
- the missing direct second-project switch, live retry/routing/egress evidence, final-candidate aggregate check and answer-calibration residual remain open historical truth;
- no Green/Qualified claim is created.

The useful grounding implementation is retained. Phase 8 may activate from the committed `0.7.31` source containing that implementation, with a coherent `0.8.0` version transition. Any future grounding requalification must address the retained gates rather than treating this sequencing waiver as evidence.
