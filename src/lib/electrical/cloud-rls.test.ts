import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initialElectricalBuilding } from "./model";
import { newComplianceContext } from "../engineering/compliance/context";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const db = new PGlite();
let designId: string;
async function asUser(id: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
const MIGRATIONS_DIR = resolve(__dirname, "../../../supabase/migrations");
const draft = () => JSON.stringify({ ...initialElectricalBuilding, compliance: { ...newComplianceContext(), category: "residential", jurisdiction: "PT", reviewNotes: "Private review notes" } });

beforeAll(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  await db.query("insert into auth.users(id) values ($1), ($2)", [alice, bob]);
  await db.exec(await readFile(resolve(MIGRATIONS_DIR, "202610100005_electrical_designs.sql"), "utf8"));
}, 30000);
afterAll(async () => { await db.close(); });

describe("electrical design owner-only policies", () => {
  it("creates an owner-scoped design and draft atomically", async () => {
    await asUser(alice);
    const result = await db.query<{ id: string; version: number }>("select * from public.save_electrical_design(null, null, $1::jsonb)", [draft()]);
    designId = result.rows[0].id;
    expect(result.rows[0].version).toBe(1);
    expect((await db.query<{ owner_id: string }>("select owner_id from public.electrical_designs")).rows).toEqual([{ owner_id: alice }]);
    expect((await db.query("select * from public.electrical_drafts")).rows).toHaveLength(1);
    expect((await db.query<{ notes: string }>("select draft->'compliance'->>'reviewNotes' as notes from public.electrical_drafts")).rows[0].notes).toBe("Private review notes");
  });

  it("prevents another customer from reading, updating, deleting or attaching a draft", async () => {
    await asUser(bob);
    expect((await db.query("select * from public.electrical_designs")).rows).toHaveLength(0);
    expect((await db.query("select * from public.electrical_drafts")).rows).toHaveLength(0);
    expect((await db.query("delete from public.electrical_designs where id = $1 returning id", [designId])).rows).toHaveLength(0);
    await expect(db.query("select * from public.save_electrical_design($1, 1, $2::jsonb)", [designId, draft()])).rejects.toThrow(/unavailable/);
    await expect(db.query("insert into public.electrical_designs(owner_id, name) values ($1, 'spoofed')", [alice])).rejects.toThrow(/row-level security/);
    await expect(db.query("insert into public.electrical_drafts(design_id, draft) values ($1, '{}'::jsonb)", [designId])).rejects.toThrow();
  });

  it("updates the owner's draft and rejects stale writes without losing data", async () => {
    await asUser(alice);
    const updated = { ...initialElectricalBuilding, name: "Updated design" };
    const result = await db.query<{ version: number }>("select * from public.save_electrical_design($1, 1, $2::jsonb)", [designId, JSON.stringify(updated)]);
    expect(result.rows[0].version).toBe(2);
    await expect(db.query("select * from public.save_electrical_design($1, 1, $2::jsonb)", [designId, draft()])).rejects.toThrow(/Version conflict/);
    expect((await db.query<{ name: string }>("select name from public.electrical_designs")).rows[0].name).toBe("Updated design");
  });

  it("rejects invalid drafts before writing", async () => {
    await asUser(alice);
    await expect(db.query("select * from public.save_electrical_design(null, null, $1::jsonb)", [JSON.stringify({ ...initialElectricalBuilding, version: 2 })])).rejects.toThrow(/Invalid draft/);
    await expect(db.query("select * from public.save_electrical_design(null, null, $1::jsonb)", [JSON.stringify({ ...initialElectricalBuilding, name: "  " })])).rejects.toThrow(/Invalid draft/);
  });

  it("denies anonymous access", async () => {
    await db.exec("reset role; set role anon;");
    await expect(db.query("select * from public.electrical_designs")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.save_electrical_design(null, null, $1::jsonb)", [draft()])).rejects.toThrow(/permission denied/);
  });

  it("cascades the draft when the owner deletes their design", async () => {
    await asUser(alice);
    await db.query("delete from public.electrical_designs where id = $1", [designId]);
    expect((await db.query("select * from public.electrical_drafts")).rows).toHaveLength(0);
  });
});
