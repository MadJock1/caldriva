"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMoney, requestStatusLabels, customerActions, type RequestRow } from "@/lib/quote";
import { withdrawQuoteRequest, respondToQuotation } from "@/app/dashboard/quotes/actions";

function QuotationDetail({ request }: { request: RequestRow }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const actions = customerActions(request.status);
  const quotation = [...request.quotations].filter(q => q.status === "sent").sort((a, b) => b.version - a.version)[0];
  if (!quotation) return null;
  const respond = (accept: boolean) => start(async () => {
    try {
      const result = await respondToQuotation({ quotationId: quotation.id, accept });
      if (result?.error) setMessage(result.error);
      else { setMessage(accept ? "Quotation accepted." : "Quotation declined. The engineer can revise it."); router.refresh(); }
    } catch { setMessage("Request failed. Please retry."); }
  });
  return <div className="border rounded-lg bg-background p-4 mt-4">
    <h3 className="font-semibold">Quotation v{quotation.version} — {requestStatusLabels[request.status] === "Quoted" ? "awaiting your decision" : formatMoney(quotation.total, quotation.currency)}</h3>
    <p className="text-sm text-text-muted mt-2">Total <strong className="text-text">{formatMoney(quotation.total, quotation.currency)}</strong> (excluding {formatMoney(quotation.tax, quotation.currency)} {quotation.currency} tax, VAT {Math.round(quotation.tax_rate * 100)}%)</p>
    {quotation.valid_until && <p className="text-sm text-text-muted">Valid until {quotation.valid_until}</p>}
    <table className="w-full text-sm mt-4 border-collapse"><thead><tr className="text-left text-text-muted border-b"><th className="py-2 pr-3">Item</th><th className="py-2 pr-3">Qty</th><th className="py-2 pr-3">Unit price</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{quotation.quotation_items.map(item => <tr key={item.id} className="border-b"><td className="py-2 pr-3">{item.description}</td><td className="py-2 pr-3">{item.quantity} {item.unit}</td><td className="py-2 pr-3">{formatMoney(item.unit_price, quotation.currency)}</td><td className="py-2 text-right">{formatMoney(item.amount, quotation.currency)}</td></tr>)}</tbody></table>
    {quotation.notes && <p className="text-sm text-text-muted mt-3">{quotation.notes}</p>}
    <p role="status" className="text-sm mt-3">{message}</p>
    {actions.respond && <div className="flex gap-3 mt-4"><Button loading={busy} onClick={() => respond(true)}>Accept quotation</Button><Button variant="outline" loading={busy} onClick={() => respond(false)}>Decline and request revision</Button></div>}
  </div>;
}

export function QuoteBoard({ initial }: { initial: RequestRow[] }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const withdraw = (id: string) => start(async () => {
    try {
      const result = await withdrawQuoteRequest(id);
      if (result?.error) setMessage(result.error);
      else { setMessage("Request withdrawn."); router.refresh(); }
    } catch { setMessage("Request failed. Please retry."); }
  });
  return <section>
    <p role="status" className="my-5">{message}</p>
    {initial.length === 0 ? <p>No quotation requests yet. Use the public “Request a quote” page to start one.</p>
      : <ul className="space-y-6">{initial.map(request => <li key={request.id} className="border rounded-xl bg-surface p-5">
        <div className="flex flex-wrap items-start gap-4 justify-between"><div><p className="text-sm text-text-muted">{request.discipline} · submitted {request.created_at.slice(0, 10)}</p><h2 className="text-xl font-semibold mt-1">{request.subject}</h2><p className="mt-3 whitespace-pre-wrap text-sm">{request.message}</p></div><span className="inline-flex rounded-full border border-border px-3 py-1 text-sm">{requestStatusLabels[request.status]}</span></div>
        {customerActions(request.status).withdraw && <div className="flex gap-3 mt-4"><Button variant="outline" loading={busy} onClick={() => withdraw(request.id)}>Withdraw request</Button>{request.status === "assigned" && <Link className="inline-flex items-center text-sm underline" href="/dashboard/buildings">View buildings</Link>}</div>}
        <QuotationDetail request={request} />
      </li>)}</ul>}
  </section>;
}