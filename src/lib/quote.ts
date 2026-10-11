import { z } from "zod";

export const DISCIPLINES = ["solar", "electrical", "mechanical", "structural", "plumbing", "fire", "acoustic", "hvac"] as const;
export const disciplineSchema = z.enum(DISCIPLINES);
export type Discipline = z.infer<typeof disciplineSchema>;

export const REQUEST_STATUSES = ["new", "assigned", "quoted", "accepted", "completed", "rejected", "withdrawn"] as const;
export const requestStatusSchema = z.enum(REQUEST_STATUSES);
export type RequestStatus = z.infer<typeof requestStatusSchema>;

export const QUOTATION_STATUSES = ["draft", "sent", "accepted", "declined", "superseded"] as const;
export const quotationStatusSchema = z.enum(QUOTATION_STATUSES);
export type QuotationStatus = z.infer<typeof quotationStatusSchema>;

export const ROLES = ["customer", "engineer", "admin"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const profileSchema = z.object({
  user_id: z.uuid(),
  display_name: z.string().trim().min(1).max(100),
  role: roleSchema,
});
export type Profile = z.infer<typeof profileSchema>;

export const quoteItemSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  quantity: z.coerce.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(20),
  unit_price: z.coerce.number().nonnegative().max(1_000_000_000),
});
export type QuoteItem = z.infer<typeof quoteItemSchema>;

export const quotationDraftSchema = z.object({
  notes: z.string().trim().max(10000).optional().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("EUR"),
  taxRate: z.coerce.number().min(0).max(1).default(0.23),
  validUntil: z.string().date().optional().nullable(),
  expectedVersion: z.coerce.number().int().positive().optional().nullable(),
  send: z.boolean().optional().default(false),
});
export type QuotationDraft = z.infer<typeof quotationDraftSchema>;

export const submitQuoteSchema = z.object({
  discipline: disciplineSchema,
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(20000),
  buildingId: z.uuid().optional().nullable(),
});
export type SubmitQuote = z.infer<typeof submitQuoteSchema>;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
export type Priced = Pick<QuoteItem, "quantity" | "unit_price">;
export function quoteAmount(item: Priced) {
  return roundMoney(item.quantity * item.unit_price);
}
export function computeQuotation(items: Priced[], taxRate: number) {
  const subtotal = roundMoney(items.reduce((sum, item) => sum + quoteAmount(item), 0));
  const tax = roundMoney(subtotal * taxRate);
  return { subtotal, tax, total: roundMoney(subtotal + tax) };
}
export const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });
export function formatMoney(value: number, currency = "EUR") {
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value); }
  catch { return `${value.toLocaleString("en-GB")} ${currency}`; }
}

// Mirror of the SQL guard. SQL remains the authority; these drive UI affordances.
export const requestTransitions: Record<RequestStatus, readonly RequestStatus[]> = {
  new: ["assigned", "withdrawn", "rejected"],
  assigned: ["quoted", "withdrawn", "rejected"],
  quoted: ["assigned", "accepted", "rejected"],
  accepted: ["completed", "rejected"],
  completed: [],
  rejected: [],
  withdrawn: [],
};
export const isTerminal = (status: RequestStatus) => requestTransitions[status].length === 0;
export function customerActions(status: RequestStatus) {
  return {
    withdraw: status === "new" || status === "assigned",
    respond: status === "quoted",
  };
}
export function staffActions(status: RequestStatus, mine: boolean) {
  return {
    claim: status === "new",
    compose: mine && (status === "assigned" || status === "quoted"),
    complete: mine && status === "accepted",
    reject: true,
  };
}

export const requestStatusLabels: Record<RequestStatus, string> = {
  new: "New",
  assigned: "Assigned",
  quoted: "Quoted",
  accepted: "Accepted",
  completed: "Completed",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};
export const quotationStatusLabels: Record<QuotationStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  superseded: "Superseded",
};

// PostgREST row shapes (numbers come back as numbers; dates as ISO strings).
export const quotationItemRowSchema = z.object({
  id: z.uuid(),
  position: z.coerce.number().int().positive(),
  description: z.string(),
  quantity: z.coerce.number(),
  unit: z.string(),
  unit_price: z.coerce.number(),
  amount: z.coerce.number(),
});
export type QuotationItemRow = z.infer<typeof quotationItemRowSchema>;

export const quotationRowSchema = z.object({
  id: z.uuid(),
  request_id: z.uuid(),
  version: z.coerce.number().int().positive(),
  status: quotationStatusSchema,
  currency: z.string(),
  subtotal: z.coerce.number(),
  tax_rate: z.coerce.number(),
  tax: z.coerce.number(),
  total: z.coerce.number(),
  notes: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  created_at: z.string(),
  quotation_items: z.array(quotationItemRowSchema).optional().default([]),
});
export type QuotationRow = z.infer<typeof quotationRowSchema>;

export const requestRowSchema = z.object({
  id: z.uuid(),
  customer_id: z.uuid(),
  building_id: z.uuid().nullable().optional(),
  discipline: disciplineSchema,
  subject: z.string(),
  message: z.string(),
  status: requestStatusSchema,
  engineer_id: z.uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  quotations: z.array(quotationRowSchema).optional().default([]),
});
export type RequestRow = z.infer<typeof requestRowSchema>;

export function latestActiveQuotation(request: RequestRow) {
  return [...request.quotations]
    .filter(q => q.status === "sent" || q.status === "accepted" || q.status === "declined")
    .sort((a, b) => b.version - a.version)[0] ?? null;
}
export function latestDraftVersion(request: RequestRow) {
  return (request.quotations ?? []).reduce((max, q) => Math.max(max, q.version), 0);
}