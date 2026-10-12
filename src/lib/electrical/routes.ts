import { generateDistribution, type DistributionModel } from "./circuits";
import { planForFloor, setPlanRoutes } from "./plan";
import { pointCircuitMap } from "./schedule";
import {
  DEFAULT_CABLE_CSA,
  uniqueId,
  type CableAssumptions,
  type CableRoute,
  type CircuitType,
  type ElectricalBuilding,
  type FloorPlan,
  type XY,
} from "./model";

export type RouteDiagnostic = { routeId: string; code: "OUT_OF_BOUNDS" | "ZERO_LENGTH_SEGMENT" | "DUPLICATE_SEGMENT"; message: string };

export const RESISTIVITY: Record<CableAssumptions["material"], number> = { copper: 0.0225, aluminium: 0.036 };

export function polylineLength(polyline: XY[]): number {
  let total = 0;
  for (let i = 1; i < polyline.length; i += 1) {
    total += Math.hypot(polyline[i].x - polyline[i - 1].x, polyline[i].y - polyline[i - 1].y);
  }
  return total;
}

export function routeLength(route: CableRoute): number {
  return polylineLength(route.polyline);
}

export function routeDiagnostics(plan: FloorPlan): RouteDiagnostic[] {
  const diagnostics: RouteDiagnostic[] = [];
  const segments = new Map<string, string>();
  for (const route of plan.routes) {
    for (let index = 1; index < route.polyline.length; index += 1) {
      const a = route.polyline[index - 1], b = route.polyline[index];
      if (a.x < 0 || a.x > plan.width || a.y < 0 || a.y > plan.depth || b.x < 0 || b.x > plan.width || b.y < 0 || b.y > plan.depth) diagnostics.push({ routeId: route.id, code: "OUT_OF_BOUNDS", message: "Route contains a vertex outside the drawing boundary." });
      if (a.x === b.x && a.y === b.y) diagnostics.push({ routeId: route.id, code: "ZERO_LENGTH_SEGMENT", message: "Route contains a zero-length segment." });
      const forward = `${a.x},${a.y}:${b.x},${b.y}`;
      const reverse = `${b.x},${b.y}:${a.x},${a.y}`;
      const existing = segments.get(forward) ?? segments.get(reverse);
      if (existing && existing !== route.id) diagnostics.push({ routeId: route.id, code: "DUPLICATE_SEGMENT", message: `Route reuses a segment from ${existing}; shared containment is not yet confirmed.` });
      else segments.set(forward, route.id);
    }
  }
  return diagnostics;
}

export function boardAnchor(plan: FloorPlan): XY {
  const db = plan.points.find(p => p.kind === "db");
  if (db) return { x: db.x, y: db.y };
  return { x: 0.5, y: 0.5 };
}

export function manhattanRoute(a: XY, b: XY): XY[] {
  if (a.x === b.x || a.y === b.y) return [a, b];
  return [a, { x: b.x, y: a.y }, b];
}

export function autoRoutePlan(building: ElectricalBuilding, floorId: string): ElectricalBuilding {
  const plan = planForFloor(building, floorId);
  if (!plan) return building;
  const assignments = pointCircuitMap(building);
  const anchor = boardAnchor(plan);
  const taken = new Set<string>();
  const routes: CableRoute[] = [];
  for (const point of plan.points) {
    const assignment = assignments.get(point.id);
    if (!assignment?.circuitId) continue;
    const id = uniqueId(`rt-${point.id}`, c => taken.has(c));
    taken.add(id);
    routes.push({ id, circuitId: assignment.circuitId, pointId: point.id, polyline: manhattanRoute(anchor, { x: point.x, y: point.y }) });
  }
  return setPlanRoutes(building, floorId, routes);
}

export type CircuitRouteSummary = { circuitId: string; maxBranchM: number; totalM: number; branchCount: number };

export function circuitRouteSummary(building: ElectricalBuilding): Map<string, CircuitRouteSummary> {
  const summary = new Map<string, CircuitRouteSummary>();
  for (const plan of building.plans) {
    for (const route of plan.routes) {
      if (!route.circuitId) continue;
      const length = routeLength(route);
      const current = summary.get(route.circuitId) ?? { circuitId: route.circuitId, maxBranchM: 0, totalM: 0, branchCount: 0 };
      current.maxBranchM = Math.max(current.maxBranchM, length);
      current.totalM += length;
      current.branchCount += 1;
      summary.set(route.circuitId, current);
    }
  }
  return summary;
}

export function csaFor(type: CircuitType, assumptions: CableAssumptions): number {
  const table = { ...DEFAULT_CABLE_CSA, ...assumptions.csaByType };
  const value = table[type];
  return typeof value === "number" && value > 0 ? value : DEFAULT_CABLE_CSA[type];
}

export type DropResult = {
  lengthM: number;
  csaMm2: number;
  currentA: number;
  phases: 1 | 3;
  nominalV: number;
  dropVolts: number;
  dropPercent: number;
};

export function voltageDrop(
  circuit: { currentA: number; phases: 1 | 3; type: CircuitType },
  lengthM: number,
  building: ElectricalBuilding,
): DropResult {
  const assumptions = building.cableAssumptions;
  const rho = RESISTIVITY[assumptions.material];
  const csaMm2 = csaFor(circuit.type, assumptions);
  const three = circuit.phases === 3;
  const nominalV = three ? building.service.voltageV : building.service.supplyType === "three" ? building.service.voltageV / Math.sqrt(3) : building.service.voltageV;
  const dropVolts = ((three ? Math.sqrt(3) : 2) * rho * lengthM * circuit.currentA) / csaMm2;
  return { lengthM, csaMm2, currentA: circuit.currentA, phases: circuit.phases, nominalV, dropVolts, dropPercent: nominalV > 0 ? (dropVolts / nominalV) * 100 : 0 };
}

export type DropRow = DropResult & {
  circuitId: string;
  boardId: string;
  code: string;
  type: CircuitType;
  status: "pass" | "warn";
};

export type VoltageDropReport = {
  rows: DropRow[];
  maxDropPercent: number;
  limitPercent: number;
  overLimit: number;
  material: CableAssumptions["material"];
};

export function voltageDropReport(building: ElectricalBuilding, distribution?: DistributionModel): VoltageDropReport {
  const dist = distribution ?? generateDistribution(building);
  const summary = circuitRouteSummary(building);
  const limitPercent = building.cableAssumptions.maxDropPercent;
  const rows: DropRow[] = [];
  for (const board of dist.boards) {
    for (const circuit of board.circuits) {
      const route = summary.get(circuit.id);
      if (!route) continue;
      const drop = voltageDrop({ currentA: circuit.currentA, phases: circuit.phases, type: circuit.type }, route.maxBranchM, building);
      rows.push({ ...drop, circuitId: circuit.id, boardId: board.id, code: circuit.code, type: circuit.type, status: drop.dropPercent <= limitPercent ? "pass" : "warn" });
    }
  }
  rows.sort((a, b) => b.dropPercent - a.dropPercent);
  const maxDropPercent = rows.reduce((n, r) => Math.max(n, r.dropPercent), 0);
  return { rows, maxDropPercent, limitPercent, overLimit: rows.filter(r => r.status === "warn").length, material: building.cableAssumptions.material };
}
