"use client";
import { useState } from "react";
import { financialScenario } from "@/lib/solar";
import type { SimulationSnapshot } from "@/lib/simulation";

export function ScenarioComparison({ entries }: { entries: { id: string; snapshot: SimulationSnapshot }[] }) {
  const [selection, setSelection] = useState<string[]>([]);
  const selected = entries.filter(e => selection.includes(e.id));
  const comparable = selected.every(e => e.snapshot.building.solar.latitude === selected[0]?.snapshot.building.solar.latitude && e.snapshot.building.solar.longitude === selected[0]?.snapshot.building.solar.longitude);
  const format = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  return <section className="mt-6 border rounded-xl p-5 bg-surface"><h2 className="font-semibold text-xl">Compare scenarios</h2><p className="text-sm text-text-muted my-3">Choose two to four scenarios at the same coordinates. Financial assumptions and calculation versions are shown separately; different versions may not be directly comparable.</p><div className="flex flex-wrap gap-4">{entries.map(e => <label key={e.id} className="flex items-center gap-2"><input type="checkbox" checked={selection.includes(e.id)} disabled={!selection.includes(e.id) && selection.length >= 4} onChange={event => setSelection(ids => event.target.checked ? [...ids, e.id] : ids.filter(id => id !== e.id))} />{e.snapshot.name}</label>)}</div>{selected.length >= 2 && !comparable && <p role="alert" className="mt-4">These scenarios have different locations. Select scenarios for the same site.</p>}{selected.length >= 2 && comparable && <div className="overflow-x-auto mt-5" role="region" aria-label="Scenario comparison table" tabIndex={0}><table className="w-full text-sm text-left"><caption className="sr-only">Solar production and financial assumption comparison</caption><thead><tr><th className="p-3 border-b">Metric</th>{selected.map(e => <th scope="col" key={e.id} className="p-3 border-b min-w-40">{e.snapshot.name}</th>)}</tr></thead><tbody>{[
    ["Calculation version", (s: SimulationSnapshot) => s.result.engineVersion],
    ["Resource database", (s: SimulationSnapshot) => s.result.database],
    ["Panel count", (s: SimulationSnapshot) => String(s.building.solar.panels)],
    ["Capacity (kWp)", (s: SimulationSnapshot) => format(s.result.capacityKwp)],
    ["Annual production (kWh)", (s: SimulationSnapshot) => format(s.result.annualKwh)],
    ["Tilt / compass azimuth (°)", (s: SimulationSnapshot) => `${s.building.solar.tilt} / ${s.building.solar.azimuth}`],
    ["Annual consumption (kWh)", (s: SimulationSnapshot) => format(s.building.finance.consumption)],
    ["Assumed self-use (%)", (s: SimulationSnapshot) => format(s.building.finance.selfConsumption)],
    ["Import / export tariff (€/kWh)", (s: SimulationSnapshot) => `${format(s.building.finance.importTariff)} / ${format(s.building.finance.exportTariff)}`],
    ["Installed cost / annual maintenance (€)", (s: SimulationSnapshot) => `${format(s.building.finance.capex)} / ${format(s.building.finance.annualOpex)}`],
    ["Net annual saving (€)", (s: SimulationSnapshot) => format(financialScenario(s.result.annualKwh, s.building.finance).netSavings)],
    ["Simple payback (years)", (s: SimulationSnapshot) => { const p = financialScenario(s.result.annualKwh, s.building.finance).payback; return p === null ? "No positive saving" : format(p); }],
  ].map(([label, get]) => <tr key={label as string}><th scope="row" className="p-3 border-b">{label as string}</th>{selected.map(e => <td key={e.id} className="p-3 border-b tabular-nums">{(get as (s: SimulationSnapshot) => string)(e.snapshot)}</td>)}</tr>)}</tbody></table></div>}</section>;
}
