import { planForFloor, setPhysicalRoutes } from "./plan";
import { pointCircuitMap } from "./schedule";
import type { ElectricalBuilding, FloorPlan, PhysicalRoute, RoutingZone, XYZ } from "./model";

export type PhysicalRouteDiagnosticCode = "MISSING_CONTAINMENT_ZONES" | "NO_VERIFIED_PHYSICAL_ROUTE_AVAILABLE" | "MISSING_DISTRIBUTION_BOARD" | "MISSING_POINT_ELEVATION" | "UNKNOWN_ELEMENT" | "STRUCTURAL_CROSSING" | "BEAM_OR_COLUMN" | "FIRE_PENETRATION_UNREVIEWED" | "FLOOR_CROSSING_WITHOUT_RISER" | "INVALID_ELEVATION" | "UNCONFIRMED_SHARED_CONTAINMENT" | "MISSING_CAPACITY_DATA" | "ROUTE_NEEDS_MANUAL_REVIEW";
export type PhysicalRouteDiagnostic = { code: PhysicalRouteDiagnosticCode; message: string; zoneId?: string };
export type PhysicalRouteResult = { route: PhysicalRoute | null; diagnostics: PhysicalRouteDiagnostic[]; uniqueContainmentLengthM: number; circuitCableLengthM: number };

