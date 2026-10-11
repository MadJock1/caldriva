import { z } from "zod";
import { buildingSummary, lineCurrentA } from "../../electrical/loads";
import { ENGINE_VERSION, type ElectricalBuilding } from "../../electrical/model";

const currentInputs = z.object({ apparentVA: z.number().finite().min(0), volts: z.number().finite().positive(), phases: z.union([z.literal(1), z.literal(3)]) });
export function currentEvidence(input: z.infer<typeof currentInputs>) {
  const parsed = currentInputs.parse(input);
  return { inputs: parsed, inputUnits: { apparentVA: "VA", volts: "V", phases: "count" }, formula: parsed.phases === 1 ? "I = S / U" : "I = S / (sqrt(3) × U_LL)", result: lineCurrentA(parsed.apparentVA, parsed.volts, parsed.phases), unit: "A", assumptions: ["RMS AC quantities; balanced load assumed for three-phase current."], reference: "Electrical power identity; not a regulatory acceptance test", engineVersion: ENGINE_VERSION };
}

export function projectCalculationEvidence(building: ElectricalBuilding) {
  const summary = buildingSummary(building);
  return {
    engineVersion: ENGINE_VERSION,
    current: currentEvidence({ apparentVA: summary.demandVA, volts: building.service.voltageV, phases: building.service.phases }),
    connectedW: summary.connected.connectedW, connectedVA: summary.connected.connectedVA, demandVA: summary.demandVA,
    method: "Existing buildingSummary: per-load W × quantity; VA = W / PF; demand uses utilisation, demand factors, diversity and margin.",
    assumptions: { apartmentDiversity: building.service.apartmentDiversity, buildingDiversity: building.service.buildingDiversity, designMargin: building.service.designMargin },
    warnings: ["Load ratings, power factors and duty factors are user/template assumptions.", "Aggregate three-phase current assumes balance; it is not a conductor or protection-device selection.", "Frequency, source impedance, cable installation conditions and protective-device data are not modelled by this power identity."],
  };
}
