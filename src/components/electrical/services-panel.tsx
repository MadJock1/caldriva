"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  APPLIANCES,
  addCommonLoad,
  loadTotals,
  removeCommonLoad,
  updateCommonLoad,
  updateService,
  formatWatts,
  type ApplianceKind,
  type ElectricalBuilding,
} from "@/lib/electrical";

export function ServicesPanel({ building, onChange }: { building: ElectricalBuilding; onChange: (b: ElectricalBuilding) => void }) {
  const [kind, setKind] = useState<ApplianceKind>("lift");
  const service = building.service;
  return (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-3">Supply & diversity</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="text-sm font-medium">Supply type
            <select className="block w-full mt-2 border border-border bg-surface rounded-lg p-2.5" value={service.supplyType} onChange={e => onChange(updateService(building, { supplyType: e.target.value as "single" | "three", phases: e.target.value === "single" ? 1 : 3, voltageV: e.target.value === "single" ? 230 : 400 }))}>
              <option value="three">Three-phase</option>
              <option value="single">Single-phase</option>
            </select>
          </label>
          <Input label="Nominal voltage (V)" type="number" min={120} max={1000} value={service.voltageV} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(updateService(building, { voltageV: n })); }} />
          <Input label="Apartment diversity" type="number" min={0.1} max={1} step={0.05} value={service.apartmentDiversity} helperText="Applied to apartment + floor-shared loads." onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(updateService(building, { apartmentDiversity: Math.min(1, Math.max(0.1, n)) })); }} />
          <Input label="Building diversity" type="number" min={0.1} max={1} step={0.05} value={service.buildingDiversity} helperText="Applied to common services." onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(updateService(building, { buildingDiversity: Math.min(1, Math.max(0.1, n)) })); }} />
          <Input label="Design margin" type="number" min={0} max={1} step={0.05} value={service.designMargin} helperText="Added to the diversified demand." onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(updateService(building, { designMargin: Math.min(1, Math.max(0, n)) })); }} />
        </div>
        <p className="text-xs text-text-muted mt-3">Diversity and margin are explicit, editable planning factors — not a substitute for a rules-based calculation.</p>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-3">Common services (building level)</h3>
        {building.commonLoads.length === 0 && <p className="text-sm text-text-muted mb-3">No common loads. Add lifts, pumps, HVAC, EV charging or technical equipment.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-xs text-text-muted"><th className="p-2">Item</th><th className="p-2">Qty</th><th className="p-2">Rated W</th><th className="p-2">Type</th><th className="p-2 text-right">Demand</th><th className="p-2" /></tr></thead>
            <tbody>
              {building.commonLoads.map(load => (
                <tr key={load.id} className="border-t border-border/60">
                  <td className="p-1.5"><Input aria-label="Name" value={load.name} maxLength={120} onChange={e => onChange(updateCommonLoad(building, { ...load, name: e.target.value }))} className="h-9" /></td>
                  <td className="p-1.5 w-24"><Input aria-label="Quantity" type="number" min={0} max={10000} value={load.quantity} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(updateCommonLoad(building, { ...load, quantity: Math.max(0, Math.min(10000, Math.round(n))) })); }} className="h-9" /></td>
                  <td className="p-1.5 w-28"><Input aria-label="Rated watts" type="number" min={0} value={load.ratedWatts} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(updateCommonLoad(building, { ...load, ratedWatts: Math.max(0, n) })); }} className="h-9" /></td>
                  <td className="p-1.5 text-text-muted">{APPLIANCES[load.kind].label}</td>
                  <td className="p-1.5 text-right tabular-nums">{formatWatts(loadTotals(load).demandVA)}</td>
                  <td className="p-1.5"><Button size="sm" variant="ghost" onClick={() => onChange(removeCommonLoad(building, load.id))}>Remove</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <select className="border border-border bg-surface rounded-lg p-2 text-sm" value={kind} onChange={e => setKind(e.target.value as ApplianceKind)}>
            {(Object.keys(APPLIANCES) as ApplianceKind[]).map(k => <option key={k} value={k}>{APPLIANCES[k].label}</option>)}
          </select>
          <Button variant="outline" onClick={() => onChange(addCommonLoad(building, kind))}>Add common load</Button>
        </div>
      </section>
    </div>
  );
}
