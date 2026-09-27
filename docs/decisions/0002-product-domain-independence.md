# ADR 0002 — Product domain independent from presentation

Status: Accepted
Date: 2026-09-27

Decision:
Project Intelligence, Agent State, Agent Runtime, Authority, and core product artifact models must not depend on Theia presentation types.

Rationale:
Dope's differentiated state must survive UI/framework evolution and remain testable without rendering the IDE.

Consequence:
Theia packages are adapters at the outer boundary.
