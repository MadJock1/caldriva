import { describe, expect, it } from "vitest";
import {
  autoRoutePlan,
  defaultBrief,
  ensurePlan,
  generateBuilding,
  generateDistribution,
  generatePointsForPlanRoom,
  scheduleSizing,
  statusLabels,
  upsertPlanRoom,
  type ElectricalBuilding,
  type PlanRoom,
  type Rect,
} from "./index";

function withPlan(route: boolean): ElectricalBuilding {
  const building = generateBuilding(defaultBrief);
  const floor = building.floors[0];
  const apartment = floor.apartments[0];
  const living = apartment.rooms.find(r => r.type === "living")!;
  const rect: Rect = { x: 0, y: 0, w: 5, h: 4 };
  const livingPlan: PlanRoom = { id: "pr-living", roomId: living.id, apartmentId: apartment.id, label: "Living", type: "living", rect };
  let next = ensurePlan(building, floor.id);
  next = upsertPlanRoom(next, floor.id, livingPlan);
  next = generatePointsForPlanRoom(next, floor.id, "pr-living");
  if (route) next = autoRoutePlan(next, floor.id);
  return next;
}

describe("status labels", () => {
  it("uses the warn level wording and never a check level", () => {
    expect(statusLabels.warn).toBe("Warn");
    for (const label of Object.values(statusLabels)) expect(label.toLowerCase()).not.toBe("check");
  });
});

describe("sizing schedule aggregation", () => {
  it("aggregates each distinct finding once per board with affected circuit counts", () => {
    const building = withPlan(true);
    const board = scheduleSizing(building, generateDistribution(building)).boards.find(b => b.circuits.length > 0);
    expect(board).toBeTruthy();

    const keys = board!.aggregates.map(a => `${a.id}::${a.status}`);
    expect(new Set(keys).size).toBe(keys.length);

    for (const aggregate of board!.aggregates) {
      expect(aggregate.circuitCodes.length).toBe(aggregate.circuitIds.length);
      expect(new Set(aggregate.circuitCodes).size).toBe(aggregate.circuitCodes.length);
      const affected = board!.circuits.filter(c => c.findings.some(f => f.id === aggregate.id && f.status === aggregate.status));
      expect(affected.length).toBe(aggregate.circuitIds.length);
    }
  });

  it("keeps the unverified-data and unverified-rule findings visible with counts", () => {
    const building = withPlan(true);
    const board = scheduleSizing(building, generateDistribution(building)).boards.find(b => b.circuits.length > 0)!;
    const data = board.aggregates.find(a => a.id === "sizing_data_unverified");
    expect(data?.status).toBe("warn");
    expect(data!.circuitCodes.length).toBe(board.circuits.length);
    const rules = board.aggregates.find(a => a.id === "sizing_rules_unverified");
    expect(rules?.status).toBe("manual");
    expect(rules!.circuitCodes.length).toBe(board.circuits.length);
  });

  it("never fabricates a selection for circuits without a route", () => {
    const building = withPlan(false);
    const schedule = scheduleSizing(building, generateDistribution(building));
    expect(schedule.sizedCircuitCount).toBe(0);
    expect(schedule.unsizedCircuitCount).toBeGreaterThan(0);
    for (const board of schedule.boards) expect(board.circuits).toHaveLength(0);
    const unsized = schedule.boards.flatMap(b => b.unsized);
    expect(unsized.length).toBeGreaterThan(0);
    expect(unsized.every(u => u.reason.length > 0)).toBe(true);
  });

  it("returns a manual finding instead of a copper selection for an aluminium building", () => {
    const building = withPlan(true);
    const aluminium: ElectricalBuilding = { ...building, cableAssumptions: { ...building.cableAssumptions, material: "aluminium" } };
    const schedule = scheduleSizing(aluminium, generateDistribution(aluminium));
    expect(schedule.material).toBe("aluminium");
    const board = schedule.boards.find(b => b.circuits.length > 0)!;
    for (const circuit of board.circuits) {
      expect(circuit.breakerA).toBeNull();
      expect(circuit.cableMm2).toBeNull();
      expect(circuit.findings.some(f => f.id === "sizing_material_unsupported")).toBe(true);
    }
    const aggregate = board.aggregates.find(a => a.id === "sizing_material_unsupported");
    expect(aggregate?.status).toBe("manual");
    expect(aggregate!.circuitCodes.length).toBe(board.circuits.length);
  });

  it("sizes routed circuits and can select a device and cable", () => {
    const building = withPlan(true);
    const schedule = scheduleSizing(building, generateDistribution(building));
    expect(schedule.sizedCircuitCount).toBeGreaterThan(0);
    const board = schedule.boards.find(b => b.circuits.length > 0)!;
    expect(board.circuits.some(c => c.breakerA !== null)).toBe(true);
  });
});
