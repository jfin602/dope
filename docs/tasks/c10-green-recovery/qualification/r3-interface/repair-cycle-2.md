# R3 repair cycle 2 — keyboard, focus, contrast, reduced motion

**Group result: GREEN / QUALIFIED in the browser and independent native Electron. Overall R3 remains NOT GREEN.** Retained pre-repair product source was `c8c41f9daf00936a212a4bbed18498c1cf44d57e`; repaired product source tested was `6218ae8f5d8c907c64b9dd418ca47126f3795381`, version `0.10.16`. This follows R3 evidence `cad9c4da4caf3cd5a951e9bda5353fdd6bffd0e6` and the already GREEN native saved-Chat [repair cycle 1](repair-cycle-1.md). That four-dock group was not rerun. No model inference, prompt execution, owner mutation, phase runner, full aggregate, R4, or R5 occurred.

## Method and source boundary

The independently operated Chrome window used backend port 3000, DevTools port 9223, X11 window `0x05a00004`, and project `/tmp/dope-r3-g2-browser`. Native Electron used its separate backend, DevTools port 9224, X11 window `0x06400004`, and project `/tmp/dope-r3-g2-native`. The [runtime inventory](repair-cycle-2/evidence/runtime-inventory.json) records final browser and Electron bundle SHA-256 values, window sizes, project-owner hashes, and saved Chat hashes. Browser and native were each driven by trusted X11 keyboard input and independently observed through their own renderer; source inspection and unit tests alone were not counted as live PASS.

The user identified a misleading spatial setup during the run: an automation session had held each rendered page at 800×600 while the outer windows were larger. Those early screenshots were **not** used as full-window qualification. I reset the renderer dimensions to their physical maximized content sizes, 1920×1113 browser and 1920×1146 Electron, reloaded the committed build, and repeated the live matrix. A separate **actual window resize** to 1100 pixels wide gave 1100×813 browser and 1100×824 native renderers, each with a 449-pixel Roadmap stage; both windows were restored to maximized size afterward. The 800×600 [before](repair-cycle-2/evidence/browser-pre-repair-end.png) and [after](repair-cycle-2/evidence/browser-post-repair-end.png) captures remain as a scoped reproduction of the narrow-viewport camera defect, with matching native captures and numeric rectangles. They are not evidence of the final full-window layout.

At the baseline, keyboard End selected the last correction while its rectangle began at x=1516 outside the 49–751 Roadmap stage in **both** shells; [browser](repair-cycle-2/evidence/browser-pre-repair-end.json) and [native](repair-cycle-2/evidence/native-pre-repair-end.json) record it. A details close could leave focus on `BODY` because the panel was hidden before testing whether it contained focus. Pre-repair computed ratios fell below the relevant limits: Light Active status text 2.48:1, Light Unknown 4.09:1, Dope Dark Not implemented 4.14:1, several status borders below 3:1, and Light focus/selection indicators 2.78:1/2.68:1. The pre-repair color readings were recorded live but their temporary raw output was superseded; these values are retained as diagnostic observations, not independent post-commit evidence. Focus Selection also requested a 320 ms camera animation under reduced motion.

The product repair centers a focused checkpoint at the current zoom when it leaves the visible stage, including Tab and arrow focus after React renders. It captures details-panel focus before hiding the panel, removes the nonessential camera animation under reduced motion, and adjusts Roadmap-only semantic color mixes for Light and Dark contrast. The approved restrained dark-orange identity, owner state, planning authority, Chat architecture, providers, and version were unchanged. Focused permanent coverage exercises the camera calculation and guards the focus, theme, and motion seams.

## A. Keyboard navigation

