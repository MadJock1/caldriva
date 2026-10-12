import { describe, expect, it } from "vitest";
import {
  autoRoutePlan,
  boardAnchor,
  csaFor,
  circuitRouteSummary,
  defaultBrief,
  defaultCableAssumptions,
  ensurePlan,
  generateAllPoints,
  generateBuilding,
  generatePointsForPlanRoom,
  manhattanRoute,
  polylineLength,
  schedulePoints,
  upsertPlanRoom,
  voltageDrop,
  voltageDropReport,
  type ElectricalBuilding,
  type PlanRoom,
  type Rect,
} from "./index";

function scenario() {
  const building = generateBuilding(defaultBrief);
  const floor = building.floors[0];
  const apartment = floor.apartments[0];
  const living = apartment.rooms.find(r => r.type === "living")!;
  const rect: Rect = { x: 0, y: 0, w: 5, h: 4 };
  const planRoom: PlanRoom = { id: "pr-living", roomId: living.id, apartmentId: apartment.id, label: "Living", type: "living", rect };
  let next = ensurePlan(building, floor.id);
  next = upsertPlanRoom(next, floor.id, planRoom);
  next = generatePointsForPlanRoom(next, floor.id, "pr-living");
  return { building: next, floor };
}

describe("route geometry", () => {
  it("measures polyline and L-route length", () => {
    expect(polylineLength([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }])).toBeCloseTo(7, 6);
    expect(polylineLength(manhattanRoute({ x: 0, y: 0 }, { x: 3, y: 4 }))).toBeCloseTo(7, 6);
    expect(manhattanRoute({ x: 0, y: 2 }, { x: 5, y: 2 })).toEqual([{ x: 0, y: 2 }, { x: 5, y: 2 }]);
  });

  it("anchors routes at a db point when present", () => {
    const plan = { id: "plan-x", floorId: "f", width: 20, depth: 14, rooms: [], points: [{ id: "db1", kind: "db" as const, x: 2, y: 3, elevationM: null, symbolId: null, deviceReference: "", description: "", rotationDeg: 0, scale: 1, manufacturer: "", productReference: "", datasheetUrl: "", productVerificationStatus: "UNVERIFIED" as const, roomId: null, note: "" }], routes: [], cadWires: [], cadJunctions: [], routingZones: [], physicalRoutes: [] };
    expect(boardAnchor(plan)).toEqual({ x: 2, y: 3 });
  });
});

describe("auto routing", () => {
  it("creates one route per scheduled point with a circuit id", () => {
    const { building, floor } = scenario();
    const routed = autoRoutePlan(building, floor.id);
    const plan = routed.plans.find(p => p.floorId === floor.id)!;
    const summary = schedulePoints(building);
    const scheduledPoints = summary.reduce((n, row) => n + row.pointCount, 0);
    expect(plan.routes.length).toBeGreaterThan(0);
    expect(plan.routes.length).toBe(scheduledPoints);
    expect(plan.routes.every(r => r.circuitId)).toBe(true);
    expect(circuitRouteSummary(routed).size).toBeGreaterThan(0);
  });

  it("drops route sketches when points are regenerated", () => {
    const { building, floor } = scenario();
    const routed = autoRoutePlan(building, floor.id);
    expect(routed.plans.find(p => p.floorId === floor.id)!.routes.length).toBeGreaterThan(0);
    const regenerated = generateAllPoints(routed, floor.id);
    expect(regenerated.plans.find(p => p.floorId === floor.id)!.routes).toHaveLength(0);
  });
});

describe("voltage drop", () => {
  it("computes a single-phase drop from resistivity, length, current and csa", () => {
    const building = generateBuilding(defaultBrief);
    const drop = voltageDrop({ currentA: 10, phases: 1, type: "SOC" }, 20, building);
    expect(drop.csaMm2).toBe(2.5);
    expect(drop.dropVolts).toBeCloseTo(3.6, 5);
    expect(drop.nominalV).toBeCloseTo(400 / Math.sqrt(3), 5);
    expect(drop.dropPercent).toBeCloseTo((3.6 / (400 / Math.sqrt(3))) * 100, 5);
  });

  it("halves the csa-relative drop by doubling the cross-section", () => {
    const building = generateBuilding(defaultBrief);
    const withDefault = voltageDrop({ currentA: 16, phases: 1, type: "SOC" }, 15, building);
    const thicker: ElectricalBuilding = { ...building, cableAssumptions: { ...defaultCableAssumptions, csaByType: { SOC: 5 } } };
    const with5 = voltageDrop({ currentA: 16, phases: 1, type: "SOC" }, 15, thicker);
    expect(with5.dropVolts).toBeCloseTo(withDefault.dropVolts / 2, 6);
  });

  it("flags circuits over the configured limit", () => {
    const { building, floor } = scenario();
    const thin = { LGT: 0.5, SOC: 0.5, KITCHEN: 0.5, DED: 0.5, HVAC: 0.5, EV: 0.5, LIFT: 0.5, PUMP: 0.5, TECH: 0.5, COMMON: 0.5 };
    const strict: ElectricalBuilding = { ...autoRoutePlan(building, floor.id), cableAssumptions: { material: "copper", maxDropPercent: 0.5, csaByType: thin } };
    const report = voltageDropReport(strict);
    expect(report.rows.length).toBeGreaterThan(0);
    expect(report.limitPercent).toBe(0.5);
    expect(report.overLimit).toBeGreaterThan(0);
    expect(report.maxDropPercent).toBe(report.rows[0].dropPercent);
  });

  it("resolves csa from defaults with an override", () => {
    expect(csaFor("LGT", defaultCableAssumptions)).toBe(1.5);
    expect(csaFor("LGT", { material: "copper", maxDropPercent: 3, csaByType: { LGT: 4 } })).toBe(4);
  });
});
