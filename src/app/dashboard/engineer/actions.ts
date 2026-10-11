"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { authenticatedSession, type Outcome } from "@/lib/session";
import { quoteItemSchema, quotationDraftSchema, requestRowSchema, roleSchema } from "@/lib/quote";

async function staffSession() {
  const session = await authenticatedSession();
  if (!session) return null;
  const { data, error } = await session.client.from("profiles").select("user_id,display_name,role").eq("user_id", session.userId).maybeSingle();
  if (error || !data) return null;
  const parsed = roleSchema.safeParse(data.role);
  if (!parsed.success || !parsed.data || parsed.data === "customer") return null;
  return { ...session, role: parsed.data };
}

export async function listOpenRequests(): Promise<Outcome<import("@/lib/quote").RequestRow[]>> {
  const staff = await staffSession();
  if (!staff) return { error: "Staff access required." };
  const { data, error } = await staff.client.from("quotation_requests")
    .select("id,customer_id,building_id,discipline,subject,message,status,engineer_id,created_at,updated_at,quotations(id,request_id,version,status,currency,subtotal,tax_rate,tax,total,notes,valid_until,created_at,quotation_items(id,position,description,quantity,unit,unit_price,amount))")
    .in("status", ["new", "assigned", "quoted", "accepted"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { error: "Could not load the queue." };
  const parsed = z.array(requestRowSchema).safeParse(data);
  return parsed.success ? { data: parsed.data } : { error: "A stored request is incompatible. Nothing was shown." };
}
export async function listAssignedRequests(): Promise<Outcome<import("@/lib/quote").RequestRow[]>> {
  const staff = await staffSession();
  if (!staff) return { error: "Staff access required." };
  const { data, error } = await staff.client.from("quotation_requests")
    .select("id,customer_id,building_id,discipline,subject,message,status,engineer_id,created_at,updated_at,quotations(id,request_id,version,status,currency,subtotal,tax_rate,tax,total,notes,valid_until,created_at,quotation_items(id,position,description,quantity,unit,unit_price,amount))")
    .eq("engineer_id", staff.userId)
    .in("status", ["assigned", "quoted", "accepted"])
    .order("updated_at", { ascending: false }).limit(200);
  if (error) return { error: "Could not load your assigned requests." };
  const parsed = z.array(requestRowSchema).safeParse(data);
  return parsed.success ? { data: parsed.data } : { error: "A stored request is incompatible. Nothing was shown." };
}
export async function claimRequest(id: unknown): Promise<Outcome<true>> {
  const staff = await staffSession();
  if (!staff || !z.uuid().safeParse(id).success) return { error: "Staff access required." };
  const { error } = await staff.client.rpc("claim_quotation_request", { p_request_id: id });
  if (error) return { error: "This request was already assigned or is unavailable." };
  revalidatePath("/dashboard/engineer");
  return { data: true };
}
export async function transitionRequest(payload: unknown): Promise<Outcome<true>> {
  const staff = await staffSession();
  const parsed = z.object({ requestId: z.uuid(), status: z.enum(["rejected", "completed"] as const) }).safeParse(payload);
  if (!staff || !parsed.success) return { error: "Staff access required." };
  const { error } = await staff.client.rpc("transition_quotation_request", { p_request_id: parsed.data.requestId, p_new_status: parsed.data.status });
  if (error) return { error: "This transition is not allowed for the current state and role." };
  revalidatePath("/dashboard/engineer");
  revalidatePath("/dashboard/quotes");
  return { data: true };
}
export async function saveQuotation(payload: unknown): Promise<Outcome<{ id: string; version: number; status: string }>> {
  const staff = await staffSession();
  if (!staff) return { error: "Staff access required." };
  const parsed = z.object({ requestId: z.uuid(), items: z.array(quoteItemSchema).min(1).max(100) })
    .and(quotationDraftSchema).safeParse(payload);
  if (!parsed.success) return { error: "Add at least one valid line item and check the tax rate, currency and notes." };
  const draft = parsed.data;
  const { data, error } = await staff.client.rpc("save_quotation", {
    p_request_id: draft.requestId,
    p_items: draft.items,
    p_currency: draft.currency,
    p_tax_rate: draft.taxRate,
    p_notes: draft.notes ?? null,
    p_valid_until: draft.validUntil ?? null,
    p_expected_version: draft.expectedVersion ?? null,
    p_send: !!draft.send,
  });
  if (error) return { error: error.code === "40001" ? "A newer quotation was saved elsewhere. Reload before retrying." : "The quotation could not be saved." };
  if (typeof data?.id !== "string") return { error: "Save returned an unexpected response." };
  revalidatePath("/dashboard/engineer");
  revalidatePath("/dashboard/quotes");
  return { data: data as { id: string; version: number; status: string } };
}