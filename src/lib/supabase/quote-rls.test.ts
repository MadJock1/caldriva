import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const carol = "33333333-3333-4333-8333-333333333333";
const dave = "44444444-4444-4444-8444-444444444444";
const db = new PGlite();
let requestA: string, requestB: string, requestC: string, quoteSentId: string;

async function asUser(id: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function fails(db: PGlite, sql: string, params: unknown[] = [], pattern = /denied/i) {
  await expect(db.query(sql, params)).rejects.toThrow(pattern);
}
const MIGRATIONS_DIR = resolve(__dirname, "../../../supabase/migrations");
async function loadMigration(name: string) {
  return readFile(resolve(MIGRATIONS_DIR, name), "utf8");
}
beforeAll(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  await db.query("insert into auth.users(id) values ($1), ($2), ($3), ($4)", [alice, bob, carol, dave]);
  await db.exec(await loadMigration("202610100001_building_drafts.sql"));
  await db.exec(await loadMigration("202610100003_quotation_workflow.sql"));
  // Bootstrap an admin as the database owner, then promote an engineer.
  await db.exec("reset role;");
  const boot = await db.query<{ out_role: string }>("select * from public.bootstrap_admin($1, 'Carol Admin')", [carol]);
  expect(boot.rows[0].out_role).toBe("admin");
  await asUser(carol);
  const promoted = await db.query<{ out_role: string }>("select * from public.set_user_role($1, 'engineer')", [dave]);
  expect(promoted.rows[0].out_role).toBe("engineer");
}, 30000);
afterAll(async () => { await db.close(); });

describe("role registry", () => {
  it("denies self-admin changes and non-admin role changes", async () => {
    await asUser(carol);
    await fails(db, "select public.set_user_role($1, 'customer')", [carol], /own role/);
    await asUser(bob);
    await fails(db, "select public.set_user_role($1, 'admin')", [alice], /Administrator/);
    await asUser(alice);
    await fails(db, "select public.set_user_role($1, 'engineer')", [bob], /Administrator/);
  });
  it("lets customers read only their own profile and denies raw role updates", async () => {
    await asUser(alice);
    await db.query("select public.ensure_profile()");
    await fails(db, "update public.profiles set role = 'admin' where user_id = $1", [alice], /permission denied/);
    const mine = await db.query<{ role: string }>("select role from public.profiles where user_id = $1", [alice]);
    expect(mine.rows[0].role).toBe("customer");
  });
});

