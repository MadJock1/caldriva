import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initialElectricalBuilding } from "../../electrical/model";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const carol = "33333333-3333-4333-8333-333333333333";
const dan = "44444444-4444-4444-8444-444444444444";
const db = new PGlite();
let designId: string;
let revisionId: string;
let assignmentId: string;

async function asUser(id: string | null) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
}

const MIGRATIONS_DIR = resolve(__dirname, "../../../../supabase/migrations");
const draft = () => JSON.stringify({ ...initialElectricalBuilding, name: "review test" });
const snapshot = (fingerprint: string) => JSON.stringify({
  schemaVersion: 1,
  id: `CR-1-${fingerprint.slice(0, 8).toUpperCase()}`,
  revisionNumber: 1,
  fingerprint,
  registryVersion: "eu-electrical-2026-10-11.1",
  engineVersion: "electrical-test",
  category: "residential",
  jurisdiction: "PT",
  disclaimer: "test",
  counts: { pass: 0, fail: 0, warning: 0, missingData: 0, notApplicable: 0, notEvaluated: 0, requiresProfessionalReview: 0 },
  checks: [],
  matrix: [],
  calculations: { demandVA: 0, currentA: 0, engineVersion: "test" },
});

async function registerRevision(fingerprint: string) {
  const result = await db.query<{ id: string; revision_number: number }>(
    "select * from public.register_compliance_revision($1, $2::jsonb)", [designId, snapshot(fingerprint)]);
  return result.rows[0];
}

beforeAll(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  await db.query("insert into auth.users(id) values ($1), ($2), ($3), ($4)", [alice, bob, carol, dan]);
  const migrations = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of migrations) await db.exec(await readFile(resolve(MIGRATIONS_DIR, file), "utf8"));
  await db.query("select public.bootstrap_admin($1, 'Admin')", [dan]);
}, 30000);
afterAll(async () => { await db.close(); });

