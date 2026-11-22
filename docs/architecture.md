# Architecture

## Stack decision

The workspace was empty. Node 22.14 and TypeScript 5.8.3 were available, but registry.npmjs.org could not resolve. Rather than leave an uninstalled Next.js scaffold, the implementation uses native Node HTTP, browser ES modules and typed TypeScript domain modules. No runtime dependency or framework download is required. The lockfile has zero external packages. This deliberately departs from the preferred Next.js/Tailwind stack, not the requested product behavior. A future framework migration can reuse the domain and database.

## Data flow

The browser imports shared domain modules. Demo commands pass through a separate local-storage adapter and never call private data endpoints. Authenticated commands go to same-origin HTTP handlers, which verify Supabase identity, validate the command and call transactional database functions using that user's bearer token and a publishable key.

Supabase Auth owns passwords and sessions. HTTP-only SameSite cookies hold access/refresh tokens; the server validates the user with Auth and refreshes expired sessions. Postgres functions repeat authorization and concurrency checks even for direct Data API callers. SQL also calculates canonical snapshots so caller-supplied totals cannot be trusted as results. No service-role key is used.

Normalized tables cover workspaces, memberships, project access, revisioned resources/deliverables/dependencies, change requests, scenario runs, proposals, decisions, events, notifications and invitations. JSON plan snapshots deliberately duplicate normalized approved scope to make a historical calculation reproducible. These immutable snapshots are versioned; they are not a mutable project-state blob.

## Scheduling contract

Effort and availability use quarter-hours. Dates are project-local calendar dates, represented as YYYY-MM-DD; UTC arithmetic advances those date labels without DST-hour arithmetic. The IANA project timezone is validated and displayed. Working weekdays and explicit holidays are authoritative. Each task has one assignee. Finish-to-start dependencies begin on the next working day, even when capacity remains on the predecessor's last day.

Stable topological scheduling chooses the first ready deliverable in stored input order and fills that assignee's remaining daily availability. Separate resources can run in parallel. The resource-day ledger prevents overbooking. A task can span days but cannot be split across people; independent tasks can share a partially used day. This heuristic does not optimize makespan. Planning horizon: 3,650 days; limits: 200 tasks, 50 resources.

Cost is rounded half up per task using integer quarter-hours × integer hourly minor units, then summed. Budget minus estimated labor is headroom; budget is not actual cost. No actual spend is recorded. UI money is rounded for compact display; exact minor units remain stored. Currency conversion is absent.

Scenario C identifies a new resource, start date, rate and explicit onboarding hours; only added deliverables move to that resource. Faster capacity cannot shorten a dependency bottleneck automatically. Scenario B removes selected deliverables but refuses dangling dependencies. The user must remove dependent work too or explicitly rewire it through scope edits.

## Risks

SQL and TypeScript implement the same scheduling contract and can drift: integration parity tests are required before release. Raw rate-bearing tables have internal-only RLS; clients use a recursively redacted RPC DTO. RLS/integration tests have not run in this environment. In-memory HTTP rate limits are per process; public multi-instance use needs shared limiting and provider-side quotas. UI needs actual browser/accessibility review. Data volumes are intentionally bounded for an MVP.
