# M1 Chrome replay — NOT GREEN (qualification incomplete)

Date: 2026-10-29. This is the manual M1 result, not a P14 decision or a P14 PASS marker. The earlier P14 NOT GREEN record remains intact. Product version stays `0.11.8`; no native Electron result is claimed.

## Source and fixtures

- Git HEAD: `803c1960fb2fb4147eae31d4521d18f50bbc83d1`. M1 implementation and this evidence are uncommitted.
- Built and served browser JavaScript SHA-256: `fc9aa87bc64cabb5d88b74ef58e7bab26117272285e280bb5cb298228dea03dd`; CSS SHA-256: `d73d38af824f93685c95012b7c375632017a9002dc4800ec0b8082c90eddce27`. The local and HTTP-served hashes matched.
- Disposable schema-2 Roadmap roots: `/tmp/dope-m1-verified-3-SueuGq` and `/tmp/dope-m1-verified-7-FuIYeX`. Their Green Phase 1 used actual zero-error browser build plus 58/58 focused tests as evidence, with typed evidence proposal, review and required Gate-set approval against the bundle hash above. Phase 2 was Planned; the three-Phase fixture's Phase 3 was Unplanned.
- Fixture `roadmap.json` SHA-256 stayed `90ad52cbe17ad1c21a71efeb78ea229f2052a9a1c98cb8b3f511fee7e4e32ae5` (three phases) and `7e5e446315e8849dcb263ef5840dd2e2f490ea026ba469c039f82c7b47c50c8a` (seven phases) through browser navigation, expansion, themes and reload. Presentation wrote no Roadmap source.

## Connected Chrome observations

At the 1533 × 1048 browser viewport, initial seven-Phase view used scale `1`, a `500 px` Phase card, `23 px` title, `15 px` Gate text and a `70 px` Gate summary. The first actionable Phase was readable; later Phases were reached by horizontal drag and Shift+Right keyboard pan. [Three-Phase initial](m1-screenshots/verified-three-initial-chrome.jpg) and [seven-Phase initial](m1-screenshots/verified-seven-initial-chrome.jpg) show the working camera. Fit All was a separate `0.267839` overview ([image](m1-screenshots/verified-seven-fit-all-chrome.jpg)); selecting Phase 2 and Focus returned to scale `1` and a whole visible `500 px` card.

Opening the Gate grew Phase 2 from `311 px` to `582 px`; opening its criterion grew it to `681 px`. The camera stayed `translate(-620px, -608px) scale(1)` and the long objective and acceptance text wrapped without crop ([expanded image](m1-screenshots/verified-seven-expanded-chrome.jpg)). Normal drag moved the camera to `-1120 px`; Shift+Right moved it a further `40 px`. A later intentional Focus camera at scale `1` survived reload.

The owner-requested selection correction passed in Chrome: the selected Planned Phase had a `3 px` perimeter outline in its copper Phase accent; other cards had no perimeter selection ring, and the title button computed `outline: none`. Keyboard `:focus-visible` kept the whole-card ring and no title outline. [Selected Planned card](m1-screenshots/selected-planned-chrome.jpg). Light, custom Kimbie Dark and Dark High Contrast each showed a whole-card status-colored outline and no title outline ([light](m1-screenshots/verified-light-selected-chrome.jpg), [custom](m1-screenshots/verified-custom-selected-chrome.jpg), [high contrast](m1-screenshots/verified-high-contrast-selected-chrome.jpg)). The light and high-contrast Green accents resolved to their theme success greens.

Left Chat plus a narrow `917 px` canvas retained the expanded card at scale `1` ([image](m1-screenshots/verified-seven-chat-narrow-chrome.jpg)). Right Chat with the left panel closed retained a `1192 px` canvas and the readable selected card ([image](m1-screenshots/verified-seven-chat-right-chrome.jpg)). With both side panels open, the center was `672 px` and Focus still displayed the full `500 px` card.

## Checks and remaining qualification gaps

- The affected browser build and TypeScript build passed with zero errors. The focused canvas, spatial, semantic zoom, viewport, Phase/Gate qualification and theme set passed `58/58`. `git diff --check` passed.
- `test/unit/roadmap-status-truth.test.ts` passed `1/3`: two legacy cases call retired schema-1 Roadmap operations and fail with `Roadmap projection requires schema 2` / `Checkpoint Roadmap operations are retired for schema 2; use Gate actions`. This does not demonstrate an M1 regression, but the requested status-truth check is not green.
- A real Chrome reduced-motion preference replay was not completed. The focused viewport test covers its reduced-motion branch, but that is not the requested browser observation.

The visible Phase sizing and selected-card border are corrected, but the full required manual matrix is incomplete. Do not advance P14/P15 or infer broader Phase 11 Green from this record.
