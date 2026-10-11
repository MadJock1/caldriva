import { type ElectricalBuilding } from "../../electrical/model";
import { newComplianceContext, REGISTRY_VERSION, supplyContextKey, type ComplianceContext } from "./context";
import { applicabilityMatrix, ceScreening } from "../standards/applicability";
import { projectCalculationEvidence } from "../calculations/evidence";

export const CHECK_STATUSES = ["PASS", "FAIL", "WARNING", "MISSING DATA", "NOT APPLICABLE", "NOT EVALUATED", "REQUIRES PROFESSIONAL REVIEW"] as const;
export type CheckStatus = typeof CHECK_STATUSES[number];
export type ComplianceCheck = {
  id: string; title: string; status: CheckStatus; severity: "info" | "warning" | "error";
  jurisdiction: ComplianceContext["jurisdiction"]; category: ComplianceContext["category"];
  reference: string; edition: string | null; requiredInputs: string[]; explanation: string;
  evidence: Record<string, unknown>; action: string; reviewerStatus: "UNREVIEWED";
};

export function evaluateCompliance(building: ElectricalBuilding) {
  const c = building.compliance ?? newComplianceContext();
  const checks: ComplianceCheck[] = [];
  function add(id: string, title: string, status: CheckStatus, requiredInputs: string[], explanation: string, evidence: Record<string, unknown>, action: string, reference = "Caldriva input completeness / consistency policy", edition: string | null = "1") {
    checks.push({ id, title, status, requiredInputs, explanation, evidence, action, reference, edition, jurisdiction: c.jurisdiction, category: c.category, reviewerStatus: "UNREVIEWED", severity: status === "FAIL" ? "error" : ["WARNING", "MISSING DATA", "REQUIRES PROFESSIONAL REVIEW"].includes(status) ? "warning" : "info" });
  }
  add("classification", "Project classification recorded", c.category && c.jurisdiction ? "PASS" : "MISSING DATA", ["category", "jurisdiction"], "A PASS here means only that classification fields are present.", { category: c.category, jurisdiction: c.jurisdiction }, "Confirm project scope and country.");
  add("registry-version", "Registry revision", c.registryVersion === REGISTRY_VERSION ? "PASS" : "WARNING", ["registryVersion"], "Evaluation uses the bundled registry; a different saved revision must be reviewed before accepting a new baseline.", { saved: c.registryVersion, evaluated: REGISTRY_VERSION }, "Review source changes and explicitly adopt the current registry revision.");
  const missingSupply = !c.frequencyHz || !c.supplyConfirmed || c.supplyConfirmationKey !== supplyContextKey(building.service, c) || !c.supplySource.trim() || c.neutral === "unknown" || c.neutral === "yes" && !(building.service.phases === 1 ? building.service.voltageV : c.lineNeutralV);
  add("supply-context", "Supply characteristics recorded", missingSupply ? "MISSING DATA" : "PASS", ["service.voltageV", "service.phases", "frequencyHz", "neutral", "supplySource", "supplyConfirmed"], "Presets are proposed nominal values; confirmation records user input, not a measurement certificate.", { service: building.service, frequencyHz: c.frequencyHz, neutral: c.neutral, lineNeutralV: c.neutral === "yes" ? (building.service.phases === 1 ? building.service.voltageV : c.lineNeutralV) : null, source: c.supplySource }, "Confirm actual supply with the utility or installation records.");
  const mismatch = (building.service.phases === 1) !== (building.service.supplyType === "single");
  const loads = [...building.commonLoads, ...building.floors.flatMap(f => [...f.sharedLoads, ...f.apartments.flatMap(a => a.rooms.flatMap(r => r.loads))])];
  add("load-evidence", "Load schedule available", loads.length ? "WARNING" : "MISSING DATA", ["load ratings", "power factors", "duty and diversity factors"], "Template/user inputs need confirmation; a generated load schedule is not verified manufacturer evidence.", { loadCount: loads.length }, "Review equipment ratings, load voltages and phase allocations against the actual supply.");
  add("supply-consistency", "Phase count / supply type consistency", mismatch ? "FAIL" : "PASS", ["service.phases", "service.supplyType"], "Checks internal model agreement only; software consistency is not regulatory compliance.", { phases: building.service.phases, type: building.service.supplyType }, "Align supply type and phase count.");
  const earthingNeeds: Record<string, string> = {
    TT: "Obtain electrode resistance, protective-device/RCD characteristics and applicable touch-voltage/disconnection criteria.",
    "TN-S": "Obtain fault-loop impedance, protective-conductor continuity and protective-device disconnection characteristics.",
    "TN-C": "Review PEN conductor conditions and permitted protective arrangements using the national rules; do not reuse TN-S or TT assumptions.",
    "TN-C-S": "Confirm PEN separation location, bonding, downstream PE/N separation and fault-loop/device data.",
    IT: "Obtain insulation-monitoring, first-fault and second-fault protection arrangements and system impedance data.",
  };
  add("earthing", "Earthing and fault protection", c.earthing && c.earthingConfirmed ? "REQUIRES PROFESSIONAL REVIEW" : "MISSING DATA", ["earthing", "earthingConfirmed", "fault-protection evidence"], c.earthing ? earthingNeeds[c.earthing] : "Earthing is unknown; no arrangement is inferred from the project country.", { earthing: c.earthing, confirmed: c.earthingConfirmed }, "Obtain the system-specific evidence and verified national requirements.", "HD 60364 / national requirements — editions unverified", null);
  add("fault-current", "Available short-circuit information", c.faultCurrentKa && c.faultCurrentEvidence.trim() ? "REQUIRES PROFESSIONAL REVIEW" : "MISSING DATA", ["faultCurrentKa", "faultCurrentEvidence"], "User-supplied fault-current data is not an IEC 60909 calculation or breaking-capacity verification.", { kA: c.faultCurrentKa, source: c.faultCurrentEvidence }, "Confirm source, measurement point, maximum/minimum conditions and protective-device data.", "IEC 60909 candidate; edition and method not verified", null);
  add("technical-checks", "Installation / product technical verification", "NOT EVALUATED", ["verified editions", "licensed technical requirements", "installation conditions", "device characteristics", "test evidence"], "No normative numerical thresholds are implemented in Phases 1–2. Cable sizing, disconnection, thermal withstand, selectivity and assembly/machinery verification remain open.", {}, "Obtain authoritative references and required engineering evidence before implementing technical rules.", "Applicable technical sources pending verification", null);
  const matrix = applicabilityMatrix(c);
  return { registryVersion: REGISTRY_VERSION, checks, matrix, ce: ceScreening(c), calculations: projectCalculationEvidence(building), professionalApproval: "NOT ASSESSED" as const };
}
