# Phase 9C closeout — Development Sessions workspace UI

**Date:** 2026-10-11 (America/Chicago)
**Disposition:** **NOT GREEN — real GUI exercised, with retained GUI and evidence gaps**
**Exact product source/version candidate:** `0.9.23` / `d2faa3604cab88a63b0ea5367d49532934dae500`
**Scope:** 9C only. Phase 9 overall is NOT QUALIFIED; 9D, 9E and Phase 10 remain inactive.

## Entry and candidate

The separate owner authorization is `docs/planning/p9/phase-9c-activation.md`. P9's Git-proven predecessor was the clean `0.9.22` commit `0752415be76ef3f87e1a34bf17c4009a888be085`. P10 advanced all 13 root/app/package manifests and pinned internal `@dope/*` references to `0.9.23` in the separate source/version checkpoint above. That commit changes only those manifests. It leaves `yarn.lock`, unrelated dependencies and source behavior unchanged and creates no root `package-lock.json`. The worktree was clean before GUI qualification.

`npm run build:browser` passed on the exact candidate. One focused `node --test` invocation ran the 11 Session contract, store, backend, resolver, membership, integration, UI controller, widget, UI membership, candidates and navigation files: **60/60 passed, zero failed or skipped**. `git diff --check` passed. This focused evidence supports the implementation but does not replace the real GUI result below.

## Direct browser GUI evidence

The real `@dope/browser` Theia backend served the built candidate at `http://127.0.0.1:3000`. All interactions below used its browser GUI. The two no-AI disposable roots were `/tmp/dope-p9c-p10-gui-c_who6jz/project-a` and `/tmp/dope-p9c-p10-gui-c_who6jz/project-b`; neither was the Dope source repository. The task interaction record contains direct GUI screenshots of the created Session, closed read-only Session, Light (Theia) theme, stale/missing link rows and post-restart link rows. The screenshots were viewed in the task, but no screenshot binary was retained in the repository; this limits standalone replay of the visual evidence.

Project A used a Chat and Project Mind idea created in the GUI. A canonical System/Subsystem was defined manually, without a synthesis provider, and its Physical Map was analyzed deterministically. A Planning Map was created in the GUI. An existing WorkItem and idle AgentTask were then seeded with the normal project-local owner stores as **navigation fixtures**, without inference or execution. Their fixture provenance is distinct from the real 9B Planning-to-Work replay. The AgentTask had no AgentRun.

| GUI step | Direct observation |
| --- | --- |
| Create, select and edit | Command Palette opened one center Sessions tab. The active Session `1c72a3ff-45f3-4392-9764-b3965dd1edb0` was created with title and objective; Notes were saved and displayed. A second Session `b93352bf-4132-4cfd-b0d4-caaf087aed70` was created and selected. |
| Browse and attach | The picker found the existing Chat, Planning Map, WorkItem, AgentTask and Project Mind idea. All five exact references attached to the first Session and displayed their current owner metadata. The WorkItem remained `ready` and was not presented as a completed AgentRun. |
| Owner navigation | Chat navigation reused its existing Chat owner view; Project Mind selected the exact idea; Planning Map and WorkItem selected their existing Planning owner; the idle AgentTask opened in Work. No Session action sent a Chat message or started work. The Chat lease recorded one owner ID. |
| Shared and detached | The same Chat was attached to both Sessions. Detaching it from the second left the first Session's Chat link and Chat owner record intact. |
| Closed | The second Session was closed through its existing backend mutation API as a setup step. The GUI then showed `closed`, its retained Chat link and read-only details, with no edit, attach or detach controls. 9C does not expose a GUI close action; richer closeout belongs to 9D. |
| Missing | A fabricated absent Chat ID was rejected with `Cannot attach missing Session artifact`. Temporarily moving the fixture AgentTask owner file after attachment made its retained link read `missing` and disabled owner navigation. The task file was restored. |
| Stale | A deliberate edit to the disposable project's `src/main.ts`, followed by deterministic Software Map refresh, made both the Planning Map and WorkItem links `stale` and disabled exact navigation. The WorkItem still displayed `ready`. No Session action changed that source file or rebased the plan. |
| Project isolation and ordinary use | Project B opened with **no Sessions** and no Session store. A Chat was created normally without a Session; Work opened its ordinary selector with no saved or running work. Project A's Sessions did not appear in B. No AgentRun was created in either root. |
| Restart/reopen | The Theia backend process was stopped and restarted, then project A was reopened in the browser. Its selected Session, metadata, five links and closed second Session restored. Planning links honestly showed `unavailable` while the in-memory Physical Map was absent; after deterministic reanalysis they returned to `stale`. Chat, Mind and the idle task resolved again. |
| Keyboard and theme | The Command Palette was operated by keyboard. Sessions remained readable in Dope Dark and Light (Theia), then the original Dope Dark theme was restored. The Light theme screenshot shows weak or absent visible boundaries around the empty Session title/objective fields and low contrast on the unselected Session row. This presentation requires correction or explicit acceptance before a Green theme claim. |

