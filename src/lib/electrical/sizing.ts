import {
  CABLE_CAPACITY_DISCLAIMER,
  CATALOGUE_DISCLAIMER,
  CONDUCTOR_RESISTIVITY_OHM_MM2_PER_M,
  STANDARD_BREAKER_RATINGS_A,
  VOLTAGE_DROP_ASSUMPTIONS,
  cableCapacityTableFor,
  type ConductorMaterial,
  type InstallationMethod,
} from "./catalogue";
import { ptRtiebtSizingRules, type SizingRule, unverifiedSizingRules } from "./rules/pt-rtiebt";
import type { CheckCategory, CheckStatus } from "./review";

export type SizingFinding = {
  id: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  detail: string;
  source: string;
};

export type SizingRequest = {
  designCurrentA: number;
  lengthM: number;
  phases: 1 | 3;
  voltageV: number;
  installMethod: InstallationMethod;
  maxVoltageDropPct: number;
  loadType: string;
  /** Optional; the bundled capacity tables are copper-based. Defaults to copper. */
  material?: ConductorMaterial;
};

export type SizingResult = {
  breakerA: number | null;
  cableMm2: number | null;
  voltageDropPct: number | null;
  findings: SizingFinding[];
};

/** Resistive voltage drop as a percentage of the nominal voltage. */
export function voltageDropPercent(input: {
  currentA: number;
  lengthM: number;
  phases: 1 | 3;
  voltageV: number;
  csaMm2: number;
  material?: ConductorMaterial;
}): number {
  const { currentA, lengthM, phases, voltageV, csaMm2 } = input;
  const material = input.material ?? "copper";
  if (voltageV <= 0 || csaMm2 <= 0) return Number.POSITIVE_INFINITY;
  const rho = CONDUCTOR_RESISTIVITY_OHM_MM2_PER_M[material];
  const k = phases === 3 ? VOLTAGE_DROP_ASSUMPTIONS.threePhaseFactor : VOLTAGE_DROP_ASSUMPTIONS.singlePhaseFactor;
  const dropVolts = (k * rho * lengthM * currentA) / csaMm2;
  return (dropVolts / voltageV) * 100;
}

function ruleSourceLabel(rule: SizingRule): string {
  return `${rule.sourceIdentifier} (${rule.sourceRef}, rule status: ${rule.status})`;
}

function unverifiedFindings(findings: SizingFinding[]): void {
  const unverified = unverifiedSizingRules();
  const refs = [...new Set(unverified.map((rule) => rule.sourceRef))].join(", ");
  findings.push({
    id: "sizing_rules_unverified",
    category: "regulatory",
    title: "Sizing rule set is unverified",
    status: "manual",
    detail:
      unverified.length > 0
        ? `${unverified.length} sizing rule(s) are marked "unverified" and require a named reviewer to confirm the text, edition and applicability. Source registry refs: ${refs}. The engine cannot confirm these rules.`
        : "No unverified sizing rules are present.",
    source: unverified.map(ruleSourceLabel).join(" | ") || "PT-RTIEBT sizing rule set",
  });
  findings.push({
    id: "sizing_data_unverified",
    category: "protection",
    title: "Catalogue data is unverified",
    status: "warn",
    detail: `${CABLE_CAPACITY_DISCLAIMER} ${CATALOGUE_DISCLAIMER}`,
    source: `Capacity table source: ${cableCapacityTableFor("concealed_in_wall").source}`,
  });
}

