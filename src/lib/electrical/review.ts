import { buildingSummary } from "./loads";
import { generateDistribution } from "./circuits";
import { pointCoverageStats, uncoveredPoints } from "./schedule";
import { voltageDropReport } from "./routes";
import { APPLIANCES, type ElectricalBuilding, type ReviewStatus } from "./model";

export type CheckCategory =
  | "missing_data"
  | "geometry"
  | "loading"
  | "circuits"
  | "phase"
  | "protection"
  | "earthing"
  | "voltage_drop"
  | "safety_zone"
  | "regulatory";

export type CheckStatus = "pass" | "warn" | "blocked" | "manual";

export type Check = {
  id: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  detail: string;
};

export type DesignReview = {
  checks: Check[];
  status: ReviewStatus;
  blocked: number;
  warnings: number;
  manual: number;
};

export const categoryLabels: Record<CheckCategory, string> = {
  missing_data: "Missing data",
  geometry: "Geometry",
  loading: "Electrical loading",
  circuits: "Circuit completeness",
  phase: "Phase allocation",
  protection: "Protection coordination",
  earthing: "Earthing information",
  voltage_drop: "Voltage-drop verification",
  safety_zone: "Safety zones",
  regulatory: "Regulatory review",
};

const MANUALS: { id: string; category: CheckCategory; title: string; detail: string }[] = [
  { id: "protection", category: "protection", title: "Protective device selection", detail: "Cable and protective-device selection needs verified installation data (routes, grouping, ambient temperature). Not automatically determined." },
  { id: "earthing", category: "earthing", title: "Earthing and bonding", detail: "Earthing system type, earth-electrode resistance and equipotential bonding require site data and professional verification." },
  { id: "safety_zone", category: "safety_zone", title: "Bathroom / special-location zones", detail: "Equipment positions in bathroom and special-location zones require manual confirmation against the applicable rules." },
  { id: "regulatory", category: "regulatory", title: "Wiring-regulation review", detail: `${"Portugal (RTIEBT) and other jurisdictions must be confirmed by a qualified professional; the system does not certify compliance."}` },
];

