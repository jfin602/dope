# P8 transparent transcript rerun — NOT GREEN

Date: 2026-11-27. This is a bounded rerun of the failing and partial Direct Work cases from [the original P8 closeout](P8-final-closeout.md). The original report and its NOT GREEN verdict remain unchanged. Product source at entry was `6007b12c` (`transparent transcripts`), initially clean, with version `0.14.0` and Pi SDK `1.4.0`. `npm run build:browser` passed before the qualifying runs. No product source, version, Roadmap Gate, or phase status was changed by this rerun.

## Setup and scope

Dope ran in the connected browser at `http://127.0.0.1:3000` with local LM Studio model `qwen3.6-35b-a3b`, context 33024 and parallel 1. The temporary project was `/tmp/c14-p8-transparent-built-Mb1p37`, initial Git HEAD `d308edaad2594a9fcd062a5949b5d424ff3a9829`, with tracked `index.html`, `main.js`, and `package.json` and no `src/`. Its `index.html` was open and saved in the native editor throughout. Direct Work selected `read`, `ls`, `write`, and `edit`; the required validation command was `node --check src/main.ts`. The initial and resulting fixture bytes are copied under [transparency-rerun-2026-11-27](transparency-rerun-2026-11-27/).

The first browser attempt after the logging source change accidentally used stale built assets. Its run `a5120042-c985-458e-bf88-d204fbde2d04` is retained under `stale-build/` but excluded from the transparent result. The browser was rebuilt and restarted before both runs below. These new runs use a newly created fixture and are a bounded reproduction, not a byte-identical replay of the deleted original fixture or prompt.

## Qualifying runs

| Case | Result | Saved evidence |
| --- | --- | --- |
| Ordinary Direct Work, editor open | **FAIL**. Run `f7b3078c-ddf5-47d9-902c-09c685044944` stopped on its first call, `ls({"path":"/tmp/dope-execution-8fVwU6/work"})`. The transparent receipt shows `pathStatus:"absolute"`, `reason:"Invalid Pi file path"`, stage `request-parse`, code `INVALID_OR_UNAUTHORIZED_ARGUMENTS`, `brokerInvoked:false`, and `effectExecuted:false`. Zero files changed; validation did not start. | [Ordinary transcript](transparency-rerun-2026-11-27/ordinary/transcript.jsonl), [run receipt](transparency-rerun-2026-11-27/ordinary/run.json), [events](transparency-rerun-2026-11-27/ordinary/events.jsonl) |
| Guided Direct retry with project-relative file paths, same open editor | **PARTIAL**. Run `772fb3b6-8142-44b2-9575-09c99de96cd4` made ten completed Pi tool calls with zero denials. It created `src/main.ts` on the first write and edited the open `index.html`; `main.js` remained intact. Its required validation failed: `node --check src/main.ts` exited 1 on `as HTMLCanvasElement`. Dope correctly recorded `validation-failed`, two applied files, zero uncertain files. | [Guided transcript](transparency-rerun-2026-11-27/guided/transcript.jsonl), [run receipt](transparency-rerun-2026-11-27/guided/run.json), [events](transparency-rerun-2026-11-27/guided/events.jsonl), [resulting files](transparency-rerun-2026-11-27/fixture-result/) |

The ordinary prompt asked the model to inspect the project, create `src/main.ts` containing JavaScript-compatible TypeScript that draws the title, edit `index.html` to say `Meteor Dodge Replay` and load that file, keep `main.js`, and validate the new file. The retry added: “For every Pi file tool call, use project-relative paths such as ., index.html, main.js, and src/main.ts.” Both used the same selected tools and validation command.

## Diagnosis

The previously hidden ordinary-run argument is now visible. Pi supplied an absolute path to its temporary execution workspace, while Dope's Pi file-operation parser accepts only project-relative paths. Dope denied the call before the broker or editor could act. This is a Pi/Dope tool path contract mismatch, not evidence that opening `index.html` blocked editing. The guided retry edited that file while it was open. Unsaved editor buffers and concurrent owner edits were not exercised.

The original P8 retry's first nested write denial did **not** recur: this retry's first `write src/main.ts` succeeded. This run did not issue `write` and `edit` concurrently in the same model turn, so it cannot clear the original parallel-call reliability gap.

The validation failure is separate. Installed Node `v24.21.0` can execute `.ts` with erasable types through native type stripping, but local `node --check src/main.ts`, including with `--experimental-strip-types`, rejected the assertion syntax. Direct `node src/main.ts` passed that syntax and then failed at `document is not defined`, as expected when browser DOM code runs in Node. The model also violated the ordinary prompt's JavaScript-compatible syntax constraint by writing a TypeScript-only `as` assertion. More fundamentally, plain browser `<script src="src/main.ts">` does not get Node's type stripping. A future fixture should choose either browser-ready JavaScript syntax with the current `node --check` command, or a real TypeScript check/build and a browser-consumable JavaScript output. This fixture's validation cannot establish browser functionality.

## Disposition

**NOT GREEN**. Transparent logging identifies the ordinary-run blocker precisely, and the relative-path workaround permits the file operations, but no passing end-to-end retry is established. The original parallel first-write failure remains unqualified. The saved raw transcript includes tool arguments and results, including the denied path and complete requested write/edit content; the run receipts retain validation output and applied-file accounting. The original P8 report remains historical evidence, not retroactively rewritten.
