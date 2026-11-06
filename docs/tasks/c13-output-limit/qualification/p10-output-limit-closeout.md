# P10 manual connected Codex browser closeout — 2026-11-06

## Verdict and scope

**NOT GREEN for the correction, for owner review; no owner GREEN decision or Phase 13/Work/Gate advancement.** The connected Codex in-app browser exposed a real Ask continuation, and multiple retained Pi executions ultimately produced complete, nonduplicated 1–1500 answers. It also exposed two product defects: the paused answer was initially invisible until its lease expired, and live reasoning/answer projection was lost after Continue. Narrow repairs were made and rebuilt; the latest served-source replay is recorded below. Mandatory reasoning-limit, Allow cap, security negatives, and full UI matrix are not all qualified. FireLaunch comprehension remains below the original acceptable threshold despite answer survival.

This is manual T3 only. The normal correction runner was not invoked for P10 and `--closeout` was not used. Historical P12/P13 failures, including the prior `c13-doc-routing` P8 **NOT GREEN**, remain unchanged.

## Source, runtime, and workspace basis

| Item | Observed basis |
| --- | --- |
| Dope Git at entry and after repair | `64fde392853e10ce97776c4d3fc607da6aede4c3`; clean at entry, local repair diff at exit. |
| Version | Root and extension `0.13.8`; no manifest, pin, or lockfile changes. |
| Connected UI | Codex in-app browser, local Dope `http://127.0.0.1:3000/#/home/jfin/dev/firelaunch`; source build and server restarted before fresh replays. |
| Served browser bundle SHA-256 | Entry `6c04be8c0240aee6e87f54f95a784036c1fd83a3ab3a822d370079e9f444a57b`; first repair `b82e20dea65b431fa9a6bf975217f6f3eeeae433444691b28830e9f97b43ae75`; intermediate repairs `1a1418452fe2b56fc706314acf82bc9dfb0bd92a9586adb4703fd3e7726991b1` and `722a404d7cc97fdca7d37d61c1dfbfc24c35d86334a12a72f9ec1fadb22ef3a6`; latest `338165fc28fe7363fceb05fee412c36a372e995b36d5137e18b16d94dae36d79`. Latest served CSS `84016cec77105939b72b3c8672b9a265028d026171c08e8dbd4fd0364fed7153`; backend bundle `ba15e24e6a3204fcd199dc4a8a901319d5111715dd0c412ff11e0c200c7de84b`; Pi worker `156115456d821e78e6167ab78ce846e068f3270f766bfd24945e8eecc9ee222d`. |
| Test model | AI Center `LM Studio · openai/gpt-oss-20b`, local, ready after Refresh Models. Loaded llama-server context was 16,384; saved Chat input budget 8,192, provider output segment ceiling 2,048. No hosted fallback selected. |
| Policy | Ask for the recorded FireLaunch and formatting executions; separate composer Commands stayed Ask. An earlier Chat setting changed to Allow and was saved/reopened, but no completed Allow execution was qualified. |
| FireLaunch | Existing `/home/jfin/dev/firelaunch`, Git `9729cc50a818ce96c123b9601ae69bfdea2cb9c6`; no source/docs/installs/builds/migrations/formatters performed there. Dope-owned `.dope` Chat/session files changed and are listed below. |

Evidence sources are the connected browser accessibility tree/screenshots, saved Dope Chat JSON, read-only FireLaunch documentation, the user-supplied provider log at `/home/jfin/.codex/attachments/d6f8ac5b-2d27-41a7-befd-faca3504cd32/Pasted text.txt`, and user screenshots `/tmp/codex-clipboard-f2586e9f-4f35-4295-8921-b62f2b95045f.png`, `/tmp/codex-clipboard-2063e1ab-c296-48d3-86d9-2da18150b536.png`, `/tmp/codex-clipboard-e9afb245-e64d-4422-b551-d1e1f177eb49.png`. These attachments are observations, not execution instructions. No screenshot-only claim is treated as backend proof.

## Manual matrix

