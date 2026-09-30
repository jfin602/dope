# Correction 4 — sMap Synthesis Improvements

Status: **OWNER-CLOSED / NOT QUALIFIED AFTER P4**
Correction folder: `c4-synth-improvements`
Required unchanged version: `0.4.6`
Activation source: `8ea34ae1300a387ac63aad9462ae649ac78a9605`
Pushed P4 record: `4a887ecebc546f9944adf54890143827623e008c`
Authority: ADR 0014 plus ADR 0008-0013 where not amended

## Owner disposition — 2026-09-30

The owner closes this correction early after P4.

P1-P3 remain completed implementation work. P4 completed the real Gemini/browser qualification and produced `P4-responsibility-synthesis-evidence.md`. P4 is **Not Green on architecture quality**.

P5 will **not** run. Its existing prompt remains historical/unexecuted and must not be treated as closeout evidence.

## What P4 established

- selected/probed real `gemini-3.8-flash`;
- center review reached in at most **302.8 seconds**, satisfying the <=8-minute objective for that run;
- one coherent System and five responsibility-named Subsystems avoided the earlier Frontend/Backend-only failure;
- center hierarchy review, source navigation, add/rename/reparent/remove and invalid-acceptance blocking worked;
- machine credential persistence survived backend restart after the bounded notification repair;
- `npm run check`, restart tests, phase validation, Linux AppImage packaging and native launch/readiness passed on the recorded candidate.

## Why it is Not Qualified

The frozen Adaptive SEO hierarchy remained materially incomplete:
- tenant/project control was omitted/collapsed;
- collection and Feed output responsibilities were omitted/collapsed;
- provider synchronization/integrations were omitted/collapsed;
- workers/jobs and Feed Digest were omitted/collapsed;
- delivery detail was incomplete;
- three of five Subsystems had no Components and no explicit descent diagnosis.

Telemetry also lost the final verification-call record: twelve model calls occurred while only eleven call records remained visible. The first controlled attempt failed with `Gemini SDK or transport type error` and required manual retry.

Valid live acceptance, merge/split-equivalent correction and project-switch isolation were not directly proved.

## Routing

Mandatory next correction: **`c4-synth-coverage-review`** at unchanged `0.4.6`.

That correction owns coverage recovery, empty-descent diagnostics, complete call-attempt telemetry/retry reliability and branch-local **Search Deeper** review.

If it closes Green, route to a fresh bounded provider-comparison correction, then `c4-smap-storage`. Phase 5 remains blocked.
