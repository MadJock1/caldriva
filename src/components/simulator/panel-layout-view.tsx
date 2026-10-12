"use client";

import { useMemo } from "react";
import { layoutPanels, type LayoutSettings } from "@/lib/panel-layout";
import { panelCatalogue, type PanelModel } from "@/lib/solar-panel-catalog";
import type { Building } from "@/lib/building";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PanelLayoutView({ building, panelModel, onPanelModel, settings, onChange, onUseCount, countSource }: {
  building: Building;
  panelModel: PanelModel;
  onPanelModel: (id: string) => void;
  settings: LayoutSettings;
  onChange: (v: LayoutSettings) => void;
  onUseCount: () => void;
  countSource: "layout" | "manual";
}) {
  const computed = useMemo(() => {
    try { return { layout: layoutPanels(building.roof, panelModel, { orientation: settings.orientation, setback: settings.setback, gap: settings.gap }, building.solar.azimuth, building.roofObstacles), error: "" }; }
    catch (error) { return { layout: null, error: error instanceof Error ? error.message : "Invalid layout inputs" }; }
  }, [building.roof, building.roofObstacles, building.solar.azimuth, panelModel, settings.orientation, settings.setback, settings.gap]);
  const layout = computed.layout;
  const bounds = layout?.bounds ?? [0, 0, 1, 1];
  const custom = !panelCatalogue.some(model => model.id === panelModel.id);

  return <section className="bg-surface border rounded-xl p-5">
    <h2 className="font-semibold text-xl">Panel placement</h2>
    <p className="text-sm text-text-muted mt-3">Choose a catalogue panel model, then set the arrangement. Module rectangles at the selected dimensions are tested against the confirmed roof boundary and obstacle polygons. Catalogue entries are illustrative and unverified.</p>
    <label className="text-sm block mt-4">Panel model<select className="block w-full mt-2 bg-surface rounded-lg border p-2.5" value={panelModel.id} onChange={event => onPanelModel(event.target.value)}>{custom && <option value={panelModel.id}>{panelModel.label} · {panelModel.watts} Wp (restored)</option>}{panelCatalogue.map(model => <option key={model.id} value={model.id}>{model.label} · {model.watts} Wp · {model.widthM} × {model.lengthM} m · unverified</option>)}</select></label>
    {!panelModel.verified && <p role="alert" className="mt-3 rounded-lg border border-warning bg-warning-muted p-3 text-sm">Unverified panel model. This is an illustrative reference, not a confirmed manufacturer datasheet. Confirm dimensions, power and datasheet values before design or procurement.</p>}
    <div className="grid sm:grid-cols-3 gap-4 my-5">
      {([ ["setback", "Roof boundary setback (m)", .05, 10], ["gap", "Module gap (m)", .01, 2] ] as const).map(([key, label, min, max]) => <Input key={key} label={label} type="number" min={min} max={max} step=".01" value={Number.isFinite(settings[key]) ? settings[key] : ""} onChange={event => onChange({ ...settings, [key]: event.target.valueAsNumber })} />)}
      <label className="text-sm">Module arrangement<select className="block w-full mt-2 bg-surface rounded-lg border p-2.5" value={settings.orientation} onChange={event => onChange({ ...settings, orientation: event.target.value as LayoutSettings["orientation"] })}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
    </div>
    {computed.error && <p role="alert" className="mt-4 text-error">{computed.error}</p>}
    {layout && <>
      <svg role="img" aria-label={`Preliminary horizontal roof layout with ${layout.count} panels; obstacle-aware metric placement`} className="w-full h-64 my-5 rounded-lg bg-background" viewBox={`${bounds[0] - 1} ${bounds[1] - 1} ${bounds[2] - bounds[0] + 2} ${bounds[3] - bounds[1] + 2}`}>
        <g transform={`translate(0 ${bounds[1] + bounds[3]}) scale(1 -1)`}>
          <polygon points={layout.roof.map(point => point.join(",")).join(" ")} fill="#17364A" stroke="#65DFD0" strokeWidth=".08" />
          {layout.obstacles.map((obstacle, index) => <polygon key={`obstacle-${index}`} points={obstacle.map(point => point.join(",")).join(" ")} fill="#F59E0B" fillOpacity=".6" stroke="#F59E0B" strokeWidth=".05" />)}
          {layout.panels.map((rectangle, index) => <polygon key={index} points={rectangle.map(point => point.join(",")).join(" ")} fill="#65DFD0" fillOpacity=".55" stroke="#0D2032" strokeWidth=".04" />)}
        </g>
      </svg>
      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <p><strong>{layout.count}</strong> accepted panels</p>
        <p><strong>{layout.kwp.toFixed(2)}</strong> kWp from this layout</p>
        <p><strong>{layout.rejected.outsideRoof + layout.rejected.obstacle}</strong> candidates rejected</p>
      </div>
      <p className="text-sm text-text-muted mt-4">{layout.warning}</p>
      <div className="flex flex-wrap items-center gap-4 mt-4"><Button size="sm" onClick={onUseCount} disabled={layout.count < 1 || countSource === "layout"}>Use layout panel count</Button><span className="text-xs text-text-muted">{countSource === "layout" ? "Panel count and capacity currently follow this layout." : "This replaces the manually entered panel count. It does not confirm module data, tilt, or electrical design."}</span></div>
    </>}
  </section>;
}