| Assertion | Browser | Native Electron | Direct evidence |
| --- | --- | --- | --- |
| Tab and Shift+Tab in spatial checkpoint order | **PASS** | **PASS** | Phase 10 → attached c10 correction → Phase 10, with trusted key events and visible focus in [full-window sequence](repair-cycle-2/evidence/full-window-tab-focus.json). |
| Enter selects and activates controls | **PASS** | **PASS** | Phase 10 Enter selected it and opened details; toolbar and overlay buttons responded to Enter in [interaction log](repair-cycle-2/evidence/keyboard-interactions.json). |
| Escape dismisses overlays and restores usable focus | **PASS** | **PASS** | Details returned to its opener/canvas, Markdown to its button, Ideas/Issues to its button; see [overlay log](repair-cycle-2/evidence/overlay-keyboard.json) and [opener return](repair-cycle-2/evidence/details-opener-return.json). |
| Left, Right, Up, Down | **PASS** | **PASS** | Phase 10 → Phase 9, Phase 11, attached correction; correction → Phase 10. All focused cards visible in [arrow log](repair-cycle-2/evidence/full-window-arrow-directions.json). |
| Home and End | **PASS** | **PASS** | Foundation and the last correction received selection and focus; End card was visible after the repair in [interaction log](repair-cycle-2/evidence/keyboard-interactions.json) and [browser](repair-cycle-2/evidence/browser-keyboard-end.png)/[native](repair-cycle-2/evidence/native-keyboard-end.png) captures. |
| Focus Selection | **PASS** | **PASS** | Keyboard Enter on the toolbar centered the selected card; reduced-motion retest also shows the camera change immediately. |
| Keyboard opening checkpoint details | **PASS** | **PASS** | Phase 10 Enter opened mounted details; Escape and explicit Close were exercised. |
| Keyboard opening prompt source | **PASS** | **PASS** | Enter on the disclosed Foundation P1 prompt switched to ordinary `P1-theia-175-bootstrap.txt` editor in both shells. [Interaction](repair-cycle-2/evidence/full-window-prompt-source.json), [browser](repair-cycle-2/evidence/browser-full-window-prompt-source.png), [native](repair-cycle-2/evidence/native-full-window-prompt-source.png). No Work execution was invoked; both disposable prompt files still matched the repository source SHA-256 `88ae5ae75434b708e5cf0aa6462b0781eabd16924594bb2c5f61c00850d375e4`. |
| Toolbar actions and overlay controls | **PASS** | **PASS** | Fit/Focus, details, Markdown, and Ideas/Issues were reached by keyboard; Tab traversed visible overlay controls and exited each overlay without a trap in [traversal log](repair-cycle-2/evidence/overlay-tab-traversal.json). |
| Camera follows selection and focus; no owner write | **PASS** | **PASS** | Full-window and actual narrow-stage focused card bounds intersected the stage; at 449 px stage width both horizontal card edges remained visible. [Narrow log](repair-cycle-2/evidence/actual-narrow-tab-focus.json). Roadmap owner/source and saved Chat hashes stayed unchanged. |

## B. Focus management

| Assertion | Browser | Native Electron | Direct evidence |
| --- | --- | --- | --- |
| Focus returns after closing overlays | **PASS** | **PASS** | Explicit details opener → panel → Close returned to the details button; Markdown and pool Escape returned to their buttons. [Opener](repair-cycle-2/evidence/details-opener-return.json), [keyboard](repair-cycle-2/evidence/keyboard-interactions.json). |
| Minimize and reopen retain usable focus | **PASS** | **PASS** | Details compact → minimized → expanded focused an input; Markdown expanded → minimized → expanded focused the panel, and Close restored its button. [Overlay log](repair-cycle-2/evidence/overlay-keyboard.json). |
| Switching editor tabs | **PASS** | **PASS** | A source editor tab was opened, Roadmap was reopened, and Tab again reached a checkpoint. [Overlay/tab log](repair-cycle-2/evidence/overlay-keyboard.json). |
| Opening Chat does not steal unrelated Roadmap focus | **PASS** | **PASS** | Opening the right Chat panel left Phase 10 focused and selected in [Chat focus log](repair-cycle-2/evidence/chat-focus-full.json). The already-qualified saved Chat was reused without a turn or four-dock replay. |
| Narrow split remains keyboard usable | **PASS** | **PASS** | At actual 1100-pixel windows, Roadmap stage width 449; Tab and Shift+Tab cards and focus ring were fully inside it. [Browser](repair-cycle-2/evidence/browser-actual-narrow-tab-focus.png), [native](repair-cycle-2/evidence/native-actual-narrow-tab-focus.png). |
| Visible focus in all four themes | **PASS** | **PASS** | `:focus-visible` true, 2 px authored outline, computed contrast above 3:1, and full-window visual captures. [State](repair-cycle-2/evidence/theme-states.json), [contrast](repair-cycle-2/evidence/focus-contrast.json). |
| No trap or unreachable required overlay control | **PASS** | **PASS** | Tab reached visible header controls, filters/list actions where present, and then exited source, details, and pool overlays in both shells. Escape from inside independently restored focus. [Traversal](repair-cycle-2/evidence/overlay-tab-traversal.json). |

## C. Contrast and themes

All four available themes were directly selected in both renderers: Dope Dark, Light, High Contrast Dark, and High Contrast Light. [Computed colors and all six status samples](repair-cycle-2/evidence/theme-computed.json) include exact CSS values for text, card fill, border, toolbar, and disabled controls. [Theme states](repair-cycle-2/evidence/theme-states.json) record selected, focused, hovered, and disabled states; hovered card fill changed without removing the status word or indicator. The four [browser Dark](repair-cycle-2/evidence/browser-dope-dark.png)/[Light](repair-cycle-2/evidence/browser-light.png)/[HC Dark](repair-cycle-2/evidence/browser-hc-theia.png)/[HC Light](repair-cycle-2/evidence/browser-hc-theia-light.png) and corresponding native screenshots are full-window captures.

The applicable AA checks used [WCAG text contrast 4.5:1](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) for ordinary status text and [non-text contrast 3:1](https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html) for meaningful borders, focus, and selection indicators. Inactive controls were inspected but are exempt from the text threshold; the evidence records their actual disabled state and computed opacity.

