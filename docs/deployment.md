# Deployment preparation

This source is prepared for a long-running Node web service. It has not been deployed. No account or charge was created. Do not publish publicly until the owner authorizes it and the release gates pass.

## Configuration

| Variable | Purpose |
| --- | --- |
| PORT | Provider-supplied port; local default 3000 |
| HOST | Use 127.0.0.1 locally; 0.0.0.0 on a hosted container |
| APP_ORIGIN | Exact scheme/host/port used by visitors; checked on mutations |
| SUPABASE_URL | HTTPS project API origin |
| SUPABASE_PUBLISHABLE_KEY | Publishable/legacy anon key, never privileged |

Build with `npm run build`; start with `npm start`. A host must use Node >=22.14. No local database or ephemeral filesystem stores authenticated records. Environment variables belong in provider configuration, not source. Demo records remain in each browser.

Apply 001_schema.sql, 002_workflow.sql, 003_calculation.sql, 004_members.sql in order before starting a release. They assume a Supabase Auth schema and authenticated/anon roles. They are one-time versioned migrations, not repeatable ad-hoc scripts. On an existing schema, inspect migration status; never re-run blindly. Run tests/database.sql against a disposable migrated project using `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database.sql`. It creates synthetic users and rolls everything back.

## Auth configuration

Use email/password through Supabase Auth. Set Site URL to APP_ORIGIN and allow the same origin as an auth confirmation redirect. Confirmation returns users to the landing page; they then sign in. No token-bearing implicit redirect or browser session SDK is required. Keep email confirmation enabled for hosted use. Supabase's default sender is restricted; verify current recipient and rate restrictions before testing with others. Use an appropriately configured sender or provider-confirmed test accounts. Password sign-in for confirmed accounts works without sending a new email. Secure project invitations require no email service: owner copies a 48-hour, one-time link, intended email signs in, then explicitly accepts.

Invitation tokens use URL fragments and are temporarily retained in sessionStorage across sign-in. Fragments are not included in HTTP request URLs. The app removes the fragment immediately; no-referrer headers and payload-free logging reduce leakage. Never put these links in public documentation.

## Hosting and free-tier constraints

Official references checked during this build; recheck before provisioning:

- [Render free services](https://render.com/docs/free): suitable for a portfolio preview, not production service. Free web services sleep after 15 minutes idle and share 750 workspace instance hours per month. Bandwidth/build limits and payment-method behavior matter; inspect account limits and spend controls. No paid plan is required by this code.
- [Supabase pricing](https://supabase.com/pricing): Free lists two active projects, 500 MB database and 5 GB egress, with inactive projects paused. Free does not include automatic backups. Check current limits before use.
- [Supabase email delivery restrictions](https://supabase.com/docs/guides/auth/auth-smtp): review default sender constraints before inviting external testers.
- [Node TypeScript](https://nodejs.org/api/typescript.html): native type stripping is not a type checker. This build uses strip-only syntax and emits ordinary ES modules.

For a commercial service, assess current hosting terms, reliability, monitoring, sender requirements, shared rate limiting and recovery rather than assuming a personal demo plan is appropriate. This application is a Node server, not a drop-in Next.js/Vercel or Cloudflare Worker artifact.

## Recovery and rollback

Back up the database before migrations using the provider's supported dump tooling; encrypt backups and restrict access. Include application tables and access metadata, and follow provider guidance separately for managed Auth recovery. Test restoration into a disposable project. Document the restore point and verify memberships and client redaction after restoring.

Retain the prior source artifact and configuration. A code rollback can redeploy the prior compatible artifact without deleting immutable history. Database rollback should use a reviewed forward repair migration or a tested backup restore; never drop revision/audit tables as a shortcut. No destructive down-migrations are supplied.
