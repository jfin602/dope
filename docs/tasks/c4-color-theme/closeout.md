# c4-color-theme closeout

Decision: **GREEN / QUALIFIED** at unchanged package version `0.4.6`.

## Candidate and P1 evidence

P1 committed candidate: `8ad8354f641e555e7d7c3e8fc9e5d8f60bc849aa` (parent `cac8f1978b60d4e9cf62d2e544f33477cd2451aa`). The P1 result in that commit records passing focused Dope theme and Theia baseline tests, extension and browser builds, diff check, version/no-root-lock check, and correction prompt validation. The working tree was clean at P2 entry; the P1 source matched this commit.

P2 made one bounded correction in the central Dope Dark token block, with its focused regression in `test/unit/dope-theme.test.ts`. No project/domain state, layout, theme registration, or package version changed.

## Browser observation

Real browser app on the Dope repository: `http://127.0.0.1:3076/#/home/jfin/dev/dope`, isolated `THEIA_CONFIG_DIR=/tmp/dope-c4-color-p2-fresh`. The fresh context had no prior theme preference. The normal Color Theme picker selected **Dope Dark** by default; the body had `dope-dark` and `dark-theia` classes.

Before the P2 correction, computed tokens confirmed `--theia-editor-background: #1F1F1F`, `--theia-button-background: #FF7A1A`, `--theia-button-hoverBackground: #FFB15C`, and `--theia-focusBorder: #FF7A1A`. The browser showed an orange active sMap Activity Bar entry, readable dark text on orange sMap/Project Mind buttons, coherent sidebar focus and list selection, and distinct Markdown syntax colors. The sMap review was not opened because no derived graph was loaded; the sMap sidebar and Project Mind were inspected.

Directly observed misses were the default-blue status bar (`#007acc`) and blue theme-picker selection/group labels. A review of computed workbench interaction tokens found the same blue in menu, quick input, suggestion, radio, input-option and sash focus states. The P2 correction maps these to the locked orange palette only while `dope-dark` is active. White text on the deep-orange status bar and selection background has approximately 4.56:1 contrast.

After the focused test and extension/browser rebuild passed, the browser was reloaded. The status bar was visibly deep orange; the Color Theme picker selected row was deep orange and group labels were highlight orange. Computed values included `--theia-statusBar-background: #C75100`, `--theia-menu-selectionBackground: #C75100`, `--theia-quickInputList-focusBackground: #C75100`, and `--theia-pickerGroup-foreground: #FFB15C`.

## User override and limits

Through the normal Color Theme picker, **Light (Theia)** visibly took control before and after the P2 correction. The `dope-dark` class and `--dope-primary` token disappeared; the editor became white and the alternate theme's own button, menu and status-bar colors returned. Dope Dark was selected again afterward.

Remaining blue is retained where it conveys syntax, diagnostics/info, terminal ANSI, debugging, SCM or extension semantics rather than Dope brand interaction. Native browser/OS select-option hover rendering was not independently sampled. This was a quick browser closeout, not native/Electron or AppImage qualification. No Phase 5 behavior was exercised.

Route to a fresh Product Phase 5 `/docs-review`. Phase 5 implementation remains inactive pending that review and approval.
