// Explicit live check. Uses two existing, confirmed test accounts and deletes only its own test building.
// No credentials, user emails, tokens or upstream error bodies are logged.
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
nextEnv.loadEnvConfig(process.cwd());
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SITE_URL", "SUPABASE_TEST_USER_A_EMAIL", "SUPABASE_TEST_USER_A_PASSWORD", "SUPABASE_TEST_USER_B_EMAIL", "SUPABASE_TEST_USER_B_PASSWORD"];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.log(`BLOCKED: required variable names not set: ${missing.join(", ")}. No live verification performed.`);
  process.exitCode = 2;
} else {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  const b = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  const anonymous = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
  let buildingId;
  function check(ok, message) { if (!ok) throw new Error(message); console.log(`PASS: ${message}`); }
  try {
    const loginA = await a.auth.signInWithPassword({ email: process.env.SUPABASE_TEST_USER_A_EMAIL, password: process.env.SUPABASE_TEST_USER_A_PASSWORD });
    const loginB = await b.auth.signInWithPassword({ email: process.env.SUPABASE_TEST_USER_B_EMAIL, password: process.env.SUPABASE_TEST_USER_B_PASSWORD });
    check(!loginA.error && !loginB.error && !!loginA.data.user && !!loginB.data.user, "Two existing test accounts authenticated");
    check(loginA.data.user.id !== loginB.data.user.id, "Test users are distinct");
    const draft = { version: 1, name: `Verification ${randomUUID()}`, address: "Automated test record - not a real property", roof: [], solar: { latitude: 38.7223, longitude: -9.1393, tilt: 30, azimuth: 180, panels: 10, panelWatts: 430, losses: 14, mounting: "free" }, finance: { consumption: 4000, selfConsumption: 40, importTariff: .25, exportTariff: .06, capex: 6500, annualOpex: 100 }, provenance: "user-supplied; polygon-area algorithmically-estimated" };
    const created = await a.rpc("save_building", { p_id: null, p_expected_version: null, p_draft: draft });
    check(!created.error && created.data?.length === 1, "Building migration RPC exists and creates a draft");
    buildingId = created.data[0].id;
    const read = await a.from("buildings").select("id,version,building_drafts(draft)").eq("id", buildingId).single();
    check(!read.error && read.data.building_drafts?.draft?.name === draft.name, "Owner can read the parent/draft relationship");
    const otherRead = await b.from("buildings").select("id").eq("id", buildingId);
    check(!otherRead.error && otherRead.data.length === 0, "Another owner cannot read the building");
    const otherDraft = await b.from("building_drafts").select("building_id").eq("building_id", buildingId);
    check(!otherDraft.error && otherDraft.data.length === 0, "Another owner cannot read the draft");
    const otherWrite = await b.rpc("save_building", { p_id: buildingId, p_expected_version: 1, p_draft: draft });
    check(!!otherWrite.error, "Another owner cannot update the building");
    const otherDelete = await b.from("buildings").delete().eq("id", buildingId).select("id");
    check(!otherDelete.error && otherDelete.data.length === 0, "Another owner cannot delete the building");
    const anonRead = await anonymous.from("buildings").select("id").eq("id", buildingId);
    check(!!anonRead.error || anonRead.data?.length === 0, "Anonymous access does not expose the building");
    const updated = await a.rpc("save_building", { p_id: buildingId, p_expected_version: 1, p_draft: { ...draft, name: `${draft.name} updated` } });
    check(!updated.error && updated.data?.[0]?.version === 2, "Owner update increments the version");
    const stale = await a.rpc("save_building", { p_id: buildingId, p_expected_version: 1, p_draft: draft });
    check(stale.error?.code === "40001", "Stale updates are rejected");
    const removed = await a.from("buildings").delete().eq("id", buildingId).select("id");
    check(!removed.error && removed.data.length === 1, "Owner delete succeeds");
    const absent = await a.from("building_drafts").select("building_id").eq("building_id", buildingId);
    check(!absent.error && absent.data.length === 0, "Draft cascade deletion succeeds");
    buildingId = undefined;
    console.log("VERIFIED: live building CRUD, owner isolation and stale-update rejection. NOT VERIFIED: new registration, email delivery, browser PKCE callback or deployed redirect configuration. Verify those manually in the same browser.");
  } catch (error) {
    // Only allow our fixed assertion messages through; SDK/network exceptions may contain sensitive URLs.
    console.log("FAILED: live verification did not complete. Review configuration and the last successful check. No upstream details or credentials printed.");
    void error;
    process.exitCode = 1;
  } finally {
    if (buildingId) {
      const cleanup = await a.from("buildings").delete().eq("id", buildingId);
      console.log(cleanup.error ? "MANUAL ACTION: cleanup failed; remove the test building named Verification in the test account." : "Cleanup: temporary building removed.");
    }
    await Promise.all([a.auth.signOut({ scope: "local" }), b.auth.signOut({ scope: "local" })]);
  }
}
