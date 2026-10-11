"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authenticatedSession, type Outcome } from "@/lib/session";
import {
  ALLOWED_FILE_TYPES,
  BUILDING_FILES_BUCKET,
  MAX_FILE_BYTES,
  buildingFileRowSchema,
  type BuildingFileRow,
} from "@/lib/building-files";

const uuid = z.uuid();
const registerSchema = z.array(z.object({ out_id: z.uuid(), out_storage_path: z.string().min(1) })).length(1);
type Session = NonNullable<Awaited<ReturnType<typeof authenticatedSession>>>;
type OwnedBuilding = { ok: true; session: Session; buildingId: string } | { ok: false; error: string };

async function ownedBuilding(buildingId: unknown): Promise<OwnedBuilding> {
  const session = await authenticatedSession();
  if (!session) return { ok: false, error: "Sign in to manage building files." };
  if (typeof buildingId !== "string" || !uuid.safeParse(buildingId).success) return { ok: false, error: "Invalid building reference." };
  const { data, error } = await session.client.from("buildings").select("id").eq("id", buildingId).eq("owner_id", session.userId).maybeSingle();
  if (error || !data) return { ok: false, error: "Building unavailable or not authorized." };
  return { ok: true, session, buildingId };
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function listBuildingFiles(buildingId: unknown): Promise<Outcome<BuildingFileRow[]>> {
  const owned = await ownedBuilding(buildingId);
  if (!owned.ok) return { error: owned.error };
  const { data, error } = await owned.session.client
    .from("building_files")
    .select("id,building_id,file_name,mime_type,byte_size,sha256,created_at")
    .eq("building_id", owned.buildingId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { error: "Could not load files. Check the file migration and connection." };
  const parsed = z.array(buildingFileRowSchema).safeParse(data);
  return parsed.success ? { data: parsed.data } : { error: "A stored file entry is incompatible with this version. Nothing unvalidated was shown." };
}

export async function uploadBuildingFile(formData: FormData): Promise<Outcome<{ id: string }>> {
  const owned = await ownedBuilding(formData.get("buildingId"));
  if (!owned.ok) return { error: owned.error };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_FILE_BYTES) return { error: "Files must be 10 MB or smaller." };
  if (!(ALLOWED_FILE_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Unsupported file type. Upload a PDF, image, CAD drawing, CSV or Excel file." };
  }
  const fileId = crypto.randomUUID();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = await sha256Hex(bytes);
  const registered = await owned.session.client.rpc("register_building_file", {
    p_building_id: owned.buildingId,
    p_file_id: fileId,
    p_file_name: file.name.slice(0, 255),
    p_mime_type: file.type,
    p_byte_size: file.size,
    p_sha256: sha256,
  });
  if (registered.error) return { error: "This file could not be registered. Check the file migration and account permissions." };
  const parsed = registerSchema.safeParse(registered.data);
  if (!parsed.success) return { error: "The server returned an unexpected response." };
  const upload = await owned.session.client.storage
    .from(BUILDING_FILES_BUCKET)
    .upload(parsed.data[0].out_storage_path, bytes, { contentType: file.type, upsert: false });
  if (upload.error) {
    // Roll back the metadata row so a failed upload leaves no orphaned entry.
    await owned.session.client.from("building_files").delete().eq("id", fileId).eq("owner_id", owned.session.userId);
    return { error: "Upload failed and nothing was stored. Check the storage bucket and its policies." };
  }
  revalidatePath(`/dashboard/buildings/${owned.buildingId}/files`);
  return { data: { id: fileId } };
}

export async function signBuildingFile(buildingId: unknown, fileId: unknown): Promise<Outcome<{ url: string }>> {
  const owned = await ownedBuilding(buildingId);
  if (!owned.ok) return { error: owned.error };
  if (!uuid.safeParse(fileId).success) return { error: "Invalid file reference." };
  const { data, error } = await owned.session.client
    .from("building_files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("building_id", owned.buildingId)
    .eq("owner_id", owned.session.userId)
    .maybeSingle();
  if (error || !data) return { error: "File unavailable or not authorized." };
  const signed = await owned.session.client.storage.from(BUILDING_FILES_BUCKET).createSignedUrl(data.storage_path, 300);
  if (signed.error || !signed.data) return { error: "Could not create a download link. Check the storage bucket." };
  return { data: { url: signed.data.signedUrl } };
}

export async function deleteBuildingFile(buildingId: unknown, fileId: unknown): Promise<Outcome<true>> {
  const owned = await ownedBuilding(buildingId);
  if (!owned.ok) return { error: owned.error };
  if (!uuid.safeParse(fileId).success) return { error: "Invalid file reference." };
  const { data, error } = await owned.session.client
    .from("building_files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("building_id", owned.buildingId)
    .eq("owner_id", owned.session.userId)
    .maybeSingle();
  if (error || !data) return { error: "File unavailable or not authorized." };
  const removed = await owned.session.client.storage.from(BUILDING_FILES_BUCKET).remove([data.storage_path]);
  if (removed.error) return { error: "Could not remove the stored file. Check the storage bucket." };
  const deleted = await owned.session.client.from("building_files").delete().eq("id", fileId).eq("owner_id", owned.session.userId).select("id");
  if (deleted.error || deleted.data?.length !== 1) return { error: "The file entry could not be removed. Refresh the list and retry." };
  revalidatePath(`/dashboard/buildings/${owned.buildingId}/files`);
  return { data: true };
}