| Theme | Lowest of six status text ratios | Lowest status border/card ratio | Focus outline/card, browser/native | Selection shadow/card, browser/native | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Dope Dark | 5.53:1 | 4.11:1 | 4.96:1 / 4.04:1 | 4.48:1 / 4.48:1 | **PASS / PASS** |
| Light | 4.54:1 | 3.08:1 | 4.28:1 / 4.32:1 | 3.76:1 / 3.76:1 | **PASS / PASS** |
| High Contrast Dark | 5.14:1 | 5.61:1 | 6.53:1 / 6.53:1 | 5.96:1 / 5.96:1 | **PASS / PASS** |
| High Contrast Light | 5.18:1 | 6.12:1 | 5.06:1 / 5.06:1 | 4.39:1 / 4.39:1 | **PASS / PASS** |

All six canonical status treatments appeared as explicit marks and words in each renderer: `✓ Green`, `▶ Active`, `! Not Green`, `◇ Owner-closed for sequencing` (Waived), `○ Not implemented`, and `? Unknown`. Whole-card tint and border were separate from the 2 px focus outline; selection also used a 2 px shadow and heavier text. Thus status, selection, and focus did not depend on color alone. The hovered, selected, focused, and disabled inspections, four themes, ordinary text, meaningful indicators, and six statuses were **PASS in browser and native**.

## D. Reduced motion

Both live renderers accepted `prefers-reduced-motion: reduce` through their own Chromium DevTools media feature override; this is the supported renderer-level equivalent tested here, **not a claim that the desktop OS preference changed**. [Reduced-motion log](repair-cycle-2/evidence/reduced-motion.json) records `matchMedia(...).matches === true`, 0 s Roadmap card transition, no related-edge animation, and zero running stage animations. [Browser](repair-cycle-2/evidence/browser-reduced-motion.png) and [native](repair-cycle-2/evidence/native-reduced-motion.png) screenshots retain visible status words and selected path. [Active-path inspection](repair-cycle-2/evidence/reduced-active-path.json) retains `▶ Active` and a 3 px static related line with no animation. Arrow selection and keyboard Focus Selection still worked.

The [camera timing log](repair-cycle-2/evidence/reduced-camera-full.json) shows Fit at scale 0.2 followed by Focus Selection at scale 1.4 **immediately**, with identical transforms at 60 and 480 ms in both shells; no continuous animation ran. The browser and native owner hashes in the runtime inventory match their pretest values, so reduced motion did not change stored Roadmap state. Media setting, suppressed nonessential motion, understandable active styling, functional selection/navigation, no continuous motion, and unchanged owner state were each **PASS in browser and native**.

## Verification and remaining R3 scope

`node --test test/unit/roadmap-viewport.test.ts test/unit/roadmap-canvas.test.ts test/unit/roadmap-spatial-canvas.test.ts test/unit/dope-theme.test.ts`: **32 passed, 0 failed**. Browser and Electron builds and Theia extension build completed with zero build errors on the product commit. `git diff --check` passed. The version remained `0.10.16`. The earlier native saved-Chat 30/30 tests remain inherited, with no rerun. [SHA-256 manifest](repair-cycle-2/evidence/manifest.sha256) gives full hashes for every retained screenshot and interaction record; the key before/after End screenshots and full-window interaction records are also cited above.

| Retained artifact | SHA-256 |
| --- | --- |
| `browser-pre-repair-end.png` | `1632ddd30d25aac691f122e37b4d1513f9a78f794b938086db3da988ae190ae9` |
| `native-pre-repair-end.png` | `6de75b6b4ba7f56c247cd465a39d08de7b90ca7ec9c1f1ead8501dd75113a09b` |
| `browser-keyboard-end.png` | `0a5ed4c00ec4cc99899705657fd391922452ac3148cf6e20ae28f29a1171e687` |
| `native-keyboard-end.png` | `b334e0a1c4bd57c3992e69726a85ca8ffe2876d73c0765735a16f1e7c997b153` |
| `keyboard-interactions.json` | `07813ef54238f414aedc0a189760d6e260b9ea672adff79cee3e26805b92684a` |
| `theme-computed.json` | `00f7a0959d6773e84631c60b6d0cefbdb7da90a5f96946617af1af1f4aa3d301` |
| `reduced-camera-full.json` | `673bd6e5131fd5bd3ac9a9412b7ebbd238211bdcc78f1a96eb6a63d3d183931f` |

**No blocker remains for this repair group. Overall R3 remains NOT GREEN.** The other independent R3 assertions from [cycle 1](cycle-1.md) remain open: touch or grounded equivalent; relationship variant and legibility in native; conflict/relink/pending-sync/undo; project switch and legacy viewport migration; incomplete wheel/pan/Arrange and checkpoint zoom observations; and a meaningful current-source Chat completion narrative. This result does not qualify those assertions, Phase 10, or the context default.
