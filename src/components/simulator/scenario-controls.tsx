"use client";
import { useState, useTransition } from "react";
import { z } from "zod";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { localScenarioSchema, snapshotSchema, type LocalScenario, type SimulationSnapshot } from "@/lib/simulation";
import type { CloudIdentity } from "@/lib/cloud-building";
import { saveSimulation } from "@/app/dashboard/simulations/actions";
import { ScenarioComparison } from "./scenario-comparison";
import { ReportDownload } from "./report-download";

const KEY = "caldriva-solar-scenarios-v1";
export function ScenarioControls({ snapshot, identity, onRestore }: {
  snapshot: SimulationSnapshot | null;
  identity: CloudIdentity | null;
  onRestore: (s: SimulationSnapshot, keepCloud: boolean) => void;
}) {
  const [name, setName] = useState(snapshot?.name ?? "Scenario 1");
  const [entries, setEntries] = useState<LocalScenario[]>([]);
  const [message, setMessage] = useState("");
  const [busy, start] = useTransition();
  const candidate = snapshot ? snapshotSchema.safeParse({ ...snapshot, name }) : null;
  const ready = candidate?.success ? candidate.data : null;
  function readLocal() {
    const raw = localStorage.getItem(KEY);
    if (raw && raw.length > 2_000_000) throw new Error("Local scenario collection is too large.");
    return raw ? z.array(localScenarioSchema).max(20).parse(JSON.parse(raw)) : [];
  }
  function saveLocal() {
    if (!ready) return;
    try {
      const all = readLocal();
      if (all.length >= 20) { setMessage("Local storage is limited to 20 scenarios. Delete one before saving."); return; }
      const next = [...all, { id: crypto.randomUUID(), snapshot: ready }];
      localStorage.setItem(KEY, JSON.stringify(next)); setEntries(next);
      setMessage("Scenario saved in this browser, including inputs, results and assumptions.");
    } catch { setMessage("Local scenarios could not be saved. Existing data was not overwritten."); }
  }
  function saveCloud() {
    if (!ready || !identity) return;
    start(async () => {
      try {
        const response = await saveSimulation({ identity, snapshot: ready });
        if (response.error) setMessage(response.error);
        else if (response.data) {
          // Do not restore an older building over edits made while the network request was pending.
          setMessage("Cloud scenario saved with refreshed PVGIS results. Open the saved-scenarios page to view its exact snapshot.");
        }
      } catch { setMessage("Cloud save failed. The current estimate is preserved."); }
    });
  }
  return <section className="border rounded-xl bg-surface p-5">
    <h2 className="font-semibold text-xl">Scenarios & reports</h2>
    <p className="text-sm text-text-muted mt-3">Save an immutable snapshot, reopen it later, or compare alternatives. Cloud saving refreshes production with PVGIS on the server before saving.</p>
    <div className="my-5 max-w-md"><Input label="Scenario name" value={name} maxLength={100} onChange={e => setName(e.target.value)} /></div>
    <div className="flex flex-wrap gap-3">
      <Button disabled={!ready} onClick={saveLocal}>Save scenario locally</Button>
      <Button variant="outline" onClick={() => { try { setEntries(readLocal()); setMessage("Local scenarios loaded."); } catch { setMessage("Local scenarios could not be read. Existing data is unchanged."); } }}>Load local scenarios</Button>
      <Button disabled={!ready || !identity} loading={busy} onClick={saveCloud}>Save cloud scenario</Button>
      {ready && <ReportDownload snapshot={ready} />}
    </div>
    {!identity && <p className="text-sm text-text-muted mt-3">Save or open a cloud building to enable cloud scenarios.</p>}
    {!ready && <p className="text-sm text-text-muted mt-3">Run a valid solar estimate and enter a scenario name to save or export.</p>}
    {identity && <Link className="inline-block underline mt-4" href={`/dashboard/simulations?building=${identity.id}`}>View saved cloud scenarios →</Link>}
    <p role="status" className="mt-4">{message}</p>
    {entries.length > 0 && <>
      <ul className="space-y-3 mt-5">{entries.map(e => <li key={e.id} className="border rounded-lg p-3 flex flex-wrap gap-4 items-center">
        <span className="flex-1 break-words">{e.snapshot.name} · {e.snapshot.building.name}</span>
        <Button variant="outline" size="sm" onClick={() => { onRestore(e.snapshot, false); setName(e.snapshot.name); setMessage("Local scenario reopened. Its original input and result snapshot is displayed."); }}>Reopen {e.snapshot.name}</Button>
        <Button variant="outline" size="sm" onClick={() => { try { const next = readLocal().filter(s => s.id !== e.id); localStorage.setItem(KEY, JSON.stringify(next)); setEntries(next); } catch { setMessage("Could not delete local scenario."); } }}>Delete {e.snapshot.name}</Button>
      </li>)}</ul>
      <ScenarioComparison entries={entries} />
    </>}
  </section>;
}