## Observed limitations and evidence gaps

1. **Light theme usability is below the requested GUI bar.** Empty Session fields are difficult to locate visually in Light (Theia), and the unselected Session row has weak contrast. Keyboard access and accessibility labels exist, but the direct visual check is not Green.
2. **Theia's File > Open dialog did not switch the current in-app browser workspace** after project B was selected and Open was pressed. The project-isolation check continued by navigating to B's Theia workspace URL and reloading. Root isolation was observed, but the ordinary File-menu switch path was not qualified in this browser surface.
3. The first Planning Map creation immediately after initial manual architecture analysis returned `Stale Planning Map basis` twice. A frontend reload, which restored the current map, allowed creation. This is a retained Planning setup observation, not a claim that Session caused the error. Exact Planning-link navigation initially produced the truthful `No available owner panel could select this exact linked artifact` fallback after the WorkItem was seeded outside the GUI; refreshing the Planning owner made both Planning Map and WorkItem navigation succeed.
4. The no-Session Work selector on both non-Git disposable roots displayed `Prompt Stack operation failed`. Its selector opened and showed no running work, but a healthy ordinary Prompt Stack path was not proved here. The AgentTask and WorkItem used for Session navigation were fixtures, not real execution. Exact AgentRun and AgentTaskSequence GUI navigation, candidate review/promotion and a live WorkItem-to-AgentRun lifecycle were not exercised in P10; 9B's real replay remains separate evidence.
5. Screenshots were captured in the direct GUI task record but were not saved as durable repository artifacts. This closeout records the observable text and interaction sequence; it does not substitute headless tests for the GUI or claim a reproducible screenshot bundle.

## Owner truth and no-execution check

After owner fixtures were established, SHA-256 comparisons across Session attach, detach, select, resolve, navigation, project switch and restart showed byte-identical **durable** Chat index/content, Planning Map, AgentTask, Project Mind, architecture and Software Map files. The transient `.dope/chats/.leases/<chat-id>.json` did change as the normal Chat owner view renewed its lease; therefore an all-owner-file byte-identity claim would be false. Neither project has an AgentRun file. Project B has no `.dope/development-sessions.json`; project A's Session store contains two Sessions with five links on the active one and one on the closed one. The source edit used solely to prove Planning staleness was made explicitly in disposable project A. The accidental `.theia/launch.json` created in B by invoking a debug shortcut during keyboard exploration was removed; it was unrelated to Session selection.

No provider call, hosted fallback, Chat recovery write, Planning rebase, Mind initialization from Session selection, candidate review/promotion, WorkItem completion, Architecture adoption, Git write or Dope source mutation was observed from Session selection, resolution or navigation. The owner-file comparison is direct byte evidence for this disposable GUI path, not a general proof for unexercised states.

## Decision and remaining gates

P10 obtained real Theia browser GUI evidence on the exact `0.9.23` checkpoint and confirmed much of 9C's bounded UI behavior. The light-theme presentation, File-menu project switching, and missing direct proof for exact AgentRun/sequence navigation keep **9C NOT GREEN**. The focused 60/60 result remains valid implementation evidence and does not promote this closeout to Green. The original Phase 5 P11 Not Green/P12 unexecuted result, Phase 8 owner-closed Green, and 9A/9B bounded Green remain unchanged.

9D richer progress/resume/closeout projections, 9E full Dope Builds Dope and aggregate qualification, native packaging and Phase 10 remain deferred and inactive. This 9C-only record neither activates them nor qualifies Phase 9 overall.