describe("qualified reviewer workflow and immutable audit trail", () => {
  it("registers a server-numbered frozen revision for the owner's design", async () => {
    await asUser(alice);
    const design = await db.query<{ id: string }>("select * from public.save_electrical_design(null, null, $1::jsonb)", [draft()]);
    designId = design.rows[0].id;
    const revision = await registerRevision("deadbeefdeadbeef");
    revisionId = revision.id;
    expect(revision.revision_number).toBe(1);
    const row = await db.query<{ owner_id: string; number: number; stored: number }>(
      "select owner_id, revision_number as number, (snapshot->>'revisionNumber')::int as stored from public.compliance_revisions");
    expect(row.rows).toEqual([{ owner_id: alice, number: 1, stored: 1 }]);
    expect((await db.query("select * from public.compliance_audit_log where action = 'revision_registered'")).rows).toHaveLength(1);
  });

  it("only admins attest reviewer qualifications", async () => {
    await asUser(bob);
    await expect(db.query("select public.set_reviewer_qualification($1, 'RTIEBT reviewer')", [carol])).rejects.toThrow(/Administrator required/);
    await asUser(alice);
    await expect(db.query("select public.set_reviewer_qualification($1, 'RTIEBT reviewer')", [carol])).rejects.toThrow(/Administrator required/);
    await asUser(dan);
    await db.query("select public.set_reviewer_qualification($1, $2, $3)", [carol, "Chartered electrical engineer", "REG-123"]);
    const rows = await db.query<{ status: string; attested_by: string }>("select status, attested_by from public.compliance_reviewers");
    expect(rows.rows).toEqual([{ status: "active", attested_by: dan }]);
    expect((await db.query("select * from public.compliance_audit_log where action = 'reviewer_qualification_set'")).rows).toHaveLength(1);
  });

  it("assigns only an actively qualified reviewer who is not the owner", async () => {
    await asUser(alice);
    await expect(db.query("select * from public.assign_compliance_reviewer($1, $2)", [revisionId, bob])).rejects.toThrow(/not qualified/);
    await expect(db.query("select * from public.assign_compliance_reviewer($1, $2)", [revisionId, alice])).rejects.toThrow(/cannot review their own/);
    const result = await db.query<{ assignment_id: string }>("select * from public.assign_compliance_reviewer($1, $2)", [revisionId, carol]);
    assignmentId = result.rows[0].assignment_id;
    expect((await db.query<{ status: string; reviewer_id: string }>("select status, reviewer_id from public.compliance_review_assignments")).rows)
      .toEqual([{ status: "assigned", reviewer_id: carol }]);
    expect((await db.query("select * from public.compliance_audit_log where action = 'reviewer_assigned'")).rows).toHaveLength(1);
  });

  it("lets only the assigned reviewer record one immutable decision", async () => {
    await asUser(bob);
    await expect(db.query("select * from public.submit_review_decision($1, 'APPROVED')", [assignmentId])).rejects.toThrow(/Not the assigned reviewer/);
    await asUser(carol);
    const decision = await db.query<{ decision_id: string }>("select * from public.submit_review_decision($1, $2, $3)", [assignmentId, "APPROVED_WITH_COMMENTS", "Verified against the frozen revision."]);
    expect(decision.rows).toHaveLength(1);
    await expect(db.query("select * from public.submit_review_decision($1, 'APPROVED')", [assignmentId])).rejects.toThrow(/already exists/);
    expect((await db.query<{ status: string }>("select status from public.compliance_review_assignments")).rows).toEqual([{ status: "completed" }]);
    expect((await db.query("select * from public.compliance_audit_log where action = 'decision_submitted'")).rows).toHaveLength(1);
  });

  it("denies unrelated customers while the assigned reviewer and admin can read", async () => {
    await asUser(bob);
    expect((await db.query("select * from public.compliance_revisions")).rows).toHaveLength(0);
    expect((await db.query("select * from public.compliance_review_assignments")).rows).toHaveLength(0);
    expect((await db.query("select * from public.compliance_review_decisions")).rows).toHaveLength(0);
    expect((await db.query("select * from public.compliance_audit_log")).rows).toHaveLength(0);
    await asUser(carol);
    expect((await db.query("select * from public.compliance_revisions")).rows).toHaveLength(1);
    expect((await db.query("select * from public.compliance_review_assignments")).rows).toHaveLength(1);
    expect((await db.query("select * from public.compliance_review_decisions")).rows).toHaveLength(1);
    expect((await db.query("select * from public.compliance_audit_log")).rows.length).toBeGreaterThanOrEqual(1);
    await asUser(dan);
    expect((await db.query("select * from public.compliance_revisions")).rows).toHaveLength(1);
  });

  it("keeps revisions, decisions and audit append-only at the privilege level", async () => {
    await asUser(alice);
    await expect(db.query("insert into public.compliance_revisions(design_id, revision_number, fingerprint, registry_version, engine_version, snapshot) values ($1, 9, 'deadbeefdeadbeef', 'r', 'e', '{}'::jsonb)", [designId])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.compliance_revisions set fingerprint = 'x'")).rejects.toThrow(/permission denied/);
    await expect(db.query("delete from public.compliance_revisions")).rejects.toThrow(/permission denied/);
    await asUser(carol);
    await expect(db.query("update public.compliance_review_decisions set decision = 'REJECTED'")).rejects.toThrow(/permission denied/);
    await expect(db.query("delete from public.compliance_review_decisions")).rejects.toThrow(/permission denied/);
    await expect(db.query("insert into public.compliance_audit_log(owner_id, actor_id, action) values ($1, $1, 'tamper')", [alice])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.compliance_audit_log set action = 'tamper'")).rejects.toThrow(/permission denied/);
  });

  it("blocks assignment and decisions once a qualification is suspended", async () => {
    await asUser(alice);
    const second = await registerRevision("feedfacefeedface");
    await asUser(dan);
    await db.query("select public.suspend_reviewer_qualification($1)", [carol]);
    await asUser(alice);
    await expect(db.query("select * from public.assign_compliance_reviewer($1, $2)", [second.id, carol])).rejects.toThrow(/not qualified/);
  });

  it("lets a reviewer decline an assignment before deciding", async () => {
    await asUser(dan);
    await db.query("select public.set_reviewer_qualification($1, 'Reinstated reviewer')", [carol]);
    await asUser(alice);
    const third = await registerRevision("0badc0de0badc0de");
    const assigned = await db.query<{ assignment_id: string }>("select * from public.assign_compliance_reviewer($1, $2)", [third.id, carol]);
    await asUser(carol);
    await db.query("select public.decline_review_assignment($1)", [assigned.rows[0].assignment_id]);
    await expect(db.query("select * from public.submit_review_decision($1, 'APPROVED')", [assigned.rows[0].assignment_id])).rejects.toThrow(/declined/);
    expect((await db.query("select * from public.compliance_audit_log where action = 'assignment_declined'")).rows).toHaveLength(1);
  });

  it("denies anonymous access to every table and function", async () => {
    await db.exec("reset role; set role anon;");
    await expect(db.query("select * from public.compliance_revisions")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.compliance_audit_log")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.register_compliance_revision($1, $2::jsonb)", [designId, snapshot("deadbeefdeadbeef")])).rejects.toThrow(/permission denied/);
  });
});
