# MVP acceptance

- Anonymous demo runs without accounts, external APIs or paid services; browser persistence is isolated and resettable.
- Baseline captures estimates, assignees, dependencies, acceptance criteria and calendar. An approved snapshot cannot be edited in place.
- Changes can add, modify or remove a deliverable, or test a new deadline. Multiple edits are supported in the domain/API and synthetic examples; the simple request form captures one operation per request.
- Three scenarios expose hours, dated schedules, estimated labor, headroom, capacity usage, assumptions and infeasible deadlines.
- Calculated alternatives are saved; a person explicitly submits one option. Approval references its revision. Resubmission withdraws previous pending approval.
- Lead application creates a new baseline once. Stale concurrent versions fail. Earlier baselines and decisions remain available.
- Supabase migrations implement workspace/project access, expiring invitations, redacted client DTOs and transactional mutations. Real integration acceptance remains blocked until migrations and database tests run in a configured environment.

Excluded: AI, billing, external messaging, live integrations, general task tracking, automatic recommendations, optimal scheduling, task splitting, actual spend, partial completion, resource skills and organizational capacity across different projects.

Release gaps are tracked in release-checklist.md; a passing local build does not establish production readiness.
