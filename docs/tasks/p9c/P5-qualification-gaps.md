# P5 candidate browsing boundary

At the `0.9.18` implementation candidate, the Session picker offers bounded owner-backed choices for Chat manifest IDs, Planning Maps, WorkItems, AgentTasks, AgentTaskSequences, and Project Mind decisions/ideas. It returns at most 50 choices for one requested kind. Chat titles are unavailable from the safe manifest-only path, so Chat choices show their exact IDs. The backend validates an exact Chat record only when the developer attaches it.

**Qualification gap:** AgentRun browsing is unavailable. The existing AgentStore list path loads full run records, including candidate review diffs; it is unsuitable for a metadata-only Session picker. The UI displays that limitation and retains P4 exact task ID plus run ID attach. A future safe run metadata list would need its own evidence before enabling those choices.

Headless P5 tests and extension compilation do not qualify the real Theia GUI. P10 owns manual 9C GUI qualification. This record does not change 9A/9B bounded Green, Phase 5 historical gaps, Phase 8 Green, or Phase 9 overall qualification.
