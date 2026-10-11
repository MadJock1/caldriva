import { lineCurrentA, sumTotals, type LoadTotals } from "./loads";
import {
  PHASES,
  type ApplianceKind,
  type CircuitType,
  type ElectricalBuilding,
  type LoadItem,
  type Phase,
} from "./model";

export const KIND_CIRCUIT_TYPE: Record<ApplianceKind, CircuitType> = {
  lighting: "LGT",
  shared_lighting: "LGT",
  socket: "SOC",
  garage_socket: "SOC",
  exhaust_fan: "SOC",
  ac: "HVAC",
  hvac_unit: "HVAC",
  refrigerator: "KITCHEN",
  oven: "KITCHEN",
  cooktop: "KITCHEN",
  dishwasher: "KITCHEN",
  hood: "KITCHEN",
  microwave: "KITCHEN",
  washing_machine: "DED",
  dryer: "DED",
  water_heater: "DED",
  ev_charger: "EV",
  lift: "LIFT",
  water_pump: "PUMP",
  technical_equipment: "TECH",
  other: "SOC",
};

const PER_KIND_TYPES: CircuitType[] = ["KITCHEN", "DED"];

export type BoardKind = "main" | "floor" | "apartment" | "common";

export type Circuit = {
  id: string;
  boardId: string;
  code: string;
  type: CircuitType;
  function: string;
  phase: Phase | null;
  phases: 1 | 3;
  loadIds: string[];
  totals: LoadTotals;
  currentA: number;
};

export type Board = {
  id: string;
  name: string;
  kind: BoardKind;
  floorId: string | null;
  apartmentId: string | null;
  circuits: Circuit[];
  totals: LoadTotals;
  currentA: number;
};

export type Feeder = {
  id: string;
  from: string;
  to: string;
  label: string;
  totals: LoadTotals;
  currentA: number;
};

export type DistributionModel = {
  boards: Board[];
  feeders: Feeder[];
  circuitCount: number;
  warnings: string[];
};

function groupKey(load: LoadItem): string {
  const type = KIND_CIRCUIT_TYPE[load.kind];
  return PER_KIND_TYPES.includes(type) ? `${type}:${load.kind}` : `${type}:all`;
}

function circuitTypeForLoad(load: LoadItem): CircuitType {
  return KIND_CIRCUIT_TYPE[load.kind];
}

function circuitPhases(loads: LoadItem[]): 1 | 3 {
  return loads.some(l => l.phases === 3) ? 3 : 1;
}

const TYPE_ORDER: CircuitType[] = ["LGT", "SOC", "KITCHEN", "HVAC", "DED", "EV", "LIFT", "PUMP", "TECH", "COMMON"];

function buildCircuits(boardId: string, loads: LoadItem[], volts: number, counters: Map<string, number>): Circuit[] {
  const groups = new Map<string, LoadItem[]>();
  for (const load of loads) {
    if (load.quantity <= 0) continue;
    const key = groupKey(load);
    const list = groups.get(key) ?? [];
    list.push(load);
    groups.set(key, list);
  }
  const entries = [...groups.entries()].sort((a, b) => {
    const ta = circuitTypeForLoad(a[1][0]);
    const tb = circuitTypeForLoad(b[1][0]);
    const oa = TYPE_ORDER.indexOf(ta);
    const ob = TYPE_ORDER.indexOf(tb);
    return oa !== ob ? oa - ob : a[0].localeCompare(b[0]);
  });
  const circuits: Circuit[] = [];
  for (const [, groupLoads] of entries) {
    const type = circuitTypeForLoad(groupLoads[0]);
    const seq = (counters.get(`${boardId}:${type}`) ?? 0) + 1;
    counters.set(`${boardId}:${type}`, seq);
    const code = `${type}-${String(seq).padStart(2, "0")}`;
    const totals = sumTotals(groupLoads);
    const phases = circuitPhases(groupLoads);
    circuits.push({
      id: `${boardId}-${code}`,
      boardId,
      code,
      type,
      function: describeCircuit(type, groupLoads),
      phase: null,
      phases,
      loadIds: groupLoads.map(l => l.id),
      totals,
      currentA: lineCurrentA(totals.demandVA, volts, phases),
    });
  }
  return circuits;
}

