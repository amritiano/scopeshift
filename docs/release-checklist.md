# Release gates

- [x] Domain model, pure deterministic engine, synthetic seed data.
- [x] Working local demo controller and browser persistence adapter.
- [x] Immutable revisions, exact approval and concurrency rules in code.
- [x] Native HTTP backend, Auth proxy, schema, RLS and transactional SQL supplied.
- [x] Focused tests and production build executed; see verification.md.
- [ ] Install Node type definitions and pass full server/test semantic type checking.
- [ ] Apply all migrations in a disposable Supabase project.
- [ ] Run tests/database.sql, including cross-workspace denial and client redaction.
- [ ] Compare SQL and TypeScript engine results across representative fixtures.
- [ ] Exercise real signup/confirmation, login, session refresh and logout.
- [ ] Test invite wrong email, expiry, replay and role grant/revocation with separate accounts.
- [ ] Review desktop and mobile in a real browser, keyboard navigation and contrast.
- [ ] Capture genuine screenshots; replace the illustrative landing preview.
- [ ] Test multi-project management and choose whether workspace switching is needed.
- [ ] Configure HTTPS, exact origin, sender restrictions and proxy/rate-limit behavior.
- [ ] Test backup/restore and compatible code rollback.
- [ ] Review privacy, retention and operational requirements for actual clients.
- [ ] Obtain owner's publication authorization; do not provision paid resources silently.

Current status: local portfolio MVP implementation, external integration and visual verification pending. Not production-ready.
