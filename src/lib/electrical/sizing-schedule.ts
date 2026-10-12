// Per-board sizing schedule.
//
// Runs the pure sizing engine (`sizeCircuit`) for every routed circuit, then
// aggregates the findings per distribution board: each distinct finding is listed
// once with the count of affected circuits, alongside a per-circuit detail view.
// Circuits that have no cable route are never guessed at; they are reported as
// "not sized" with a reason. No finding here is an approval or a compliance claim.

import {
  cableCapacityTableFor,
  installationMethodLabels,
  type ConductorMaterial,
  type InstallationMethod,
} from "./catalogue";
import { generateDistribution, type DistributionModel } from "./circuits";
import { circuitRouteSummary } from "./routes";
import { SIZING_ENGINE_DISCLAIMER, sizeCircuit, type SizingFinding } from "./sizing";
import type { CircuitType, ElectricalBuilding } from "./model";
import type { CheckCategory, CheckStatus } from "./review";

/** One distinct sizing finding within a board, with every circuit it affects. */
export type SizingAggregateFinding = {
  id: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  source: string;
  circuitIds: string[];
  circuitCodes: string[];
};

/** The full sizing result and findings for a single circuit. */
export type CircuitSizingRow = {
  circuitId: string;
  boardId: string;
  code: string;
  type: CircuitType;
  function: string;
  phases: 1 | 3;
  designCurrentA: number;
  lengthM: number;
  breakerA: number | null;
  cableMm2: number | null;
  voltageDropPct: number | null;
  findings: SizingFinding[];
};

export type UnsizedCircuit = {
  circuitId: string;
  boardId: string;
  code: string;
  function: string;
  reason: string;
};

export type BoardSizingSchedule = {
  boardId: string;
  boardName: string;
  aggregates: SizingAggregateFinding[];
  circuits: CircuitSizingRow[];
  unsized: UnsizedCircuit[];
  /** Count of distinct aggregated findings per level (not per circuit). */
  statusCounts: Record<CheckStatus, number>;
};

export type SizingSchedule = {
  installMethod: InstallationMethod;
  installMethodLabel: string;
  material: ConductorMaterial;
  boards: BoardSizingSchedule[];
  statusCounts: Record<CheckStatus, number>;
  sizedCircuitCount: number;
  unsizedCircuitCount: number;
  disclaimer: string;
};

const STATUS_ORDER: readonly CheckStatus[] = ["blocked", "manual", "warn", "pass"];

function emptyStatusCounts(): Record<CheckStatus, number> {
  return { pass: 0, warn: 0, blocked: 0, manual: 0 };
}

function countStatuses(findings: readonly { status: CheckStatus }[]): Record<CheckStatus, number> {
  const counts = emptyStatusCounts();
  for (const finding of findings) counts[finding.status] += 1;
  return counts;
}

/** Collapse a board's per-circuit findings to one entry per distinct (id, status). */
export function aggregateSizingFindings(circuits: readonly CircuitSizingRow[]): SizingAggregateFinding[] {
  const map = new Map<string, SizingAggregateFinding>();
  for (const circuit of circuits) {
    for (const finding of circuit.findings) {
      const key = `${finding.id}::${finding.status}`;
      const existing = map.get(key);
      if (existing) {
        existing.circuitIds.push(circuit.circuitId);
        existing.circuitCodes.push(circuit.code);
      } else {
        map.set(key, {
          id: finding.id,
          category: finding.category,
          title: finding.title,
          status: finding.status,
          source: finding.source,
          circuitIds: [circuit.circuitId],
          circuitCodes: [circuit.code],
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    const order = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    return order !== 0 ? order : a.id.localeCompare(b.id);
  });
}

export type SizingScheduleOptions = {
  installMethod?: InstallationMethod;
};

/**
 * Size every routed circuit and aggregate the findings per board.
 *
 * The installation method is an explicit assumption (defaulted to concealed in
 * wall); the conductor material comes from the building's cable assumptions. The
 * bundled capacity tables are illustrative and copper-based, so a non-copper
 * building yields a manual "unsupported material" finding rather than a guess.
 */
export function scheduleSizing(
  building: ElectricalBuilding,
  distribution?: DistributionModel,
  options: SizingScheduleOptions = {},
): SizingSchedule {
  const dist = distribution ?? generateDistribution(building);
  const installMethod = options.installMethod ?? "concealed_in_wall";
  const material = building.cableAssumptions.material;
  const limit = building.cableAssumptions.maxDropPercent;
  const service = building.service;
  const routeSummary = circuitRouteSummary(building);

  const boards: BoardSizingSchedule[] = dist.boards.map((board) => {
    const circuits: CircuitSizingRow[] = [];
    const unsized: UnsizedCircuit[] = [];

    for (const circuit of board.circuits) {
      const route = routeSummary.get(circuit.id);
      if (!route) {
        unsized.push({
          circuitId: circuit.id,
          boardId: board.id,
          code: circuit.code,
          function: circuit.function,
          reason: "No cable route on any floor plan. Route the points to size this circuit; no length is assumed.",
        });
        continue;
      }

      const three = circuit.phases === 3;
      const nominalV = three
        ? service.voltageV
        : service.supplyType === "three"
          ? service.voltageV / Math.sqrt(3)
          : service.voltageV;

      const result = sizeCircuit({
        designCurrentA: circuit.currentA,
        lengthM: route.maxBranchM,
        phases: circuit.phases,
        voltageV: nominalV,
        installMethod,
        maxVoltageDropPct: limit,
        loadType: circuit.function || circuit.type,
        material,
      });

      circuits.push({
        circuitId: circuit.id,
        boardId: board.id,
        code: circuit.code,
        type: circuit.type,
        function: circuit.function,
        phases: circuit.phases,
        designCurrentA: circuit.currentA,
        lengthM: route.maxBranchM,
        breakerA: result.breakerA,
        cableMm2: result.cableMm2,
        voltageDropPct: result.voltageDropPct,
        findings: result.findings,
      });
    }

    const aggregates = aggregateSizingFindings(circuits);
    return {
      boardId: board.id,
      boardName: board.name,
      aggregates,
      circuits,
      unsized,
      statusCounts: countStatuses(aggregates),
    };
  });

  const statusCounts = emptyStatusCounts();
  for (const board of boards) {
    for (const status of STATUS_ORDER) statusCounts[status] += board.statusCounts[status];
  }

  const sizedCircuitCount = boards.reduce((n, board) => n + board.circuits.length, 0);
  const unsizedCircuitCount = boards.reduce((n, board) => n + board.unsized.length, 0);

  return {
    installMethod,
    installMethodLabel: installationMethodLabels[installMethod],
    material,
    boards,
    statusCounts,
    sizedCircuitCount,
    unsizedCircuitCount,
    disclaimer: `${SIZING_ENGINE_DISCLAIMER} Each distinct finding is listed once per board with the number of affected circuits.`,
  };
}

/** Convenience: the capacity-table source shown for the assumed installation method. */
export function sizingCapacitySource(installMethod: InstallationMethod): string {
  return cableCapacityTableFor(installMethod).source;
}