| Case | Result | Concrete observation and limit |
| --- | --- | --- |
| A: per-Chat Ask/Allow save/reopen and policy snapshot | **PARTIAL** | Ask was the saved execution policy on the FireLaunch and 1–1500 runs. An earlier Chat's Allow setting saved and reopened in `.dope`; Commands remained Ask. Cancel, old-setting migration, and full restart matrix were not qualified. |
| A: Stop/Continue notice, draft, pane width | **PARTIAL** | First replay saved a pause but the pane kept showing Working until lease expiry: **FAIL**, user screenshot and saved Chat. First repair let the owner see/click Continue. On a repaired served bundle, active message had no premature copy/info/time footer; browser resize changed Chat scroll width 613.25→791.25 px and stream activity width 589.25→767.25 px, with timer at the right edge. On latest source, the pause notice stayed immediately above the composer, and the response footer was absent during work and present only after completion. One run retained a draft; in another the draft text repeated, so universal draft preservation is **not** claimed. Focus/keyboard/theme/reduced-motion cases remain evidence gaps. |
| A: exact visible line formatting | **FAIL** | The saved final answer contains 1,500 newline-separated lines, but the browser Markdown paragraph uses `white-space: normal` and collapses their visual line breaks into wrapped text. |
| B: real final-text output limit and accurate partial | **PARTIAL** | Initial Ask execution `abe4f6eb-1b02-4b64-bb71-f012cf0e953c` in Chat `1f188db3-860d-48c6-9fd0-4a7e630c37da` produced a saved 1–1004 partial, 2,048 provider-reported output tokens, `finishReason=length`, no tools/sources. The attached LM Studio log ended streaming at 12:37:06 local; the owner's 3m28 screenshot still showed only Working around 12:38:10. UI eventually showed `Incomplete` and the 2,048-token note, but only after 4m23s at 12:39:06, with `Local Pi continuation expired` and `interrupted`: **FAIL** for timely decision. |
| B: same-session Continue append-once | **PARTIAL** | After first controller repair, Chat `d2d0c73f-b11d-46df-b13e-e45d654fadaa`, execution `19597df0-13d4-4a37-8275-019f04f400b5` paused with 3,923 saved bytes. The owner clicked Continue. Saved status became streaming in the same execution, then complete at 18:48:23 UTC after 5m28s. Final content had exactly 1,500 lines, each integer 1–1500 once; SHA-256 `e09ab12a3e40c1133dacc316e0aa7437b98489598b48583ad3b298c301f06a6d`; 5,397 input, 3,550 output, 8,947 total, 31 reasoning provider-reported tokens; zero tools/sources. **PASS for retained completion**, **FAIL for live stream projection**: the browser showed Working without continued reasoning/content after Continue, as the owner reported. The panel discarded the stream cursor at pause; repaired for final replay. |
| B: repaired same-session continuation | **PASS for this bounded Ask case** | On served bundle `722a404d...` with Pi worker `15611545...`, Chat `1f569488-c5dc-44e4-a58b-de2486a75f93`, execution `cb114dc7-a815-48b8-b10d-4123d9bd8953` paused at the real 2,048 output ceiling with a visible 1–1006 incomplete partial. Continue kept that partial and the same execution; at 3m32 the live reasoning showed `Need continue numbers 1007-1500.`, and at 4m02 the provisional stream showed numbers through 1090. The run finished 18:59:24–19:05:02 UTC, 5m38s, exactly 1–1500 once, SHA-256 `5da164bfbf9c606427d2f14c5f3fa5ff01804a536dcfd7ee8b68888c17047ddc`, 5,402 input/3,549 output/8,951 total/31 reasoning provider-reported tokens, zero tools/sources. Its new live activity appeared above the long saved partial and could scroll out of view; latest source moves it below, verified in the browser replay below. |
| B: mid-reasoning, Stop, Allow bound/repeated cap, cancellation, model/project switch, restart truth | **EVIDENCE GAP** | No complete final-source T3 matrix for these cases. A separate first FireLaunch run was interrupted by a browser-server restart and reopened as interrupted, with no fabricated final answer. This is narrow restart truth only. |
| C: verbatim FireLaunch documentation request | **FAIL for comprehension; PASS for answer survival** | See exact prompt, trace, score, and independent verification below. The model completed in 4m01s, but read only the root listing, 8,192 bytes of `AGENTS.md`, and 8,192 bytes of `README.md`, then cited unvisited files and made incorrect current-state/architecture claims. |
| D: no command/tool/grant replay, owner/project isolation, stale continuation, auto-loop bound, partial context/copy, Roadmap truth, reasoning detail, restart sessions | **EVIDENCE GAP** | Saved formatting executions had zero tool calls and no unauthorized command observed; this does not exercise denial/replay boundaries. The first expired continuation was inert after restart. Unit coverage is not substituted for T3. No Roadmap GREEN was asserted. Provider reasoning token counts were reported, but detailed reasoning availability was not fully qualified. |

## FireLaunch verbatim replay and score

