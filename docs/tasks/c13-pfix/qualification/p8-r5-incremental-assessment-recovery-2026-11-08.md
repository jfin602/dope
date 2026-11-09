# c13-pfix P8-R5 — incremental Assessment recovery, 2026-11-08

**Disposition: PASS for the targeted headless correction.** The protected `/prompt-ass` path now stages verified findings and brokered source coverage incrementally, and only `assessment_finish` can seal a structured Assessment for `/prompt-plan`. This is not a real GPT-OSS or connected-browser qualification. P8-R4 and all earlier P8 verdicts remain unchanged; Phase 13 recovery remains ON HOLD.

## Exact source and scope

- Entry HEAD: `203acc65` on clean `main`, aligned with `origin/main`. P8-R4 tested product source was `05cd7dbb`; this correction inspected the actual later checkout. Final tested product and test HEAD: `a3cf35be4b24840c61e38f853efdfa533faaff38`. Product version remains `0.13.11`.
- Read BOOT, AGENTS, workflow, ADR 0055, ADR 0056, the named-chain contract, and the original P8/P8-R1/P8-R2/P8-R3/P8-R4 qualification reports. No original report or executed prompt was edited.
- No `codex:phase`, live GPT-OSS inference, browser, Electron GUI, Work Run, Roadmap award, canonical prompt publication, or version advance occurred.

## P8-R4 failure and changed interface

The P8-R4 real model successfully read `src/clamp.js` and `test/clamp.test.js`, used `list_files("package.json")`, received a generic denial, skipped three requested sources, and returned one JSON Assessment with `dependencies: []`. Dope correctly rejected it with `ASSESSMENT_DEPENDENCIES`; no Assessment was saved. The new headless backend reproduction verifies that an eligible requested file now returns `NOT_A_DIRECTORY: list_files expects a directory. Use read_file with this relative file path.` That listing does not count as inspection. A subsequent explicit `read_file("package.json")` succeeds and advances coverage. Missing requested files return `MISSING_FILE`; unsafe paths return `UNSAFE_PATH` without revealing protected content.

The model-facing Pi tools are top-level object operations:

```text
assessment_status({})
assessment_stage({category:"observations",claim:"...",path:"src/clamp.js",quote:"..."})
assessment_stage({category:"dependencies",reason:"No external runtime dependencies are declared..."})
assessment_stage({category:"scope",text:"..."})
assessment_stage({category:"tiers",T1:"...",T2:"...",T3:"..."})
assessment_finish({})
```

Dope derives draft/session identity, revision, source hash and exact byte offsets. The model supplies no transport metadata or Markdown Assessment. A stage returns a compact receipt; a rejected stage returns a stable code, field, expected shape, recovery step and confirmation that earlier findings remain. Eight rejected calls, 128 Assessment tool calls and 64 model calls bound a turn. Identical findings are idempotent; conflicting replay is denied. Ordinary model prose and the last finding cannot seal the Assessment.

## Coverage, validation and durability

- Trusted entry extracts up to 16 explicit requested paths from the owner's command. The checklist reports not inspected, partially inspected, required range inspected, or unavailable/blocked with a safe reason. Source coverage advances only after a successful brokered `read_file`; list/search results do not advance it. Assessment path-only reads also use the bounded range broker. Every requested file must be covered through its final byte, including a late section; zero-byte files require their own successful brokered read. The 32-page durable limit fails closed. Source bodies are not automatically added to model context or stored in the partial record.
- Each finding is immediately checked against one unique exact quote in successful brokered read bytes. Dope stores derived path, byte start/end and source hash. Unsupported or ambiguous quotes, malformed fields, oversized records and conflicting replay leave prior valid stages intact. Source/version drift denies stale progress and finish. The old P8-R4 `dependencies: []` without a reason still fails; a reason based on unread `package.json` also fails.
- Observations and preservation must be substantive. Dependencies and risks may be empty only with explicit reasons after requested coverage is complete. A fully inspected `package.json` with declared runtime/optional/peer dependencies contradicts an empty dependency result; package citations must name a declared dependency. T1 requires focused source/unit work, T2 integration, and T3 manual browser qualification. `assessment_finish` independently re-reads pinned pages, checks coverage, citations, categories, tiers and current source/owner/lease authority, then stores one `AssessmentRecord` with justified empty reasons. The existing renderer and Plan consumer use that sealed record; no canonical file is written at finish.
- Accepted partial findings and page identities are atomically stored in the existing protected Prompt Draft staging area under the Chat repository lock. A failed or canceled turn before successful finish remains incomplete and cannot enable Plan. A new valid Chat lease can explicitly retry that failed Assessment after source/project checks; stale or foreign authority is denied. A failed later attempt cannot change a sealed Assessment. If a turn fails after sealing but before its Chat completion, a trusted retry recovers the already sealed record without another model run. The saved blocked card retains specific diagnostics plus inspected-source and verified-finding counts after restart. Successful Assessment still exposes the existing bound `/prompt-plan` card/chip path.

## Verification and limits

- Built `@dope/chat`, `@dope/contracts`, then `@dope/theia-extension`; the bundled Pi worker has no build script and was exercised directly.
- Eleven directly affected test files passed **160/160** on the final source: Assessment/source validation, PromptDraftStore, Pi worker/conversation, ChatBackend, staging controller, ChatRepository, Chat presentation, incremental prompt stack, guarded publication and project grounder. Tests cover the five-file 2/5 to 5/5 progression, late ranged read, empty file, source drift, invalid/duplicate/oversized findings, justified empty and contradictory dependencies, missing/unsafe paths, restart with a new lease, no canonical write, Plan/Write and publisher compatibility. `git diff --check` passed.
- The real selected GPT-OSS 20B has **not** run this new tool interface. Connected-browser Assessment, Plan, Write, native review, Accept/Reject/Revise, keyboard/touch/theme, hostile content, Electron parity and remaining P7/P8 negative cases remain **EVIDENCE GAPS** for separate independent qualification. Exact semantic truth of arbitrary natural-language claims still requires model and owner review; the headless gate verifies exact cited bytes and the stated package-dependency contradiction.

No Work grant/Run, applied History event, Roadmap Criterion/Gate GREEN, Phase completion, or product version advance follows from this headless PASS. Do not automatically begin live browser requalification or Phase 13 recovery.
