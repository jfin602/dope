# /prompt-ass — c10-green-recovery

**Reviewed:** 2026-10-15. **Decision:** the current product needs **supplemental qualification**, not a speculative large refactor. Product baseline c8c41f9 / 0.10.16; P14 full aggregate passed.

## Evidence-based defect classification

| Evidence | Truth and action |
| --- | --- |
| Native Electron built and PID started | Controller never exposed a *controllable/capturable* native window; neither successful build nor PID is native GUI proof. R1 must use independent Linux X11/Wayland session tools if available. |
| Browser controller timeout, later tab shown as "This page crashed" | Browser tab crash is directly observed; Dope backend remained responsive. High RAM/dense docks possible contributors, **not established root cause**. Older abrupt host reboot cause unknown. Gather minimal trace; do not label kernel/Dope defect without reproduction. |
| Backend-only strace saw 127.0.0.1:1234 | Partial loopback evidence. Browser renderer/network service, pre-existing LM Studio and native Electron not observed; R1 must establish instrumentation and R4 run actual authorized trace. |
| Q4 approved edit and restart, eight hostile denials | Genuine scoped passes at app/compiled boundary. R2/R4 audit before running only unproved assertions. |
| Q3 16K/32K/64K context ladder | Real Q3 loads and no-action turns; not Q4 comparative policy proof. Q4/32768 is provisional from later P12/P13. R5 must decide honest operating context or defer. |

**Scope:** R1 instrumentation, R2 P10 continuity, R3 P12 GUI, R4 P13 safety/egress, R5 P11 context, R6 new recovery closeout. Preserve original P9–P14/P16/P19 Not Green source records and valid passed evidence. Share one disposable fixture across positive integrated tests; isolate destructive authority tests. No second Chat, silent hosted/model fallback, status promotion or runner stack.

**Trust and equipment:** native keyboard/screenshot must identify real Dope window/process. Network evidence must cover connection attempts with PID/time/destination for all relevant processes; a backend-only trace and periodic ss snapshots cannot prove absence of short-lived outbound traffic. Capture **metadata only**, not request contents. Remote in-app-browser infrastructure may be outside local namespace; require a genuinely local controllable browser to prove locally scoped browser traffic, or record missing coverage. No sudo/new install/reboot without owner approval.

**Efficiency:** R1 first, stop on missing permissions; R2–R5 use exact source applicability audits, then target each remaining gap rather than repeat broad loops. Product changes only for a confirmed reproducible defect, with separately approved narrow implementation and regression. R6 sole final correction decision; Phase 10 owner closeout separately authorized.
