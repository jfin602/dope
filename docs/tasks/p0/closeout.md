# Foundation Spike 0 Closeout

Status: **QUALIFIED — bounded Evidence Gaps retained** (2026-09-27)

## Candidate and decision

- Original assessment baseline: `e90164da659b21a3d24e87b7ce3ff2a7f995cace`, package `0.0.0`; the immediate pre-P1 baseline was `f1332f55b46e45c2cd6aa46b8f5b5702121436e4`, also `0.0.0`.
- Reachable P1-P5 implementation/qualification commits: P1 `d2f7294637ee40bef4434d739e2069f20837d2fd`, P2 `43ca52f9666aae80a8770543f1846c43e5eb9f5b`, P3 `2e6efe76284611aa5c459a2b816daff8e4b9f93f`, P4 `7bd8a8c43f995eb6dd5f0d244204b0be13a31179`, P5 `6624e146683b6cbfe507325438f2edf19fe20d97`.
- Exact P6 pre-task/final committed candidate: `6624e146683b6cbfe507325438f2edf19fe20d97`, package `0.0.5`. P6 changes are uncommitted package `0.0.6`; the phase runner alone assigns the final implementation SHA. No product implementation or Theia upgrade was made in P6.
- Theia: **1.75.0** in directly controlled dependencies and the coherence guard; Node `v24.21.0` in this rerun. Electron `42.8.1`.
- Substrate decision: **Qualified for Foundation Spike 0**, not a qualification of Product Phase 1 or any AI/authority runtime. No unresolved hard substrate blocker, framework fork, broad private/internal coupling, or Theia-owned canonical Note schema was found. The native-window visual gap below is not Green.

## Gates A-F

| Gate | Disposition | Executed evidence and boundary |
| --- | --- | --- |
| A — Bootstrap / commodity IDE | **Green** | P4 directly observed branded Dope browser workbench, a real Git fixture, Explorer, Monaco edit/save, TypeScript diagnostic, search, SCM dirty/clean transition, terminal command, Node breakpoint/locals, and Open VSX installation/function. Browser build alone is not the evidence. |
| B — Dope UI surface | **Green** | P4 directly observed Project Mind and Planning spike views, BUILD/PLAN focus/right-panel change, branding/styling, hidden duplicate Open Editors, and title rebind effect. Widgets/layout are presentation state, not canonical Note or mode identity. |
| C — Typed backend / persistence | **Green** | Dope contracts define typed Note read/save and change callback; Node store owns `.dope/note.json`; transport closes its listener. Tests cover round trip, stable ID, corruption protection, notifications/disposal. P4 stopped and restarted the backend and observed the same Note ID/title/body; P5/P6 packaged renderer recovered that ID. |
| D — Customization stress | **Green** | Material layout, hidden section, `WindowTitleService` rebind, CSS, BUILD/PLAN mode persistence and restart were exercised. The coupling ledger classifies contributions, service rebind, shell-level calls/selectors; no private/internal API or framework fork was identified. |
| E — Extension / tooling | **Green** | P4 directly exercised TypeScript/JavaScript, JSON, Markdown, Node debug, Git, terminal, ESLint, Prettier, and Open VSX cSpell. The latter three were runtime-installed in P4, not bundled in the package. |
| F — Linux packaging | **Green for artifact/build/launch/renderer; Evidence Gap for native visual interaction** | P5 produced and launched the `0.0.5` AppImage outside the dev server; P6 rebuilt `0.0.6`, checked resources/90 bundled plugins and launched it from `/tmp` with fresh HOME and packaged `file://` renderer. CDP observed attached shell, Project Mind, and retained P4 Note ID. No native-window visual claim is made. |

## Coupling, extensions, persistence

