# P8 absolute path repair — second disposable live rerun

Date: 2026-11-27 (America/Chicago). Result: **ordinary task completed in this disposable Direct Work run; P8 Gate status unchanged**. This is additive to the [focused repair](P8-absolute-workspace-path-repair-2026-11-27.md), [first live rerun](P8-absolute-path-live-rerun-2026-11-27.md), [transparent failure](P8-transparency-rerun-2026-11-27.md), and [original P8 closeout](P8-final-closeout.md). No earlier report or evidence was overwritten.

## Exact source and setup

Dope source remained on HEAD `6007b12c6d63b5348f8d46c9b0fa51452f7d8d71`, version `0.14.0`, with the uncommitted repair. The changed source and test SHA-256 values remained those recorded in the focused repair report. No product code changed since its 5/5 focused tests, 29/29 Direct tests, Pi runtime check, and extension/browser/Electron builds passed. Those checks were not rerun for this browser attempt.

A fresh disposable project at `/tmp/c14-p8-retry-2-esE1w6` had initial Git HEAD `2dc1119905c86b258f0c8086283d81d497228efa`, with tracked `index.html`, `main.js`, and `package.json`. Its Dope state was ignored only in the fixture's `.git/info/exclude`; the project source basis was clean. The `index.html` native editor tab was open and saved. Dope was served from the patched browser build on `127.0.0.1:3000`; LM Studio supplied `qwen3.6-35b-a3b` at context 33024. Work used Direct mode, an exact local Qwen target, and selected `read`, `ls`, `write`, `edit`. The required Dope validation command was `node --check src/main.ts`. No command tool was available to Pi.

The ordinary Work instruction contained no relative-path guidance:

> Inspect this project. Create src/main.ts using only JavaScript syntax to draw the title on the canvas. Edit index.html to say Meteor Dodge Replay and load src/main.ts. Keep main.js intact. Finish after the edits; Dope will run the configured syntax check.

The final sentence clarified validation ownership after the first live rerun's model loop; it did not change Pi's path arguments or the broker contract. Run ID `443e7090-409c-43b7-b1b4-0389867528db`; active execution workspace `/tmp/dope-execution-pyl2Ju/work`. Exact copies of the [run receipt](absolute-path-live-rerun-2-2026-11-27/run.json), [transparent transcript](absolute-path-live-rerun-2-2026-11-27/transcript.jsonl), [events](absolute-path-live-rerun-2-2026-11-27/events.jsonl), [initial fixture](absolute-path-live-rerun-2-2026-11-27/initial-index.html), and [result files](absolute-path-live-rerun-2-2026-11-27/result/index.html) are preserved alongside this report.

## Observations and outcome

Pi again made its first call as `ls({"path":"/tmp/dope-execution-pyl2Ju/work"})`. The transcript retained that raw absolute path and recorded `resolvedProjectPath: "."`; broker execution completed and returned the three initial files. All 11 file-tool requests used absolute paths inside this workspace: 3 `ls`, 6 `read`, 1 `write`, 1 `edit`. Each completed through broker execution with a validating resolved project path; none was rejected. The write to `src/main.ts` and edit to the saved open `index.html` tab both completed. The editor displayed the changed title and script afterward without a dirty-buffer conflict.

The model finished its turn, then **Finish Work** triggered Dope's required validation. The run receipt is `completed` with changed files exactly `index.html` and `src/main.ts`. The validation receipt is `passed`, exit code `0`, for `node --check src/main.ts` against the current workspace fingerprint. The resulting `.ts` file contains JavaScript syntax only. `index.html` has the new title, heading, and module script; `main.js` and `package.json` are byte-identical to the initial fixture. The browser Work panel showed **Finished**, two applied files, and required validation applying to current source.

This is a successful end-to-end disposable run for the repaired absolute-path handling and ordinary edit/validation task. It does not establish first-write reliability across repeated or parallel attempts; only one first write was exercised here. It also does not prove that a separate browser can load the `.ts` script from this fixture. No Gate or Phase status was awarded, no version was changed, and no commit was made.
