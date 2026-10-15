# R1 cycle-1 network monitor correction

This is a metadata-only equipment diagnostic. Run it only for the approved R1 calibration, in the local host session. The raw host trace must stay private outside the repository. The agent must not start the privileged monitor.

The original IPv4/IPv6 `connect`, `sendto` and `sendmsg` probes remain in `network-r1-v2.bt`. Added socket-layer probes aim to show IPv4/IPv6 peers for connected UDP and TCP sends and individual `sendmmsg` messages. The syscall `sendmmsg` entry/exit records requested and returned message counts. Do not treat a probe entry as proof of delivery, or a destinationless event as proof of no egress.

1. Compile the disposable loopback test as the ordinary user:

   `gcc -O2 -Wall -Wextra -Werror loopback-calibration.c -o /tmp/dope-r1-loopback-calibration`

2. Start `/tmp/dope-r1-loopback-calibration` in one terminal. It prints its PID and IPv4/IPv6 TCP ports, then waits. These TCP connections already exist before tracing starts.

3. In another terminal, choose a private output directory (`mktemp -d /tmp/dope-r1-v2-XXXXXXXX` creates a mode-0700 directory). The owner runs:

   `sudo timeout 90s bpftrace -q /home/jfin/dev/dope/docs/tasks/c10-green-recovery/qualification/r1-infrastructure/diagnostics/network-r1-v2.bt > PRIVATE_DIR/events.log 2>&1`

   Replace `PRIVATE_DIR` with the directory just created. Confirm `bpftrace` is attached with `pgrep -a bpftrace`; if it exits, inspect only the small compile/error output and correct the script before any calibration claim. Do not change kernel security settings.

4. Press Enter in the waiting loopback terminal. The test prints the PID and ports for pre-existing IPv4/IPv6 TCP sends, explicit UDP `sendto`/`sendmsg`, connected UDP `send`, and two `sendmmsg` messages to different ports in each address family.

5. Inspect only lines matching that PID and the matching `SENDMMSG_ENTER`/`SENDMMSG_EXIT` TID. Confirm each port, transport, timestamp, and one socket-layer destination per actual message. Check the private trace for compile/runtime errors and lost/dropped-event warnings. Keep any unrelated host lines private. A missing/mismatched event, unresolved peer, lost-event warning, or failed hook is a coverage gap; do not declare R1 READY.

The socket-layer probes are named in this kernel's BTF and kallsyms, but require owner-run attachment and loopback evidence before their behavior can be claimed. This test does not run Dope, a model action, or R4.

## Verified owner-run calibration and R4 handoff (2026-10-15)

**Current status: R1 READY for R4 instrumentation**, supported by [cycle-1](../cycle-1.md), [PID-only socket-layer calibration](../evidence/socket-layer-calibration.txt) and commit `194609f97f7a4f451e5fadb10f941eaef977f087`. Prior prospective warnings above were written *before* owner execution, and remain historical instructions; the owner **did** attach and calibrate the socket-layer probes. The verified script is [`network-r1-v2.bt`](network-r1-v2.bt), with actual SHA-256 `8d8228ec49e07bf018c0b588ec4d1d3a9e0e273a41d82632068e3072f7aa8e31`, bpftrace 0.20.2, Linux 7.0.0-31-generic, host UID 1000. TCP/UDP IPv4/IPv6 socket peer and per-message `sendmmsg` output worked on loopback; pre-existing TCP connections and destinationless connected UDP were positively observed.

**R4 procedure:** in a developer-controlled private 0700 trace directory, the **owner**, not Codex, starts the same validated monitor for a bounded duration. Adjust duration only as explicitly approved by the owner. Inventory PID, PPID, start time, executable, UID and network namespace for locally observed Chrome network service/renderer, native Electron main/network service/renderer/backend, browser backend, and existing LM Studio server/worker/children **before and after** a real approved Q4/32768 Dope planning turn. Timestamp monitor attach/startup/idle/Send/pending/Apply/new revision/fresh response/stop. Keep raw host log private; retain only PID/time/destination matched sanitized excerpts and hashes. Record external Chrome/Electron startup destinations separately; `connect` entry is attempt, not proof of completed traffic/authorization. Correlate `sendmmsg` return count to actual UDP socket-layer per-message destinations and fail closed on missing peers/processes, unresolved paths, or possible event loss. Monitor scope is observed TCP/UDP paths, **not** a proof of zero loss, all possible network methods or no unauthorized egress. The full contract and additional hostile authority gates are in [R4 manual prompt](../../../manual/R4-integrated-authority-egress.md).
