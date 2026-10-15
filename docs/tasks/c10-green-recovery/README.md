# c10-green-recovery — Phase 10 supplemental qualification

**Status (2026-10-15): R1 READY FOR R4 INSTRUMENTATION (scoped); R2–R6 MANUAL PROMPTS AUTHORED / NOT EXECUTED; OVERALL CORRECTION NOT GREEN.** [Committed R1 evidence](qualification/r1-infrastructure/cycle-1.md) at `194609f97f7a4f451e5fadb10f941eaef977f087` verifies real native Electron window/input/screenshots, independent Chrome/restart and IPv4/IPv6 TCP/UDP socket peer calibration, including `sendmmsg`. It does NOT prove actual whole-app no-egress, complete event-loss detection or authorization of external startup attempts.
**Product baseline:** c8c41f9daf00936a212a4bbed18498c1cf44d57e; version **0.10.16 unchanged**.
**Authority:** prior [P14 Not Green closeout](../c10-roadmap-qualify/closeout.md), [assessment](prompt-assessment.md), [plan](implementation-plan.md), ADR 0036 and repository workflow.

The correction recovers **missing mandatory evidence**, not Roadmap implementation. P14's single exact-source full check and browser/Electron builds passed; P10–P13 nevertheless remained Not Green for incomplete real-world qualification. Both previously scoped corrections are Green; the original P9 three-cycle Not Green, later P9 requalification Green, P10–P14, P16 and P19 records remain intact.

| Recovery checkpoint | Required outcome | Status |
| --- | --- | --- |
| **R1 Equipment** | Independent native Dope Electron screenshot/input, local browser/restart observation and full relevant-process network attribution *pilot* | **READY FOR R4 (qualified equipment only)** |
| R2 Planning continuity | Resolve P10's remaining post-restart browser, foreign-owner and historical-status gates; reuse exact-source P12/P13 Q4 proof where applicable | **[Prompt ready](manual/R2-planning-continuity.md)** |
| R3 Browser/native GUI | Finish P12 keyboard/touch/pointer, six statuses and connectors, overlays, theme/motion/viewport migration, narrow panes and restart in browser AND native | **[Prompt ready](manual/R3-browser-native-interface.md)** |
| R4 Integrated authority/egress | Direct unfinished hostile/Planning Map/Work/recovery tests and no unauthorized egress during one fully instrumented Q4 local approved turn | **[Prompt ready](manual/R4-integrated-authority-egress.md)** |
| R5 Context/reliability | Minimal meaningful same-Q4-model context comparison plus longer approved/fresh-turn/latency evidence, or explicitly deferred context default | **[Prompt ready](manual/R5-q4-context-reliability.md)** |
| R6 Final recovery closeout | Exact-source supplemental family matrix; correction Green only if every mandatory gate has sufficient direct evidence | **[Prompt ready](manual/R6-final-recovery-closeout.md)** |

**Current execution: R2 → R3 → R4 → R5 → R6**, each individually run as manual T3 OUTSIDE phase runner, with no `/activate`. All five prompts are now authored; none has run. Source/fixture applicability controls reuse; R2 and R4 should synchronize one owner-monitored real local approval if feasible. R1's verified `qualification/r1-infrastructure/diagnostics/network-r1-v2.bt` and its [operator instructions](qualification/r1-infrastructure/diagnostics/README.md) govern privileged capture: **the owner runs it**, with raw host logs private and PID-matched metadata only. A shared observation can count for multiple family gates only with separately documented acceptance.

**Preserve and reuse:** P9 real Codex ↔ Dope linked Markdown handoff, P10 local intent/approval/greenfield, P11 Q3 measured 16K/32K/64K *no-write* characterization, P12 Roadmap/Chat/4-dock observations, P13 real Q4_K_M/32768 approval/restart and eight compiled-authority denials. None is a blanket family Green. Q4/32K is **explicitly selected provisional test settings**, not a qualified global default. Avoid repeating an already proven action unless its source/fixture/producer-consumer changed.

**Safety:** Do not reboot host, change provider/AI Center defaults, unload unrelated models, install packages, elevate privileges, collect secrets or packet payloads, erase historic evidence, or weaken mandatory native/egress gates. If permissions are required, ask owner and mark blocker. A reproduced actual product defect receives a separately authorized narrow repair/commit/regression check. The original successful P14 aggregate is source-equivalent reusable if product bytes are unchanged; otherwise R6 runs one new final-source aggregate.

**Next:** execute [R2 planning continuity](manual/R2-planning-continuity.md) manually, preserving R1's passes. R3–R6 remain unexecuted. Phase 10 stays Not Green and not owner-closed; Phases 11/12 inactive.
