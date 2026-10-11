# Live Supabase verification — current session

## Observed

- No `.env*` files exist in the project root.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SITE_URL` and two-user test credentials are not set in the process environment. Only presence was checked; no values were printed.
- Docker CLI exists, but the Docker Desktop Linux daemon is unavailable.
- Callback implementation uses a fixed `/dashboard/buildings` redirect after server-side PKCE exchange, not a user-provided redirect. Failure returns 400, with no-store caching.

## NOT live-verified

Registration, email delivery, confirmation callback success, deployed redirect allowlist, token refresh, deployed migration status, hosted CRUD, owner isolation and stale updates. There is no configured project against which to run these checks. No migration was applied remotely.

The quotation workflow and staff roles (migration `202610100003`) are likewise only tested in PGlite. Hosted role assignment, the request/claim/compose/send/respond flow, engineer visibility and RLS over PostgREST are not live-verified.

Private file storage (migration `202610100004` + `supabase/storage/building_files.sql`) is implemented and PGlite-tested but not live-verified. Hosted bucket creation, object policy application, signed URL generation, multipart upload and metadata rollback are not validated against a real project.

The Auto Electrical Design Studio cloud persistence (migration `202610100005`) is implemented and PGlite-tested (owner isolation, cross-owner and anonymous denial, stale-version rejection, invalid-draft rejection and cascade delete) but not live-verified. Hosted electrical-design CRUD and RLS over PostgREST are not validated against a real project. The local studio works entirely without Supabase.

## Manual configuration needed

1. Follow `SUPABASE_SETUP.md` to configure the project URL, publishable key and site URL locally (never send secrets in chat).
2. Apply migrations `202610100001_building_drafts.sql`, `202610100002_solar_simulations.sql`, `202610100003_quotation_workflow.sql`, `202610100004_building_files.sql` and `202610100005_electrical_designs.sql` to the intended project, using your normal migration workflow.
3. Provision the Storage bucket and object policies with `supabase/storage/building_files.sql` in the SQL editor or CLI.
4. Configure Auth site URL, callback allowlist, email/password signup, email confirmation and SMTP. Seed the first administrator with `select public.bootstrap_admin('AUTH-USER-UUID', 'Full Name');` in the SQL editor.
5. Register a test account in the browser, open its email confirmation in that same browser, confirm arrival at `/dashboard/buildings`, then sign out and sign in. Repeat with a second account.
6. Set `SUPABASE_TEST_USER_A_EMAIL`, `SUPABASE_TEST_USER_A_PASSWORD`, `SUPABASE_TEST_USER_B_EMAIL`, `SUPABASE_TEST_USER_B_PASSWORD` privately in the local environment and run `npm run verify:supabase`.

The live verification command logs only fixed check names and status. It uses existing confirmed test accounts, creates one uniquely named test building, tests ownership and stale updates, and deletes that record. It does not create users, alter existing buildings, apply migrations or prove email delivery/PKCE redirects. Failed cleanup is explicitly reported.

Local PGlite RLS tests and browser tests are tracked separately from live verification. PGlite executes the SQL policies but stubs Supabase's auth schema; browser tests use explicit solar fixtures for deterministic results. Private file storage PGlite tests cover registration, path derivation, cross-owner denial, owner delete and anonymous denial; the Storage bucket and object policies are not PGlite-testable.
