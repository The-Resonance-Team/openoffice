# 0001 — RBAC with a team-scoped Team Leader, not ABAC

We considered attribute-based access control (policies over document sensitivity, resource owner, time, device) but chose a fixed role hierarchy instead: Owner > Admin > Team Leader > Member, with Team Leader's elevated permission scoped to their own Team only. An attribute-policy engine is real work with no concrete policy requirement driving it yet; a fixed hierarchy covers "admin configures for non-technical member" completely. Revisit if a specific attribute policy (e.g. per-document sensitivity) becomes a real requirement.
