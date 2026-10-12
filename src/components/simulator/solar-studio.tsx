"use client";
import dynamic from "next/dynamic";
import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildingSchema, horizontalRoofArea, initialBuilding, type Building, type MapPoint } from "@/lib/building";
import { financialScenario, solarInputSchema, solarResultSchema, type SolarResult, type SolarInput, type FinanceInput } from "@/lib/solar";
import { CloudDraftControls } from "@/components/building/cloud-draft-controls";
import type { CloudIdentity } from "@/lib/cloud-building";
import { ScenarioControls } from "./scenario-controls";
import { PanelLayoutView } from "./panel-layout-view";
import { Logo } from "@/components/brand/logo";
import { defaultLayout, layoutPanels, type LayoutSettings } from "@/lib/panel-layout";
import { panelModelById, defaultPanelModelId, PANEL_CATALOGUE_DISCLAIMER, type PanelModel } from "@/lib/solar-panel-catalog";
import { migratedSnapshotSchema, assumptions, panelModelFromSelection, type SimulationSnapshot } from "@/lib/simulation";
import { AddressAutocomplete } from "./address-autocomplete";
import { geocodedAddressSchema, type GeocodedAddress } from "@/lib/geocoding";

const RoofMap = dynamic(() => import("@/components/map/roof-map"), { ssr: false, loading: () => <div className="h-[430px] grid place-items-center bg-background" role="status">Loading map…</div> });
const KEY = "caldriva-building-v1";
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const number = (n: number, decimals = 0) => n.toLocaleString("en-GB", { maximumFractionDigits: decimals });

type Step = "address" | "confirm" | "roof" | "system" | "finance" | "results";

