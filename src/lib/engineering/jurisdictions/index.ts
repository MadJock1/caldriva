import type { Jurisdiction } from "../compliance/context";

export const jurisdictionPacks: Record<Jurisdiction, { name: string; referenceIds: string[]; status: string; action: string }> = {
  PT: { name: "Portugal", referenceIds: ["rtiebt", "pt-installations"], status: "Applicability scaffold — national source review required", action: "Confirm RTIEBT scope, consolidated legislation, utility requirements and installation characteristics. Earthing must be confirmed on site; no country-derived earthing default is applied." },
  FR: { name: "France", referenceIds: ["nf-c15-100"], status: "Future rule pack — not evaluated", action: "Obtain the applicable NF C 15-100 parts, editions and French legal requirements." },
  DE: { name: "Germany", referenceIds: ["vde-0100"], status: "Future rule pack — not evaluated", action: "Obtain applicable DIN VDE 0100 parts and utility requirements." },
  ES: { name: "Spain", referenceIds: ["rebt"], status: "Future rule pack — not evaluated", action: "Verify current REBT and applicable ITC-BT provisions." },
  OTHER: { name: "Other jurisdiction", referenceIds: [], status: "Unsupported jurisdiction — not evaluated", action: "A qualified reviewer must identify the national requirements and whether EU legislation applies." },
};
