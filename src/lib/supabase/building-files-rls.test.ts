import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initialBuilding } from "../building";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const fileId = "33333333-3333-4333-8333-333333333333";
const otherFileId = "44444444-4444-4444-8444-444444444444";
const sha = "a".repeat(64);
const db = new PGlite();
let buildingId: string;
let storagePath: string;

async function asUser(id: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function fails(sql: string, params: unknown[] = [], pattern = /denied/i) {
  await expect(db.query(sql, params)).rejects.toThrow(pattern);
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
  await db.exec(await loadMigration("202610100004_building_files.sql"));
  await asUser(alice);
  const created = await db.query<{ id: string }>("select * from public.save_building(null, null, $1::jsonb)", [JSON.stringify(initialBuilding)]);
  buildingId = created.rows[0].id;
}, 30000);
afterAll(async () => { await db.close(); });

describe("owner-scoped building files", () => {
  it("registers a file for the owner's building and derives the storage path", async () => {
    await asUser(alice);
    const result = await db.query<{ out_id: string; out_storage_path: string }>(
      "select * from public.register_building_file($1, $2, 'roof-plan.pdf', 'application/pdf', 2048, $3)",
      [buildingId, fileId, sha]);
    storagePath = result.rows[0].out_storage_path;
    expect(result.rows[0].out_id).toBe(fileId);
    expect(storagePath).toBe(`${alice}/${buildingId}/${fileId}`);
    const rows = await db.query<{ owner_id: string; byte_size: string }>("select owner_id, byte_size from public.building_files");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].owner_id).toBe(alice);
  });
  it("rejects bad names, types, sizes and checksums", async () => {
    await asUser(alice);
    await fails("select * from public.register_building_file($1, $2, '  ', 'application/pdf', 100, $3)", [buildingId, otherFileId, sha], /Invalid file name/);
    await fails("select * from public.register_building_file($1, $2, 'x.zip', 'application/zip', 100, $3)", [buildingId, otherFileId, sha], /Unsupported file type/);
    await fails("select * from public.register_building_file($1, $2, 'x.pdf', 'application/pdf', 10485761, $3)", [buildingId, otherFileId, sha], /File too large/);
    await fails("select * from public.register_building_file($1, $2, 'x.pdf', 'application/pdf', 100, 'nope')", [buildingId, otherFileId], /Invalid checksum/);
    expect((await db.query("select * from public.building_files")).rows).toHaveLength(1);
  });
  it("prevents non-owners from reading, registering against or deleting a file", async () => {
    await asUser(bob);
    expect((await db.query("select * from public.building_files")).rows).toHaveLength(0);
    await fails("select * from public.register_building_file($1, $2, 'x.pdf', 'application/pdf', 100, $3)", [buildingId, otherFileId, sha], /Building unavailable/);
    expect((await db.query("delete from public.building_files where id = $1 returning id", [fileId])).rows).toHaveLength(0);
    await fails("insert into public.building_files(id, building_id, owner_id, storage_path, file_name, mime_type, byte_size, sha256) values ($1, $2, $3, 'p', 'x.pdf', 'application/pdf', 100, $4)", [otherFileId, buildingId, alice, sha], /permission denied/);
  });
  it("rejects duplicate file ids", async () => {
    await asUser(alice);
    await fails("select * from public.register_building_file($1, $2, 'x.pdf', 'application/pdf', 100, $3)", [buildingId, fileId, sha], /duplicate key|unique/i);
  });
  it("lets the owner delete their file and denies anonymous access", async () => {
    await asUser(alice);
    expect((await db.query<{ id: string }>("delete from public.building_files where id = $1 returning id", [fileId])).rows).toHaveLength(1);
    expect((await db.query("select * from public.building_files")).rows).toHaveLength(0);
    await db.exec("reset role; set role anon;");
    await fails("select * from public.building_files", [], /permission denied/);
    await fails("select * from public.register_building_file($1, $2, 'x.pdf', 'application/pdf', 100, $3)", [buildingId, fileId, sha], /permission denied/);
    await db.exec("reset role;");
  });
});