export function sizeCircuit(request: SizingRequest): SizingResult {
  const findings: SizingFinding[] = [];
  const { designCurrentA, lengthM, phases, voltageV, installMethod, maxVoltageDropPct, loadType } = request;
  const material: ConductorMaterial = request.material ?? "copper";

  if (material !== "copper") {
    findings.push({
      id: "sizing_material_unsupported",
      category: "missing_data",
      title: "Conductor material is not supported by the bundled capacity tables",
      status: "manual",
      detail: `The bundled current-carrying capacity tables are copper-based and must not be reused for ${material}. The engine will not pick a copper cable for an ${material} circuit. Supply a verified ${material} capacity table or select the conductor manually. No device or cable was selected.`,
      source: cableCapacityTableFor(installMethod).source,
    });
    unverifiedFindings(findings);
    return { breakerA: null, cableMm2: null, voltageDropPct: null, findings };
  }

  const invalidInput =
    !Number.isFinite(designCurrentA) ||
    designCurrentA <= 0 ||
    !Number.isFinite(lengthM) ||
    lengthM <= 0 ||
    !Number.isFinite(voltageV) ||
    voltageV <= 0 ||
    !Number.isFinite(maxVoltageDropPct) ||
    maxVoltageDropPct <= 0;

  if (invalidInput) {
    findings.push({
      id: "sizing_input",
      category: "missing_data",
      title: "Sizing inputs incomplete",
      status: "manual",
      detail: "Design current, length, voltage and maximum voltage drop must all be positive, finite numbers. No device or cable was selected.",
      source: "Sizing engine input validation",
    });
    unverifiedFindings(findings);
    return { breakerA: null, cableMm2: null, voltageDropPct: null, findings };
  }

  const breakerA = STANDARD_BREAKER_RATINGS_A.find((rating) => rating >= designCurrentA) ?? null;
  if (breakerA === null) {
    findings.push({
      id: "sizing_breaker",
      category: "protection",
      title: "No standard protective device",
      status: "manual",
      detail: `Design current ${designCurrentA.toFixed(2)} A exceeds the largest bundled standard rating (${STANDARD_BREAKER_RATINGS_A[STANDARD_BREAKER_RATINGS_A.length - 1]} A). Select the device manually. No cable was selected.`,
      source: "Bundled standard breaker rating list",
    });
    unverifiedFindings(findings);
    return { breakerA: null, cableMm2: null, voltageDropPct: null, findings };
  }

  const table = cableCapacityTableFor(installMethod);
  let selection: { csaMm2: number; dropPct: number } | null = null;

  for (const entry of table.entries) {
    if (entry.capacityA < breakerA) continue;
    const drop = voltageDropPercent({ currentA: designCurrentA, lengthM, phases, voltageV, csaMm2: entry.csaMm2, material });
    if (drop <= maxVoltageDropPct) {
      selection = { csaMm2: entry.csaMm2, dropPct: drop };
      break;
    }
  }

  if (selection === null) {
    const smallestCapacity = table.entries.find((entry) => entry.capacityA >= breakerA);
    findings.push({
      id: "sizing_cable",
      category: "voltage_drop",
      title: "No bundled cable satisfies all conditions",
      status: "manual",
      detail: smallestCapacity
        ? `No cable in the ${installMethod} table keeps the voltage drop at or below ${maxVoltageDropPct}% while carrying ${breakerA} A over ${lengthM} m. Select the conductor manually or obtain verified data. No cable was selected.`
        : `No cable in the ${installMethod} table can carry the selected ${breakerA} A device. Select the conductor manually or obtain verified data. No cable was selected.`,
      source: table.source,
    });
    unverifiedFindings(findings);
    return { breakerA, cableMm2: null, voltageDropPct: null, findings };
  }

  const { csaMm2: cableMm2, dropPct: voltageDropPct } = selection;
  const capacityOk = table.entries.some((entry) => entry.csaMm2 === cableMm2 && entry.capacityA >= breakerA);
  const dropOk = voltageDropPct <= maxVoltageDropPct;

  findings.push({
    id: "sizing_breaker",
    category: "protection",
    title: "Protective device selected",
    status: "pass",
    detail: `Smallest bundled standard rating at or above the ${designCurrentA.toFixed(2)} A design current: ${breakerA} A.`,
    source: "Bundled standard breaker rating list",
  });
  findings.push({
    id: "sizing_cable_capacity",
    category: "protection",
    title: "Cable capacity covers the device",
    status: capacityOk ? "pass" : "manual",
    detail: `Selected ${cableMm2} mm² conductor (${table.material}) for the ${installMethod} method; illustrative capacity covers the ${breakerA} A device.`,
    source: table.source,
  });
  findings.push({
    id: "sizing_voltage_drop",
    category: "voltage_drop",
    title: "Voltage drop within limit",
    status: dropOk ? "pass" : "manual",
    detail: `Estimated voltage drop ${voltageDropPct.toFixed(2)}% at ${designCurrentA.toFixed(2)} A over ${lengthM} m (${phases === 3 ? "three-phase" : "single-phase"}) is within the ${maxVoltageDropPct}% limit for load type "${loadType}".`,
    source: VOLTAGE_DROP_ASSUMPTIONS.method,
  });

  unverifiedFindings(findings);
  return { breakerA, cableMm2, voltageDropPct, findings };
}

export const SIZING_ENGINE_DISCLAIMER =
  "The sizing engine only selects from the bundled bounded rating list and illustrative capacity tables. It never approves a design, never claims regulatory compliance and returns a manual finding instead of guessing when no bundled combination fits.";

export { ptRtiebtSizingRules };
