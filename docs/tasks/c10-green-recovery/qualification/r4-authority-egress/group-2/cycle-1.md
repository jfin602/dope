# R4 repair Group 2 — cycle 1

**Status: BLOCKED at owner-operated monitor handoff; qualification operation NOT RUN.** Entry on 2026-10-16. This is a preflight record, not a Group 2 or overall R4 qualification. Phase 10 remains NOT GREEN / NOT OWNER-CLOSED; R5/R6 remain unrun.

## Source and equipment preflight

- Clean entry HEAD `5efef59675cbd63f48bce8a7d0fe2af062c9b06b` contains Group 1 evidence only after product source `00121646f6b5f3d66e06e3cd320935a76dc73353`. The latter is an ancestor of HEAD; there is no diff under `apps/`, `packages/`, `test/`, root `package.json` or `yarn.lock`. Version is `0.10.16`.
- R1 script `../../r1-infrastructure/diagnostics/network-r1-v2.bt` has SHA-256 `8d8228ec49e07bf018c0b588ec4d1d3a9e0e273a41d82632068e3072f7aa8e31`. Current kernel is `7.0.0-31-generic`, bpftrace is `v0.20.2`, and the user UID is `1000`, matching R1's owner-run calibration. The script has five syscall probes and three socket-send probes and filters UID 1000. It has not been attached for Group 2.
- Rebuilt the Theia extension, browser and Electron from this clean checkout using their package build scripts. All completed with zero build errors. Generated browser bundle SHA-256 `65788a33cf1d353d81eae010cb3151ea4592273e9a75c7fd3a6436b60058ee54`, Electron bundle `b9079688a05034b7d124f46175fc4931cda5575dab8f0e64650ac6099ec58ccd`, compiled ChatBackend `442627bf1e0bd46b77bf77d477025703c24d244c7b95151c392a6c1bc65815de`; both generated backend entry points are `3cadf81668e99b6674b6f248f54bc04615ed7876787d8a1ba79314815035407a`. These hashes identify the bundles to launch later; no UI has been launched for Group 2.
- Installed model inventory reports exact `qwen3-coder-30b-a3b-instruct@q4_k_m`, GGUF Q4_K_M, 18,632,186,176 bytes, maximum context 262144. `lms ps --json` returned `[]`: loaded 32768 context, parallel/offload, server endpoint and selected saved Chat are **not yet verified**. The inventory read woke the LM Studio service before tracing; it was not a model request. At preflight, no Dope browser/Electron or Chrome test process and no `127.0.0.1:1234` or `:3000` listener were observed.

## Owner monitor handoff

The owner must start the R1 monitor independently before Dope/Chrome/Electron startup or any model request. In an owner terminal, from any directory:

```bash
umask 077
trace_dir=$(mktemp -d /tmp/dope-r4-g2-XXXXXXXX)
printf 'Private trace directory: %s\n' "$trace_dir"
sudo timeout --signal=INT --kill-after=10s 1800s bpftrace /home/jfin/dev/dope/docs/tasks/c10-green-recovery/qualification/r1-infrastructure/diagnostics/network-r1-v2.bt > "$trace_dir/events.log" 2>&1
```

Leave that terminal running. From another owner terminal, confirm attachment without copying raw host traffic:

```bash
pgrep -af 'bpftrace.*network-r1-v2.bt'
rg -m1 '^Attaching [0-9]+ probes' "$trace_dir/events.log"
stat -c '%a %n' "$trace_dir" "$trace_dir/events.log"
date --iso-8601=seconds
```

The owner should provide only the private directory path, attach confirmation, timestamp and any compilation/error text. No full trace or unrelated traffic belongs in Git. The 1800-second timeout bounds this first capture; if it ends before all actions, stop testing and coordinate a second bounded window. Codex must not start/stop the monitor or change tracing permissions.

## Coverage limits and next observations

R1 calibrated IPv4/IPv6 TCP attempts, TCP sends including pre-existing peers, explicit and connected UDP, and per-message `sendmmsg`. The script does **not** independently count kernel ring-buffer loss, track `connect` return status, prove delivery, or cover every possible transmission API. Group 2 must verify expected local events, check for errors/drop warnings/truncation, reconcile `sendmmsg` returns against socket-layer messages, inventory all relevant UID/namespace/process descendants before and after, and fail closed on unresolved peers or non-UID-1000 actors. A missing line alone cannot prove no egress. Previous Chrome/Electron external startup attempts remain unclassified until monitored and attributed here.

After owner attach is confirmed, launch the disposable browser and independent native environments, record startup/idle traffic, then verify loaded Q4/32768 and perform the approved UI operation. No startup, inference, approval, negative control, external classification or source mutation occurred in this preflight. Group 1's source-bound Green result is unchanged.
