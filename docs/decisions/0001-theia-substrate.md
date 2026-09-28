# ADR 0001 — Eclipse Theia as initial IDE substrate

Status: Accepted — Foundation Spike 0 qualified with bounded Evidence Gaps
Date: 2026-09-27

Decision:
Use Eclipse Theia as the initial IDE/workbench substrate and qualify it through Foundation Spike 0 before major product implementation.

Rationale:
Theia provides commodity IDE capabilities Dope needs while being designed for custom IDE products.

Constraint:
Dope domain state remains independent from Theia and Theia AI.

Evidence: `docs/tasks/p0/closeout.md` records Gates A-E Green, Linux artifact/launch/renderer Green, and native visual interaction as an Evidence Gap rather than Green; Theia remains 1.75.0.

Revisit when:
Foundation Spike 0 is Not Green, upgradeability is unacceptable, or core product seams require broad internal framework coupling.
