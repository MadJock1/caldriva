"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { BriefPanel } from "./brief-panel";
import { HierarchyEditor } from "./hierarchy-editor";
import { PlanEditor } from "./plan-editor";
import { ServicesPanel } from "./services-panel";
import { LoadSummary } from "./load-summary";
import { DistributionView } from "./distribution-view";
import { ReviewView } from "./review-view";
import { StandardsCompliance } from "./standards-compliance";
import { ElectricalCloudControls } from "./cloud-controls";
import { CanvasBackgroundToggle } from "./CanvasBackgroundToggle";
import {
  buildingSummary,
  electricalBuildingSchema,
  emptyBuilding,
  generateBuilding,
  parseElectricalBuildingDraft,
  type BuildingBrief,
  type ElectricalBuilding,
  type ReviewStatus,
} from "@/lib/electrical";

const KEY = "caldriva-electrical-v1";
type Step = "brief" | "hierarchy" | "plan" | "services" | "loads" | "circuits" | "review" | "compliance";

const stepList: { id: Step; label: string }[] = [
  { id: "brief", label: "1. Brief" },
  { id: "hierarchy", label: "2. Building" },
  { id: "plan", label: "3. Plan" },
  { id: "services", label: "4. Services" },
  { id: "loads", label: "5. Loads" },
  { id: "circuits", label: "6. Distribution" },
  { id: "review", label: "7. Review" },
  { id: "compliance", label: "8. Standards & Compliance" },
];

