"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  apartmentTemplateIds,
  defaultCommonBrief,
  uniformBrief,
  type ApartmentTemplateId,
  type BuildingBrief,
  type CommonBrief,
} from "@/lib/electrical";

const categories: BuildingBrief["category"][] = ["residential", "mixed_use", "commercial", "industrial"];

type Local = {
  name: string;
  country: string;
  jurisdiction: string;
  category: BuildingBrief["category"];
  basementLevels: number;
  includeGround: boolean;
  groundApartmentCount: number;
  groundTemplate: ApartmentTemplateId;
  upperFloors: number;
  apartmentsPerFloor: number;
  template: ApartmentTemplateId;
  common: CommonBrief;
};

const initial: Local = {
  name: "Residential block",
  country: "Portugal",
  jurisdiction: "Portugal - low-voltage installations (RTIEBT scope)",
  category: "residential",
  basementLevels: 0,
  includeGround: true,
  groundApartmentCount: 4,
  groundTemplate: "T2",
  upperFloors: 5,
  apartmentsPerFloor: 4,
  template: "T2",
  common: { ...defaultCommonBrief },
};

function Int({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <Input label={label} type="number" min={min} max={max} value={value} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n)))); }} />
  );
}

export function BriefPanel({ onGenerate }: { onGenerate: (brief: BuildingBrief) => void }) {
  const [form, setForm] = useState<Local>(initial);
  function set<K extends keyof Local>(key: K, value: Local[K]) { setForm(f => ({ ...f, [key]: value })); }
  function setCommon<K extends keyof CommonBrief>(key: K, value: CommonBrief[K]) { setForm(f => ({ ...f, common: { ...f.common, [key]: value } })); }
  function submit() {
    onGenerate(uniformBrief({
      name: form.name,
      country: form.country,
      jurisdiction: form.jurisdiction,
      category: form.category,
      basementLevels: form.basementLevels,
      includeGround: form.includeGround,
      upperFloors: form.upperFloors,
      apartmentsPerFloor: form.apartmentsPerFloor,
      template: form.template,
      groundTemplate: form.groundTemplate,
      groundApartmentCount: form.groundApartmentCount,
      common: form.common,
    }));
  }
  const templateSelect = (value: ApartmentTemplateId, onChange: (v: ApartmentTemplateId) => void, label: string) => (
    <label className="text-sm font-medium">{label}
      <select className="block w-full mt-2 border border-border bg-surface rounded-lg p-2.5" value={value} onChange={e => onChange(e.target.value as ApartmentTemplateId)}>
        {apartmentTemplateIds.map(id => <option key={id} value={id}>{id}</option>)}
      </select>
    </label>
  );
  return (
    <div className="space-y-6">
      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-4">Project</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="Building name" value={form.name} maxLength={150} onChange={e => set("name", e.target.value)} />
          <Input label="Country" value={form.country} maxLength={80} onChange={e => set("country", e.target.value)} />
          <label className="text-sm font-medium">Category
            <select className="block w-full mt-2 border border-border bg-surface rounded-lg p-2.5" value={form.category} onChange={e => set("category", e.target.value as BuildingBrief["category"])}>
              {categories.map(c => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2 lg:col-span-3"><Input label="Jurisdiction / regulatory scope" value={form.jurisdiction} maxLength={120} onChange={e => set("jurisdiction", e.target.value)} helperText="Used for labelling only. No automatic compliance is claimed." /></div>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-4">Layout</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Int label="Basement levels" value={form.basementLevels} min={0} max={6} onChange={n => set("basementLevels", n)} />
          <Int label="Upper floors" value={form.upperFloors} min={0} max={60} onChange={n => set("upperFloors", n)} />
          <Int label="Apartments per floor" value={form.apartmentsPerFloor} min={0} max={60} onChange={n => set("apartmentsPerFloor", n)} />
          {templateSelect(form.template, v => set("template", v), "Typical apartment template")}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <label className="flex items-center gap-2 text-sm font-medium mt-6"><input type="checkbox" checked={form.includeGround} onChange={e => set("includeGround", e.target.checked)} /> Include ground floor</label>
          <Int label="Ground-floor apartments" value={form.groundApartmentCount} min={0} max={60} onChange={n => set("groundApartmentCount", n)} />
          {templateSelect(form.groundTemplate, v => set("groundTemplate", v), "Ground-floor template")}
        </div>
      </section>

      <section className="bg-surface border border-border rounded-xl p-5">
        <h3 className="font-semibold text-lg mb-4">Common services</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Int label="Lifts" value={form.common.lifts} min={0} max={50} onChange={n => setCommon("lifts", n)} />
          <Int label="EV chargers" value={form.common.evChargers} min={0} max={500} onChange={n => setCommon("evChargers", n)} />
          <Int label="Technical rooms" value={form.common.technicalRooms} min={0} max={50} onChange={n => setCommon("technicalRooms", n)} />
        </div>
        <div className="flex flex-wrap gap-5 mt-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.common.sharedLightingPerFloor} onChange={e => setCommon("sharedLightingPerFloor", e.target.checked)} /> Shared-area lighting per floor</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.common.waterPump} onChange={e => setCommon("waterPump", e.target.checked)} /> Water booster pump</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.common.hvac} onChange={e => setCommon("hvac", e.target.checked)} /> Central HVAC unit</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.common.garage} onChange={e => setCommon("garage", e.target.checked)} /> Garage general loads</label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit}>Generate building</Button>
        <p className="text-sm text-text-muted">Generating replaces the current building with an editable hierarchy and preliminary load schedule.</p>
      </div>
    </div>
  );
}
