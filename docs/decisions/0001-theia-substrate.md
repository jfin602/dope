# ADR 0001 — Eclipse Theia as provisional IDE substrate

Status: Provisional Accepted
Date: 2026-09-27

Decision:
Use Eclipse Theia as the initial IDE/workbench substrate and qualify it through Foundation Spike 0 before major product implementation.

Rationale:
Theia provides commodity IDE capabilities Dope needs while being designed for custom IDE products.

Constraint:
Dope domain state remains independent from Theia and Theia AI.

Revisit when:
Foundation Spike 0 is Not Green, upgradeability is unacceptable, or core product seams require broad internal framework coupling.