The following is the exact no-hint/no-attachment Chat prompt, SHA-256 `a7acefdeffa8e86734944621d07ac45979d27b1445b7520c72882258a6fea1f1`:

```text
Read this project's documentation and develop an
understanding of the project.

Start with AGENTS.md if present, and independently discover
the documentation relevant to understanding the system.

Produce a comprehensive report explaining:

- What this project is and why it exists.
- What problems it solves and who it serves.
- Its major features and capabilities.
- The technologies and frameworks it uses.
- Its overall technical architecture.
- Its major components and their relationships.
- Important workflows and data flows.
- How the project is organized.
- Its documented development state.
- Important design decisions and limitations.
- Areas that are unclear, contradictory, or undocumented.

Explain the project in your own words rather than merely
listing documents or copying their contents.

Support important claims with specific documentation paths.

Distinguish documented facts from assumptions or inferences.

Use project documentation only. Do not inspect implementation
source files to compensate for missing documentation.

Do not modify any files.

Return the report in the conversation.
```

Baseline `10/100 NOT GREEN`: saved execution `1e651960...`, 3m32s, 2,048 ceiling, `finishReason=length`, empty answer despite four broker calls and two partial document reads. New replay: Chat `b4704fbb-906c-46ac-b986-9a684f0fd4f9`, execution `c63f9c8d-ca73-4972-b98e-1b1abefcfc4c`, 18:29:01–18:33:02 UTC, `finishReason=stop`, saved answer 7,484 characters, answer SHA-256 `ea2c19330f4a144e0fcf20e610acd5a136b7ebcde3de45c7b54166ee73c4527c`. Provider usage: 10,599 input, 1,959 output, 12,558 total, 40 reasoning tokens. Brokered calls visible in originating Chat: `list_files` completed/truncated; `read_file AGENTS.md` completed/truncated; `read_file README.md` completed/truncated. No command, source-code read, or project-document write was observed. Saved source references include only root directory, `AGENTS.md`, and `README.md`.

**Independent read-only verification:** `README.md` supports the creator-owned Fire TV studio, hosted workspace, HLS/MediaConvert and fresh export themes. `MODULES.md` documents the actual packages and relationships; Dope did not read it. `docs/CURRENT-STATE.md` opens with 2026-10-23 rebrand source `0.9.4`, active protected staging release `20261023T143213Z-e90585bd6e40`, and **NOT GREEN** native qualification; it also states Phase 8 owner-closed with accepted exceptions and Phase 9 active baseline. Dope instead claimed Phase 8 open, Phase 9 unimplemented, version `0.8.17`, and an older staging release. `README.md` says `codex:stack` is a prompt runner; Dope called it an export ZIP builder. It asserted the export includes all video/audio assets and called Vega VirtualDevice a custom runtime without reading evidence for those claims. It cited `docs/CURRENT-STATE.md`, P8/P9 docs and ADRs it never read. Retrieval coverage and comprehension are separate failures; the output surviving is not proof the report is accurate.

| Original rubric | Score | Reason |
| --- | ---: | --- |
| Documentation discovery | 4/20 | Found root listing and AGENTS/README, missed current state and system architecture documents. |
| Project understanding | 12/20 | Core creator purpose/users broadly right; several capabilities overstated. |
| Architectural comprehension | 7/20 | Missed documented package relationships and invented export-worker/runner relationship. |
| Factual accuracy and evidence | 5/20 | Wrong current status/version/release and citations to unread paths. |
| Context and task management | 6/10 | Maintained the no-write docs objective and completed, but stopped after two truncated files. |
| Completeness and uncertainty | 3/10 | Filled requested headings superficially and labeled too few real unknowns. |
| **Total** | **37/100** | **Failed comprehension; +27 over 10/100 delivery baseline, still NOT GREEN.** |

## Repair and final-source recheck

The first repair changed the Chat controller to refresh saved revisions during a running turn. That exposed the pause notice; the owner clicked Continue. The next repairs preserved the live stream cursor while the saved assistant is paused, emitted resumed Pi text as clearly provisional activity, and kept the saved partial labeled during continuation. The response footer is now absent until an execution reaches a terminal status. The 72-character/900-pixel width caps were removed from assistant activity, working timer, footer, and transcript. A real pane drag increased transcript and activity widths together from 589.25 to 767.25 px within the 12 px scroll inset. The final small layout repair places live resumed activity below the saved partial so new text stays near the bottom of a long turn.