- `docs/tasks/p0/customization-coupling-ledger.md` is the per-seam inventory. The highest-risk seams are shell-area behavior, navigator widget IDs, status-bar CSS, and the title service lifecycle; they are localized to the Theia presentation adapter. `WorkspaceMode` stores only `BUILD`/`PLAN` in browser localStorage; Theia's restored layout is a derived projection. No Theia Perspectives/layout ID or chat history defines Dope canonical state.
- Built-ins from the P4 bundle: TypeScript language features, JavaScript, JSON language features, Markdown language features, Git (`1.108.2`); Node debugger `ms-vscode.js-debug@1.105.0`. Runtime-installed and functionally observed from Open VSX: `dbaeumer.vscode-eslint@3.0.34` (diagnostic), `esbenp.prettier-vscode@12.4.0` (format/save), `streetsidesoftware.code-spell-checker@4.9.5` (diagnostic). P5/P6 package includes 90 built-ins, not those three runtime installs.
- Canonical Note has schema version 1, stable UUID, `type: note`, developer provenance, title/body in workspace `.dope/note.json`; P4 reconstructed it after a backend restart. Browser-side view uses typed service and backend-originated notification; transport disposal is tested. One Note per workspace is a deliberate spike limit, not a Product Phase 1 persistence design.

## Package and validation

- P5 committed evidence: `dist/linux/Dope-0.0.5.AppImage`, 187,871,338 bytes, SHA-256 `627841c8fc93059c0a76126ba9debcf461c793b14d6349a9d93ad44489ccfe74`; packaged renderer/90 plugins and native process launch recorded in `P5-linux-package-evidence.md`.
- P6 rerun: `PKG_CONFIG_SYSROOT_DIR=/tmp/dope-p3-sysroot/root PKG_CONFIG_LIBDIR=/tmp/dope-p3-sysroot/root/usr/lib/x86_64-linux-gnu/pkgconfig:/tmp/dope-p3-sysroot/root/usr/share/pkgconfig npm run check` passed typecheck, runner tests **93/93**, baseline tests **3/3**, product tests **6/6**, browser and Electron builds (zero build errors). `npm run codex:phase:validate -- p0` passed. Theia 1.75 coherence test passed; no root `package-lock.json`; `git diff --check` passed.
- P6 `npm run package:linux` with the same X11 sysroot passed. `dist/linux/Dope-0.0.6.AppImage` is an executable x86-64 AppImage, 187,871,351 bytes, SHA-256 `2f181035d88c33ff4f6122745752f469d0ffe53628ee517612accf7309e8e5b0`. Its asar reports Dope/`0.0.6` and contains frontend/backend/entrypoint; the preview includes 90 bundled plugins. Launch from `/tmp` with fresh HOME, `--no-sandbox --disable-gpu --remote-debugging-port=9246` smoke flags and the P4 fixture stayed alive through CDP; backend listened on `127.0.0.1:37987`; renderer title was `dope-p4-fixture - Dope · BUILD`, packaged `file://` page had an attached shell, Project Mind, and Note ID `74e8826e-d45c-48b9-882b-103adf11f231`. The harness terminated the process after observation; this is not native visual inspection.
- Linux packaging requires Node 24, Yarn/Corepack, native build tools and X11 development headers; this host used the existing P3 sysroot. The package build emitted missing author, duplicate-dependency, and default Electron icon notices. Runtime emitted nonfatal missing per-user plugin directory warnings and a parcel-watcher `fs.Stats` deprecation under an ERROR logger; no fatal startup error was observed.

## Remaining Evidence Gaps and next action

- **Evidence Gap, not Green:** direct native Electron-window visual interaction and day-to-day native UI behavior. P4's shared-workbench GUI and P5/P6 packaged renderer/process observations bound, but do not erase, this gap.
- **Evidence Gap:** AppImage behavior on another Linux distribution and fresh-checkout pinned plugin download; the rerun reused 90 downloaded built-ins. The default Electron icon is a branding-polish gap, not evidence of a startup blocker.
- Required pre-Phase-1 architecture/documentation amendments through post-spike `/docs-review`: record the qualified 1.75.0 substrate and bounded shell/rebind/CSS coupling in current architecture authority; preserve the Dope-owned canonical Note/WorkspaceMode and presentation adapter boundary; carry native dogfooding, cross-distribution/fresh-checkout packaging and icon polish into appropriate future qualification without relabeling them Green. Keep upgradeability as a real-upgrade qualification, not a synthetic Phase 0 gate.
- **Next required action: post-spike `/docs-review`.** Only an approved Phase 1 activation may establish package baseline `0.1.0` before a `p1` stack is written/run. This closeout does not approve or generate Product Phase 1 implementation.
