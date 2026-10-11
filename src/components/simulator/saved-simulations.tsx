"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { SavedSimulation } from "@/lib/simulation";
import { deleteSimulation } from "@/app/dashboard/simulations/actions";
import { ScenarioComparison } from "./scenario-comparison";
import { ReportDownload } from "./report-download";
import { Button } from "@/components/ui/button";
export function SavedSimulations({ initial }: { initial: SavedSimulation[] }) {
  const [entries, setEntries] = useState(initial), [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  return <><p className="text-text-muted mt-4">Latest 50 saved scenarios for this building. Each snapshot preserves its inputs, assumptions and calculation version. Editing the building does not change saved scenarios.</p><p role="status" className="my-5">{message}</p>{entries.length === 0 ? <p>No simulations saved yet. Open the building, calculate an estimate, then save a cloud scenario.</p> : <><ul className="grid md:grid-cols-2 gap-5">{entries.map(e => <li key={e.id} className="border rounded-xl bg-surface p-5"><h2 className="text-xl font-semibold break-words">{e.snapshot.name}</h2><p className="text-text-muted text-sm my-4">{e.snapshot.result.annualKwh.toLocaleString("en-GB")} kWh/year · {e.snapshot.result.capacityKwp} kWp · {e.snapshot.result.engineVersion}</p><p className="text-sm mb-4">Building version {e.building_version} · Saved {e.created_at.slice(0, 10)}</p><div className="flex flex-wrap items-center gap-4"><Link className="underline" href={`/tools/solar?simulation=${e.id}`}>Reopen scenario</Link><ReportDownload snapshot={e.snapshot} /><Button variant="outline" disabled={busy} onClick={() => { if (!window.confirm(`Delete scenario “${e.snapshot.name}”?`)) return; start(async () => { try { const response = await deleteSimulation(e.id); if (response.error) setMessage(response.error); else { setEntries(items => items.filter(item => item.id !== e.id)); setMessage("Scenario deleted."); } } catch { setMessage("Delete failed. Please retry."); } }); }}>Delete scenario</Button></div></li>)}</ul><ScenarioComparison entries={entries} /></>}</>;
}