describe("quotation lifecycle", () => {
  it("lets a customer submit only their own requests", async () => {
    await asUser(alice);
    const one = await db.query<{ sid: string }>("select * from public.submit_quotation_request('solar', 'Rooftop PV study', 'Quotation for a PV system on the west roof.', $1)", [null]);
    requestA = one.rows[0].sid;
    const two = await db.query<{ sid: string }>("select * from public.submit_quotation_request('electrical', 'Rewire', 'Quote to rewire the ground floor.' )");
    requestB = two.rows[0].sid;
    const three = await db.query<{ sid: string }>("select * from public.submit_quotation_request('hvac', 'Heat pump', 'Air-source heat pump sizing.')");
    requestC = three.rows[0].sid;
  });
  it("isolates requests by owner and role", async () => {
    await asUser(bob);
    expect((await db.query("select * from public.quotation_requests")).rows).toHaveLength(0);
    await fails(db, "select public.respond_to_quotation($1, true)", [requestA], /Quotation unavailable/);
    await asUser(alice);
    expect((await db.query("select * from public.quotation_requests")).rows).toHaveLength(3);
    await fails(db, "select public.claim_quotation_request($1)", [requestA], /Staff only/);
  });
  it("lets an engineer claim, draft, and send with correct totals", async () => {
    await asUser(dave);
    await db.query("select public.claim_quotation_request($1)", [requestA]);
    const draft = await db.query<{ qversion: number; request_status: string }>("select * from public.save_quotation($1, '[{\"description\":\"5 kWp PV system\",\"quantity\":1,\"unit\":\"lot\",\"unit_price\":8000.00}]'::jsonb, 'EUR', 0.23, 'Preliminary design', '2026-12-31', null, false)", [requestA]);
    expect(draft.rows[0].qversion).toBe(1);
    expect(draft.rows[0].request_status).toBe("assigned");
    const sent = await db.query<{ qid: string; qversion: number; request_status: string }>("select * from public.save_quotation($1, '[{\"description\":\"5 kWp PV system\",\"quantity\":1,\"unit\":\"lot\",\"unit_price\":8000.00}]'::jsonb, 'EUR', 0.23, 'Preliminary design', '2026-12-31', 1, true)", [requestA]);
    expect(sent.rows[0].qversion).toBe(2);
    expect(sent.rows[0].request_status).toBe("quoted");
    quoteSentId = sent.rows[0].qid;
    const quote = await db.query<{ subtotal: string; tax: string; total: string }>("select subtotal, tax, total from public.quotations where id = $1", [quoteSentId]);
    expect(quote.rows).toEqual([{ subtotal: "8000.00", tax: "1840.00", total: "9840.00" }]);
    expect((await db.query<{ status: string }>("select status from public.quotations order by version")).rows.map(r => r.status)).toEqual(["superseded", "sent"]);
    expect((await db.query<{ amount: string }>("select amount from public.quotation_items where quotation_id = $1", [quoteSentId])).rows).toEqual([{ amount: "8000.00" }]);
  });
  it("rejects stale versions, non-engineers and second claims", async () => {
    await asUser(bob);
    await fails(db, "select public.claim_quotation_request($1)", [requestA], /Staff only/);
    await asUser(dave);
    await fails(db, "select public.save_quotation($1, '[{\"description\":\"x\",\"quantity\":1,\"unit\":\"lot\",\"unit_price\":1}]'::jsonb, 'EUR', 0.23, null, null, 1, false)", [requestA], /Version conflict/);
    await fails(db, "select public.claim_quotation_request($1)", [requestA], /already assigned/i);
    await asUser(bob);
    await fails(db, "select public.claim_quotation_request($1)", [requestC], /Staff only/);
  });
  it("lets the customer decline and the engineer revise", async () => {
    await asUser(alice);
    await fails(db, "select public.respond_to_quotation($1, true)", [requestB], /Quotation unavailable/);
    await asUser(bob);
    await fails(db, "select public.respond_to_quotation($1, true)", [quoteSentId], /Not your quotation/);
    await asUser(alice);
    await db.query("select public.respond_to_quotation($1, false)", [quoteSentId]);
    await fails(db, "select public.respond_to_quotation($1, true)", [quoteSentId], /not awaiting/i);
    expect((await db.query<{ status: string }>("select status from public.quotation_requests where id = $1", [requestA])).rows[0].status).toBe("assigned");
    await asUser(dave);
    const revised = await db.query<{ qversion: number; request_status: string }>("select * from public.save_quotation($1, '[{\"description\":\"5 kWp PV system (revised)\",\"quantity\":1,\"unit\":\"lot\",\"unit_price\":7900.00}]'::jsonb, 'EUR', 0.23, null, null, 2, true)", [requestA]);
    expect(revised.rows[0].qversion).toBe(3);
    expect(revised.rows[0].request_status).toBe("quoted");
    const newest = await db.query<{ id: string }>("select id from public.quotations where request_id = $1 and status = 'sent'", [requestA]);
    await asUser(alice);
    await db.query("select public.respond_to_quotation($1, true)", [newest.rows[0].id]);
    expect((await db.query<{ status: string }>("select status from public.quotation_requests where id = $1", [requestA])).rows[0].status).toBe("accepted");
  });
  it("guards staff transitions and rejects/withdraws correctly", async () => {
    await asUser(dave);
    await fails(db, "select public.transition_quotation_request($1, 'completed')", [requestB], /Only accepted/);
    await asUser(alice);
    await db.query("select public.cancel_quotation_request($1)", [requestB]);
    expect((await db.query<{ status: string }>("select status from public.quotation_requests where id = $1", [requestB])).rows[0].status).toBe("withdrawn");
    await asUser(carol);
    await db.query("select public.transition_quotation_request($1, 'rejected')", [requestC]);
    expect((await db.query<{ status: string }>("select status from public.quotation_requests where id = $1", [requestC])).rows[0].status).toBe("rejected");
    await fails(db, "select public.claim_quotation_request($1)", [requestC], /already assigned/i);
    await asUser(carol);
    await db.query("select public.transition_quotation_request($1, 'completed')", [requestA]);
    expect((await db.query<{ status: string }>("select status from public.quotation_requests where id = $1", [requestA])).rows[0].status).toBe("completed");
  });
  it("denies raw mutations and anonymous access while staff can still read", async () => {
    await asUser(dave);
    await fails(db, "delete from public.quotation_requests where id = $1", [requestA], /permission denied/);
    await fails(db, "update public.quotation_requests set status = 'rejected' where id = $1", [requestC], /permission denied/);
    expect((await db.query("select id from public.quotation_requests")).rows.length).toBeGreaterThan(0);
    await db.exec("reset role; set role anon;");
    await fails(db, "select * from public.quotation_requests", [], /permission denied/);
    await fails(db, "select * from public.quotations", [], /permission denied/);
    await db.exec("reset role;");
  });
});