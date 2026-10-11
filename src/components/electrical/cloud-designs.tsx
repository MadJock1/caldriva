"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteElectricalDesign, listElectricalDesigns } from "@/app/dashboard/electrical/actions";
import type { ElectricalSummary } from "@/lib/electrical/cloud";
import { Button } from "@/components/ui/button";

export function CloudElectricalDesigns({ initial }: { initial: ElectricalSummary[] }) {
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  return (
    <>
      <p className="text-text-muted my-5">Your latest 100 saved electrical design drafts.</p>
      <Link className="underline" href="/tools/electrical">Create an electrical design →</Link>
      <Button variant="outline" className="ml-5" disabled={busy} onClick={() => start(async () => { try { const response = await listElectricalDesigns(); if (response.error) setMessage(response.error); else if (response.data) { setItems(response.data); setMessage("Design list refreshed."); } } catch { setMessage("Could not refresh. Please retry."); } })}>Refresh</Button>
      <p role="status" className="my-5">{message}</p>
      {!items.length ? (
        <div className="border border-border rounded-xl bg-surface p-8">
          <h2 className="text-xl font-semibold">No cloud designs yet</h2>
          <p className="mt-3 text-text-muted">Open the Auto Electrical Design Studio, generate a building, then choose Save to account.</p>
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-5">
          {items.map(item => (
            <li key={item.id} className="border border-border rounded-xl bg-surface p-6">
              <h2 className="text-xl font-semibold break-words">{item.name}</h2>
              <p className="mt-2 text-sm text-text-muted">Version {item.version} · {item.updated_at.slice(0, 10)}</p>
              <div className="mt-5 flex flex-wrap gap-5 items-center">
                <Link className="underline" href={`/tools/electrical?design=${item.id}`}>Open in studio</Link>
                <Button variant="outline" disabled={busy} onClick={() => { if (!window.confirm(`Delete “${item.name}” from your account? This cannot be undone.`)) return; start(async () => { try { const response = await deleteElectricalDesign({ id: item.id, version: item.version }); if (response.error) setMessage(response.error); else { setItems(list => list.filter(d => d.id !== item.id)); setMessage("Cloud design deleted. Local drafts are unchanged."); } } catch { setMessage("Delete failed. Please retry."); } }); }}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
