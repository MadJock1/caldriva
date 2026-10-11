import { defaultBrief, generateBuilding } from "../../electrical/generate";
import { initialElectricalBuilding, type ElectricalBuilding } from "../../electrical/model";
import { newComplianceContext } from "../compliance/context";

/** Classification fixtures, not independently approved engineering designs. */
export function exampleProjects(): Record<"A" | "B" | "C" | "D", ElectricalBuilding> {
  const context = { ...newComplianceContext(), jurisdiction: "PT" as const };
  return {
    A: { ...generateBuilding({ ...defaultBrief, name: "A — Portuguese house", floors: [{ level: 0, kind: "ground", template: "T2", apartmentCount: 1 }] }), compliance: { ...context, category: "residential", assemblyType: "ordinary_persons", emcScope: "fixed_installation", productOnMarket: "no" } },
    B: { ...generateBuilding({ ...defaultBrief, name: "B — Five-floor residential building" }), compliance: { ...context, category: "apartment_building", assemblyType: "ordinary_persons", emcScope: "fixed_installation", productOnMarket: "no" } },
    C: { ...initialElectricalBuilding, name: "C — 630 A industrial distribution board", compliance: { ...context, category: "assembly", assemblyType: "power", assemblyRatedCurrentA: 630, productOnMarket: "yes", emcScope: "apparatus" } },
    D: { ...initialElectricalBuilding, name: "D — Automated packaging machine", compliance: { ...context, category: "machinery", productOnMarket: "yes", emcScope: "apparatus", marketDate: "2026-10-11" } },
  };
}
