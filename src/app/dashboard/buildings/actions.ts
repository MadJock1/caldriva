"use server";
import { z } from "zod";
import { serverSupabase } from "@/lib/supabase/server";
import { buildingSchema, horizontalRoofArea, type Building } from "@/lib/building";
import { cloudSaveSchema, cloudIdentitySchema, cloudSummarySchema, type CloudIdentity, type CloudSummary } from "@/lib/cloud-building";
import { revalidatePath } from "next/cache";

type Outcome<T> = { data: T; error?: never } | { error: string; data?: never };
async function authenticatedClient() {
  const client = await serverSupabase();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}
export async function listBuildings(): Promise<Outcome<CloudSummary[]>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to access cloud buildings. Supabase must be configured." };
  const { data, error } = await session.client.from("buildings").select("id,name,version,updated_at").eq("owner_id", session.userId).order("updated_at", { ascending: false }).limit(100);
  if (error) return { error: "Could not load buildings. Check the connection and database migration." };
  const parsed = z.array(cloudSummarySchema).safeParse(data);
  return parsed.success ? { data: parsed.data } : { error: "The stored building list is incompatible with this version." };
}
export async function saveBuilding(payload: unknown): Promise<Outcome<CloudIdentity>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to save to your account. Your local draft remains available." };
  const parsed = cloudSaveSchema.safeParse(payload);
  if (!parsed.success) return { error: "Check the building name, location, solar and financial inputs before saving." };
  try { horizontalRoofArea(parsed.data.draft.roof); } catch { return { error: "Correct the roof geometry before saving." }; }
  const { identity, draft } = parsed.data;
  const { data, error } = await session.client.rpc("save_building", { p_id: identity?.id ?? null, p_expected_version: identity?.version ?? null, p_draft: draft });
  if (error) return { error: error.code === "40001" ? "This building was changed elsewhere. Reopen the latest version or save a new copy." : "Could not save this building. It may be unavailable, or the database is not configured." };
  const saved = z.array(cloudIdentitySchema).length(1).safeParse(data);
  if (!saved.success) return { error: "Save returned an unexpected response. Reopen your cloud list before retrying." };
  revalidatePath("/dashboard/buildings");
  return { data: saved.data[0] };
}
export async function loadBuilding(id: unknown): Promise<Outcome<{ identity: CloudIdentity; draft: Building }>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to open this building." };
  if (!z.uuid().safeParse(id).success) return { error: "Invalid building reference." };
  const { data, error } = await session.client.from("buildings").select("id,version,building_drafts(draft)").eq("id", id).eq("owner_id", session.userId).maybeSingle();
  if (error || !data) return { error: "Building unavailable or not authorized." };
  // PostgREST represents a one-to-one relationship as an object.
  const parsed = cloudIdentitySchema.extend({ building_drafts: z.object({ draft: buildingSchema }) }).safeParse(data);
  if (!parsed.success) return { error: "This building draft is incompatible with this application version." };
  return { data: { identity: { id: parsed.data.id, version: parsed.data.version }, draft: parsed.data.building_drafts.draft } };
}
export async function deleteBuilding(payload: unknown): Promise<Outcome<true>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to delete this building." };
  const parsed = cloudIdentitySchema.safeParse(payload);
  if (!parsed.success) return { error: "Invalid building reference." };
  const { data, error } = await session.client.from("buildings").delete().eq("id", parsed.data.id).eq("version", parsed.data.version).eq("owner_id", session.userId).select("id");
  if (error || data?.length !== 1) return { error: "Building unavailable or changed elsewhere. Refresh the list before retrying." };
  revalidatePath("/dashboard/buildings");
  return { data: true };
}
