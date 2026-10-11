import { PHASES, type ApplianceKind, type ElectricalBuilding, type LoadItem, type Phase } from "./model";

export const REFERENCE_HOURS_PER_DAY: Record<ApplianceKind, number> = {
  lighting: 5,
  socket: 4,
  refrigerator: 10,
  oven: 1,
  cooktop: 1.5,
  dishwasher: 1,
  washing_machine: 1,
  dryer: 1,
  hood: 1,
  microwave: 0.3,
  water_heater: 3,
  ac: 6,
  ev_charger: 4,
  lift: 12,
  water_pump: 2,
  shared_lighting: 12,
  exhaust_fan: 2,
  hvac_unit: 8,
  garage_socket: 1,
  technical_equipment: 12,
  other: 4,
};

export const ENERGY_ASSUMPTION = "Energy uses indicative hours-per-day per appliance type (editable assumption), not metered demand.";

export type LoadTotals = {
  connectedW: number;
  connectedVA: number;
  demandW: number;
  demandVA: number;
  energyKwhPerDay: number;
};

export const emptyTotals: LoadTotals = { connectedW: 0, connectedVA: 0, demandW: 0, demandVA: 0, energyKwhPerDay: 0 };

export function loadTotals(load: LoadItem): LoadTotals {
  const pf = load.powerFactor > 0 ? load.powerFactor : 1;
  const connectedW = load.ratedWatts * load.quantity;
  const demandW = connectedW * load.utilisationFactor * load.demandFactor;
  const hours = REFERENCE_HOURS_PER_DAY[load.kind] ?? 0;
  return {
    connectedW,
    connectedVA: connectedW / pf,
    demandW,
    demandVA: demandW / pf,
    energyKwhPerDay: (demandW / 1000) * hours,
  };
}

export function sumTotals(loads: LoadItem[]): LoadTotals {
  return loads.reduce<LoadTotals>(
    (acc, load) => {
      const t = loadTotals(load);
      return {
        connectedW: acc.connectedW + t.connectedW,
        connectedVA: acc.connectedVA + t.connectedVA,
        demandW: acc.demandW + t.demandW,
        demandVA: acc.demandVA + t.demandVA,
        energyKwhPerDay: acc.energyKwhPerDay + t.energyKwhPerDay,
      };
    },
    { ...emptyTotals },
  );
}

export function applyDiversity(totals: LoadTotals, factor: number): LoadTotals {
  const f = Math.min(1, Math.max(0, factor));
  return {
    connectedW: totals.connectedW * f,
    connectedVA: totals.connectedVA * f,
    demandW: totals.demandW * f,
    demandVA: totals.demandVA * f,
    energyKwhPerDay: totals.energyKwhPerDay,
  };
}

export type PhaseBalance = {
  perPhaseVA: Record<Phase, number>;
  unassignedVA: number;
  threePhaseVA: number;
  assignableVA: number;
  imbalancePercent: number;
};

export function phaseBalance(loads: LoadItem[]): PhaseBalance {
  const perPhaseVA: Record<Phase, number> = { L1: 0, L2: 0, L3: 0 };
  let unassignedVA = 0;
  let threePhaseVA = 0;
  for (const load of loads) {
    const t = loadTotals(load);
    if (load.phases === 3) {
      threePhaseVA += t.demandVA;
      const share = t.demandVA / 3;
      PHASES.forEach(p => { perPhaseVA[p] += share; });
    } else if (load.phase) {
      perPhaseVA[load.phase] += t.demandVA;
    } else {
      unassignedVA += t.demandVA;
    }
  }
  const values = PHASES.map(p => perPhaseVA[p]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const assignableVA = values.reduce((a, b) => a + b, 0);
  const imbalancePercent = max > 0 ? ((max - min) / max) * 100 : 0;
  return { perPhaseVA, unassignedVA, threePhaseVA, assignableVA, imbalancePercent };
}

export function lineCurrentA(apparentVA: number, volts: number, phases: 1 | 3) {
  if (volts <= 0) return 0;
  return phases === 3 ? apparentVA / (Math.sqrt(3) * volts) : apparentVA / volts;
}

export function apartmentTotals(apartment: { rooms: { loads: LoadItem[] }[] }): LoadTotals {
  return sumTotals(apartment.rooms.flatMap(room => room.loads));
}

export function floorTotals(floor: { apartments: { rooms: { loads: LoadItem[] }[] }[]; sharedLoads: LoadItem[] }): LoadTotals {
  return sumTotals([...floor.apartments.flatMap(apt => apt.rooms.flatMap(room => room.loads)), ...floor.sharedLoads]);
}

export type BuildingSummary = {
  apartmentCount: number;
  floorCount: number;
  loadCount: number;
  apartment: LoadTotals;
  floor: LoadTotals;
  common: LoadTotals;
  connected: LoadTotals;
  diversified: LoadTotals;
  demandWithMargin: LoadTotals;
  demandVA: number;
  lineCurrentA: number;
  phases: 1 | 3;
  balance: PhaseBalance;
  perFloor: { floorId: string; code: string; totals: LoadTotals }[];
};

export function buildingSummary(building: ElectricalBuilding): BuildingSummary {
  const apartmentLoads = building.floors.flatMap(floor => floor.apartments.flatMap(apt => apt.rooms.flatMap(room => room.loads)));
  const sharedLoads = building.floors.flatMap(floor => floor.sharedLoads);
  const commonLoads = building.commonLoads;
  const apartment = sumTotals(apartmentLoads);
  const floorShared = sumTotals(sharedLoads);
  const common = sumTotals(commonLoads);
  const connected = sumTotals([...apartmentLoads, ...sharedLoads, ...commonLoads]);
  const apartmentDiv = applyDiversity(apartment, building.service.apartmentDiversity);
  const sharedDiv = applyDiversity(floorShared, building.service.apartmentDiversity);
  const commonDiv = applyDiversity(common, building.service.buildingDiversity);
  const combined = addTotals(addTotals(apartmentDiv, sharedDiv), commonDiv);
  const demandWithMargin = { ...combined, demandW: combined.demandW * (1 + building.service.designMargin), demandVA: combined.demandVA * (1 + building.service.designMargin) };
  const balance = phaseBalance([...apartmentLoads, ...sharedLoads, ...commonLoads]);
  const loadCount = [...apartmentLoads, ...sharedLoads, ...commonLoads].length;
  return {
    apartmentCount: building.floors.reduce((n, floor) => n + floor.apartments.length, 0),
    floorCount: building.floors.length,
    loadCount,
    apartment,
    floor: floorShared,
    common,
    connected,
    diversified: combined,
    demandWithMargin,
    demandVA: demandWithMargin.demandVA,
    lineCurrentA: lineCurrentA(demandWithMargin.demandVA, building.service.voltageV, building.service.phases),
    phases: building.service.phases,
    balance,
    perFloor: building.floors.map(floor => ({ floorId: floor.id, code: floor.code, totals: floorTotals(floor) })),
  };
}

export function addTotals(a: LoadTotals, b: LoadTotals): LoadTotals {
  return {
    connectedW: a.connectedW + b.connectedW,
    connectedVA: a.connectedVA + b.connectedVA,
    demandW: a.demandW + b.demandW,
    demandVA: a.demandVA + b.demandVA,
    energyKwhPerDay: a.energyKwhPerDay + b.energyKwhPerDay,
  };
}

export function formatWatts(w: number) {
  if (Math.abs(w) >= 1000) return `${(w / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} kW`;
  return `${w.toLocaleString("en-GB", { maximumFractionDigits: 0 })} W`;
}
