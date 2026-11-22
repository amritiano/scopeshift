# ScopeShift

Understand the delivery consequences of a scope change before committing to it.

A TypeScript change-control workspace for agency delivery leads: immutable scope baselines, dependency-aware scheduling, three trade-off scenarios, exact-revision approval and a traceable decision history. No paid API or LLM dependency. All sample records are synthetic.

## Run locally

Requires Node.js 22.14 or newer. No npm install is needed for the runtime.

```powershell
cd scopeshift
npm run dev
```

Open http://localhost:3000/demo for the isolated, browser-persisted demo, or http://localhost:3000 for the landing page. Use Reset demo to start again. Source lives in src/; the server compiles browser modules through Node's native TypeScript type erasure.

```powershell
npm test
npm run format:check
npm run lint
npm run typecheck
npm run build
npm start
```

Stop the development server before starting the production build on the same port. Type checking requires an available TypeScript compiler (`tsc`, tested with 5.8.3). The default typecheck covers domain, demo and browser code. Full server/test checking additionally requires Node type definitions; when package access is restored, install development tools with `npm install --save-dev typescript@5.8.3 @types/node@22`, commit the updated lockfile and run `npm run typecheck:full`. Native type erasure and build alone do not perform semantic type checking.

## Persistent authenticated mode

GitHub Pages deployment preparation is in [docs/github-deployment.md](docs/github-deployment.md). `npm run build:pages` emits only the isolated browser demo; the full authenticated app uses the separate Node server and Supabase.

1. Create a Supabase project within the plan you choose. Nothing here provisions or pays for one.
2. Apply all four supabase/migrations/*.sql files in numerical order to a clean database. Prefer `supabase db push` with a locally installed CLI, or execute the files in order in the SQL editor. The four migrations form one release and must all be installed before using the app.
3. Copy .env.example to .env. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and APP_ORIGIN. Never supply a service-role or secret key. Restart the server.
4. Configure Auth Site URL to your origin and allow the confirmation destination. Create/confirm an account before signing in at /login. A restricted/default email sender may prevent arbitrary recipients from confirming; see docs/deployment.md. No signup is represented as complete without confirmation or a returned session.
5. Create a workspace, create a project with an editable starter plan, then validate and approve its baseline. Use settings to create an expiring invitation link, which you can send manually.
6. For reproducible synthetic data, provide SEED_EMAIL and SEED_PASSWORD for a confirmed account in the current shell, then `npm run seed`. It creates a separate synthetic workspace through the application API; it does not mutate existing projects.

The selected workspace is the signed-in user's oldest membership. Multiple projects within it are supported. Switching between multiple workspaces needs a later UI enhancement.

## Structure

- src/domain/: types, engine, revision rules and synthetic fixtures.
- src/demo.ts: isolated browser persistence.
- src/app.ts, styles.css: responsive interface and accessible native controls.
- src/server.ts: static serving, same-origin API, Supabase Auth/session handling.
- supabase/migrations/: normalized schema, RLS, atomic workflow and SQL forecast calculation.
- tests/: executable local behavior tests and a separate database integration script.
- docs/: architecture, security, deployment, walkthrough and case study.

## Screenshots and verification

Real screenshots are intentionally absent because both available browser tools failed to initialize. The landing page uses an explicitly illustrative HTML product preview, not a fabricated screenshot. Capture real desktop/mobile screenshots after browser review and replace that preview before a public release.

See docs/verification.md for exact checks, including unexecuted database tests. No production-readiness claim is made.

## Limitations

Forecasts start from project start and do not model completed work or actual spending. One assignee per task, no optimal scheduling, skill matching, external project contention or task splitting. Dependency edges use whole-day boundaries. Client-facing prices are not implemented and are not inferred from internal labor cost. Currency conversion and currencies with non-two-decimal minor units are not supported in the MVP. HTTP abuse limits are process-local. PostgreSQL/Auth integration still needs external setup and verification; local UI has not been visually reviewed in a browser.
