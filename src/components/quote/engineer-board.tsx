"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { formatMoney, requestStatusLabels, quotationStatusLabels, computeQuotation, quoteAmount, staffActions, latestDraftVersion, type RequestRow, type QuoteItem } from "@/lib/quote";
import { claimRequest, saveQuotation, transitionRequest } from "@/app/dashboard/engineer/actions";

const emptyItem = { description: "", quantity: 1, unit: "item", unit_price: 0 };
function ComposePanel({ request, staffId, admin }: { request: RequestRow; staffId: string; admin: boolean }) {
  const firstDraft = request.quotations.filter(q => q.status === "draft").sort((a, b) => b.version - a.version)[0];
  const [items, setItems] = useState<QuoteItem[]>(firstDraft?.quotation_items?.length ? [...firstDraft.quotation_items].map(i => ({ description: i.description, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price })) : [emptyItem]);
  const [notes, setNotes] = useState(firstDraft?.notes ?? "");
  const [validUntil, setValidUntil] = useState(firstDraft?.valid_until ?? "");
  const [taxRate, setTaxRate] = useState(0.23);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const router = useRouter();
  const totals = computeQuotation(items, taxRate);
  const expectedVersion = latestDraftVersion(request);
  const update = (index: number, patch: Partial<QuoteItem>) => setItems(list => list.map((item, i) => i === index ? { ...item, ...patch } : item));
  const save = (send: boolean) => start(async () => {
    try {
      const result = await saveQuotation({ requestId: request.id, items, notes: notes.trim() || null, currency: "EUR", taxRate, validUntil: validUntil || null, expectedVersion: expectedVersion || null, send });
      if (result?.error) setMessage(result.error);
      else { setMessage(send ? "Quotation sent to the customer." : "Draft saved. Send it when ready."); router.refresh(); }
    } catch { setMessage("Save failed. Please retry."); }
  });
  return <div className="border rounded-lg bg-background p-4 mt-4 space-y-4">
    <h3 className="font-semibold">Compose quotation — {request.subject}</h3>
    <ul className="space-y-2">{items.map((item, index) => (
      <li key={index} className="grid gap-2 md:grid-cols-[1fr_5rem_5rem_6rem_auto] items-end">
        <Input label="Description" value={item.description} onChange={e => update(index, { description: e.target.value })} />
        <Input label="Qty" inputMode="decimal" value={item.quantity} onChange={e => update(index, { quantity: Number(e.target.value) })} />
        <Input label="Unit" value={item.unit} onChange={e => update(index, { unit: e.target.value })} />
        <Input label="Unit price (€)" inputMode="decimal" value={item.unit_price} onChange={e => update(index, { unit_price: Number(e.target.value) })} />
        <p className="text-sm pb-2">{formatMoney(quoteAmount(item))}</p>
        <Button variant="outline" size="sm" onClick={() => setItems(list => list.filter((_, i) => i !== index))} aria-label={`Remove line ${index + 1}`}>Remove</Button>
      </li>
    ))}</ul>
    <Button variant="outline" size="sm" onClick={() => setItems(list => [...list, { ...emptyItem }])}>Add line item</Button>
    <div className="grid gap-4 md:grid-cols-2">
      <Textarea label="Notes to customer (scope, exclusions)" rows={3} maxLength={10000} value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Tax rate (0–1)" inputMode="decimal" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} helperText="Applied to the subtotal." />
        <Input label="Valid until" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
      </div>
    </div>
    <div className="text-sm text-text-muted">Subtotal {formatMoney(totals.subtotal)} · Tax {formatMoney(totals.tax)} · <strong className="text-text">Total {formatMoney(totals.total)}</strong> (EUR)</div>
    <p role="status" className="text-sm">{message}</p>
    <div className="flex flex-wrap gap-3">
      <Button loading={busy} onClick={() => save(false)}>Save draft</Button>
      <Button variant="secondary" loading={busy} onClick={() => save(true)}>Save and send</Button>
      {admin && <Button variant="outline" onClick={() => { if (window.confirm(`Reject “${request.subject}”?`)) start(async () => { const r = await transitionRequest({ requestId: request.id, status: "rejected" }); setMessage(r?.error ?? "Request rejected."); router.refresh(); }); }}>Reject request (admin)</Button>}
    </div>
    <span className="sr-only">Staff reference {staffId}</span>
  </div>;
}
function RequestCard({ request, staffId, admin, selected, onSelect }: { request: RequestRow; staffId: string; admin: boolean; selected: boolean; onSelect: () => void }) {
  const [busy, start] = useTransition();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const mine = request.engineer_id === staffId || admin;
  const actions = staffActions(request.status, mine);
  const claim = () => start(async () => { const r = await claimRequest(request.id); setMessage(r?.error ?? "Claimed. Compose below."); router.refresh(); });
  const complete = () => start(async () => { const r = await transitionRequest({ requestId: request.id, status: "completed" }); setMessage(r?.error ?? "Marked completed."); router.refresh(); });
  return <li className="border rounded-xl bg-surface p-5">
    <div className="flex flex-wrap items-start gap-4 justify-between">
      <div><p className="text-sm text-text-muted">{request.discipline} · submitted {request.created_at.slice(0, 10)} {mine && request.engineer_id === staffId && <span>· assigned to you</span>}</p><h2 className="text-xl font-semibold mt-1">{request.subject}</h2><p className="mt-3 whitespace-pre-wrap text-sm">{request.message}</p></div>
      <span className="inline-flex rounded-full border border-border px-3 py-1 text-sm">{requestStatusLabels[request.status]}</span>
    </div>
    {request.quotations.length > 0 && <ul className="mt-3 space-y-1 text-sm">{request.quotations.slice().sort((a, b) => b.version - a.version).map(q => <li key={q.id} className="flex gap-3 justify-between text-text-muted"><span>v{q.version} · {quotationStatusLabels[q.status]}</span><span>{formatMoney(q.total, q.currency)}</span></li>)}</ul>}
    <p role="status" className="text-sm mt-3">{message}</p>
    <div className="flex flex-wrap gap-3 mt-4">
      {actions.claim && <Button onClick={claim} loading={busy}>Claim request</Button>}
      {actions.compose && <Button variant={selected ? "secondary" : "outline"} onClick={onSelect}>{selected ? "Editing…" : request.status === "quoted" ? "Revise quotation" : "Compose quotation"}</Button>}
      {actions.complete && <Button variant="secondary" onClick={complete} loading={busy}>Mark completed</Button>}
      {admin && request.status !== "rejected" && <Button variant="outline" onClick={() => { if (window.confirm(`Reject “${request.subject}”?`)) start(async () => { const r = await transitionRequest({ requestId: request.id, status: "rejected" }); setMessage(r?.error ?? "Request rejected."); router.refresh(); }); }}>Reject (admin)</Button>}
    </div>
    {selected && actions.compose && <ComposePanel request={request} staffId={staffId} admin={admin} />}
  </li>;
}
export function EngineerBoard({ open, mine, staffId, role }: { open: RequestRow[]; mine: RequestRow[]; staffId: string; role: "engineer" | "admin" }) {
  const admin = role === "admin";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const all = [...mine, ...open.filter(r => r.status === "new" && r.engineer_id !== staffId)];
  const seen = new Set<string>();
  const decks = all.filter(r => !seen.has(r.id) && seen.add(r.id));
  return <section className="container py-12">
    <div className="flex flex-wrap gap-5 justify-between"><div><p className="text-sm text-text-muted">Staff workspace · {role}</p><h1 className="text-3xl font-semibold mt-2">Quotation desk</h1><p className="mt-3">Queue {open.filter(r => r.status === "new").length} open · {mine.length} assigned to you</p></div><Link className="underline self-center" href="/dashboard/buildings">Buildings workspace →</Link></div>
    {decks.length === 0 ? <p className="mt-8">No requests waiting. New quotation requests from customers appear here.</p>
      : <ul className="mt-8 space-y-6">{decks.map(request => <RequestCard key={request.id} request={request} staffId={staffId} admin={admin} selected={selectedId === request.id} onSelect={() => setSelectedId(current => current === request.id ? null : request.id)} />)}</ul>}
  </section>;
}