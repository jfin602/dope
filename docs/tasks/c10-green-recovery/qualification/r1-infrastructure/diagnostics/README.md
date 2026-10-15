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
