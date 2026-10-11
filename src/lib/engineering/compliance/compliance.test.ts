import { describe, expect, it } from "vitest";
import { electricalBuildingSchema, initialElectricalBuilding, loadItemSchema } from "../../electrical/model";
import { buildingSummary } from "../../electrical/loads";
import { currentEvidence } from "../calculations/evidence";
import { exampleProjects } from "../verification/examples";
import { applicabilityMatrix, ceScreening } from "../standards/applicability";
import { standardsRegistry } from "../standards/registry";
import { complianceContextSchema, EARTHING_SYSTEMS, newComplianceContext, PROJECT_CATEGORIES, supplyContextKey, supplyPresets } from "./context";
import { evaluateCompliance } from "./evaluate";

const status = (context: ReturnType<typeof newComplianceContext>, id: string) => applicabilityMatrix(context).find(r => r.reference.id === id)!.status;

describe("classification and supply context", () => {
  it("has all ten categories, 230/400 V presets and no inferred earthing", () => {
    expect(PROJECT_CATEGORIES).toHaveLength(10);
    expect(supplyPresets.single).toMatchObject({ voltageV: 230, lineNeutralV: 230, phases: 1, frequencyHz: 50 });
    expect(supplyPresets.three).toMatchObject({ voltageV: 400, lineNeutralV: 230, phases: 3, frequencyHz: 50 });
    expect(newComplianceContext()).toMatchObject({ category: null, jurisdiction: null, earthing: null, supplyConfirmed: false });
  });
  it.each(EARTHING_SYSTEMS)("accepts explicit %s and keeps fault verification open", earthing => {
    const b = { ...initialElectricalBuilding, compliance: { ...newComplianceContext(), earthing, earthingConfirmed: true } };
    expect(evaluateCompliance(b).checks.find(c => c.id === "earthing")?.status).toBe("REQUIRES PROFESSIONAL REVIEW");
  });
  it("validates overrides and dates without accepting invalid inputs", () => {
    for (const patch of [{ frequencyHz: -1 }, { frequencyHz: NaN }, { lineNeutralV: 0 }, { faultCurrentKa: Infinity }, { marketDate: "2026-02-30" }, { earthing: "TN" }]) expect(complianceContextSchema.safeParse(patch).success).toBe(false);
  });
  it("preserves legacy drafts and round-trips new project context", () => {
    expect(electricalBuildingSchema.parse(initialElectricalBuilding).compliance).toBeUndefined();
    const b = exampleProjects().C;
    expect(electricalBuildingSchema.parse(JSON.parse(JSON.stringify(b))).compliance).toEqual(b.compliance);
  });
});

describe("applicability and source governance", () => {
  it("activates different installation, assembly and machinery references", () => {
    const p = exampleProjects();
    expect(p.B.floors).toHaveLength(5);
    expect(status(p.A.compliance!, "rtiebt")).toBe("CANDIDATE");
    expect(status(p.B.compliance!, "61439-3")).toBe("CANDIDATE");
    expect(status(p.C.compliance!, "61439-2")).toBe("CANDIDATE");
    expect(status(p.C.compliance!, "61439-3")).toBe("NOT APPLICABLE");
    expect(status(p.C.compliance!, "rtiebt")).toBe("NOT APPLICABLE");
    expect(status(p.D.compliance!, "60204-1")).toBe("CANDIDATE");
    expect(status(p.A.compliance!, "60204-1")).toBe("NOT APPLICABLE");
    expect(status(p.A.compliance!, "lvd")).toBe("NOT APPLICABLE");
    expect(ceScreening(p.A.compliance!)).toContain("no CE marking");
  });
  it("uses the corrected machinery transition date and fails closed on missing dates", () => {
    const context = exampleProjects().D.compliance!;
    expect(status({ ...context, marketDate: null }, "machinery-directive")).toBe("MISSING DATA");
    expect(status({ ...context, marketDate: "2027-01-19" }, "machinery-directive")).toBe("CANDIDATE");
    expect(status({ ...context, marketDate: "2027-01-20" }, "machinery-directive")).toBe("NOT APPLICABLE");
    expect(status({ ...context, marketDate: "2027-01-20" }, "machinery-regulation")).toBe("CANDIDATE");
  });
  it("requires cabinet integration and individual product legislation screening", () => {
    const c = { ...exampleProjects().C.compliance!, category: "control_cabinet" as const };
    expect(status(c, "60204-1")).toBe("MISSING DATA");
    expect(status({ ...c, machineIntegration: "no" }, "60204-1")).toBe("NOT APPLICABLE");
    expect(status(c, "ecodesign")).toBe("NOT EVALUATED");
    expect(status({ ...c, productOnMarket: "unknown" }, "lvd")).toBe("MISSING DATA");
  });
  it("does not turn unsupported countries or unverified standards into passes", () => {
    const context = exampleProjects().A.compliance!;
    expect(applicabilityMatrix({ ...context, jurisdiction: "OTHER" }).every(r => r.status === "NOT EVALUATED")).toBe(true);
    expect(status({ ...context, jurisdiction: "FR" }, "rtiebt")).toBe("NOT APPLICABLE");
    expect(status({ ...context, jurisdiction: "FR" }, "nf-c15-100")).toBe("CANDIDATE");
    expect(applicabilityMatrix(newComplianceContext()).every(r => r.status === "MISSING DATA")).toBe(true);
    expect(standardsRegistry.every(r => !r.technicalRulesVerified)).toBe(true);
    expect(standardsRegistry.find(r => r.id === "61439-1")?.edition).toContain("EN 61439-1:2011");
    expect(standardsRegistry.find(r => r.id === "rtiebt")?.lastVerificationDate).toBeNull();
  });
  it("flags changed registry revisions and ignores legacy workflow approvals", () => {
    const p = exampleProjects().A;
    const r = evaluateCompliance({ ...p, reviewStatus: "APPROVED", compliance: { ...p.compliance!, registryVersion: "older-pack" } });
    expect(r.checks.find(c => c.id === "registry-version")?.status).toBe("WARNING");
    expect(r.professionalApproval).toBe("NOT ASSESSED");
    expect(r.checks.every(c => c.reviewerStatus === "UNREVIEWED")).toBe(true);
  });
});

