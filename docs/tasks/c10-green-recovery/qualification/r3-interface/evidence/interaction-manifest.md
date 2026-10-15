# R3 sanitized interaction and screenshot manifest

Screenshots are full captures of only the disposable Dope browser/Chrome or Electron windows; no host-wide image, credentials, prompt/packet payload or private user project was retained. [manifest.sha256](manifest.sha256) contains the exact SHA-256 for each retained file. Times are 2026-10-15 UTC; source/owner hashes and revisions are in [cycle 1](../cycle-1.md). Browser IAB accessibility/DOM observations were read live and summarized there; they are not mislabeled as screenshot files.

| File | Environment and actual state |
| --- | --- |
| `browser-initial.png` | Separate Chrome PID 13256, initial linked 42-card canvas at Phase 10, revision 1. |
| `browser-phase10-selected.png` | Chrome Phase 10 selected, details overlay, revision 1. |
| `browser-prompts-expanded.png` | Chrome explicit View Prompts, P1/P2 visible, 58-card branch, revision 1. |
| `browser-reload.png` | Chrome after Ctrl+R, P1 still selected and prompt branch expanded, revision 2. |
| `native-ready.png` | Independent Electron PID 10859, disposable project workbench before Roadmap opened. |
| `native-imported.png` | Native canonical Roadmap import, Phase 9/10/11 and corrections visible, revision 1. |
| `native-phase10-selected.png` | Native Phase 10 selected with same checkpoint details. |
| `native-phase10-focused.png` | Native explicit Focus centered selected Phase 10. |
| `native-prompts-expanded.png` | Native explicit View Prompts, P1 and connector visible. |
| `native-reload.png` | Native settled after Ctrl+R, selected Phase 10 and expanded branch restored. |
| `native-source-changed.png` | Native external disposable Markdown change warned for review. |
| `native-source-review.png` | Native Linked Markdown overlay displayed accepted/current hashes and unsupported-only explanation. |
| `native-source-reviewed.png` | Native after explicit Apply, synced revision 2. |
| `native-ideas-empty.png` | Native Ideas/Issues overlay empty records and unlinked task diagnostics. |
| `native-keyboard-right.png` | Native Right key selected Phase 11 from Phase 10 with focus/selection outline. |
| `native-keyboard-home.png` | Native Home selected Foundation, shown in details while camera remained elsewhere. |
| `native-keyboard-end.png` | Native End selected last correction, shown in details before Focus. |
| `native-keyboard-end-focused.png` | Native explicit Focus brought End-selected correction onscreen. |
| `native-light-theme.png` | Native Light (Theia), selected Unknown correction; label and outline visible. |
| `native-high-contrast-light.png` | Native High Contrast Light (Theia), same selected Unknown correction. |

The separate browser-IAB interaction record was: initial 42 nodes/40 edges; Fit world scale 0.2; Phase 10 Focus scale 1.4; explicit View Prompts 58 nodes/56 edges; Open Prompt exposed exact `docs/tasks/p10/P1-source-import.txt` editor. In a parser-valid, manually constructed revision-4 disposable variant, 63 nodes/59 edges included separate stored dependency and correction membership labels, with `c100-other` unassociated. A browser source-only external edit against that bypass-created variant failed at validation; the same edit succeeded against the restored UI-created revision-2 owner, advancing to synced revision 3. These observations are summarized rather than presented as a raw tool transcript.
