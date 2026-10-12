"use client";

import { useMemo } from "react";
import { panelLayout, type LayoutSettings } from "@/lib/panel-layout";
import type { Building } from "@/lib/building";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PanelLayoutView({ building, settings, onChange, onUseCount }: { building: Building; settings: LayoutSettings; onChange: (v: LayoutSettings) => void; onUseCount: (count: number) => void }) {
  const computed = useMemo(() => {
    try { return { layout: panelLayout(building.roof, settings, building.solar.azimuth, building.roofObstacles), error: "" }; }
    catch (error) { return { layout: null, error: error instanceof Error ? error.message : "Invalid layout inputs" }; }
  }, [building.roof, building.roofObstacles, building.solar.azimuth, settings]);
  const layout = computed.layout;
  const bounds = layout?.bounds ?? [0, 0, 1, 1];

  return <section className="bg-surface border rounded-xl p-5">
    <h2 className="font-semibold text-xl">Panel placement</h2>
    <p className="text-sm text-text-muted mt-3">Panels are tested in a compact local metric projection against the confirmed roof boundary and obstacle polygons. Dimensions below are preliminary user inputs, not a verified manufacturer module record.</p>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 my-5">
      {([ ["width", "Module width (m)", .2, 5], ["length", "Module length (m)", .2, 5], ["setback", "Roof boundary setback (m)", .05, 10], ["gap", "Module gap (m)", .01, 2] ] as const).map(([key, label, min, max]) => <Input key={key} label={label} type="number" min={min} max={max} step=".01" value={Number.isFinite(settings[key]) ? settings[key] : ""} onChange={event => onChange({ ...settings, [key]: event.target.valueAsNumber })} />)}
    </div>
    <label className="text-sm">Module arrangement<select className="block bg-surface rounded border p-2 mt-2" value={settings.orientation} onChange={event => onChange({ ...settings, orientation: event.target.value as LayoutSettings["orientation"] })}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
    {computed.error && <p role="alert" className="mt-4 text-error">{computed.error}</p>}
    {layout && <>
      <svg role="img" aria-label={`Preliminary horizontal roof layout with ${layout.panels.length} panels; obstacle-aware metric placement`} className="w-full h-64 my-5 rounded-lg bg-background" viewBox={`${bounds[0] - 1} ${bounds[1] - 1} ${bounds[2] - bounds[0] + 2} ${bounds[3] - bounds[1] + 2}`}>
        <g transform={`translate(0 ${bounds[1] + bounds[3]}) scale(1 -1)`}>
          <polygon points={layout.roof.map(point => point.join(",")).join(" ")} fill="#17364A" stroke="#65DFD0" strokeWidth=".08" />
          {layout.obstacles.map((obstacle, index) => <polygon key={`obstacle-${index}`} points={obstacle.map(point => point.join(",")).join(" ")} fill="#F59E0B" fillOpacity=".6" stroke="#F59E0B" strokeWidth=".05" />)}
          {layout.panels.map((rectangle, index) => <polygon key={index} points={rectangle.map(point => point.join(",")).join(" ")} fill="#65DFD0" fillOpacity=".55" stroke="#0D2032" strokeWidth=".04" />)}
        </g>
      </svg>
      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <p><strong>{layout.panels.length}</strong> accepted panels</p>
        <p><strong>{layout.rejected.outsideRoof}</strong> rejected at roof edge</p>
        <p><strong>{layout.rejected.obstacle}</strong> rejected at obstacle</p>
      </div>
      <p className="text-sm text-text-muted mt-4">{layout.warning}</p>
      <div className="flex flex-wrap items-center gap-4 mt-4"><Button size="sm" onClick={() => onUseCount(layout.panels.length)} disabled={layout.panels.length < 1}>Use layout panel count</Button><span className="text-xs text-text-muted">This replaces the manually entered panel count. It does not confirm module data, tilt, or electrical design.</span></div>
    </>}
  </section>;
}