describe("deterministic checks and calculation evidence", () => {
  it("distinguishes missing data, internal pass/fail and unimplemented checks", () => {
    const p = exampleProjects().A;
    const r = evaluateCompliance({ ...p, service: { ...p.service, phases: 1, supplyType: "three" } });
    expect(r.checks.find(c => c.id === "classification")?.status).toBe("PASS");
    expect(r.checks.find(c => c.id === "supply-consistency")?.status).toBe("FAIL");
    expect(r.checks.find(c => c.id === "supply-context")?.status).toBe("MISSING DATA");
    expect(r.checks.find(c => c.id === "technical-checks")?.status).toBe("NOT EVALUATED");
  });
  it("invalidates supply confirmation after edits from other studio tabs", () => {
    const p = exampleProjects().A;
    const c = { ...p.compliance!, frequencyHz: 50, neutral: "yes" as const, lineNeutralV: 230, supplySource: "Utility record", supplyConfirmed: true };
    c.supplyConfirmationKey = supplyContextKey(p.service, c);
    p.compliance = c;
    expect(evaluateCompliance(p).checks.find(c => c.id === "supply-context")?.status).toBe("PASS");
    expect(evaluateCompliance({ ...p, service: { ...p.service, voltageV: 415 } }).checks.find(c => c.id === "supply-context")?.status).toBe("MISSING DATA");
  });
  it("checks independent analytical current examples and invalid inputs", () => {
    expect(currentEvidence({ apparentVA: 2300, volts: 230, phases: 1 }).result).toBe(10);
    // Independent expected value: 400 V × sqrt(3) × 10 A = 6928.203230275509 VA.
    expect(currentEvidence({ apparentVA: 6928.203230275509, volts: 400, phases: 3 }).result).toBeCloseTo(10, 10);
    expect(() => currentEvidence({ apparentVA: 100, volts: 0, phases: 1 })).toThrow();
    expect(() => currentEvidence({ apparentVA: NaN, volts: 230, phases: 1 })).toThrow();
  });
  it("rejects invalid power factors using the canonical load schema", () => {
    const load = exampleProjects().A.floors[0].apartments[0].rooms[0].loads[0];
    for (const pf of [0, -0.1, 1.01, Infinity]) expect(loadItemSchema.safeParse({ ...load, powerFactor: pf }).success).toBe(false);
  });
  it("applies the requested margin and recomputes evidence after load changes", () => {
    const p = exampleProjects().A;
    const s = buildingSummary(p);
    expect(s.demandVA).toBeCloseTo(s.diversified.demandVA * 1.1);
    const before = evaluateCompliance(p).calculations;
    const next = structuredClone(p);
    next.floors[0].apartments[0].rooms[0].loads[0].ratedWatts += 1000;
    const after = evaluateCompliance(next).calculations;
    expect(after.demandVA).toBeGreaterThan(before.demandVA);
    expect(after.current.inputs.apparentVA).toBe(after.demandVA);
    expect(after.current.result).toBe(buildingSummary(next).lineCurrentA);
  });
});
