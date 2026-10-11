"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ElectricalBuilding } from "@/lib/electrical";
import { categoryLabels, complianceContextSchema, EARTHING_SYSTEMS, JURISDICTIONS, newComplianceContext, PROJECT_CATEGORIES, REGISTRY_VERSION, supplyContextKey, supplyPresets, type ComplianceContext } from "@/lib/engineering/compliance/context";
import { CHECK_STATUSES, evaluateCompliance } from "@/lib/engineering/compliance/evaluate";
import { jurisdictionPacks } from "@/lib/engineering/jurisdictions";

const field = "block w-full mt-1 p-2 rounded-lg border border-border bg-surface text-sm";
export function StandardsCompliance({ building, onChange }: { building: ElectricalBuilding; onChange: (b: ElectricalBuilding) => void }) {
  const c = building.compliance ?? newComplianceContext();
  const report = evaluateCompliance(building);
  const [error, setError] = useState("");
  function update(patch: Partial<ComplianceContext>) {
    const parsed = complianceContextSchema.safeParse({ ...c, ...patch });
    if (!parsed.success) { setError(parsed.error.issues.map(i => i.message).join("; ")); return; }
    setError("");
    onChange({ ...building, compliance: parsed.data, ...(patch.jurisdiction ? { country: jurisdictionPacks[patch.jurisdiction].name, jurisdiction: jurisdictionPacks[patch.jurisdiction].name } : {}) });
  }
  function preset(key: keyof typeof supplyPresets) {
    const p = supplyPresets[key];
    onChange({ ...building, service: { ...building.service, voltageV: p.voltageV, phases: p.phases, supplyType: p.supplyType }, compliance: { ...c, frequencyHz: p.frequencyHz, lineNeutralV: p.lineNeutralV, neutral: p.neutral, supplyConfirmed: false } });
  }
  return <div className="space-y-5">
    <section className="bg-surface border border-border rounded-xl p-5 space-y-4">
      <h2 className="text-xl font-semibold">Standards &amp; Compliance</h2>
      <p className="text-sm text-text-muted">Preliminary applicability and evidence review. PASS applies only to an individual implemented check. This assessment does not constitute certification, a CE declaration of conformity, an installation inspection certificate, or approval for construction.</p>
      <p className="text-xs text-text-muted">Registry {report.registryVersion} · Calculation engine {report.calculations.engineVersion} · Professional approval: {report.professionalApproval}</p>
      {error && <p role="alert" className="text-error">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">Project classification<select aria-label="Project classification" className={field} value={c.category ?? ""} onChange={e => update({ category: e.target.value as ComplianceContext["category"], assemblyType: null })}><option value="" disabled>Select project category</option>{PROJECT_CATEGORIES.map(key => <option key={key} value={key}>{categoryLabels[key]}</option>)}</select></label>
        <label className="text-sm">Project jurisdiction<select aria-label="Project jurisdiction" className={field} value={c.jurisdiction ?? ""} onChange={e => update({ jurisdiction: e.target.value as ComplianceContext["jurisdiction"] })}><option value="" disabled>Confirm jurisdiction</option>{JURISDICTIONS.map(key => <option key={key} value={key}>{jurisdictionPacks[key].name}</option>)}</select></label>
        <label className="text-sm">Assembly type in scope<select className={field} value={c.assemblyType ?? ""} onChange={e => update({ assemblyType: e.target.value ? e.target.value as ComplianceContext["assemblyType"] : null })}><option value="">Not established</option><option value="power">Power switchgear / controlgear</option><option value="ordinary_persons">Distribution board — ordinary persons</option><option value="other">Other assembly</option></select></label>
        <label className="text-sm">Product placed on EU market<select className={field} value={c.productOnMarket} onChange={e => update({ productOnMarket: e.target.value as ComplianceContext["productOnMarket"] })}>{["unknown", "yes", "no"].map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="text-sm">Cabinet integrated into machinery<select className={field} value={c.machineIntegration} onChange={e => update({ machineIntegration: e.target.value as ComplianceContext["machineIntegration"] })}>{["unknown", "yes", "no"].map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="text-sm">EMC scope<select aria-label="EMC scope" className={field} value={c.emcScope} onChange={e => update({ emcScope: e.target.value as ComplianceContext["emcScope"] })}><option value="unknown">Not established</option><option value="apparatus">Apparatus</option><option value="fixed_installation">Fixed installation</option></select></label>
        <label className="text-sm">Placing-on-market / service date<Input type="date" value={c.marketDate ?? ""} onChange={e => update({ marketDate: e.target.value || null })} /></label>
        {c.assemblyType && <label className="text-sm">Declared assembly rated current (A)<Input type="number" min={1} max={100000} value={c.assemblyRatedCurrentA ?? ""} onChange={e => update({ assemblyRatedCurrentA: e.target.value === "" ? null : e.target.valueAsNumber })} /></label>}
      </div>
      {c.jurisdiction && <p className="text-sm text-text-muted">{jurisdictionPacks[c.jurisdiction].status}. {jurisdictionPacks[c.jurisdiction].action}</p>}
      <p className="text-sm text-text-muted">{report.ce}</p>
      {c.registryVersion !== REGISTRY_VERSION && <Button variant="outline" onClick={() => update({ registryVersion: REGISTRY_VERSION })}>Adopt current registry revision</Button>}
    </section>

    <section className="bg-surface border border-border rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-lg">Supply characteristics</h3>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => preset("single")}>230 V · single-phase · 50 Hz</Button><Button variant="outline" onClick={() => preset("three")}>400/230 V · three-phase · 50 Hz</Button></div>
      <p className="text-sm text-text-muted">Presets are editable project proposals, not measured supply characteristics. Service voltage and phases use the existing calculation model. Individual load voltages remain explicit equipment inputs; review them when changing supply.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <label className="text-sm">{building.service.phases === 3 ? "Line-to-line voltage (V)" : "Single-phase supply voltage (V)"}<Input type="number" min={120} max={1000} value={building.service.voltageV} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n) && n >= 120 && n <= 1000) { setError(""); onChange({ ...building, service: { ...building.service, voltageV: n }, compliance: { ...c, supplyConfirmed: false } }); } else setError("The existing service engine supports 120–1000 V. This is a software range, not a regulatory limit."); }} /></label>
        {building.service.phases === 3 && <label className="text-sm">Line-to-neutral voltage (V)<Input type="number" min={1} max={1000} disabled={c.neutral === "no"} value={c.lineNeutralV ?? ""} onChange={e => update({ lineNeutralV: e.target.value === "" ? null : e.target.valueAsNumber, supplyConfirmed: false })} /></label>}
        <label className="text-sm">Frequency (Hz)<Input type="number" min={1} max={400} value={c.frequencyHz ?? ""} onChange={e => update({ frequencyHz: e.target.value === "" ? null : e.target.valueAsNumber, supplyConfirmed: false })} /></label>
        <label className="text-sm">Neutral availability<select className={field} value={c.neutral} onChange={e => update({ neutral: e.target.value as ComplianceContext["neutral"], supplyConfirmed: false })}>{["unknown", "yes", "no"].map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="text-sm">Earthing arrangement<select aria-label="Earthing arrangement" className={field} value={c.earthing ?? ""} onChange={e => update({ earthing: e.target.value ? e.target.value as ComplianceContext["earthing"] : null, earthingConfirmed: false })}><option value="">Unknown — confirm actual system</option>{EARTHING_SYSTEMS.map(v => <option key={v}>{v}</option>)}</select></label>
        <label className="text-sm">Supply source<Input maxLength={300} value={c.supplySource} placeholder="Utility, transformer, generator…" onChange={e => update({ supplySource: e.target.value, supplyConfirmed: false })} /></label>
        <label className="text-sm">Utility / connection information<Input maxLength={300} value={c.utility} onChange={e => update({ utility: e.target.value })} /></label>
        <label className="text-sm">Available fault current (kA)<Input type="number" min={0.001} max={1000} step="any" value={c.faultCurrentKa ?? ""} onChange={e => update({ faultCurrentKa: e.target.value === "" ? null : e.target.valueAsNumber })} /></label>
        <label className="text-sm">Fault-current source / point / conditions<Input maxLength={1000} value={c.faultCurrentEvidence} onChange={e => update({ faultCurrentEvidence: e.target.value })} /></label>
      </div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={c.supplyConfirmed && c.supplyConfirmationKey === supplyContextKey(building.service, c)} onChange={e => update({ supplyConfirmed: e.target.checked, supplyConfirmationKey: e.target.checked ? supplyContextKey(building.service, c) : null })} />Supply characteristics confirmed by project author</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={c.earthingConfirmed} disabled={!c.earthing} onChange={e => update({ earthingConfirmed: e.target.checked })} />Actual earthing arrangement confirmed by project author</label>
    </section>

    <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <h3 className="font-semibold text-lg">Standards applicability matrix</h3>
      <p className="text-sm text-text-muted">Candidate references require scope review. Metadata verification does not verify technical clauses, the latest edition, or project conformity. Open a reference for sources and limitations.</p>
      {report.matrix.map(row => <details key={row.reference.id} data-reference={row.reference.id} className="border border-border rounded-lg p-3">
        <summary className="cursor-pointer text-sm"><strong>{row.reference.identifier}</strong> · {row.status} · {row.reference.edition ?? "Edition not verified"}</summary>
        <div className="mt-3 text-sm space-y-2 text-text-muted">
          <p>{row.reference.title}</p><p><strong>Why:</strong> {row.reason}</p><p><strong>Action:</strong> {row.action}</p>
          <p>Source status: {row.reference.reviewStatus}. Last metadata verification: {row.reference.lastVerificationDate ?? "Not verified"}.</p>
          <p>Publication: {row.reference.publicationDate ?? "Not verified"} · General application: {row.reference.effectiveDate ?? "Not verified"}</p>
          <p>Amendments / corrigenda: {row.reference.amendments}</p>
          <p>Technical rules: NOT EVALUATED · Reviewer: UNREVIEWED</p>
          <a href={row.reference.source} target="_blank" rel="noreferrer" className="underline text-primary">Authoritative source / verification destination</a>
        </div>
      </details>)}
    </section>

    <section className="bg-surface border border-border rounded-xl p-5 space-y-3">
      <h3 className="font-semibold text-lg">Implemented checks &amp; missing evidence</h3>
      <div className="flex flex-wrap gap-3 text-xs">{CHECK_STATUSES.map(status => <span key={status}>{status}: {report.checks.filter(r => r.status === status).length}</span>)}</div>
      {report.checks.map(check => <details key={check.id} className="border border-border rounded-lg p-3"><summary className="cursor-pointer text-sm">{check.title} · <strong className={check.status === "FAIL" ? "text-error" : check.status === "PASS" ? "text-success" : "text-warning"}>{check.status}</strong></summary><div className="text-sm space-y-2 mt-3 text-text-muted"><p>{check.explanation}</p><p>Rule: {check.id} · Reference: {check.reference} · Edition: {check.edition ?? "Not verified"}</p><p>Required inputs: {check.requiredInputs.join(", ")}</p><pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(check.evidence, null, 2)}</pre><p>Action: {check.action}</p><p>Reviewer status: {check.reviewerStatus}</p></div></details>)}
      <details className="border border-border rounded-lg p-3"><summary className="cursor-pointer">Calculation evidence — existing load engine</summary><p className="text-sm my-3">Estimated current: {report.calculations.current.result.toFixed(2)} A. Mathematical result only; no cable or breaker is selected.</p><pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(report.calculations, null, 2)}</pre></details>
      <label className="text-sm block">Project review notes (author notes, not professional approval)<textarea className={field} maxLength={3000} rows={3} value={c.reviewNotes} onChange={e => update({ reviewNotes: e.target.value })} /></label>
      <p className="text-xs text-text-muted">Results are derived from the current project on every edit. Signed review, evidence uploads, revision audit and PDF compliance reports are later milestones. Existing workflow labels do not establish an authenticated professional approval.</p>
    </section>
  </div>;
}
