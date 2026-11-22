# Verification record

Executed on 23 November 2026 with Node 22.14.0 and TypeScript 5.8.3.

| Check | Observed result |
| --- | --- |
| `node --experimental-strip-types --test tests/*.test.ts` | 31 passed, 0 failed; raw output in test-results.tap |
| Static Pages controller journey | Passed separately with SCOPESHIFT_TEST_STATIC=1: zero private API calls, repository-prefixed links, compare/approve/apply journey |
| `npm run build:pages` | Passed for /scopeshift; route index files and private-file exclusion checked by test |
| `tsc --noEmit` | Passed for browser, demo adapter and domain modules |
| `node scripts/check.mjs` | Passed source syntax, JSON, whitespace and unsafe-evaluation checks |
| `node scripts/build.mjs` | Passed; emits ordinary JS browser modules and Node server into dist |
| Production handler smoke | /demo, /app.js, /styles.css and /domain/engine.js each returned 200 in direct handler checks |
| Full server/test semantic type check | Attempted, failed because Node type declarations are missing; registry DNS blocked installation |
| PostgreSQL migrations and tests/database.sql | Not executed: no configured Supabase project, database credentials, psql or Docker |
| Real Auth and membership integration | Not executed: external configuration is absent |
| Browser desktop/mobile QA | Not executed: in-app browser could not initialize kernel assets; native fallback required an unavailable CODEX_CLI_PATH |
| Loopback HTTP network client | Blocked by executor socket permissions; direct handler tests were used instead |
| Screenshots | None captured; no fabricated screenshots supplied |

Test coverage includes sequential and parallel tasks, shared-resource contention, non-working days, cycles, zero capacity, missing estimates, scope additions/removals, dangling dependencies, infeasible dates, integer cost rounding, explicit resource availability, stale approval revisions, immutable history, duplicate application, role restrictions and client cost projection. Demo tests cover storage/reset and stale tabs. A controller-level integration harness invokes real UI event handlers and completes compare, estimate persistence, submit, approve and apply. It does not simulate native browser layout, keyboard behavior or browser validation.

The database script supplies cross-tenant, pending-invite, client-rate-exclusion, concurrency, canonical-calculation and atomic-application assertions. They are source artifacts awaiting execution, not passing security evidence. Local TypeScript role/projection tests do not prove database RLS behavior.

The focused local lint/format checker is intentionally small; it is not ESLint or Prettier and does not claim their coverage. Native Node type erasure is a build mechanism, not semantic type checking. To complete the latter once network access exists, install `typescript@5.8.3` and `@types/node@22` as development dependencies, update the lockfile, and run `npm run typecheck:full`.

Deployment readiness: local MVP implementation and build prepared. Persistent-mode verification, full semantic checking and real browser review are still release gates. Nothing has been published publicly.

GitHub publication was subsequently authorized for a new public ScopeShift repository. The local Pages workflow and Render configuration are prepared. GitHub appeared installed, but repository tools were not exposed to this session; direct GitHub DNS requests and local credential enumeration were blocked. No remote push, repository creation or deployment is claimed.
