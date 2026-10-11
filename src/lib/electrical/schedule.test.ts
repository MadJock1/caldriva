import { describe, expect, it } from "vitest";
import {
  assignCircuitIds,
  defaultBrief,
  designReview,
  ensurePlan,
  generateBuilding,
  generateDistribution,
  generatePointsForPlanRoom,
  pointCircuitMap,
  pointCoverageStats,
  schedulePoints,
  uncoveredPoints,
  upsertPlanRoom,
  type ElectricalBuilding,
  type PlanRoom,
  type Rect,
} from "./index";

function scenario() {
  const building = generateBuilding(defaultBrief);
  const floor = building.floors[0];
  const apartment = floor.apartments[0];
  const living = apartment.rooms.find(r => r.type === "living")!;
  const kitchen = apartment.rooms.find(r => r.type === "kitchen")!;
  const rect: Rect = { x: 0, y: 0, w: 5, h: 4 };
  const livingPlan: PlanRoom = { id: "pr-living", roomId: living.id, apartmentId: apartment.id, label: "Living", type: "living", rect };
  const kitchenPlan: PlanRoom = { id: "pr-kitchen", roomId: kitchen.id, apartmentId: apartment.id, label: "Kitchen", type: "kitchen", rect: { x: 5, y: 0, w: 3, h: 3 } };
  let next = ensurePlan(building, floor.id);
  next = upsertPlanRoom(next, floor.id, livingPlan);
  next = upsertPlanRoom(next, floor.id, kitchenPlan);
  next = generatePointsForPlanRoom(next, floor.id, "pr-living");
  next = generatePointsForPlanRoom(next, floor.id, "pr-kitchen");
  return { building: next, floor, apartment, living, kitchen };
}

describe("circuit assignment", () => {
  it("writes circuit ids back onto loads and clears stale ones", () => {
    const { building } = scenario();
    const stale: ElectricalBuilding = {
      ...building,
      floors: building.floors.map(f => ({ ...f, apartments: f.apartments.map(a => ({ ...a, rooms: a.rooms.map(r => ({ ...r, loads: r.loads.map(l => ({ ...l, circuitId: "STALE-99" })) })) })) })),
    };
    const distribution = generateDistribution(stale);
    const assigned = assignCircuitIds(stale, distribution);
    const activeIds = new Set(distribution.boards.flatMap(b => b.circuits.flatMap(c => c.loadIds)));
    for (const floor of assigned.floors) {
      for (const apartment of floor.apartments) {
        for (const room of apartment.rooms) {
          for (const load of room.loads) {
            if (activeIds.has(load.id)) expect(load.circuitId).not.toBe("STALE-99");
            if (load.quantity === 0) expect(load.circuitId).toBeNull();
          }
        }
      }
    }
  });
});

describe("point to circuit mapping", () => {
  it("maps lighting and socket points to the apartment circuits of the right type", () => {
    const { building } = scenario();
    const distribution = generateDistribution(building);
    const map = pointCircuitMap(building, distribution);
    const livingPoints = [...map.values()].filter(a => a.planRoomId === "pr-living");
    expect(livingPoints.length).toBeGreaterThan(0);
    for (const assignment of livingPoints) {
      if (assignment.point.kind === "lighting") expect(assignment.circuit?.type).toBe("LGT");
      if (assignment.point.kind === "socket") expect(assignment.circuit?.type).toBe("SOC");
      if (assignment.point.kind === "switch") expect(assignment.circuitId).toBeNull();
    }
  });

  it("maps kitchen dedicated points to a kitchen circuit", () => {
    const { building } = scenario();
    const distribution = generateDistribution(building);
    const map = pointCircuitMap(building, distribution);
    const dedicated = [...map.values()].filter(a => a.planRoomId === "pr-kitchen" && a.point.kind === "dedicated");
    expect(dedicated.length).toBeGreaterThan(0);
    for (const assignment of dedicated) expect(assignment.circuit?.type).toBe("KITCHEN");
  });

  it("reports full coverage for linked rooms and gaps for unlinked rooms", () => {
    const { building, floor } = scenario();
    const distribution = generateDistribution(building);
    expect(uncoveredPoints(building, distribution)).toHaveLength(0);
    const stats = pointCoverageStats(building, distribution);
    expect(stats.uncovered).toBe(0);
    expect(stats.circuitsUsed).toBeGreaterThan(0);
    expect(stats.perKind.switch).toBeGreaterThan(0);

    const loose: PlanRoom = { id: "pr-loose", roomId: null, apartmentId: null, label: "Loose", type: "office", rect: { x: 8, y: 0, w: 3, h: 3 } };
    const withLoose = generatePointsForPlanRoom(upsertPlanRoom(building, floor.id, loose), floor.id, "pr-loose");
    const dist2 = generateDistribution(withLoose);
    const gaps = uncoveredPoints(withLoose, dist2);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every(g => g.planRoomId === "pr-loose")).toBe(true);
  });
});

describe("point schedule", () => {
  it("schedules circuits from points with counts and rooms", () => {
    const { building } = scenario();
    const distribution = generateDistribution(building);
    const rows = schedulePoints(building, distribution);
    const lgt = rows.find(r => r.type === "LGT");
    expect(lgt).toBeTruthy();
    expect(lgt!.pointCount).toBeGreaterThanOrEqual(2);
    expect(lgt!.demandVA).toBeGreaterThan(0);
    expect(lgt!.rooms.length).toBeGreaterThan(0);
    const soc = rows.find(r => r.type === "SOC");
    expect(soc?.pointCount).toBeGreaterThanOrEqual(1);
  });

  it("produces no schedule rows when there are no points", () => {
    const building = generateBuilding(defaultBrief);
    const distribution = generateDistribution(building);
    expect(schedulePoints(building, distribution)).toHaveLength(0);
  });
});

describe("review point coverage", () => {
  it("passes when every circuit-requiring point is scheduled", () => {
    const { building } = scenario();
    const check = designReview(building).checks.find(c => c.id === "point_coverage");
    expect(check?.status).toBe("pass");
  });

  it("warns when a placed point has no circuit", () => {
    const { building, floor } = scenario();
    const loose: PlanRoom = { id: "pr-loose", roomId: null, apartmentId: null, label: "Loose", type: "office", rect: { x: 8, y: 0, w: 3, h: 3 } };
    const withLoose = generatePointsForPlanRoom(upsertPlanRoom(building, floor.id, loose), floor.id, "pr-loose");
    const check = designReview(withLoose).checks.find(c => c.id === "point_coverage");
    expect(check?.status).toBe("warn");
  });
});
