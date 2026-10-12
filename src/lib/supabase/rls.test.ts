import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initialBuilding } from "../building";
import { simulationFixture } from "../../../tests/fixtures";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const db = new PGlite();
let buildingId: string;
let simulationId: string;
async function asUser(id: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
const MIGRATIONS_DIR = resolve(__dirname, "../../../supabase/migrations");
async function loadMigration(name: string) {
  return readFile(resolve(MIGRATIONS_DIR, name), "utf8");
}
beforeAll(async () => {
  // Minimal Supabase auth schema emulation; real PostgreSQL RLS, not mocked policies.
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
  await db.query("insert into auth.users(id) values ($1), ($2)", [alice, bob]);
  await db.exec(await loadMigration("202610100001_building_drafts.sql"));
  await db.exec(await loadMigration("202610100002_solar_simulations.sql"));
  await db.exec(await loadMigration("202610120002_solar_snapshot_version2.sql"));
}, 30000);
afterAll(async () => { await db.close(); });

describe("owner-only PostgreSQL policies and atomic draft saves", () => {
  it("creates an owner-scoped parent and draft atomically", async () => {
    await asUser(alice);
    const result = await db.query<{ id: string; version: number }>("select * from public.save_building(null, null, $1::jsonb)", [JSON.stringify(initialBuilding)]);
    buildingId = result.rows[0].id;
    expect(result.rows[0].version).toBe(1);
    const rows = await db.query<{ owner_id: string }>("select owner_id from public.buildings");
    expect(rows.rows).toEqual([{ owner_id: alice }]);
    expect((await db.query("select * from public.building_drafts")).rows).toHaveLength(1);
  });
  it("prevents another customer from reading, updating, deleting or attaching a draft", async () => {
    await asUser(bob);
    expect((await db.query("select * from public.buildings")).rows).toHaveLength(0);
    expect((await db.query("select * from public.building_drafts")).rows).toHaveLength(0);
    expect((await db.query("delete from public.buildings where id = $1 returning id", [buildingId])).rows).toHaveLength(0);
    await expect(db.query("select * from public.save_building($1, 1, $2::jsonb)", [buildingId, JSON.stringify(initialBuilding)])).rejects.toThrow(/unavailable/);
    await expect(db.query("insert into public.buildings(owner_id, name) values ($1, 'spoofed')", [alice])).rejects.toThrow(/row-level security/);
    await expect(db.query("insert into public.building_drafts(building_id,draft) values ($1, '{}'::jsonb)", [buildingId])).rejects.toThrow();
  });
  it("updates the owner's draft and rejects stale writes without losing data", async () => {
    await asUser(alice);
    const draft = { ...initialBuilding, name: "Updated building" };
    const result = await db.query<{ version: number }>("select * from public.save_building($1, 1, $2::jsonb)", [buildingId, JSON.stringify(draft)]);
    expect(result.rows[0].version).toBe(2);
    await expect(db.query("select * from public.save_building($1, 1, $2::jsonb)", [buildingId, JSON.stringify(initialBuilding)])).rejects.toThrow(/Version conflict/);
    expect((await db.query<{ name: string }>("select name from public.buildings")).rows[0].name).toBe(draft.name);
    await expect(db.query("update public.buildings set owner_id = $1 where id = $2", [bob, buildingId])).rejects.toThrow(/row-level security/);
  });
  it("denies anonymous access even with a forged user setting", async () => {
    await db.exec("reset role; set role anon;");
    await expect(db.query("select * from public.buildings")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.save_building(null, null, $1::jsonb)", [JSON.stringify(initialBuilding)])).rejects.toThrow(/permission denied/);
  });
  it("saves multiple immutable solar scenarios with inputs and results atomically", async () => {
    await asUser(alice);
    for (const name of ["Alternative A", "Alternative B"]) {
      const saved = await db.query<{ id: string }>("select public.save_solar_simulation($1, 2, $2::jsonb) as id", [buildingId, JSON.stringify({ ...simulationFixture, name })]);
      simulationId = saved.rows[0].id;
    }
    expect((await db.query("select * from public.simulations")).rows).toHaveLength(2);
    expect((await db.query("select * from public.simulation_inputs")).rows).toHaveLength(2);
    expect((await db.query("select * from public.simulation_results")).rows).toHaveLength(2);
    await expect(db.query("update public.simulation_results set data = '{}'::jsonb where simulation_id = $1", [simulationId])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.simulations set review_status = 'approved'")).rejects.toThrow(/permission denied/);
  });
  it("rejects stale scenario saves and rolls back invalid engine versions", async () => {
    await asUser(alice);
    await expect(db.query("select public.save_solar_simulation($1, 1, $2::jsonb)", [buildingId, JSON.stringify(simulationFixture)])).rejects.toThrow(/Version conflict/);
    await expect(db.query("select public.save_solar_simulation($1, 2, $2::jsonb)", [buildingId, JSON.stringify({ ...simulationFixture, result: { ...simulationFixture.result, engineVersion: "unknown" } })])).rejects.toThrow();
    expect((await db.query("select * from public.simulations")).rows).toHaveLength(2);
  });
  it("denies cross-owner simulation reads, inserts and deletes", async () => {
    await asUser(bob);
    for (const table of ["simulations", "simulation_inputs", "simulation_results"]) expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(0);
    await expect(db.query("select public.save_solar_simulation($1, 2, $2::jsonb)", [buildingId, JSON.stringify(simulationFixture)])).rejects.toThrow(/unavailable/);
    expect((await db.query("delete from public.simulations where id = $1 returning id", [simulationId])).rows).toHaveLength(0);
    await expect(db.query("insert into public.simulation_results values ($1, '{}'::jsonb)", [simulationId])).rejects.toThrow();
    await db.exec("reset role; set role anon;");
    await expect(db.query("select * from public.simulations")).rejects.toThrow(/permission denied/);
  });
  it("allows the owner to delete, cascading their draft and simulation snapshots", async () => {
    await asUser(alice);
    await db.query("delete from public.buildings where id = $1", [buildingId]);
    expect((await db.query("select * from public.building_drafts")).rows).toHaveLength(0);
    for (const table of ["simulations", "simulation_inputs", "simulation_results"]) expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(0);
  });
});