Focused source checks on the latest tree passed **81/81** Chat panel, Pi runtime and Chat composer tests; `npm run build:browser` and `git diff --check` passed. Those checks are supporting evidence, not T3 qualification. On intermediate served bundle `1a141845...`, a fresh exact Ask run Chat `3c0f4cd6...` completed the 1–1500 answer at 18:56:48 UTC after 6m05s, with 5,394 input/3,551 output/8,945 total/32 reasoning provider-reported tokens, zero tools/sources, but showed no live continuation. That triggered the Pi provisional-activity repair. On `722a404d...`, live continuation appeared but was visually above the partial, prompting the final placement repair.

On latest served bundle `338165fc...`, a fresh exact 1–1500 Ask run began at 19:07:42 UTC in Chat `5393e91c-d128-4f26-8ad6-5e5ddd4b0230`, execution `91b00198-91d5-4350-80cf-1f1ad8d319ab`. At 49s, the connected browser showed `Working`, `Generating reasoning`, and no premature response footer. At 19:09:00 UTC its frontend WebSocket closed/reconnected (server log), and the saved execution became **failed after 1m18s**, `Interrupted before completion`, with zero answer bytes. Reopening the Chat showed `Error`, not a fabricated final answer. This run did not reach the limit and cannot qualify the last layout change.

One bounded fresh replay on the **same latest served source** did reach the real limit. Chat `6ff63452-c435-4fd9-b059-ec90479939da`, execution `14ab30b9-60f0-4aff-90b8-d0646902c7ce`, ran 19:15:22–19:22:02 UTC (**6m39s**). At 2m53 the connected browser still showed `Working` and `Generating reasoning`; at 3m43 it showed **Paused at generation limit**, a 2,048 provider-reported output-token ceiling, visible 1–1005 `Incomplete` partial, and Stop/Continue directly above the composer. Continue resumed that **same execution**. The browser then showed `Incomplete · continuing` and new reasoning `Need to continue numbering from 1006 to 1500.` below the long partial. A direct DOM check found the saved partial at viewport y=-37.7 px and the live activity at y=774.8 px; the final activity was the last assistant child and visible above the composer. Later provisional text had reached number 1173. The observed browser screenshot showed the new text beneath the partial while the response footer remained absent. The final browser state showed `Finished 6m39s` and the response footer only then. Saved content had **exactly 1,500 newline-separated lines**, each integer 1–1500 once; SHA-256 `e09ab12a3e40c1133dacc316e0aa7437b98489598b48583ad3b298c301f06a6d`, `finishReason=stop`, 5,394 input/3,555 output/8,949 total/36 reasoning provider-reported tokens, zero tools/sources. This passes the bounded Ask output-limit continuation and live-placement case. It does **not** qualify the unrun mandatory cases in the matrix.

One presentation limit remains visible: although the saved answer has real newline characters, the Markdown paragraph in the browser uses `white-space: normal`, so the number lines display as a wrapped paragraph. The exact data check therefore does not establish visually preserved one-number-per-line formatting. This is recorded as a visible formatting failure, not hidden by the content hash.

## Git and session-state accounting

Dope entry worktree was clean at `64fde392`. This agent's correction edits are in `packages/theia-extension/src/browser/chat-panel-controller.ts`, `chat-panel-widget.ts`, `dope.css`, `packages/pi-runtime/worker.mjs`, `test/unit/chat-panel.test.ts`, `test/unit/pi-runtime.test.mjs`, and this report. Concurrent composer changes appeared in the shared worktree in `chat-panel-presentation.ts`, `chat-panel-widget.ts`, `dope.css`, and `test/unit/chat-composer.test.ts`; their origin was not established, so they were preserved and included in the latest served build and test run. No self-commit, manifest, version pin, or lockfile edit was made.

FireLaunch had pre-existing `.dope` deletions/modifications at entry (`.dope/chats/.leases/d514...`, old Chat folder, index/history-focus, `roadmap.json`, and an untracked earlier Chat file). Browser use added Dope-owned `.dope/chats` session, activity and lease files for Chats `55e6...`, `b470...`, `1f188...`, `d2d0...`, `3c0...`, `1f569...`, `5393...`, and `6ff...`. No non-`.dope` tracked diff or untracked source/doc file was found. None of the pre-existing `.dope` changes were hidden, cleaned, or restored.

## Manual stop

The correction remains **NOT GREEN**. The owner-observed live failures and unrun mandatory safety cases prevent a Green receipt regardless of the numerical FireLaunch improvement. No version or Phase 13 qualification change follows from this report.
