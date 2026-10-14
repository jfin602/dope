# P11 repair loop — cycle 1 (2026-10-14)

**Disposition: NOT GREEN.** This is one focused repair and browser replay, not a committed-source or complete native qualification. The historical P11 closeout and failures remain untouched.

## Source and fixture

- Product HEAD before and after: `824eaa17b58e888451a615c14fccf79092f1adb4`; `main` was clean at entry. Version `0.10.16`; no version or lockfile edit.
- Final uncommitted product/test diff SHA-256 (`git diff --binary` restricted to the five changed files): `6a20fe274611b96e5342d87787b7a1bfc8cb6af813e6a3c8a8293f52d76fb4e9`. Changed: `roadmap-canvas-model.ts`, `roadmap-canvas-widget.ts`, `roadmap-viewport.ts`, `roadmap-spatial-canvas.test.ts`, and `roadmap-viewport.test.ts`. The new records and screenshots in this directory are untracked. No product commit was created.
- Disposable browser project: `/tmp/dope-c10-p11-repair-lCN56x/project`, cloned from HEAD; project ID `2a860b8c-0c59-4a9b-8710-da69934c82c2`. The accepted `docs/roadmap/mvp-roadmap.md` source SHA-256 was `ee3882420d60fc00130d902f3d907a2bd6d8c4243dfec2cb5ce437d70a49ae1f` before and after gestures. The disposable `.dope/roadmap.json` stayed at revision 1 and SHA-256 `28a9d21b43746a74262b9b9c864064eb5586c415a79ef83480363cec55451aa2`. Opening a prompt additionally produced `.dope/history-focus.json` in the disposable project. No source Markdown write or Roadmap revision change occurred.

## Cause and repair

The old camera lifecycle treated a React Flow move callback as user intent whenever it carried an event value. It had no retained automatic target to reassert if graph measurement changed the camera after import. The widget now accepts only trusted pointer, touch, wheel, mouse, or keyboard navigation as user camera intent and holds the initial actionable camera until that intent or an explicit toolbar action. The saved user viewport still owns later refresh/restart restoration.

The prior top/bottom correction handles sent a vertical connector through intervening cards in a dense phase column. Membership and vertically separated supporting links now use measured right-side target handles and an orthogonal gutter route. A stored branch and its presentation membership for the same endpoints render as one relationship; the stored graph is unchanged. Lateral Arrange cases retain the previous smooth-step route. The existing strategic-only zoom and explicit View Prompts behavior was already present at this HEAD, so it was verified rather than reimplemented.

## Validation actually run

| Check | Result |
| --- | --- |
| Focused `roadmap-spatial-canvas`, `roadmap-viewport`, `roadmap-semantic-zoom`, `roadmap-canvas`, `roadmap-prompt-open` | **PASS 30/30** on final source |
| `@dope/theia-extension` build and affected browser build | **PASS** on final source |
| `npm run build:electron`, followed by affected Electron build after final widget edit | **PASS** compilation; not GUI evidence |
| `git diff --check` | **PASS** |
| `npm run check` | **NOT RUN**; Phase 10 manual P14 owns the aggregate |

## Direct browser observations

The real in-app browser loaded the local Dope app at `http://127.0.0.1:3001/#/tmp/dope-c10-p11-repair-lCN56x/project`. Import preview reported 31 checkpoints, 78 source files, zero unsupported sections, 7 Not Green and 15 read-only checkpoints. The accepted graph settled at 42 displayed strategic cards, revision 1 and 10 unresolved references. Before any user pan or zoom, the viewport was `translate(-3431.6px, -173px) scale(0.9)`, visibly centered on Phases 9–11. The earlier 0.359 world-camera failure did not recur. [Settled screenshot](evidence/cycle-1-browser-settled.png).

At Phase 10, zoom to checkpoint detail reached `scale(1.5552)` while staying at 42 nodes with zero generic task-stack cards. Explicit View Prompts showed 16 ordered Phase 10 prompt cards, 58 total nodes, without changing the camera. Hide Prompts restored 42 nodes and removed prompt connectors, again without camera movement. Reload restored the intentional `translate(-6222.06px, -539.336px) scale(1.5552)` camera and collapsed disclosure. [Zoom](evidence/cycle-1-browser-checkpoint-zoom.png), [expanded](evidence/cycle-1-browser-prompts-expanded.png), [collapsed](evidence/cycle-1-browser-prompts-collapsed.png).

The selected Phase 6 view showed `c6-edit-architecture` above its Waived phase; its membership line used the card-side gutter instead of crossing the correction text. The source-only correction's explicit View Prompts revealed exactly four prompts. Selecting P1 displayed `docs/tasks/c6-edit-architecture/P1-canonical-architecture-edit-service.txt`; Open Prompt opened that file in an ordinary editor tab and did not run it. [Final-source gutter replay](evidence/cycle-1-browser-final-source-phase6.png), [prompt editor](evidence/cycle-1-browser-prompt-source.png). The final widget edit only selects the existing smooth-step route for laterally arranged endpoints; the final-source gutter screenshot directly replays the affected vertical route. Earlier screenshots in this cycle show the same vertical route and projection on the immediately preceding candidate, and are carried only for those unchanged seams.

| P11 gate | Result and limit |
| --- | --- |
| Fresh import camera and subsequent automatic graph settling | **PASS in browser** for this imported fixture; readable 0.9 settled view |
| Chronological phase route and upper correction branches | **PASS in observed browser view**; Phase 9→10→11 and Phase 6 correction route visible |
| No card-text connector collision | **PASS for observed Phase 6/10 branches**; exhaustive Arrange/dense geometry remains **NOT RUN** |
| Zoom-only disclosure, explicit expand/collapse, prompt ordering/source | **PASS in browser** for Phase 10 and source-only c6 correction |
| Saved intentional camera and collapse on reload | **PASS in browser** for the observed state; project-switch and native restart **NOT RUN** |
| Six status truth and theme treatment | **PARTIAL**: visible Green, Active, Not Green, Waived, Not implemented, Unknown labels remained distinct; dark screenshot only. Full light/hover/focus matrix **NOT RUN** on this source |
| Stored dependency edges | **NOT RUN** live: imported Roadmap has zero stored dependencies; unit fixture preserves directed endpoints |
| Narrow split, saved Chat, reduced motion, keyboard, overlays, full interaction matrix | **NOT RUN** in this cycle; no PASS inferred from source tests |
| Native Electron GUI | **BLOCKED**: Electron build and launch succeeded, but X11/window inventory exposed only an unmapped 10×10 Electron input window, no controllable Dope application window; no native screenshot or interaction |

Browser screenshots were captured from the actual UI. `sha256sum evidence/*.png` is available for each file. No native screenshot exists.

## Stop and next action

The working tree contains the five modified product/test files plus this untracked evidence directory. A developer commit is required before any committed-source Green decision. Native GUI evidence, the remaining visual/interaction matrix, and an explicit live stored-dependency fixture remain open. Stop after this one repair cycle because the native window facility is unavailable and a second source repair has no demonstrated defect to target. Obtain a controllable Electron window, commit the candidate at the developer's chosen boundary, then replay affected gates on its exact SHA. `c10-better-planning` P5 is separately **NOT GREEN** in its current repository closeout despite the pasted task's Green baseline; the full Phase 10 campaign remains gated.
