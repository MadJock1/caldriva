"use server";
import { z } from "zod";
import { serverSupabase } from "@/lib/supabase/server";
import { electricalBuildingSchema } from "@/lib/electrical/model";
import { electricalDraftSchema, electricalIdentitySchema, electricalSaveSchema, electricalSummarySchema, type ElectricalIdentity, type ElectricalSummary } from "@/lib/electrical/cloud";
import { revalidatePath } from "next/cache";

type Outcome<T> = { data: T; error?: never } | { error: string; data?: never };

async function authenticatedClient() {
  const client = await serverSupabase();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

export async function listElectricalDesigns(): Promise<Outcome<ElectricalSummary[]>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to access cloud designs. Supabase must be configured." };
  const { data, error } = await session.client.from("electrical_designs").select("id,name,version,updated_at").eq("owner_id", session.userId).order("updated_at", { ascending: false }).limit(100);
  if (error) return { error: "Could not load designs. Check the connection and database migration." };
  const parsed = z.array(electricalSummarySchema).safeParse(data);
  return parsed.success ? { data: parsed.data } : { error: "The stored design list is incompatible with this version." };
}

export async function saveElectricalDesign(payload: unknown): Promise<Outcome<ElectricalIdentity>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to save to your account. Your local draft remains available." };
  const parsed = electricalSaveSchema.safeParse(payload);
  if (!parsed.success) return { error: "Check the building name and inputs before saving." };
  const { identity, draft } = parsed.data;
  const { data, error } = await session.client.rpc("save_electrical_design", { p_id: identity?.id ?? null, p_expected_version: identity?.version ?? null, p_draft: draft });
  if (error) return { error: error.code === "40001" ? "This design was changed elsewhere. Reopen the latest version or save a new copy." : "Could not save this design. It may be unavailable, or the database is not configured." };
  const saved = z.array(electricalIdentitySchema).length(1).safeParse(data);
  if (!saved.success) return { error: "Save returned an unexpected response. Reopen your design list before retrying." };
  revalidatePath("/dashboard/electrical");
  return { data: saved.data[0] };
}

export async function loadElectricalDesign(id: unknown): Promise<Outcome<{ identity: ElectricalIdentity; draft: ReturnType<typeof electricalBuildingSchema.parse> }>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to open this design." };
  if (!z.uuid().safeParse(id).success) return { error: "Invalid design reference." };
  const { data, error } = await session.client.from("electrical_designs").select("id,version,electrical_drafts(draft)").eq("id", id).eq("owner_id", session.userId).maybeSingle();
  if (error || !data) return { error: "Design unavailable or not authorized." };
  const parsed = electricalIdentitySchema.extend({ electrical_drafts: z.object({ draft: electricalDraftSchema }) }).safeParse(data);
  if (!parsed.success) return { error: "This design draft is incompatible with this application version." };
  return { data: { identity: { id: parsed.data.id, version: parsed.data.version }, draft: parsed.data.electrical_drafts.draft } };
}

export async function deleteElectricalDesign(payload: unknown): Promise<Outcome<true>> {
  const session = await authenticatedClient();
  if (!session) return { error: "Sign in to delete this design." };
  const parsed = electricalIdentitySchema.safeParse(payload);
  if (!parsed.success) return { error: "Invalid design reference." };
  const { data, error } = await session.client.from("electrical_designs").delete().eq("id", parsed.data.id).eq("version", parsed.data.version).eq("owner_id", session.userId).select("id");
  if (error || data?.length !== 1) return { error: "Design unavailable or changed elsewhere. Refresh the list before retrying." };
  revalidatePath("/dashboard/electrical");
  return { data: true };
}
