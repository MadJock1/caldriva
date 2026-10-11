import { generateDistribution, type Circuit, type DistributionModel } from "./circuits";
import type {
  CircuitType,
  ElectricalBuilding,
  ElectricalPoint,
  LoadItem,
  Phase,
  PointKind,
} from "./model";

export const POINT_CIRCUIT_TYPES: Record<PointKind, CircuitType[]> = {
  lighting: ["LGT"],
  socket: ["SOC"],
  switch: [],
  dedicated: ["KITCHEN", "DED"],
  hvac: ["HVAC"],
  data: [],
  db: [],
};

export function pointRequiresCircuit(kind: PointKind) {
  return POINT_CIRCUIT_TYPES[kind].length > 0;
}

export function circuitIndex(distribution: DistributionModel): Map<string, Circuit> {
  const map = new Map<string, Circuit>();
  for (const board of distribution.boards) for (const circuit of board.circuits) map.set(circuit.id, circuit);
  return map;
}

function mapLoad(load: LoadItem, byLoadId: Map<string, string>): LoadItem {
  const circuitId = byLoadId.get(load.id) ?? null;
  return load.circuitId === circuitId ? load : { ...load, circuitId };
}

export function assignCircuitIds(building: ElectricalBuilding, distribution?: DistributionModel): ElectricalBuilding {
  const dist = distribution ?? generateDistribution(building);
  const byLoadId = new Map<string, string>();
  for (const board of dist.boards) for (const circuit of board.circuits) for (const id of circuit.loadIds) byLoadId.set(id, circuit.id);
  return {
    ...building,
    commonLoads: building.commonLoads.map(l => mapLoad(l, byLoadId)),
    floors: building.floors.map(floor => ({
      ...floor,
      sharedLoads: floor.sharedLoads.map(l => mapLoad(l, byLoadId)),
      apartments: floor.apartments.map(apartment => ({
        ...apartment,
        rooms: apartment.rooms.map(room => ({ ...room, loads: room.loads.map(l => mapLoad(l, byLoadId)) })),
      })),
    })),
  };
}

export type PointAssignment = {
  point: ElectricalPoint;
  floorId: string;
  planRoomId: string;
  circuitId: string | null;
  circuit: Circuit | null;
};

function pickCircuit(circuits: Circuit[], candidates: CircuitType[], roomLoadIds: Set<string>): Circuit | null {
  const eligible = circuits.filter(c => candidates.includes(c.type));
  const intersecting = eligible.find(c => c.loadIds.some(id => roomLoadIds.has(id)));
  return intersecting ?? eligible[0] ?? null;
}

export function pointCircuitMap(building: ElectricalBuilding, distribution?: DistributionModel): Map<string, PointAssignment> {
  const dist = distribution ?? generateDistribution(building);
  const assignments = new Map<string, PointAssignment>();
  for (const plan of building.plans) {
    const floor = building.floors.find(f => f.id === plan.floorId);
    for (const point of plan.points) {
      if (!point.roomId) continue;
      const planRoom = plan.rooms.find(r => r.id === point.roomId);
      const assignment: PointAssignment = { point, floorId: plan.floorId, planRoomId: point.roomId, circuitId: null, circuit: null };
      const candidates = POINT_CIRCUIT_TYPES[point.kind];
      if (planRoom?.roomId && floor && candidates.length) {
        const apartment = floor.apartments.find(a => a.rooms.some(r => r.id === planRoom.roomId));
        const room = apartment?.rooms.find(r => r.id === planRoom.roomId);
        const board = apartment ? dist.boards.find(b => b.id === `ADB-${apartment.id}`) : undefined;
        if (board && room) {
          const roomLoadIds = new Set(room.loads.filter(l => l.quantity > 0).map(l => l.id));
          const circuit = pickCircuit(board.circuits, candidates, roomLoadIds);
          if (circuit) {
            assignment.circuitId = circuit.id;
            assignment.circuit = circuit;
          }
        }
      }
      assignments.set(point.id, assignment);
    }
  }
  return assignments;
}

export type PointScheduleRow = {
  circuitId: string;
  boardId: string;
  code: string;
  function: string;
  type: CircuitType;
  phase: Phase | null;
  floorId: string;
  pointCount: number;
  demandVA: number;
  rooms: string[];
};

export function schedulePoints(building: ElectricalBuilding, distribution?: DistributionModel): PointScheduleRow[] {
  const dist = distribution ?? generateDistribution(building);
  const assignments = pointCircuitMap(building, dist);
  const rows = new Map<string, PointScheduleRow>();
  for (const plan of building.plans) {
    for (const point of plan.points) {
      const assignment = assignments.get(point.id);
      const circuit = assignment?.circuit;
      if (!circuit || !assignment?.circuitId) continue;
      const planRoom = plan.rooms.find(r => r.id === point.roomId);
      const row = rows.get(circuit.id) ?? {
        circuitId: circuit.id,
        boardId: circuit.boardId,
        code: circuit.code,
        function: circuit.function,
        type: circuit.type,
        phase: circuit.phase,
        floorId: plan.floorId,
        pointCount: 0,
        demandVA: circuit.totals.demandVA,
        rooms: [],
      };
      row.pointCount += 1;
      if (planRoom && !row.rooms.includes(planRoom.label)) row.rooms.push(planRoom.label);
      rows.set(circuit.id, row);
    }
  }
  return [...rows.values()].sort((a, b) => (a.boardId === b.boardId ? a.code.localeCompare(b.code) : a.boardId.localeCompare(b.boardId)));
}

export function uncoveredPoints(building: ElectricalBuilding, distribution?: DistributionModel): PointAssignment[] {
  const assignments = pointCircuitMap(building, distribution);
  return [...assignments.values()].filter(a => pointRequiresCircuit(a.point.kind) && !a.circuitId);
}

export type PointCoverageStats = {
  total: number;
  covered: number;
  uncovered: number;
  circuitsUsed: number;
  perKind: Record<PointKind, number>;
};

export function pointCoverageStats(building: ElectricalBuilding, distribution?: DistributionModel): PointCoverageStats {
  const assignments = [...pointCircuitMap(building, distribution).values()];
  const perKind: Record<PointKind, number> = { lighting: 0, socket: 0, switch: 0, dedicated: 0, hvac: 0, data: 0, db: 0 };
  let total = 0;
  let covered = 0;
  const circuits = new Set<string>();
  for (const assignment of assignments) {
    perKind[assignment.point.kind] += 1;
    if (!pointRequiresCircuit(assignment.point.kind)) continue;
    total += 1;
    if (assignment.circuitId) {
      covered += 1;
      circuits.add(assignment.circuitId);
    }
  }
  return { total, covered, uncovered: total - covered, circuitsUsed: circuits.size, perKind };
}