const key = (point: XYZ) => `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
const distance = (a: XYZ, b: XYZ) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function zoneDiagnostics(zone: RoutingZone): PhysicalRouteDiagnostic[] {
  const diagnostics: PhysicalRouteDiagnostic[] = [];
  if (zone.polyline.some(point => !Number.isFinite(point.z) || point.z < 0)) diagnostics.push({ zoneId: zone.id, code: "INVALID_ELEVATION", message: "Routing-zone elevation must be a non-negative real value." });
  if (zone.crossingElement === "beam" || zone.crossingElement === "column") diagnostics.push({ zoneId: zone.id, code: "BEAM_OR_COLUMN", message: "Automatic penetration through a beam or column is prohibited." });
  if (zone.crossingElement === "unknown") diagnostics.push({ zoneId: zone.id, code: "UNKNOWN_ELEMENT", message: "A route cannot automatically cross an unknown construction element." });
  if (zone.crossingElement === "load_bearing_wall" && !zone.crossingReviewed) diagnostics.push({ zoneId: zone.id, code: "STRUCTURAL_CROSSING", message: "Load-bearing wall crossing requires explicit structural review." });
  if (zone.crossingElement === "fire_rated_partition" && !zone.crossingReviewed) diagnostics.push({ zoneId: zone.id, code: "FIRE_PENETRATION_UNREVIEWED", message: "Fire-rated boundary crossing requires a reviewed firestopping solution." });
  if (zone.crossingElement === "floor_slab" && (zone.containment !== "vertical_riser" || !zone.crossingReviewed)) diagnostics.push({ zoneId: zone.id, code: "FLOOR_CROSSING_WITHOUT_RISER", message: "Floor-slab crossing requires a reviewed, explicitly modeled vertical riser." });
  if (zone.widthM === null || zone.heightM === null) diagnostics.push({ zoneId: zone.id, code: "MISSING_CAPACITY_DATA", message: "Containment dimensions are missing; cable capacity and grouping are not established." });
  return diagnostics;
}

function prohibited(diagnostic: PhysicalRouteDiagnostic) {
  return ["INVALID_ELEVATION", "BEAM_OR_COLUMN", "UNKNOWN_ELEMENT", "STRUCTURAL_CROSSING", "FIRE_PENETRATION_UNREVIEWED", "FLOOR_CROSSING_WITHOUT_RISER"].includes(diagnostic.code);
}

/** Runs Dijkstra only across explicit, reviewed construction pathways. Coordinates are metres. */
export function findPhysicalRoute(plan: FloorPlan, source: XYZ, target: XYZ, id = "physical-route"): PhysicalRouteResult {
  if (plan.routingZones.length === 0) return { route: null, diagnostics: [{ code: "MISSING_CONTAINMENT_ZONES", message: "No confirmed containment zones have been modeled." }, { code: "NO_VERIFIED_PHYSICAL_ROUTE_AVAILABLE", message: "NO VERIFIED PHYSICAL ROUTE AVAILABLE" }], uniqueContainmentLengthM: 0, circuitCableLengthM: 0 };
  const diagnostics = plan.routingZones.flatMap(zoneDiagnostics);
  const usable = plan.routingZones.filter(zone => !zoneDiagnostics(zone).some(prohibited));
  const adjacency = new Map<string, Array<{ to: XYZ; zone: RoutingZone; length: number }>>();
  const add = (from: XYZ, to: XYZ, zone: RoutingZone) => {
    const entries = adjacency.get(key(from)) ?? [];
    entries.push({ to, zone, length: distance(from, to) }); adjacency.set(key(from), entries);
  };
  for (const zone of usable) for (let i = 1; i < zone.polyline.length; i += 1) { add(zone.polyline[i - 1], zone.polyline[i], zone); add(zone.polyline[i], zone.polyline[i - 1], zone); }
  const sourceKey = key(source), targetKey = key(target);
  const queue: Array<{ node: XYZ; cost: number }> = [{ node: source, cost: 0 }];
  const costs = new Map([[sourceKey, 0]]); const previous = new Map<string, { from: XYZ; zone: RoutingZone }>();
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost); const current = queue.shift()!;
    if (key(current.node) === targetKey) break;
    for (const edge of adjacency.get(key(current.node)) ?? []) {
      const nextCost = current.cost + edge.length;
      if (nextCost < (costs.get(key(edge.to)) ?? Infinity)) { costs.set(key(edge.to), nextCost); previous.set(key(edge.to), { from: current.node, zone: edge.zone }); queue.push({ node: edge.to, cost: nextCost }); }
    }
  }
  if (!previous.has(targetKey)) return { route: null, diagnostics: [...diagnostics, { code: "NO_VERIFIED_PHYSICAL_ROUTE_AVAILABLE", message: "NO VERIFIED PHYSICAL ROUTE AVAILABLE: source and target are not connected by validated containment." }], uniqueContainmentLengthM: 0, circuitCableLengthM: 0 };
  const segments: PhysicalRoute["segments"] = [];
  let current = target;
  while (key(current) !== sourceKey) { const step = previous.get(key(current))!; segments.unshift({ zoneId: step.zone.id, start: step.from, end: current, containment: step.zone.containment, lengthM: distance(step.from, current), crossingElement: step.zone.crossingElement, crossingId: step.zone.crossingId, reviewed: step.zone.reviewStatus === "REVIEWED" && step.zone.crossingReviewed }); current = step.from; }
  const length = segments.reduce((sum, segment) => sum + segment.lengthM, 0);
  const needsReview = segments.some(segment => !segment.reviewed);
  if (needsReview) diagnostics.push({ code: "ROUTE_NEEDS_MANUAL_REVIEW", message: "Proposed route uses containment or crossings not yet accepted by an authorized engineering reviewer." });
  const shared = new Set(plan.physicalRoutes.flatMap(route => route.segments.map(segment => `${segment.zoneId}:${key(segment.start)}:${key(segment.end)}`)));
  if (segments.some(segment => shared.has(`${segment.zoneId}:${key(segment.start)}:${key(segment.end)}`) || shared.has(`${segment.zoneId}:${key(segment.end)}:${key(segment.start)}`))) diagnostics.push({ code: "UNCONFIRMED_SHARED_CONTAINMENT", message: "Shared containment requires compatibility, grouping, thermal, separation, fire-performance, and capacity review." });
  return { route: { id, circuitId: null, pointId: null, state: "PROPOSED_PHYSICAL", segments, reviewNote: "" }, diagnostics, uniqueContainmentLengthM: length, circuitCableLengthM: length };
}

export type PhysicalRouteGeneration = { building: ElectricalBuilding; diagnostics: PhysicalRouteDiagnostic[]; generated: number };

/** Creates proposals only where board and endpoint elevations are explicitly modeled. */
export function generatePhysicalRoutes(building: ElectricalBuilding, floorId: string): PhysicalRouteGeneration {
  const plan = planForFloor(building, floorId);
  if (!plan) return { building, diagnostics: [{ code: "NO_VERIFIED_PHYSICAL_ROUTE_AVAILABLE", message: "No floor plan exists for this floor." }], generated: 0 };
  const board = plan.points.find(point => point.kind === "db");
  if (!board) return { building, diagnostics: [{ code: "MISSING_DISTRIBUTION_BOARD", message: "A modeled distribution-board point is required for proposed physical routes." }], generated: 0 };
  if (board.elevationM === null) return { building, diagnostics: [{ code: "MISSING_POINT_ELEVATION", message: "Distribution-board elevation is required for proposed physical routes." }], generated: 0 };
  const assignments = pointCircuitMap(building); const routes: PhysicalRoute[] = []; const diagnostics: PhysicalRouteDiagnostic[] = [];
  for (const point of plan.points) {
    const assignment = assignments.get(point.id);
    if (!assignment?.circuitId || point.kind === "db") continue;
    if (point.elevationM === null) { diagnostics.push({ code: "MISSING_POINT_ELEVATION", message: `Point ${point.id} has no explicit elevation.`, zoneId: point.id }); continue; }
    const result = findPhysicalRoute({ ...plan, physicalRoutes: routes }, { x: board.x, y: board.y, z: board.elevationM }, { x: point.x, y: point.y, z: point.elevationM }, `physical-${point.id}`);
    diagnostics.push(...result.diagnostics);
    if (result.route) routes.push({ ...result.route, circuitId: assignment.circuitId, pointId: point.id });
  }
  return { building: setPhysicalRoutes(building, floorId, routes), diagnostics, generated: routes.length };
}
