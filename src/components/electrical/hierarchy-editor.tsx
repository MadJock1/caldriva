"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  APPLIANCES,
  PHASES,
  addLoadToRoom,
  apartmentTemplateIds,
  loadTotals,
  reTemplateApartment,
  removeLoadFromRoom,
  replaceLoadInRoom,
  updateFloorSharedLoad,
  withApartment,
  withFloor,
  withoutApartment,
  withoutFloor,
  formatWatts,
  type ApartmentTemplateId,
  type ApplianceKind,
  type ElectricalBuilding,
  type LoadItem,
  type Phase,
} from "@/lib/electrical";

function ApplianceSelect({ value, onChange, id }: { value: ApplianceKind; onChange: (kind: ApplianceKind) => void; id?: string }) {
  return (
    <select id={id} className="border border-border bg-surface rounded-lg p-2 text-sm" value={value} onChange={e => onChange(e.target.value as ApplianceKind)}>
      {(Object.keys(APPLIANCES) as ApplianceKind[]).map(kind => <option key={kind} value={kind}>{APPLIANCES[kind].label}</option>)}
    </select>
  );
}

function LoadRow({ load, onUpdate, onRemove }: { load: LoadItem; onUpdate: (load: LoadItem) => void; onRemove: () => void }) {
  const totals = loadTotals(load);
  return (
    <tr className="border-t border-border/60">
      <td className="p-1.5"><Input aria-label="Load name" value={load.name} maxLength={120} onChange={e => onUpdate({ ...load, name: e.target.value })} className="h-9" /></td>
      <td className="p-1.5 w-24"><Input aria-label="Quantity" type="number" min={0} max={10000} value={Number.isFinite(load.quantity) ? load.quantity : ""} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onUpdate({ ...load, quantity: Math.max(0, Math.min(10000, Math.round(n))) }); }} className="h-9" /></td>
      <td className="p-1.5 w-28"><Input aria-label="Rated watts" type="number" min={0} max={10000000} value={Number.isFinite(load.ratedWatts) ? load.ratedWatts : ""} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onUpdate({ ...load, ratedWatts: Math.max(0, n) }); }} className="h-9" /></td>
      <td className="p-1.5 w-24">
        <select aria-label="Phase" className="border border-border bg-surface rounded-lg p-2 text-sm w-full" value={load.phase ?? "auto"} onChange={e => onUpdate({ ...load, phase: e.target.value === "auto" ? null : (e.target.value as Phase) })}>
          <option value="auto">Auto</option>
          {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </td>
      <td className="p-1.5 text-right tabular-nums text-text-muted whitespace-nowrap">{totals.demandW.toFixed(0)} W</td>
      <td className="p-1.5"><Button size="sm" variant="ghost" aria-label={`Remove ${load.name}`} onClick={onRemove}>Remove</Button></td>
    </tr>
  );
}

