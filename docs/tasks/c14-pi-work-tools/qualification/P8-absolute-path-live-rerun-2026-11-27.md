# P8 absolute execution-workspace path repair — disposable live rerun

Date: 2026-11-27 (America/Chicago). Result: **absolute-path broker compatibility observed live; ordinary Work task NOT GREEN**. This report adds evidence to the [focused repair](P8-absolute-workspace-path-repair-2026-11-27.md), [earlier transparent rerun](P8-transparency-rerun-2026-11-27.md), and original [P8 closeout](P8-final-closeout.md). Their files and historical evidence were not changed.

## Exact source and setup

Dope Git HEAD was `6007b12c6d63b5348f8d46c9b0fa51452f7d8d71`, product version `0.14.0`, Pi SDK `1.4.0`, with the uncommitted repair and owner work listed in the focused report. The five changed source/test SHA-256 values in that report were rechecked before this live run and were unchanged. Browser and Electron builds, the Pi runtime check, and 5/5 focused plus 29/29 Direct tests passed on those bytes in the preceding focused verification; no code was edited or rebuilt for this rerun.

The browser was served from the local patched build at `http://127.0.0.1:3000`. A fresh disposable Git project was created at `/tmp/c14-p8-absolute-live-akFU0h`, initial HEAD `f060f16fcecb21810ad2a94821d5566b3721134d`, with tracked `index.html`, `main.js`, and `package.json`. Its `.dope/` state was excluded through the disposable repository's `.git/info/exclude` so Start Work saw a clean source basis. `index.html` was open in a saved native editor tab throughout the run. LM Studio served `qwen3.6-35b-a3b` at context 33024; the model passed the AI Center synthetic Coding Agent tool check. The Work selection was **Direct**, exact local Qwen target, and exactly `read`, `ls`, `write`, `edit`. The required Dope validation command was `node --check src/main.ts`; `run_command` was not selected or available to Pi.

The Work instruction, with no relative-path guidance, was:

> Inspect this project. Create src/main.ts with JavaScript-compatible TypeScript that draws the title on the canvas. Edit index.html to say Meteor Dodge Replay and load src/main.ts. Keep main.js intact. Validate the new file and report the result.

Run `ea592b86-b090-4c7c-a337-ee1503bd3171`, grant `1945e404-5c7b-4718-87c7-230c899dd274`, execution workspace `/tmp/dope-execution-yKe4VP/work`. The exact [run receipt](absolute-path-live-rerun-2026-11-27/run.json), [transparent transcript](absolute-path-live-rerun-2026-11-27/transcript.jsonl), [events](absolute-path-live-rerun-2026-11-27/events.jsonl), [initial fixture](absolute-path-live-rerun-2026-11-27/initial-index.html), and [result files](absolute-path-live-rerun-2026-11-27/result/index.html) are copied unchanged into this evidence directory.

## Observed outcome

Pi's first call was `ls({"path":"/tmp/dope-execution-yKe4VP/work"})`, the active workspace root. Transcript sequence 4 retained that exact raw argument. Sequence 6 recorded `resolvedProjectPath: "."`; sequence 7 completed broker execution and returned `index.html`, `main.js`, `package.json`. The earlier absolute-path parser rejection did not recur.

All 21 file-tool requests in this run used absolute paths under that same workspace root: 3 `ls`, 6 `read`, 11 `write`, and 1 `edit`. Each has a requested raw argument and a validating `resolvedProjectPath` observation; each completed through broker execution. There were no rejected tool calls. In particular, the absolute `write` of `src/main.ts` resolved to `src/main.ts`, and the absolute `edit` of `index.html` resolved to `index.html`. The latter completed with the saved native editor tab open. The editor displayed the new title and script tag afterward without an unsaved-buffer conflict. This is live evidence for the saved-tab case, alongside the focused negative tests; it does not qualify unsaved-buffer handling beyond those tests.

The intended `index.html` and `src/main.ts` were created/edited, and `main.js` stayed byte-identical to the initial fixture. The model also wrote `validate.js` and rewrote `package.json` nine times while attempting to run validation without a selected command tool. The package rewrite only removed its final newline. After repeated identical writes, Work was stopped through the UI. The final run status is **cancelled**, and the required Dope validation receipt is **cancelled**. A separate direct `node --check src/main.ts` on the resulting file exited nonzero: line 1 contains `as HTMLCanvasElement`, which Node reported as `SyntaxError: Unexpected identifier 'as'`. The agent did not finish the task or report a successful validation. Its statement that the source was JavaScript compatible is contradicted by the saved file and syntax check.

## Scope and gaps

This live run directly verifies the repaired absolute-path contract and the authorized saved-tab edit. It does **not** show a complete ordinary-task success, a successful validation, or resolution of the separate parallel first-write reliability issue. One first write happened to complete here; that observation is not a reliability qualification. The earlier P8 statuses remain intact. No Gate, Phase, version, or commit action was taken.
