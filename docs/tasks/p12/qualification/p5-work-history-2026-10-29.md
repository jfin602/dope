# P5 Work and History qualification — 2026-10-29

Pre-task HEAD: `2d8bed21f13bb66dfad05bff33a598a262ca5e9e` at `0.12.4`. The P4 broker and its qualification are present on that committed source. P5 changes are uncommitted for the phase runner; assigned version is `0.12.5`.

The installed Pi Coding Agent 1.4.0 SDK defines `agent_start`, `turn_start`, `turn_end`, `agent_end`, `agent_settled`, `tool_execution_start` and `tool_execution_end`. The Pi worker now forwards only bounded structured event metadata with an ordered sequence. The host rejects skipped, repeated, malformed and out-of-scope event records. The Work adapter maps the observed lifecycle to Dope Work events; command output comes from the approved Dope broker. Dope's existing AgentRun, transcript, validation, review candidate and History store retain run/task/project identity, model provenance, source-basis checks, and the Accept/Reject boundary.

Focused automated evidence:

- The P4 Pi Work fixture runs the installed Pi session against a synthetic loopback Local model stream and now asserts real SDK session, turn and tool event order alongside brokered read/edit/test output. An approved test command first fails, then another passes; the failed command and Pi tool error are recorded without an authority-denial claim or invented exit code.
- A separate Work/History fixture uses two fresh disposable Git clones. Both candidates reach a Dope validation and review hold; one is rejected with no canonical source mutation, and one is accepted with only the reviewed file promoted. It reopens persisted AgentRun, transcript and History with a new store/runtime instance and checks exact run/model/project attribution, command ordering and a failed command record. Its event inputs are deterministic adapter fixtures, not a claim of a second live Pi model session.
- A Pi Work callback fixture exercises revocation during a tool request, cancellation, and a late callback after cancellation. The P4 fixture continues to cover foreign task/grant refusal and changed source basis.
- Extension build, pinned Pi integrity check and the focused test files passed on the P5 working tree. `git diff --check` passed.

The local LM Studio service, a full app process restart, and an independent native GUI were not part of this headless fixture qualification. Restart evidence is limited to new store/runtime instances reading the same persisted project files. No Pi narration was accepted as validation, Green status, or promotion authority. This result does not close P8 or B1–B9.
