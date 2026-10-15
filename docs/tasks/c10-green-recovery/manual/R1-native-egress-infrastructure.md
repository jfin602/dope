# R1 — Independent Electron GUI and whole-app egress instrumentation proof

**Manual T3. GPT-6 Sol High. Browser-capable local Codex.** Do NOT use the phase runner or require /activate.
**Product:** retained c8c41f9daf00936a212a4bbed18498c1cf44d57e, **0.10.16 unchanged**.
**Purpose:** prove independent test tooling, not full P12/P13 qualification, source repair, context default or Phase 10 Green.
**Target:** ~25–35 minutes, stop early on missing critical permission/tool. Record in qualification/r1-infrastructure/cycle-1.md.

## 0. Preflight / safety

Read BOOT.md, AGENTS.md, docs/workflow.md, [recovery plan](../implementation-plan.md), the existing P14 closeout and narrow native/egress sections of P12/P13 cycles. Check actual HEAD, git status, manifests, product-tree equivalence with c8c41f9, built Electron/browser artifact identity. Do not reset/stash/clean, alter source/version/lockfile or overwrite dirty work. Record developer's host display/session XDG_SESSION_TYPE, DISPLAY, WAYLAND_DISPLAY, available user window/input tools, browser/backend/LM Studio/Electron processes, RAM/headroom and namespaces. Verify Codex tooling is in the **same local desktop/session** as native Dope. If not, mark a real capability gap.

**No** unapproved sudo, installations, root packet capture, killing user apps, unloading unrelated models, host reboot, graphics-stress test, secret logging or automatic fix.

## 1. Native GUI observability

Inspect installed, source-equivalent Electron build and apps/electron/package.json. Launch supported Dope native app (reuse valid build; rebuild affected artifact only if needed), record exact PID/process tree and window identity. Do NOT count Electron build, process existence or browser view as native GUI evidence.

On X11, assess available xwininfo/xprop/wmctrl/xdotool plus import/scrot or other installed capture mechanism. On Wayland use compositor-approved screenshot/window portal and permitted input controls; never assume X11 can operate arbitrary Wayland windows. Do not install tools automatically.

Find a visible **Dope** window independent of ChatGPT in-app browser inventory. Safely focus only Dope and perform a reversible keyboard or pointer action with observed UI change. Capture before and after (or equivalent visible state evidence) on native window, metadata-only PID/title/session/time and SHA-256 of screenshots. Exclude private developer content. If impossible, record NATIVE BLOCKED with exactly which window/tool/session/access failed. Avoid trying to "fix" app code without a product-specific repro.

## 2. Local browser and crash pilot

Use a genuinely **locally observable** browser process and source-identified Dope bundle when possible. Record backend HTTP health, renderer/browser PID and network-service processes. On a minimal Roadmap-only disposable project, observe initial UI and one bounded browser reload/backend restart; record timestamp/PID/status. Optionally exercise one short saved Chat only if RAM headroom allows; do not deliberately recreate crowded 4-dock / Q4 high-memory crash.

Record separately: controller timeout, renderer/tab crashed, backend process exit, log/journal OOM/GPU/process-kill evidence, resource snapshots and reproducible steps. The prior tab "This page crashed" is observed; its cause and previous abrupt host reboot are unknown. If a reproducible Dope renderer failure appears, preserve minimal repro and propose a separate narrow repair; do not implement unapproved source changes inside R1.

## 3. Process-wide egress capture readiness

Create a process-class map, including:
- Browser renderer **and its network-service** plus related children.
- Browser and/or Electron backend and descendants.
- The **already running** LM Studio server and all relevant children, not just a backend-spawned subprocess.
- Native Electron main, renderer, network service, backend and children.

Select a permitted **metadata-only process-attributed network connect/destination/time** method. Evaluate properly scoped strace -ff -e trace=network, permitted ptrace/process audit/eBPF or owner-approved host packet metadata combined with PID attribution. A periodic ss snapshot is supplemental, not proof that no short-lived external connection happened. A backend-only strace is **not whole-app** evidence. Do not retain Chat/prompt payloads, request bodies, auth tokens or unrelated network contents.

Pilot a harmless, intentional **loopback** request with independently identified PID/destination/time to validate attribution; show that the chosen monitor actually covers all other required process classes. If ChatGPT browser renderer/network service runs on a different host/container, local tracer does not cover it—use independent local browser or mark missing boundary. Do NOT contact an unauthorized external server just to simulate egress.

For unavailable sudo/ptrace/eBPF/compositor/packet permission: STOP and ask owner's explicit action, record exact capability and blocked process classes. Do not claim full no-egress until R4 runs an actual Q4-approved local action with complete coverage.

## 4. R1 acceptance and report

Create append-only qualification/r1-infrastructure/cycle-1.md and sanitized evidence. Report actual docs HEAD vs product SHA; OS/session; native window+input+screenshot screenshots hashes; browser source bundle and restart/crash observation; PID/time/connection attribution and method/coverage of every process class; permissions; clear PASS/FAIL/BLOCKED/NOT RUN; minimal next owner action.

**R1 READY** requires all: actual independently controlled/captured Dope Electron window, observable reliable local browser/restart pilot, and a demonstrably sufficient **all-relevant-process** network capture method for R4. Does **not** equal native full UI qualification or no-egress Green.

Otherwise **R1 NOT GREEN/BLOCKED**. Do not spend extra cycles repeating blocked tooling; do not execute R2–R6, npm run check or phase runner. Only propose a separately authorized product repair for a reproduced defect.

**Final response:** exact tested source SHA, window screenshot/input result, browser/controller result, process coverage result, permissions needed, evidence paths and next single concrete action.