export function designReview(building: ElectricalBuilding): DesignReview {
  const checks: Check[] = [];
  const summary = buildingSummary(building);
  const distribution = generateDistribution(building);

  const totalLoads = building.floors.flatMap(f => f.apartments.flatMap(a => a.rooms.flatMap(r => r.loads)));
  const apartmentCount = summary.apartmentCount;

  checks.push(
    building.floors.length
      ? { id: "floors", category: "missing_data", title: "Floors defined", status: "pass", detail: `${building.floors.length} floor(s) defined.` }
      : { id: "floors", category: "missing_data", title: "Floors defined", status: "blocked", detail: "No floors defined. Generate a building or add floors." },
  );
  checks.push(
    apartmentCount
      ? { id: "apartments", category: "missing_data", title: "Apartments defined", status: "pass", detail: `${apartmentCount} apartment instance(s) across all floors.` }
      : { id: "apartments", category: "missing_data", title: "Apartments defined", status: "warn", detail: "No apartments. Common services will still be modelled." },
  );

  const zeroRated = totalLoads.filter(l => l.ratedWatts <= 0 && l.quantity > 0);
  checks.push(
    zeroRated.length
      ? { id: "ratings", category: "missing_data", title: "Appliance ratings known", status: "warn", detail: `${zeroRated.length} load(s) have a zero rating. Set rated power for a meaningful result.` }
      : { id: "ratings", category: "missing_data", title: "Appliance ratings known", status: "pass", detail: "All active loads have a positive rated power." },
  );

  const missingRating = [...totalLoads, ...building.commonLoads].filter(
    l => l.quantity > 0 && (l.ratedWatts <= 0 || l.powerFactor <= 0),
  );
  if (missingRating.length) checks.push({ id: "unknown_ratings", category: "loading", title: "Unknown equipment ratings", status: "warn", detail: `${missingRating.length} load(s) rely on default or unverified ratings.` });

  const assignedIds = new Set(distribution.boards.flatMap(b => b.circuits.flatMap(c => c.loadIds)));
  const activeLoads = [...totalLoads, ...building.floors.flatMap(f => f.sharedLoads), ...building.commonLoads].filter(l => l.quantity > 0);
  const unassigned = activeLoads.filter(l => !assignedIds.has(l.id));
  checks.push(
    unassigned.length
      ? { id: "unassigned", category: "circuits", title: "Equipment circuit assignment", status: "blocked", detail: `${unassigned.length} active load(s) are not assigned to any circuit.` }
      : { id: "unassigned", category: "circuits", title: "Equipment circuit assignment", status: "pass", detail: `All ${activeLoads.length} active load(s) are assigned to ${distribution.circuitCount} circuit(s).` },
  );

  const imbalance = summary.balance.imbalancePercent;
  checks.push(
    summary.phases === 1
      ? { id: "phase", category: "phase", title: "Phase balance", status: "pass", detail: "Single-phase supply; phase balancing not applicable." }
      : imbalance <= 15
        ? { id: "phase", category: "phase", title: "Phase balance", status: "pass", detail: `Estimated phase imbalance ${imbalance.toFixed(1)}% (target ≤ 15%).` }
        : { id: "phase", category: "phase", title: "Phase balance", status: "warn", detail: `Estimated phase imbalance ${imbalance.toFixed(1)}% exceeds 15%. Rebalance circuits.` },
  );

  checks.push({ id: "geometry", category: "geometry", title: "Architectural geometry", status: "manual", detail: building.plans.some(p => p.rooms.length) ? `Manual floor-plan geometry placed for ${building.plans.filter(p => p.rooms.length).length} floor(s). Route lengths, cable quantities and voltage drop are not modelled.` : "No floor-plan geometry placed and no CAD geometry imported. Room coordinates, route lengths and cable quantities are not modelled in this phase." });

  const coverage = pointCoverageStats(building, distribution);
  if (coverage.total > 0) {
    const gaps = uncoveredPoints(building, distribution).length;
    checks.push(
      gaps
        ? { id: "point_coverage", category: "circuits", title: "Floor-plan point coverage", status: "warn", detail: `${gaps} of ${coverage.total} circuit-requiring point(s) are not assigned to a circuit. Link their rooms to the hierarchy and regenerate the distribution.` }
        : { id: "point_coverage", category: "circuits", title: "Floor-plan point coverage", status: "pass", detail: `All ${coverage.total} circuit-requiring point(s) sit on ${coverage.circuitsUsed} circuit(s).` },
    );
  } else {
    checks.push({ id: "point_coverage", category: "circuits", title: "Floor-plan point coverage", status: "manual", detail: "No circuit-requiring points placed on the floor plans. Lay out rooms and generate points, or confirm the load model is intended to stand alone." });
  }

  const drop = voltageDropReport(building, distribution);
  if (drop.rows.length) {
    checks.push(
      drop.overLimit
        ? { id: "voltage_drop", category: "voltage_drop", title: "Voltage-drop verification", status: "warn", detail: `Estimated worst-case voltage drop ${drop.maxDropPercent.toFixed(1)}% exceeds the ${drop.limitPercent}% target on ${drop.overLimit} circuit(s), using assumed cable sizes. Confirm against the final cable schedule and route lengths.` }
        : { id: "voltage_drop", category: "voltage_drop", title: "Voltage-drop verification", status: "pass", detail: `Estimated worst-case voltage drop ${drop.maxDropPercent.toFixed(1)}% is within the ${drop.limitPercent}% target across ${drop.rows.length} routed circuit(s), using assumed ${drop.material} cable sizes. Preliminary estimate.` },
    );
  } else {
    checks.push({ id: "voltage_drop", category: "voltage_drop", title: "Voltage-drop verification", status: "manual", detail: "No cable routes sketched on the floor plans. Route the points and re-run to estimate voltage drop from assumed cable sizes." });
  }

  checks.push({ id: "loading_info", category: "loading", title: "Demand basis", status: "pass", detail: `Estimated maximum demand ${(summary.demandWithMargin.demandVA / 1000).toFixed(1)} kVA from explicit factors and a ${(building.service.designMargin * 100).toFixed(0)}% design margin.` });

  for (const manual of MANUALS) checks.push({ ...manual, status: "manual" });

  const blocked = checks.filter(c => c.status === "blocked").length;
  const warnings = checks.filter(c => c.status === "warn").length;
  const manual = checks.filter(c => c.status === "manual").length;
  const status: ReviewStatus = blocked > 0 ? "NEEDS_REVIEW" : building.reviewStatus === "APPROVED" ? "APPROVED" : "GENERATED";

  return { checks, status, blocked, warnings, manual };
}

export function applianceCatalogue() {
  return Object.entries(APPLIANCES).map(([kind, spec]) => ({ kind, ...spec }));
}