function RoomCard({ building, floorId, apartmentId, room, onChange }: { building: ElectricalBuilding; floorId: string; apartmentId: string; room: ElectricalBuilding["floors"][number]["apartments"][number]["rooms"][number]; onChange: (b: ElectricalBuilding) => void }) {
  const [newKind, setNewKind] = useState<ApplianceKind>("socket");
  const totals = room.loads.reduce((acc, load) => { const t = loadTotals(load); return { w: acc.w + t.demandW, va: acc.va + t.demandVA }; }, { w: 0, va: 0 });
  return (
    <div className="border border-border rounded-lg bg-background p-3">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <strong className="text-sm">{room.name}</strong>
        <span className="text-xs text-text-muted">{formatWatts(totals.va)} demand · {room.loads.length} item(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-left text-xs text-text-muted"><th className="p-1.5">Item</th><th className="p-1.5">Qty</th><th className="p-1.5">Rated W</th><th className="p-1.5">Phase</th><th className="p-1.5 text-right">Demand</th><th className="p-1.5" /></tr></thead>
          <tbody>
            {room.loads.map(load => (
              <LoadRow key={load.id} load={load} onUpdate={l => onChange(replaceLoadInRoom(building, floorId, apartmentId, room.id, l))} onRemove={() => onChange(removeLoadFromRoom(building, floorId, apartmentId, room.id, load.id))} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <ApplianceSelect value={newKind} onChange={setNewKind} />
        <Button size="sm" variant="outline" onClick={() => onChange(addLoadToRoom(building, floorId, apartmentId, room.id, newKind))}>Add appliance</Button>
      </div>
    </div>
  );
}

function ApartmentCard({ building, floorId, apartment, onChange }: { building: ElectricalBuilding; floorId: string; apartment: ElectricalBuilding["floors"][number]["apartments"][number]; onChange: (b: ElectricalBuilding) => void }) {
  const demand = apartment.rooms.flatMap(r => r.loads).reduce((n, l) => n + loadTotals(l).demandVA, 0);
  return (
    <details className="border border-border rounded-lg bg-surface">
      <summary className="cursor-pointer p-3 flex flex-wrap justify-between gap-2 items-center">
        <span className="font-medium">{apartment.code} · {apartment.label}</span>
        <span className="text-xs text-text-muted">{apartment.rooms.length} rooms · {formatWatts(demand)} demand · {apartment.templateId}</span>
      </summary>
      <div className="p-3 border-t border-border space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">Template
            <select className="ml-2 border border-border bg-surface rounded-lg p-2 text-sm" value={apartment.templateId} onChange={e => onChange(reTemplateApartment(building, floorId, apartment.id, e.target.value as ApartmentTemplateId))}>
              {apartmentTemplateIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <Button size="sm" variant="ghost" onClick={() => onChange(withoutApartment(building, floorId, apartment.id))}>Remove apartment</Button>
        </div>
        <p className="text-xs text-text-muted">Re-templating replaces this apartment&apos;s rooms and loads with the template.</p>
        {apartment.rooms.map(room => (
          <RoomCard key={room.id} building={building} floorId={floorId} apartmentId={apartment.id} room={room} onChange={onChange} />
        ))}
      </div>
    </details>
  );
}

export function HierarchyEditor({ building, onChange }: { building: ElectricalBuilding; onChange: (b: ElectricalBuilding) => void }) {
  const [newTemplate, setNewTemplate] = useState<ApartmentTemplateId>("T2");
  return (
    <div className="space-y-5">
      {building.floors.length === 0 && <p className="text-sm text-text-muted">No floors yet. Generate a building from the brief or add a floor below.</p>}
      {[...building.floors].sort((a, b) => b.level - a.level).map(floor => (
        <section key={floor.id} className="bg-surface border border-border rounded-xl p-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <strong className="text-lg">{floor.code} · {floor.name}</strong>
              <p className="text-xs text-text-muted">{floor.kind} · level {floor.level} · {floor.apartments.length} apartment(s) · {floor.sharedLoads.length} shared load(s)</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onChange(withoutFloor(building, floor.id))}>Remove floor</Button>
          </div>

          {floor.sharedLoads.length > 0 && (
            <div className="mt-3 border border-border rounded-lg bg-background p-3">
              <p className="text-sm font-medium mb-2">Shared loads</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <tbody>
                    {floor.sharedLoads.map(load => (
                      <LoadRow key={load.id} load={load} onUpdate={l => onChange(updateFloorSharedLoad(building, floor.id, l))} onRemove={() => onChange(updateFloorSharedLoad(building, floor.id, { ...load, quantity: 0 }))} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-3 space-y-2">
            {floor.apartments.map(apartment => (
              <ApartmentCard key={apartment.id} building={building} floorId={floor.id} apartment={apartment} onChange={onChange} />
            ))}
          </div>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => onChange(withApartment(building, floor.id, newTemplate))}>Add apartment ({newTemplate})</Button>
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-3 bg-surface border border-border rounded-xl p-4">
        <label className="text-sm font-medium">New floor template
          <select className="ml-2 border border-border bg-surface rounded-lg p-2 text-sm" value={newTemplate} onChange={e => setNewTemplate(e.target.value as ApartmentTemplateId)}>
            {apartmentTemplateIds.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <Button onClick={() => onChange(withFloor(building, newTemplate))}>Add floor</Button>
      </div>
    </div>
  );
}
