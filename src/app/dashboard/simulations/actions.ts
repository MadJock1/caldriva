"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { serverSupabase } from "@/lib/supabase/server";
import { snapshotFromRow, snapshotSchema, assumptions, type SavedSimulation } from "@/lib/simulation";
import { cloudIdentitySchema } from "@/lib/cloud-building";
import { calculateSolar } from "@/lib/pvgis";

type Outcome<T> = { data: T; error?: never } | { error: string; data?: never };
const selection = "id,name,building_id,building_version,calculation_version,building_snapshot,assumptions,created_at,simulation_inputs(data),simulation_results(data)";
async function session() {
  const client = await serverSupabase();
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : { client, userId: data.user.id };
}
export async function saveSimulation(payload: unknown): Promise<Outcome<SavedSimulation>> {
  const auth = await session();
  if (!auth) return { error: "Sign in and save a cloud building before saving a cloud simulation." };
  const parsed = z.object({ identity: cloudIdentitySchema, snapshot: snapshotSchema }).safeParse(payload);
  if (!parsed.success) return { error: "The simulation inputs and results are incomplete or inconsistent. Run a new estimate." };
  const { identity, snapshot } = parsed.data;
  const owner = await auth.client.from("buildings").select("id,version").eq("id", identity.id).eq("owner_id", auth.userId).maybeSingle();
  if (owner.error || !owner.data) return { error: "Building unavailable or not authorized." };
  if (owner.data.version !== identity.version) return { error: "This building changed elsewhere. Reopen the current building before saving a scenario." };
  // Never trust browser-supplied energy results for a cloud save. Recalculate from inputs.
  let verified;
  try { verified = snapshotSchema.parse({ ...snapshot, assumptions: [...assumptions], result: await calculateSolar(snapshot.building.solar) }); }
  catch { return { error: "PVGIS could not refresh this scenario. No simulation was saved. Local saving is still available." }; }
  const { data: id, error } = await auth.client.rpc("save_solar_simulation", { p_building_id: identity.id, p_building_version: identity.version, p_snapshot: verified });
  if (error) return { error: error.code === "40001" ? "The building changed while calculating. Reopen it before saving." : "Could not save the simulation. Check the simulation migration and account permissions." };
  revalidatePath("/dashboard/simulations");
  return loadSimulation(id);
}
export async function listSimulations(buildingId: unknown): Promise<Outcome<SavedSimulation[]>> {
  const auth = await session();
  if (!auth) return { error: "Sign in to view saved simulations." };
  const parsed = z.uuid().safeParse(buildingId);
  if (!parsed.success) return { error: "Choose a valid building." };
  const { data, error } = await auth.client.from("simulations").select(selection).eq("building_id", parsed.data).order("created_at", { ascending: false }).limit(50);
  if (error) return { error: "Could not load scenarios. Check the simulation migration and connection." };
  try { return { data: (data ?? []).map(snapshotFromRow) }; } catch { return { error: "A stored scenario is incompatible. No unvalidated results were displayed." }; }
}
export async function loadSimulation(id: unknown): Promise<Outcome<SavedSimulation>> {
  const auth = await session();
  if (!auth) return { error: "Sign in to reopen this simulation." };
  if (!z.uuid().safeParse(id).success) return { error: "Invalid simulation reference." };
  const { data, error } = await auth.client.from("simulations").select(selection).eq("id", id).maybeSingle();
  if (error || !data) return { error: "Simulation unavailable or not authorized." };
  try { return { data: snapshotFromRow(data) }; } catch { return { error: "Stored simulation failed validation." }; }
}
export async function deleteSimulation(id: unknown): Promise<Outcome<true>> {
  const auth = await session();
  if (!auth || !z.uuid().safeParse(id).success) return { error: "Sign in and select a valid simulation." };
  const { data, error } = await auth.client.from("simulations").delete().eq("id", id).select("id");
  if (error || data?.length !== 1) return { error: "Simulation unavailable or not authorized." };
  revalidatePath("/dashboard/simulations");
  return { data: true };
}
