import { describe, expect, it } from "vitest";
import { computeQuotation, customerActions, requestTransitions, requestRowSchema, quoteAmount, staffActions, isTerminal, submitQuoteSchema } from "./quote";

describe("quotation transitions", () => {
  it("keeps a DAG of allowed status moves and reflects the two roles", () => {
    for (const status of Object.keys(requestTransitions) as (keyof typeof requestTransitions)[]) {
      if (isTerminal(status)) continue;
      expect(requestTransitions[status].length).toBeGreaterThan(0);
    }
    expect(requestTransitions.new).toContain("assigned");
    expect(requestTransitions.assigned).toContain("quoted");
    expect(requestTransitions.quoted).toContain("accepted");
    expect(requestTransitions.accepted).toContain("completed");
    expect(customerActions("new").withdraw).toBe(true);
    expect(customerActions("quoted").respond).toBe(true);
    expect(customerActions("accepted").withdraw).toBe(false);
    expect(staffActions("new", true).claim).toBe(true);
    expect(staffActions("accepted", true).complete).toBe(true);
    expect(staffActions("accepted", false).complete).toBe(false);
  });
});
describe("quotation money", () => {
  it("rounds amounts and totals consistently", () => {
    expect(quoteAmount({ quantity: 3, unit_price: 2.5 })).toBe(7.5);
    const t = computeQuotation([{ quantity: 2, unit_price: 100 }, { quantity: 1, unit_price: 19.5 }], 0.23);
    expect(t.subtotal).toBe(219.5);
    expect(t.tax).toBe(50.49);
    expect(t.total).toBe(269.99);
  });
});
describe("quotation schemas", () => {
  it("validates submission input and rejects empty subjects and unknown disciplines", () => {
    expect(submitQuoteSchema.safeParse({ discipline: "solar", subject: "Roof PV", message: "Hello" }).success).toBe(true);
    expect(submitQuoteSchema.safeParse({ discipline: "blacksmith", subject: "x", message: "y" }).success).toBe(false);
    expect(submitQuoteSchema.safeParse({ discipline: "solar", subject: "  ", message: "y" }).success).toBe(false);
  });
  it("parses a nested PostgREST request row with quotations and items", () => {
    const row = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      customer_id: "11111111-1111-4111-8111-111111111111",
      building_id: null,
      discipline: "solar",
      subject: "PV", message: "details", status: "quoted", engineer_id: "44444444-4444-4444-8444-444444444444",
      created_at: "2026-10-10T10:00:00.000Z", updated_at: "2026-10-10T10:00:00.000Z",
      quotations: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", request_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 2, status: "sent", currency: "EUR", subtotal: 8000, tax_rate: 0.23, tax: 1840, total: 9840, notes: null, valid_until: "2026-12-31", created_at: "2026-10-10T10:00:00.000Z", quotation_items: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", position: 1, description: "5 kWp system", quantity: 1, unit: "lot", unit_price: 8000, amount: 8000 }] }],
    };
    const parsed = requestRowSchema.safeParse(row);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.quotations[0].total).toBe(9840);
      expect(parsed.data.quotations[0].quotation_items[0].amount).toBe(8000);
    }
  });
  it("rejects malformed nested rows", () => {
    expect(requestRowSchema.safeParse({ id: "not-a-uuid", discipline: "bogus" }).success).toBe(false);
  });
});