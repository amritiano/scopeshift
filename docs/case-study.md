# ScopeShift: making scope decisions reviewable

## Problem and user

A delivery lead receives an apparently small change during a fixed-scope implementation. Saying yes without considering dependencies, constrained specialists and acceptance work creates an ambiguous delivery commitment. ScopeShift makes that decision explicit and preserves its evidence.

## Design choices

The main screen emphasizes the approved scope, forecast, pending request and next decision. Impact analysis asks a lead to compare timeline extension, explicit deferral and specified capacity. Infeasible outcomes remain visible; the product does not invent an AI score or pick a winner. Client approval is a separate step from internal baseline application.

Native controls, readable tables, an indigo/neutral visual system and responsive navigation support daily professional use. The UI includes empty, validation, setup-blocked and recoverable-error states. This design has not yet been visually or accessibly audited in a real browser.

## Engineering decisions and trade-offs

A shared typed engine drives both the local demo and authenticated server validation. Resource-day scheduling respects dependencies rather than dividing extra hours by total team capacity. Immutable revision snapshots and exact decisions prevent an older approval from authorizing a changed proposal.

Package registry access was unavailable, so a dependency-free Node/TypeScript implementation replaced the preferred Next.js starting point. This made implementation and focused runtime verification possible without downloads. It trades framework conventions and mature UI tooling for an intentionally small, explicit codebase. The pure domain is portable if a framework is introduced later.

Postgres transactions and RLS repeat the security boundary even when callers bypass the HTTP API. SQL canonical calculation protects stored forecasts against forged totals, at the cost of a second implementation requiring integration parity testing.

## Validation and honest limits

Local tests exercise scheduling edge cases, immutable history, stale revisions, duplicate application, role restrictions, redaction, isolated demo storage and HTTP handlers. Check verification.md for the final executed totals. Database tests are supplied but have not been run because no Supabase project/credentials or PostgreSQL executable is present. Browser tools failed to initialize; there are no verified screenshots or measured UX results.

There were no user interviews and no real customer deployment. The synthetic example demonstrates a baseline forecast of 10 December and a Hindi change forecast of 16 December. These are deterministic fixture results, not business outcomes. Future evaluation should measure whether users understand the trade-offs, complete approval reliably and reduce unapproved scope work.
