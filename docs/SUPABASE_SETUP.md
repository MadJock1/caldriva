# Supabase customer persistence

## Configuration

Create a Supabase project in your chosen EU region. Apply `supabase/migrations/202610100001_building_drafts.sql`, `supabase/migrations/202610100002_solar_simulations.sql`, `supabase/migrations/202610100003_quotation_workflow.sql`, `supabase/migrations/202610100004_building_files.sql` and `supabase/migrations/202610100005_electrical_designs.sql` through a reviewed SQL migration or Supabase CLI (in order). They create the building-draft, solar-simulation, quotation/role, private file storage and electrical-design boundaries; they do not create admin roles automatically or the future project workflow.

After applying the migrations, provision the Storage bucket and object policies with `supabase/storage/building_files.sql` in the SQL editor or Supabase CLI. The bucket is private; only the owner's signed URLs reach the bytes.

Create `.env.local` yourself with:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
SITE_URL=http://localhost:3000
```

Only the new `sb_publishable_` key format is accepted. Do not put secret or service-role keys in public variables. No environment file is created or overwritten by this implementation.

In Supabase Auth, enable email/password authentication and email confirmation. Set Site URL to your origin and allow `http://localhost:3000/auth/callback` for development and `https://YOUR_DOMAIN/auth/callback` for production. Supply SMTP settings for production delivery. The confirmation link must redirect to the callback with a PKCE `code`; confirmation must be opened in the same browser that initiated registration. Restart/rebuild the app after configuration.

## Data and authorization

- `buildings` stores identity, owner, display name, timestamps and optimistic version.
- `building_drafts` stores the versioned editable input snapshot. Simulation output is not stored and is not marked reviewed.
- Both tables enable RLS and deny anonymous access. Only `auth.uid() = owner_id` can operate on the building or its draft.
- The `save_building` function is **security invoker**; atomic parent/draft writes are checked by the caller's RLS. No service-role bypass is used.
- Each server action calls `auth.getUser()` and explicitly scopes owner queries. Auth state from browser input is never trusted.
- Proxy refreshes cookies and marks account/studio responses private, no-store. It is not the sole authorization layer.
- Direct Data API writes remain owner-scoped; snapshot shape is fully validated by the application on save and reopen. DB checks enforce basic name/schema version/object size, not every engineering parameter. Untrusted direct edits may be rejected on reopen.
- Version checks in the save RPC reject stale application writes. The client can reopen or save a new copy.
- Deleting a cloud building cascades its editable draft. Local browser drafts are separate and remain until explicitly deleted.
- `simulations` stores an owner-scoped named snapshot with an optimistic building-version reference; `simulation_inputs` and `simulation_results` hold the immutable input and result payloads (append-only; no update policy). `save_solar_simulation` is security invoker, re-checks the building version and writes inputs/results atomically.
- `simulations` stores an owner-scoped named snapshot with an optimistic building-version reference; `simulation_inputs` and `simulation_results` hold the immutable input and result payloads (append-only; no update policy). `save_solar_simulation` is security invoker, re-checks the building version and writes inputs/results atomically.
- Results are not editable and are not marked reviewed. Deleting a building cascades its simulations and their input/result rows.
- `building_files` stores owner-scoped file metadata (name, MIME, size, SHA-256, storage path) with a 10 MB per-file limit and an allow-list of PDF, image, CAD (DWG/DXF), CSV and Excel types. The `register_building_file` RPC is security definer; it fixes the storage path to `<owner_id>/<building_id>/<file_id>` and rejects invalid names, types, sizes or checksums. The actual bytes live in the private Supabase Storage bucket `building-files`; bucket and `storage.objects` policies are applied separately via `supabase/storage/building_files.sql` (not included in migrations and not PGlite-testable). Server actions create signed download URLs (~5 min) and delete both the bucket object and the metadata row. Uploads are multipart FormData; `next.config.ts` raises `serverActions.bodySizeLimit` to 12 MB for overhead.
- `profiles` holds each account's role (`customer`, `engineer`, `admin`). Customers get a default profile on first contact; only an administrator can change roles, and administrators cannot change their own role. The first administrator is seeded with `select public.bootstrap_admin('AUTH-USER-UUID', 'Full Name');` run in the SQL editor as the project owner — never expose this to clients.
- `quotation_requests` are owned by the customer; `quotations` and `quotation_items` are immutable versions created by the assigned staff member. Clients have SELECT only; submitting, claiming, assigning, composing, sending, accepting, declining, withdrawing, rejecting and completing all run through security-definer functions that re-check the caller's id, role and the current request state.

## Roles

Assign staff after they register a normal account: promote the first administrator in the SQL editor with `bootstrap_admin`, then that administrator can promote others with `select public.set_user_role('AUTH-USER-UUID', 'engineer');` (admins may also run this from an authenticated SQL session). Non-admins cannot change roles; nobody can self-assign admin. The `engineer` and `admin` roles unlock `/dashboard/engineer`.

## Verification boundaries

`npm test` runs the actual migrations against in-memory PostgreSQL (PGlite), with a minimal Supabase auth schema stub. Tests verify RLS isolation for multiple users, owner spoofing denial, anonymous denial, owner transfer denial, atomic save/version conflicts, cascading deletion, atomic simulation snapshots, immutable results, cross-owner simulation denial and stale/engine-version rejection, plus the quotation workflow: role escalation guards, claim/assign, draft-and-send totals, stale-version rejection, supersede/revision, accept/decline, withdraw, admin reject/complete and anonymous denial, plus private file storage: registration, path derivation, cross-owner denial, stale rejection, owner delete and anonymous denial. They do not replace hosted Supabase integration tests.

Without project credentials or a running local Supabase stack, real registration, SMTP delivery, PKCE exchange, cookie refresh and PostgREST relationship serialization cannot be end-to-end verified. Before deployment, test registration/confirmation/sign-in/sign-out, save and reopen from a second browser, stale update rejection, and cross-user denial against the configured project. Supabase Auth rate limits must be configured; enable provider CAPTCHA before exposing public registration at scale.

Account recovery, account deletion/export workflow, organisation membership, private file storage and engineer qualifications remain subsequent work. The public privacy notice remains a draft and must be updated with the controller, region, retention and support contact before public launch.
