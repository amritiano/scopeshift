# Security model

All private requests verify a Supabase user; a browser role label is never authorization. Anonymous demo operations stay in a separate local-storage namespace. No anonymous database mutations are granted.

Workspace owners administer workspace projects. Other users need project_access and a workspace membership. Clients have only explicit shares. Every read RPC checks ss_role; direct table access uses RLS and internal-only grants. Raw snapshots contain rates, so clients cannot SELECT them; ss_get_project returns a recursively redacted DTO without rates, budget, estimated cost or headroom. There is no client price field masquerading as internal cost.

Mutation functions use a locked project row and expected version. They implement the state machine independently of p_next, which is never trusted. Exact proposal revision and baseline revision are required for a decision. Resubmission withdraws pending approvals. Decisions and baseline details are immutable. An applied proposal has a unique filtered index per change. Insertion of a new baseline, proposal status, notifications, audit event and version update happen in one Postgres transaction; failures roll back together. Applying one change withdraws other pending/approved proposals against the old baseline.

Scenario results are recalculated by a database trigger. Assumptions and input plans remain historical snapshots. The SQL calculation must pass parity tests against the TypeScript calculation before a release. Structural validation rejects cycles, absent dependencies, invalid estimates and missing/zero-capacity assignees.

Auth passwords are passed over the same-origin API to managed Supabase Auth. Tokens are HTTP-only, SameSite=Strict cookies, Secure on HTTPS. Server verifies identity on each request and can refresh sessions. Logout revokes the Auth session and clears cookies. Do not log bodies, auth headers, cookies, invite links or private records. Current logs contain event categories only. Set APP_ORIGIN correctly; mutations enforce Origin plus JSON content type.

Invitation secrets use 32 random bytes; only SHA-256 hashes are persisted. Acceptance locks the invite, checks signed-in email, expiry and prior use, then grants access atomically. Pending invites grant no access. The app keeps the secret in a URL fragment and short-lived sessionStorage during the acceptance flow. Invite data is not in event logs.

HTML text and attributes are escaped before templating. No user markdown/HTML rendering or eval is supported. CSP restricts resources to self, blocks frames and external connections in the browser; inline style attributes are used for generated timeline positioning. Static serving uses an explicit asset whitelist and cannot serve .env or server source.

MVP limits include request size, resource/task counts, scheduling horizon, workspace/project/invitation caps and per-IP process-local mutation limits. This is not distributed abuse protection. Do not trust arbitrary forwarding headers. Deploy behind a correctly configured proxy and add shared limits/provider quotas before public multi-instance use.

Outstanding security validation: execute tests/database.sql, exercise real Auth session refresh/logout, verify raw Data API attempts as separate tenants and client, review provider settings, test invitation reuse/expiry and obtain a review before real client data. SQL integration and browser security behavior are not claimed to have passed here.