export function ElectricalStudio({ cloudDraft }: { cloudDraft?: { draft: ElectricalBuilding; identity: { id: string; version: number } } } = {}) {
  const [building, setBuilding] = useState<ElectricalBuilding>(cloudDraft?.draft ?? emptyBuilding());
  const [identity, setIdentity] = useState(cloudDraft?.identity ?? null);
  const [step, setStep] = useState<Step>(cloudDraft ? "hierarchy" : "brief");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const summary = useMemo(() => buildingSummary(building), [building]);

  function generate(brief: BuildingBrief) {
    setError("");
    try {
      const generated = generateBuilding(brief);
      setBuilding(building.compliance ? { ...generated, country: building.country, jurisdiction: building.jurisdiction, compliance: { ...building.compliance, supplyConfirmed: false } } : generated);
      setIdentity(null);
      setStep("hierarchy");
      setMessage(`Generated ${brief.floors.length} floor(s). Review and edit the hierarchy.`);
    } catch {
      setError("Could not generate the building from those inputs.");
    }
  }

  function persist(load: boolean) {
    setError("");
    setMessage("");
    try {
      if (load) {
        const saved = localStorage.getItem(KEY);
        if (!saved) { setMessage("No draft saved in this browser yet."); return; }
        const parsed = parseElectricalBuildingDraft(JSON.parse(saved));
        setBuilding(parsed);
        setIdentity(null);
        setStep("hierarchy");
        setMessage("Local electrical draft reopened.");
      } else {
        localStorage.setItem(KEY, JSON.stringify(electricalBuildingSchema.parse(building)));
        setMessage("Draft saved on this browser only. This is not a cloud backup.");
      }
    } catch {
      setError("Could not save or reopen this draft. Existing saved data was not removed.");
    }
  }

  function setStatus(status: ReviewStatus) {
    setBuilding(b => ({ ...b, reviewStatus: status }));
  }

  const hasBuilding = building.floors.length > 0;

  return (
    <div className="studio-workspace text-text-primary">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3">
        <div>
          <Logo variant="horizontal" size="sm" className="mb-2.5" />
          <p className="text-xs tracking-widest text-text-muted uppercase">Auto Electrical Design Studio</p>
          <h1 className="text-xl font-semibold">{building.name || "New electrical design"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CanvasBackgroundToggle />
          <Button variant="outline" onClick={() => persist(true)}>Reopen draft</Button>
          <Button onClick={() => persist(false)}>Save local draft</Button>
          <Button variant="destructive" onClick={() => { setBuilding(emptyBuilding()); setIdentity(null); setStep("brief"); setMessage(""); setError(""); }}>Reset</Button>
        </div>
      </div>

      <p className="text-xs text-text-muted bg-surface border border-border rounded-lg p-3 mb-3">
        Preliminary automated design tool. Outputs are a starting point for a qualified engineer — they are not construction-ready
        drawings, do not certify compliance with any wiring regulation, and must not be issued for construction without professional review.
      </p>

      <div role="status" aria-live="polite" className="text-sm">{message}</div>
      {error && <p role="alert" className="p-3 my-3 border border-error bg-surface text-error rounded-lg">{error}</p>}

      <details className="mb-3 text-sm">
        <summary className="cursor-pointer">Save & account · {identity ? `Cloud version ${identity.version}` : "Local draft"}</summary>
        <ElectricalCloudControls building={building} identity={identity} onSaved={setIdentity} />
      </details>

      <div className="my-3 flex flex-wrap gap-2" role="navigation" aria-label="Workflow steps">
        {stepList.map(({ id, label }) => {
          const isCurrent = step === id;
          return (
            <Button key={id} size="sm" variant={isCurrent ? "default" : "outline"} aria-current={isCurrent ? "step" : undefined} onClick={() => setStep(id)}>{label}</Button>
          );
        })}
      </div>

      {hasBuilding && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 my-3">
          <div className="bg-surface border border-border rounded-lg p-3"><p className="text-xs text-text-muted uppercase tracking-wider">Floors</p><strong className="text-lg tabular-nums">{summary.floorCount}</strong></div>
          <div className="bg-surface border border-border rounded-lg p-3"><p className="text-xs text-text-muted uppercase tracking-wider">Apartments</p><strong className="text-lg tabular-nums">{summary.apartmentCount}</strong></div>
          <div className="bg-surface border border-border rounded-lg p-3"><p className="text-xs text-text-muted uppercase tracking-wider">Design demand</p><strong className="text-lg tabular-nums">{(summary.demandWithMargin.demandVA / 1000).toFixed(1)} kVA</strong></div>
          <div className="bg-surface border border-border rounded-lg p-3"><p className="text-xs text-text-muted uppercase tracking-wider">Status</p><strong className="text-lg">{building.reviewStatus}</strong></div>
        </div>
      )}

      <div className="mt-4">
        {step === "brief" && <BriefPanel onGenerate={generate} />}
        {step === "hierarchy" && <HierarchyEditor building={building} onChange={setBuilding} />}
        {step === "plan" && <><div className="mb-3 flex justify-end"><Link className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-background" href="/studio/electrical/plan">Open full-screen plan workspace</Link></div><PlanEditor building={building} onChange={setBuilding} /></>}
        {step === "services" && <ServicesPanel building={building} onChange={setBuilding} />}
        {step === "loads" && (hasBuilding ? <LoadSummary building={building} /> : <p className="text-sm text-text-muted">Generate a building first.</p>)}
        {step === "circuits" && (hasBuilding ? <DistributionView building={building} onChange={setBuilding} /> : <p className="text-sm text-text-muted">Generate a building first.</p>)}
        {step === "review" && (hasBuilding ? <ReviewView building={building} onStatus={setStatus} /> : <p className="text-sm text-text-muted">Generate a building first.</p>)}
        {step === "compliance" && <StandardsCompliance building={building} onChange={setBuilding} />}
      </div>

      <details className="mt-6 text-sm">
        <summary className="cursor-pointer">Assumptions & provenance</summary>
        <ul className="list-disc ml-5 mt-3 space-y-1 text-text-muted">
          {building.assumptions.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
        <p className="text-text-muted mt-3">Provenance: {building.provenance}</p>
      </details>

      <p className="text-sm mt-6">
        <Link href="/request-quote?service=electrical" className="underline">Prepare a professional electrical design brief →</Link>
      </p>
    </div>
  );
}
