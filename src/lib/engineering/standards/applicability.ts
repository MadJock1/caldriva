import { type ComplianceContext } from "../compliance/context";
import { INSTALLATIONS, PRODUCTS, standardsRegistry, type Reference } from "./registry";

export type Applicability = { reference: Reference; status: "CANDIDATE" | "NOT APPLICABLE" | "MISSING DATA" | "NOT EVALUATED"; reason: string; action: string };

/** Applicability screening only: no candidate is an assertion of legal applicability. */
export function applicabilityMatrix(context: ComplianceContext): Applicability[] {
  return standardsRegistry.map(reference => {
    const row = (status: Applicability["status"], reason: string): Applicability => ({ reference, status, reason, action: status === "NOT APPLICABLE" ? "Re-screen if project scope changes." : reference.conditions + " " + reference.verificationScope });
    if (!context.category || !context.jurisdiction) return row("MISSING DATA", "Confirm project category and jurisdiction before applying references.");
    if (context.category === "other" || context.jurisdiction === "OTHER") return row("NOT EVALUATED", "Project scope or jurisdiction is outside the implemented classifier; individual source review required.");
    if (!["EU", "INTERNATIONAL", context.jurisdiction].includes(reference.jurisdiction)) return row("NOT APPLICABLE", "Different national jurisdiction.");
    if (!reference.categories.includes(context.category)) return row("NOT APPLICABLE", "Outside this category's preliminary scope; equipment inside an installation may require its own product assessment.");
    if (reference.id.startsWith("61439")) {
      if (!context.assemblyType) return row("MISSING DATA", "Select the assembly type being assessed, including any assembly within an installation.");
      if (context.assemblyType === "other") return row("NOT EVALUATED", "Select the appropriate 61439 product part with a qualified reviewer.");
      if (reference.id === "61439-2" && context.assemblyType !== "power" || reference.id === "61439-3" && context.assemblyType !== "ordinary_persons") return row("NOT APPLICABLE", "A different assembly product part was selected.");
    }
    const machineRelated = ["machinery-directive", "machinery-regulation", "60204-1", "functional-safety"].includes(reference.id);
    if (machineRelated && context.category === "control_cabinet") {
      if (context.machineIntegration === "unknown") return row("MISSING DATA", "Confirm whether the cabinet forms part of machinery.");
      if (context.machineIntegration === "no") return row("NOT APPLICABLE", "Cabinet declared outside machinery scope.");
    }
    if (reference.id.startsWith("machinery-")) {
      if (!context.marketDate) return row("MISSING DATA", "Record the planned placing-on-market / putting-into-service date for transition screening.");
      const future = context.marketDate >= "2027-01-20";
      if (future === (reference.id === "machinery-directive")) return row("NOT APPLICABLE", "Outside the general application period for this project date; exceptional transition provisions still require review.");
    }
    if (reference.id === "lvd" || reference.id === "ecodesign") {
      if (context.productOnMarket === "unknown") return row("MISSING DATA", "Confirm whether the project is a product placed on the EU market.");
      if (context.productOnMarket === "no") return row("NOT APPLICABLE", "No marketed product declared; review separately if scope changes.");
      if (reference.id === "ecodesign") return row("NOT EVALUATED", "Product group and applicable measure have not been identified.");
    }
    if (reference.id === "emc" && context.emcScope === "unknown") return row("MISSING DATA", "Distinguish apparatus from a fixed installation before evaluating EMC obligations.");
    return row("CANDIDATE", reference.conditions);
  });
}

export function ceScreening(context: ComplianceContext): string {
  if (!context.category) return "Classify the project before screening product documentation obligations.";
  if (INSTALLATIONS.includes(context.category)) return "Installation scope: no CE marking is awarded to the building installation. Assess incorporated products separately; fixed-installation EMC obligations may still apply.";
  if (PRODUCTS.includes(context.category) && context.productOnMarket === "yes") return "Product documentation candidate only. Assess each legislative instrument and its exclusions individually; manufacturer responsibilities and authorized conformity assessment remain outstanding.";
  return "Product scope not established; CE documentation obligations are not evaluated.";
}