function describeCircuit(type: CircuitType, loads: LoadItem[]): string {
  if (type === "KITCHEN" || type === "DED") return loads[0].name;
  if (type === "LGT") return "Lighting";
  if (type === "SOC") return "Socket outlets";
  if (type === "HVAC") return "HVAC";
  if (type === "EV") return "EV charging";
  if (type === "LIFT") return "Lift";
  if (type === "PUMP") return "Water pump";
  if (type === "TECH") return "Technical equipment";
  return loads[0]?.name ?? "Circuit";
}

export function assignPhases(circuits: Circuit[]): void {
  const load: Record<Phase, number> = { L1: 0, L2: 0, L3: 0 };
  for (const circuit of circuits) {
    if (circuit.phases === 3) {
      circuit.phase = null;
      const share = circuit.totals.demandVA / 3;
      PHASES.forEach(p => { load[p] += share; });
      continue;
    }
    let best: Phase = "L1";
    for (const p of PHASES) if (load[p] < load[best]) best = p;
    circuit.phase = best;
    load[best] += circuit.totals.demandVA;
  }
}

export function generateDistribution(building: ElectricalBuilding): DistributionModel {
  const volts = building.service.voltageV;
  const warnings: string[] = [];
  const boards: Board[] = [];
  const feeders: Feeder[] = [];
  const counters = new Map<string, number>();

  const mdbId = "MDB";
  const mdb: Board = { id: mdbId, name: "Main distribution board", kind: "main", floorId: null, apartmentId: null, circuits: [], totals: sumTotals([]), currentA: 0 };
  boards.push(mdb);

  const csbLoads = building.commonLoads;
  let csbId: string | null = null;
  if (csbLoads.length) {
    csbId = "CSB";
    const circuits = buildCircuits(csbId, csbLoads, volts, counters);
    const totals = sumTotals(csbLoads);
    boards.push({ id: csbId, name: "Common services board", kind: "common", floorId: null, apartmentId: null, circuits, totals, currentA: lineCurrentA(totals.demandVA, volts, 3) });
  }

  for (const floor of building.floors) {
    const floorLoads = floor.sharedLoads;
    const hasApartments = floor.apartments.length > 0;
    if (!floorLoads.length && !hasApartments) continue;
    const fdbId = `FDB-${floor.code}`;
    const circuits = floorLoads.length ? buildCircuits(fdbId, floorLoads, volts, counters) : [];
    const totals = sumTotals(floorLoads);
    boards.push({ id: fdbId, name: `Floor board ${floor.code}`, kind: "floor", floorId: floor.id, apartmentId: null, circuits, totals, currentA: lineCurrentA(totals.demandVA, volts, 3) });
    feeders.push({ id: `MDB-${fdbId}`, from: mdbId, to: fdbId, label: `Riser ${floor.code}`, totals, currentA: lineCurrentA(totals.demandVA, volts, 3) });
    for (const apartment of floor.apartments) {
      const adbId = `ADB-${apartment.id}`;
      const aptLoads = apartment.rooms.flatMap(room => room.loads);
      const aptCircuits = buildCircuits(adbId, aptLoads, volts, counters);
      const aptTotals = sumTotals(aptLoads);
      boards.push({ id: adbId, name: `Apartment board ${apartment.code}`, kind: "apartment", floorId: floor.id, apartmentId: apartment.id, circuits: aptCircuits, totals: aptTotals, currentA: lineCurrentA(aptTotals.demandVA, volts, 1) });
      feeders.push({ id: `${fdbId}-${adbId}`, from: fdbId, to: adbId, label: apartment.code, totals: aptTotals, currentA: lineCurrentA(aptTotals.demandVA, volts, 1) });
    }
  }

  if (csbId) feeders.unshift({ id: `MDB-${csbId}`, from: mdbId, to: csbId, label: "Common services", totals: boards.find(b => b.id === csbId)!.totals, currentA: boards.find(b => b.id === csbId)!.currentA });

  const allCircuits = boards.flatMap(b => b.circuits);
  assignPhases(allCircuits);
  mdb.totals = sumTotals([...csbLoads, ...building.floors.flatMap(f => [...f.sharedLoads, ...f.apartments.flatMap(a => a.rooms.flatMap(r => r.loads))])]);
  mdb.currentA = lineCurrentA(mdb.totals.demandVA, volts, 3);

  const unassigned = allCircuits.filter(c => c.phases === 1 && c.phase === null).length;
  if (unassigned) warnings.push(`${unassigned} single-phase circuits have no phase allocation.`);
  if (!building.floors.some(f => f.apartments.length)) warnings.push("No apartments are defined; only common services were modelled.");

  return { boards, feeders, circuitCount: allCircuits.length, warnings };
}