export function SolarStudio({ cloudDraft, initialScenario }: { cloudDraft?: { draft: Building; identity: CloudIdentity }; initialScenario?: SimulationSnapshot }) {
  const initialModel: PanelModel = initialScenario?.panel
    ? panelModelById(initialScenario.panel.panelModelId) ?? { id: initialScenario.panel.panelModelId, label: initialScenario.panel.label, watts: initialScenario.panel.watts, widthM: initialScenario.panel.widthM, lengthM: initialScenario.panel.lengthM, verified: initialScenario.panel.verified, provenance: "Restored snapshot panel record." }
    : panelModelById(defaultPanelModelId)!;
  const [building, setBuilding] = useState<Building>(initialScenario?.building ?? cloudDraft?.draft ?? initialBuilding);
  const [layout, setLayout] = useState<LayoutSettings>(initialScenario?.layout ?? { ...defaultLayout, width: initialModel.widthM, length: initialModel.lengthM });
  const [panelModel, setPanelModel] = useState<PanelModel>(initialModel);
  const [countSource, setCountSource] = useState<"layout" | "manual">(initialScenario?.panel?.countSource ?? "layout");
  const [savedAssumptions, setSavedAssumptions] = useState<string[]>(initialScenario?.assumptions ?? [...assumptions]);
  const [identity, setIdentity] = useState<CloudIdentity | null>(cloudDraft?.identity ?? null);
  const [step, setStep] = useState<Step>(initialScenario ? "roof" : "address");
  const [mode, setMode] = useState<"locate" | "roof" | "obstacle">("locate");
  const [pendingObstacle, setPendingObstacle] = useState<MapPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<{ input: SolarInput; result: SolarResult } | null>(initialScenario ? { input: initialScenario.building.solar, result: initialScenario.result } : null);
  const center = useMemo<MapPoint>(() => [building.solar.latitude, building.solar.longitude], [building.solar.latitude, building.solar.longitude]);
  const validCenter = Number.isFinite(center[0]) && Number.isFinite(center[1]) && Math.abs(center[0]) <= 90 && Math.abs(center[1]) <= 180;
  const geometry = useMemo(() => { try { return { area: horizontalRoofArea(building.roof), error: "" }; } catch (e) { return { area: 0, error: e instanceof Error ? e.message : "Invalid roof" }; } }, [building.roof]);
  const layoutResult = useMemo(() => {
    try { return { result: layoutPanels(building.roof, panelModel, { orientation: layout.orientation, setback: layout.setback, gap: layout.gap }, building.solar.azimuth, building.roofObstacles), error: "" }; }
    catch (e) { return { result: null, error: e instanceof Error ? e.message : "Invalid layout inputs" }; }
  }, [building.roof, building.roofObstacles, building.solar.azimuth, panelModel, layout.orientation, layout.setback, layout.gap]);
  const layoutCount = layoutResult.result?.count ?? 0;
  const layoutKwp = layoutCount * panelModel.watts / 1000;
  const effectiveSolar: SolarInput = countSource === "layout" ? { ...building.solar, panels: layoutCount, panelWatts: panelModel.watts } : building.solar;
  const effectiveBuilding: Building = { ...building, solar: effectiveSolar };
  const current = snapshot && JSON.stringify(snapshot.input) === JSON.stringify(effectiveSolar);
  const result = current ? snapshot.result : null;
  const report = result ? migratedSnapshotSchema.safeParse({ schemaVersion: 2, name: initialScenario?.name ?? "Solar scenario", building: effectiveBuilding, layout, panel: { panelModelId: panelModel.id, label: panelModel.label, widthM: panelModel.widthM, lengthM: panelModel.lengthM, watts: panelModel.watts, verified: panelModel.verified, layoutCount, countSource }, result, assumptions: savedAssumptions }) : null;

  const choosePanel = useCallback((id: string) => {
    const model = panelModelById(id);
    if (!model) return;
    setPanelModel(model);
    setLayout(l => ({ ...l, width: model.widthM, length: model.lengthM }));
    setMessage(`Panel model set to ${model.label}.${model.verified ? "" : " This model is unverified; confirm its datasheet before design or procurement."}`);
  }, []);

  function restoreScenario(s: SimulationSnapshot) {
    setBuilding(s.building); setLayout(s.layout); setSavedAssumptions(s.assumptions);
    setPanelModel(panelModelFromSelection(s.panel)); setCountSource(s.panel.countSource);
    setSnapshot({ input: s.building.solar, result: s.result });
    setIdentity(null);
    setStep("roof");
  }

  let finance: ReturnType<typeof financialScenario> | null = null;
  try { if (result) finance = financialScenario(result.annualKwh, building.finance); } catch { /* Editable input can be temporarily incomplete. */ }

  const setSolar = useCallback((key: keyof SolarInput, value: number | string) => setBuilding(b => ({ ...b, solar: { ...b.solar, [key]: value } })), []);
  const setFinance = useCallback((key: keyof FinanceInput, value: number) => setBuilding(b => ({ ...b, finance: { ...b.finance, [key]: value } })), []);

  const handleAddressSelect = useCallback((address: GeocodedAddress) => {
    const parsed = geocodedAddressSchema.safeParse(address);
    if (!parsed.success) { setError("Invalid address data."); return; }
    setBuilding(b => ({
      ...b,
      address: parsed.data.formattedAddress,
      geocodedAddress: parsed.data,
      solar: { ...b.solar, latitude: parsed.data.latitude, longitude: parsed.data.longitude },
      locationConfirmed: false,
      locationSource: "address",
    }));
    setMessage(() => {
      const base = `Address found: ${parsed.data.formattedAddress}`;
      return parsed.data.resultType !== "building" ? `${base} · Please confirm the exact building location on the map.` : base;
    });
    setStep("address");
  }, []);

  function persist(load: boolean) {
    setError(""); setMessage("");
    try {
      if (load) {
        const saved = localStorage.getItem(KEY);
        if (!saved) { setMessage("No draft saved in this browser yet."); return; }
        setBuilding(buildingSchema.parse(JSON.parse(saved))); setSnapshot(null); setIdentity(null); setStep("address");
      } else {
        if (geometry.error) throw new Error(geometry.error);
        localStorage.setItem(KEY, JSON.stringify(buildingSchema.parse(building)));
      }
      setMessage(load ? "Local draft reopened. Run a new solar estimate." : "Draft saved on this browser only. This is not a cloud backup.");
    } catch { setError("Could not save or reopen this draft. Check the inputs and browser storage permissions. Existing saved data was not removed."); }
  }

  async function simulate() {
    setError(""); setMessage("");
    const parsed = solarInputSchema.safeParse(effectiveSolar);
    if (!parsed.success) { setError("Complete all solar inputs within the displayed limits."); return; }
    setBusy(true); setSnapshot(null);
    try {
      const response = await fetch("/api/solar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Solar request failed.");
      setSnapshot({ input: parsed.data, result: solarResultSchema.parse(data) });
      setSavedAssumptions([...assumptions]);
      setMessage("PVGIS estimate received. Review the assumptions below.");
      setStep("results");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to retrieve a solar estimate."); }
    finally { setBusy(false); }
  }

  const confirmLocation = () => {
    if (!validCenter || !(building.locationSource || building.geocodedAddress)) return;
    setBuilding(b => ({ ...b, locationConfirmed: true }));
    setMessage("Building location confirmed. Now draw or confirm the roof outline.");
    setStep("roof");
  };

  const stepLabels: Record<Step, { label: string; description: string }> = {
    address: { label: "01 / Find your address", description: "Search for your property. Select a suggestion to center the map." },
    confirm: { label: "02 / Confirm your building", description: "Verify the marker is on your building. Adjust if needed, then confirm." },
    roof: { label: "03 / Confirm roof details", description: "Draw or edit the roof outline. Add vertices for corners and obstacles." },
    system: { label: "04 / Solar system", description: "Set panel count, orientation and system parameters." },
    finance: { label: "05 / Financial assumptions", description: "Set consumption, tariffs and costs for the financial scenario." },
    results: { label: "06 / Solar potential", description: "Review the energy production and financial scenario." },
  };

  const hasLocation = validCenter && Boolean(building.locationSource || building.geocodedAddress || building.locationConfirmed);
  const selectPosition = (p: MapPoint) => setBuilding(b => ({ ...b, locationSource: "manual", locationConfirmed: false, solar: { ...b.solar, latitude: p[0], longitude: p[1] } }));
  const blocked = (s: Step) => s === "roof" ? !building.locationConfirmed : ["system", "finance"].includes(s) ? !building.locationConfirmed || geometry.area <= 0 || Boolean(geometry.error) : s === "results" ? !snapshot : false;
  return <div className="studio-workspace text-text-primary">
    <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
      <div>
        <Logo variant="horizontal" size="sm" className="mb-2.5" />
        <p className="text-xs tracking-widest text-text-muted uppercase">Building Studio / Solar PV</p>
        <h1 className="text-xl font-semibold">Explore your building.</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" aria-label="Toggle light or dark theme" onClick={() => document.documentElement.classList.toggle("light")}>Theme</Button>
        <Button variant="outline" onClick={() => persist(true)}>Reopen draft</Button>
        <Button onClick={() => persist(false)}>Save local draft</Button>
      </div>
    </div>
    <details className="mb-3 text-sm"><summary className="cursor-pointer">Save & account · {identity ? `Cloud version ${identity.version}` : "Local draft"}</summary><CloudDraftControls building={building} identity={identity} onSaved={setIdentity} /></details>
    <div role="status" aria-live="polite" className="text-sm">{message}</div>
    {error && <p role="alert" className="p-3 my-3 border border-error bg-surface text-error rounded-lg">{error}</p>}

    <div className="my-3 flex flex-wrap gap-2" role="navigation" aria-label="Workflow steps">
      {(["address", "roof", "system", "results"] as Step[]).map((s, i) => {
        const stepIndex = (["address", "confirm", "roof", "system", "finance", "results"] as Step[]).indexOf(step);
        const isCurrent = step === s;
        const isCompleted = i < stepIndex;
        return (
          <Button
            key={s}
            variant={isCurrent ? "default" : isCompleted ? "outline" : "ghost"}
            size="sm"
            disabled={blocked(s)}
            aria-current={isCurrent ? "step" : undefined}
            onClick={() => setStep(s)}
            className="truncate max-w-[160px]"
          >
            {i + 1}. {({ address: "Find Building", roof: "Define Roof", system: "Configure Solar", results: "Review Results" } as Partial<Record<Step, string>>)[s]}
          </Button>
        );
      })}
    </div>

    <div className="studio-body">
    <section aria-label="Building map" className="border rounded-xl overflow-hidden bg-surface">
       <div className="flex flex-wrap items-center gap-2 p-2 border-b"><Button size="sm" variant={mode === "locate" ? "secondary" : "ghost"} onClick={() => { setMode("locate"); setStep("address"); }}>Select location on map</Button><Button size="sm" disabled={!building.locationConfirmed} variant={mode === "roof" ? "secondary" : "ghost"} onClick={() => { setMode("roof"); setStep("roof"); }}>Draw roof</Button><Button size="sm" disabled={!building.locationConfirmed} variant={mode === "obstacle" ? "secondary" : "ghost"} onClick={() => { setMode("obstacle"); setStep("roof"); }}>Draw obstacle</Button><span className="text-sm text-text-muted">{number(geometry.area, 1)} m² · approximate horizontal area</span></div>
       <div className="studio-map">{validCenter && <RoofMap center={center} roof={building.roof} obstacles={[...building.roofObstacles, ...(pendingObstacle.length >= 3 ? [pendingObstacle] : [])]} locationConfirmed={building.locationConfirmed} onClick={p => { if (mode === "roof" && building.locationConfirmed) setBuilding(b => ({ ...b, roof: b.roof.length < 100 ? [...b.roof, p] : b.roof })); else if (mode === "obstacle" && building.locationConfirmed) setPendingObstacle(points => points.length < 100 ? [...points, p] : points); else selectPosition(p); }} />}</div>
       <p className="p-2 text-xs text-text-muted">{mode === "roof" ? "Click roof corners in order; edit or undo vertices below." : mode === "obstacle" ? "Click an obstacle boundary, then save the obstacle after at least three vertices." : "Click your building to place or reposition the marker."} Reference map, not a surveyed roof measurement.</p>
    </section>
    <div className="studio-controls">
      <aside className="rounded-xl bg-surface border p-4 space-y-4 self-start">
        <Input label="Project name" value={building.name} maxLength={150} onChange={e => setBuilding(b => ({ ...b, name: e.target.value }))} />
        <h2 className="font-semibold text-xl">{stepLabels[step].label}</h2>
        <p className="text-sm text-text-muted">{stepLabels[step].description}</p>

        {step === "address" && (
          <>
            <AddressAutocomplete
              label="Search address"
              placeholder="Start typing your address (3+ characters)…"
              onSelect={handleAddressSelect}
              biasCountry="pt"
            />
            <p className="text-xs text-text-muted">Results biased toward Portugal. Other European countries are included.</p>
            <p className="text-sm">{!hasLocation ? "Select an address suggestion or click the map to continue." : building.locationSource === "manual" ? "Location selected manually" : building.address}</p>
            {hasLocation && <p className="text-sm font-mono">{center[0].toFixed(6)}, {center[1].toFixed(6)}</p>}
            <Button disabled={!hasLocation} onClick={confirmLocation}>Confirm Building</Button>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="bg-background p-4 rounded-lg">
              <p className="font-medium">{building.locationSource === "manual" ? "Location selected manually" : building.address || "Select an address or click the map."}</p>
              <p className="text-sm text-text-muted mt-1">
                Lat: {building.solar.latitude.toFixed(6)} · Lon: {building.solar.longitude.toFixed(6)}
                {building.geocodedAddress?.confidence !== undefined && ` · Confidence: ${Math.round(building.geocodedAddress.confidence * 100)}%`}
                {building.geocodedAddress?.resultType && ` · Type: ${building.geocodedAddress.resultType}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={confirmLocation} disabled={!hasLocation}>
                {building.locationConfirmed ? "Location confirmed" : "Confirm this building"}
              </Button>
              <Button variant="ghost" onClick={() => setStep("address")}>Change address</Button>
            </div>
            <p className="text-xs text-text-muted">Click the map to move the marker. Then confirm the building location.</p>
          </>
        )}

        {step === "roof" && (
          <>
            <Input label="Address / site reference" value={building.address} maxLength={500} onChange={e => setBuilding({ ...building, address: e.target.value })} helperText="Reference only. Use the map for precise location." />
            <p className="text-xs text-text-muted">Provenance: user-supplied location, roof vertices and system parameters. Polygon area is algorithmically estimated.</p>
            <Button variant="outline" onClick={() => { if (window.confirm("Delete the saved local draft? Current on-screen inputs will remain.")) { try { localStorage.removeItem(KEY); setMessage("Saved local draft deleted."); } catch { setError("Browser storage is unavailable."); } } }}>Delete saved draft</Button>
          </>
        )}

      </aside>

      <div className="space-y-6 min-w-0">

        {step === "roof" && (
          <>
            <section className="bg-surface border rounded-xl p-5">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <h2 className="font-semibold text-xl">Roof outline</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant={mode === "locate" ? "default" : "outline"} aria-pressed={mode === "locate"} onClick={() => setMode("locate")}>Move marker</Button>
                   <Button size="sm" variant={mode === "roof" ? "default" : "outline"} aria-pressed={mode === "roof"} onClick={() => setMode("roof")}>Draw roof</Button>
                   <Button size="sm" variant={mode === "obstacle" ? "default" : "outline"} aria-pressed={mode === "obstacle"} onClick={() => setMode("obstacle")}>Draw obstacle</Button>
                </div>
              </div>
              <p className="text-sm text-text-muted mb-4">{mode === "locate" ? "Click to move the site marker. Existing roof vertices stay in place." : "Click roof corners in order. Edit vertices below or undo the last point."} Map tiles show reference geography, not surveyed roof imagery.</p>
               <div className="flex flex-wrap gap-4 items-center mt-4">
                <strong>Horizontal roof area: {number(geometry.area, 1)} m²</strong>
                <Button size="sm" variant="outline" disabled={!building.roof.length} onClick={() => setBuilding({ ...building, roof: building.roof.slice(0, -1) })}>Undo vertex</Button>
                <Button size="sm" variant="outline" onClick={() => setBuilding({ ...building, roof: [] })}>Clear roof</Button>
                <Button size="sm" onClick={() => setStep("system")} disabled={building.roof.length < 3 || Boolean(geometry.error)}>Continue to system</Button>
               </div>
               {mode === "obstacle" && <div className="mt-4 rounded-lg border border-warning bg-warning-muted p-3 text-sm"><p>Pending obstacle vertices: {pendingObstacle.length}</p><div className="mt-2 flex flex-wrap gap-2"><Button size="sm" disabled={pendingObstacle.length < 3} onClick={() => { setBuilding(b => ({ ...b, roofObstacles: [...b.roofObstacles, pendingObstacle] })); setPendingObstacle([]); setMessage("Obstacle added to the layout geometry."); }}>Save obstacle</Button><Button size="sm" variant="outline" disabled={!pendingObstacle.length} onClick={() => setPendingObstacle(points => points.slice(0, -1))}>Undo obstacle vertex</Button><Button size="sm" variant="ghost" disabled={!pendingObstacle.length} onClick={() => setPendingObstacle([])}>Discard pending obstacle</Button></div></div>}
               {building.roofObstacles.length > 0 && <div className="mt-4 text-sm"><strong>Saved obstacles: {building.roofObstacles.length}</strong><Button className="ml-3" size="sm" variant="outline" onClick={() => setBuilding(b => ({ ...b, roofObstacles: b.roofObstacles.slice(0, -1) }))}>Remove last obstacle</Button></div>}
              {geometry.error && <p role="alert" className="text-error mt-3">{geometry.error}</p>}
              <details className="mt-5"><summary className="cursor-pointer">Keyboard-accessible roof vertices ({building.roof.length})</summary><div className="space-y-3 mt-4">{building.roof.map((point, i) => <div key={i} className="grid grid-cols-2 gap-3">{point.map((value, axis) => <Input key={axis} label={`Vertex ${i + 1} ${axis === 0 ? "latitude" : "longitude"}`} type="number" step="any" value={value} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && Math.abs(n) <= (axis === 0 ? 90 : 180)) setBuilding(b => ({ ...b, roof: b.roof.map((p, index) => index === i ? (axis === 0 ? [n, p[1]] : [p[0], n]) : p) })); }} />)}</div>)}<Button variant="outline" disabled={!validCenter || building.roof.length >= 100} onClick={() => setBuilding(b => ({ ...b, roof: [...b.roof, [...center]] }))}>Add vertex at marker</Button></div></details>
            </section>
            <PanelLayoutView building={building} panelModel={panelModel} onPanelModel={choosePanel} settings={layout} onChange={setLayout} onUseCount={() => setCountSource("layout")} countSource={countSource} />
          </>
        )}

        {step === "system" && (
          <section className="bg-surface rounded-xl border p-5">
            <h2 className="font-semibold text-xl mb-3">04 / Solar system</h2>
            <p className="text-sm text-text-muted mb-6">Panel count follows the roof layout by default, or a manual override you enter here. Panel nominal power comes from the selected catalogue model. Structural suitability, obstacles and sloped-plane fit require professional review.</p>
            <fieldset disabled={busy} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <Input label="Panel count" type="number" required min={1} max={10000} step={1} value={countSource === "layout" ? layoutCount : (Number.isFinite(building.solar.panels) ? building.solar.panels : "")} onChange={e => { setCountSource("manual"); setSolar("panels", e.target.valueAsNumber); }} />
              {([
                ["tilt", "Confirmed roof tilt (°)", 0, 90, 1],
                ["azimuth", "Compass azimuth (°; south = 180)", 0, 360, 1],
                ["losses", "System losses (%)", 0, 50, 0.1],
              ] as const).map(([key, label, min, max, stepVal]) => (
                <Input key={key} label={label} type="number" required min={min} max={max} step={stepVal} value={Number.isFinite(building.solar[key]) ? building.solar[key] : ""} onChange={e => setSolar(key, e.target.valueAsNumber)} />
              ))}
              <label className="text-sm font-medium">Mounting<select className="block w-full mt-2 border rounded-lg p-2.5" value={building.solar.mounting} onChange={e => setSolar("mounting", e.target.value)}><option value="free">Ventilated / free-standing</option><option value="building">Building-integrated</option></select></label>
            </fieldset>
            <div className="mt-5 rounded-lg border p-4 text-sm">
              <p><strong>Selected panel model:</strong> {panelModel.label} · {panelModel.watts} Wp · {panelModel.widthM} × {panelModel.lengthM} m · {panelModel.verified ? "verified" : "unverified"}</p>
              <p className="mt-2 text-text-muted">{countSource === "layout" ? `Panel count and capacity follow the roof layout: ${layoutCount} panels, ${layoutKwp.toFixed(2)} kWp.` : "Manual panel count override is active; the roof layout is not used for the estimate."}</p>
              <button type="button" className="mt-2 underline disabled:opacity-50" disabled={countSource === "layout" || layoutCount < 1} onClick={() => setCountSource("layout")}>Use layout count</button>
            </div>
            {!panelModel.verified && <p role="alert" className="mt-4 rounded-lg border border-warning bg-warning-muted p-3 text-sm">{PANEL_CATALOGUE_DISCLAIMER}</p>}
            <div className="flex gap-3 mt-6">
              <Button loading={busy} onClick={simulate}>Estimate with PVGIS</Button>
              <Button variant="outline" onClick={() => setStep("roof")}>Back to roof</Button>
            </div>
            <p className="mt-4 text-xs text-text-muted">Crystalline silicon; terrain horizon included by PVGIS. Nearby buildings, chimneys and vegetation are not modelled. Tilt and azimuth must be confirmed manually.</p>
          </section>
        )}

        {step === "finance" && (
          <section className="bg-surface border rounded-xl p-5">
            <h2 className="font-semibold text-xl mb-5">Financial assumptions</h2>
            <p className="text-sm text-text-muted mb-6">Simplified annual scenario, not hourly self-consumption. Self-used energy is capped by annual demand. No battery, degradation, discounting, tax or tariff escalation model.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {([
                ["consumption", "Annual consumption (kWh)", 1e8],
                ["selfConsumption", "Assumed PV self-consumption (%)", 100],
                ["importTariff", "Import tariff (€/kWh)", 5],
                ["exportTariff", "Export compensation (€/kWh)", 5],
                ["capex", "Installed cost (€)", 1e8],
                ["annualOpex", "Annual maintenance (€)", 1e7],
              ] as const).map(([key, label, max]) => (
                <Input key={key} label={label} type="number" min={0} max={max} step="any" value={Number.isFinite(building.finance[key]) ? building.finance[key] : ""} onChange={e => setFinance(key, e.target.valueAsNumber)} />
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <Button loading={busy} onClick={simulate}>Estimate with PVGIS</Button>
              <Button variant="outline" onClick={() => setStep("system")}>Back to system</Button>
            </div>
          </section>
        )}

        {step === "results" && (
          <section className="bg-surface border rounded-xl p-5" aria-label="Solar results">
            <h2 className="font-semibold text-xl mb-5">Results</h2>
            {!result ? (
              <p className="text-text-muted">{snapshot ? "System inputs changed. Run a new estimate to see current results." : "Run the estimate to retrieve location-based PVGIS results. No production values have been assumed."}</p>
            ) : (
              <>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[["Capacity", `${number(result.capacityKwp, 2)} kWp`], ["Annual production", `${number(result.annualKwh)} kWh`], ["Specific yield", `${number(result.specificYield)} kWh/kWp`]].map(([label, value]) => (
                    <div className="bg-background p-5 rounded-lg" key={label}><p className="text-sm text-text-muted">{label}</p><strong className="block text-2xl mt-2">{value}</strong></div>
                  ))}
                </div>
                <h3 className="font-semibold mt-7 mb-4">Monthly production (kWh)</h3>
                <div className="grid gap-2">
                  {result.monthly.map(month => (
                    <div key={month.month} className="grid grid-cols-[2rem_1fr_4rem] items-center gap-3 text-sm">
                      <span>{months[month.month - 1]}</span>
                      <div className="bg-background rounded h-5"><div className="bg-steel-blue h-full rounded" style={{ width: `${month.E_m / Math.max(1, ...result.monthly.map(mm => mm.E_m)) * 100}%` }} /></div>
                      <span className="text-right tabular-nums">{number(month.E_m)}</span>
                    </div>
                  ))}
                </div>
                {finance ? (
                  <div className="mt-6 bg-background p-5 rounded-lg">
                    <h3 className="font-semibold">Annual financial scenario</h3>
                    <dl className="grid sm:grid-cols-2 gap-4 mt-4">
                      {[["Self-used energy", `${number(finance.selfUsed)} kWh`], ["Grid exports", `${number(finance.exported)} kWh`], ["Net annual savings after maintenance", `€${number(finance.netSavings)}`], ["Simple payback", finance.payback === null ? "No positive annual saving" : `${number(finance.payback, 1)} years`]].map(([label, value]) => (
                        <div key={label}><dt className="text-sm text-text-muted">{label}</dt><dd className="font-semibold">{value}</dd></div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <p role="alert" className="mt-5">Correct the financial assumptions to see the scenario.</p>
                )}
                <p className="text-xs text-text-muted mt-6">Source: {result.source} · {result.database} · {new Date(result.calculatedAt).toLocaleString("en-GB")} · Engine {result.engineVersion}. Preliminary automated estimate; not professionally reviewed.</p>
                <Link href="/request-quote?service=solar" className="inline-block underline mt-5">Prepare a professional design brief →</Link>
                <div className="flex gap-3 mt-6">
                  <Button variant="outline" onClick={() => setStep("finance")}>Adjust financials</Button>
                  <Button variant="outline" onClick={() => setStep("system")}>Adjust system</Button>
                  <Button variant="outline" onClick={() => setStep("roof")}>Adjust roof</Button>
                </div>
              </>
            )}
          </section>
        )}

        {step === "system" && <Button variant="outline" onClick={() => setStep("finance")}>Financial assumptions</Button>}
        <ScenarioControls snapshot={report?.success ? report.data : null} identity={identity} onRestore={restoreScenario} />
      </div>
    </div>
    </div>
  </div>;
}
