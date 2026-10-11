"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authenticatedSession, type Outcome } from "@/lib/session";
import { submitQuoteSchema, requestRowSchema, profileSchema } from "@/lib/quote";

async function customerSession() {
  const session = await authenticatedSession();
  return session;
}
export async function submitQuoteRequest(payload: unknown): Promise<Outcome<{ id: string }>> {
  const session = await customerSession();
  if (!session) return { error: "Sign in to submit a quotation request. Your local brief is still available below." };
  const parsed = submitQuoteSchema.safeParse(payload);
  if (!parsed.success) return { error: "Choose a discipline and write a subject and message before submitting." };
  // Customers get a default profile on first contact.
  await session.client.rpc("ensure_profile");
  const { data, error } = await session.client.rpc("submit_quotation_request", {
    p_discipline: parsed.data.discipline,
    p_subject: parsed.data.subject,
    p_message: parsed.data.message,
    p_building_id: parsed.data.buildingId ?? null,
  });
  if (error) return { error: "Your request could not be submitted. Check the quotation migration and account permissions." };
  const id = z.uuid().safeParse(data);
  if (!id.success) return { error: "The server returned an unexpected response." };
  revalidatePath("/dashboard/quotes");
  return { data: { id: id.data } };
}
export async function listQuoteRequests(): Promise<Outcome<import("@/lib/quote").RequestRow[]>> {
  const session = await customerSession();
  if (!session) return { error: "Sign in to view your quotation requests." };
  const { data, error } = await session.client
    .from("quotation_requests")
    .select("id,customer_id,building_id,discipline,subject,message,status,engineer_id,created_at,updated_at,quotations(id,request_id,version,status,currency,subtotal,tax_rate,tax,total,notes,valid_until,created_at,quotation_items(id,position,description,quantity,unit,unit_price,amount))")
    .eq("customer_id", session.userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { error: "Could not load quotation requests. Check the quotation migration and connection." };
  const parsed = z.array(requestRowSchema).safeParse(data);
  return parsed.success ? { data: parsed.data } : { error: "A stored request is incompatible with this version. Nothing unvalidated was shown." };
}
export async function roleOf(): Promise<Outcome<{ role: import("@/lib/quote").Role }>> {
  const session = await customerSession();
  if (!session) return { error: "Sign in first." };
  const { data, error } = await session.client.from("profiles").select("user_id,display_name,role").eq("user_id", session.userId).maybeSingle();
  if (error || !data) {
    const rpc = await session.client.rpc("ensure_profile");
    if (rpc.error) return { error: "Your profile could not be read." };
    const row = await session.client.from("profiles").select("user_id,display_name,role").eq("user_id", session.userId).maybeSingle();
    if (row.error || !row.data) return { error: "Your profile is unavailable." };
    const parsed = profileSchema.safeParse(row.data);
    return parsed.success ? { data: { role: parsed.data.role } } : { error: "Profile is invalid." };
  }
  const parsed = profileSchema.safeParse(data);
  return parsed.success ? { data: { role: parsed.data.role } } : { error: "Profile is invalid." };
}
export async function withdrawQuoteRequest(id: unknown): Promise<Outcome<true>> {
  const session = await customerSession();
  if (!session || !z.uuid().safeParse(id).success) return { error: "Sign in and select a valid request." };
  const { error } = await session.client.rpc("cancel_quotation_request", { p_request_id: id });
  if (error) return { error: "This request cannot be withdrawn. Refresh before retrying." };
  revalidatePath("/dashboard/quotes");
  return { data: true };
}
export async function respondToQuotation(payload: unknown): Promise<Outcome<true>> {
  const session = await customerSession();
  const parsed = z.object({ quotationId: z.uuid(), accept: z.boolean() }).safeParse(payload);
  if (!session || !parsed.success) return { error: "Sign in and select a valid quotation." };
  const { error } = await session.client.rpc("respond_to_quotation", { p_quotation_id: parsed.data.quotationId, p_accept: parsed.data.accept });
  if (error) return { error: "This quotation cannot be answered. Refresh before retrying." };
  revalidatePath("/dashboard/quotes");
  return { data: true };
}