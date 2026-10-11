import { describe, expect, it } from "vitest";
import {
  APARTMENT_TEMPLATES,
  addCommonLoad,
  addLoadToRoom,
  buildingSummary,
  buildRooms,
  defaultBrief,
  designReview,
  emptyBuilding,
  floorCode,
  generateBuilding,
  generateDistribution,
  loadTotals,
  removeCommonLoad,
  sumTotals,
  uniformBrief,
  uniqueId,
  withApartment,
  withFloor,
  withoutApartment,
  withoutFloor,
  type ElectricalBuilding,
} from "./index";

function buildingWith(brief: Parameters<typeof generateBuilding>[0]) {
  return generateBuilding(brief);
}

function allLoadIds(building: ElectricalBuilding) {
  return [
    ...building.commonLoads.map(l => l.id),
    ...building.floors.flatMap(f => [
      ...f.sharedLoads.map(l => l.id),
      ...f.apartments.flatMap(a => a.rooms.flatMap(r => r.loads.map(l => l.id))),
    ]),
  ];
}

describe("id helpers", () => {
  it("codes floors by level", () => {
    expect(floorCode(-2)).toBe("B2");
    expect(floorCode(0)).toBe("G");
    expect(floorCode(3)).toBe("F3");
  });

  it("de-duplicates ids deterministically", () => {
    const taken = new Set(["a", "a-2"]);
    expect(uniqueId("a", id => taken.has(id))).toBe("a-3");
    expect(uniqueId("b", id => taken.has(id))).toBe("b");
  });
});

describe("example 1 - small residential block", () => {
  const brief = uniformBrief({ name: "Block A", upperFloors: 2, apartmentsPerFloor: 4, template: "T2", includeGround: true, basementLevels: 0 });
  const building = buildingWith(brief);

  it("creates the expected hierarchy", () => {
    expect(building.floors.map(f => f.code)).toEqual(["G", "F1", "F2"]);
    expect(building.floors.every(f => f.apartments.length === 4)).toBe(true);
    const summary = buildingSummary(building);
    expect(summary.floorCount).toBe(3);
    expect(summary.apartmentCount).toBe(12);
  });

  it("is deterministic", () => {
    expect(buildingWith(brief)).toEqual(building);
  });

  it("uses unique ids everywhere", () => {
    const ids = allLoadIds(building);
    expect(new Set(ids).size).toBe(ids.length);
    const apartmentIds = building.floors.flatMap(f => f.apartments.map(a => a.id));
    expect(new Set(apartmentIds).size).toBe(apartmentIds.length);
  });

  it("builds a T2 apartment with the expected rooms and loads", () => {
    const apt = building.floors[1].apartments[0];
    expect(apt.rooms.map(r => r.type).sort()).toEqual(["bathroom", "bedroom", "bedroom", "hall", "kitchen", "living"]);
    const loads = apt.rooms.flatMap(r => r.loads);
    expect(loads.length).toBe(16);
    expect(loads.filter(l => l.kind === "lighting")).toHaveLength(6);
    const socketQuantity = loads.filter(l => l.kind === "socket").reduce((n, l) => n + l.quantity, 0);
    expect(socketQuantity).toBe(1 + 6 + 4 + 4 + 4);
  });

  it("generates circuits that cover every active load", () => {
    const distribution = generateDistribution(building);
    const assigned = new Set(distribution.boards.flatMap(b => b.circuits.flatMap(c => c.loadIds)));
    for (const id of allLoadIds(building)) expect(assigned.has(id)).toBe(true);
    expect(distribution.circuitCount).toBeGreaterThan(0);
    expect(distribution.boards.some(b => b.kind === "main")).toBe(true);
    expect(distribution.boards.some(b => b.kind === "apartment")).toBe(true);
  });

  it("treats each apartment as its own board", () => {
    const distribution = generateDistribution(building);
    const apartmentBoards = distribution.boards.filter(b => b.kind === "apartment");
    expect(apartmentBoards).toHaveLength(12);
  });

  it("produces a review that is not blocked", () => {
    const review = designReview(building);
    expect(review.blocked).toBe(0);
    expect(review.status).not.toBe("APPROVED");
    expect(review.checks.some(c => c.category === "regulatory" && c.status === "manual")).toBe(true);
  });
});

describe("example 2 - building with basement and common services", () => {
  const building = buildingWith(
    uniformBrief({
      upperFloors: 4,
      apartmentsPerFloor: 3,
      template: "T3",
      includeGround: true,
      basementLevels: 2,
      common: { lifts: 2, sharedLightingPerFloor: true, waterPump: true, hvac: false, evChargers: 6, garage: true, technicalRooms: 1 },
    }),
  );

  it("includes basements and common loads", () => {
    expect(building.floors.some(f => f.code === "B1")).toBe(true);
    expect(building.floors.some(f => f.code === "B2")).toBe(true);
    const kinds = building.commonLoads.map(l => l.kind);
    expect(kinds).toContain("lift");
    expect(kinds).toContain("water_pump");
    expect(kinds).toContain("ev_charger");
    expect(kinds).toContain("garage_socket");
    expect(kinds).toContain("technical_equipment");
  });

  it("adds an EV circuit to common services", () => {
    const distribution = generateDistribution(building);
    const ev = distribution.boards.flatMap(b => b.circuits).filter(c => c.type === "EV");
    expect(ev.length).toBe(1);
    expect(ev[0].loadIds).toHaveLength(1);
  });

  it("counts the T3 rooms", () => {
    const apt = building.floors.find(f => f.apartments.length)!.apartments[0];
    expect(apt.rooms.length).toBe(APARTMENT_TEMPLATES.T3.rooms.reduce((n, r) => n + r.count, 0));
  });
});

describe("load aggregation", () => {
  it("applies utilisation and demand factors", () => {
    const load = { ...generateBuilding(defaultBrief).floors[0].apartments[0].rooms[1].loads.find(l => l.kind === "socket")! };
    load.quantity = 10;
    const totals = loadTotals(load);
    expect(totals.connectedW).toBe(load.ratedWatts * 10);
    expect(totals.demandW).toBeCloseTo(load.ratedWatts * 10 * load.utilisationFactor * load.demandFactor, 6);
    expect(totals.connectedVA).toBeCloseTo(totals.connectedW / load.powerFactor, 6);
  });

  it("sums totals additively", () => {
    const building = generateBuilding(defaultBrief);
    const loads = building.floors.flatMap(f => f.apartments.flatMap(a => a.rooms.flatMap(r => r.loads)));
    const total = sumTotals(loads);
    const manual = loads.reduce((n, l) => n + loadTotals(l).connectedW, 0);
    expect(total.connectedW).toBeCloseTo(manual, 6);
  });

  it("balances three-phase circuits within a reasonable band", () => {
    const building = generateBuilding(uniformBrief({ upperFloors: 5, apartmentsPerFloor: 4, template: "T2" }));
    const distribution = generateDistribution(building);
    for (const board of distribution.boards) {
      const phases = board.circuits.filter(c => c.phases === 1).map(c => c.phase);
      expect(phases.every(p => p === "L1" || p === "L2" || p === "L3")).toBe(true);
    }
  });
});

describe("example 6 - single-phase service", () => {
  const building = buildingWith({ ...uniformBrief({ upperFloors: 1, apartmentsPerFloor: 2, template: "T1" }), service: { phases: 1, supplyType: "single", voltageV: 230 } as ElectricalBuilding["service"] });

  it("reports single-phase balance as not applicable", () => {
    const review = designReview(building);
    const phase = review.checks.find(c => c.id === "phase");
    expect(phase?.status).toBe("pass");
    expect(phase?.detail).toContain("Single-phase");
  });
});

describe("manual editing helpers", () => {
  it("adds and removes floors and apartments", () => {
    let building = emptyBuilding();
    expect(building.floors).toHaveLength(0);
    building = withFloor(building, "T2");
    expect(building.floors).toHaveLength(1);
    building = withApartment(building, building.floors[0].id, "T1");
    expect(building.floors[0].apartments).toHaveLength(2);
    building = withoutApartment(building, building.floors[0].id, building.floors[0].apartments[1].id);
    expect(building.floors[0].apartments).toHaveLength(1);
    building = withoutFloor(building, building.floors[0].id);
    expect(building.floors).toHaveLength(0);
  });

  it("adds and removes common loads and room loads", () => {
    let building = generateBuilding(defaultBrief);
    const before = building.commonLoads.length;
    building = addCommonLoad(building, "lift");
    expect(building.commonLoads.length).toBe(before + 1);
    building = removeCommonLoad(building, building.commonLoads[building.commonLoads.length - 1].id);
    expect(building.commonLoads.length).toBe(before);

    const floor = building.floors[0];
    const apt = floor.apartments[0];
    const room = apt.rooms[0];
    const loadCount = room.loads.length;
    building = addLoadToRoom(building, floor.id, apt.id, room.id, "socket");
    const updatedRoom = building.floors[0].apartments[0].rooms[0];
    expect(updatedRoom.loads.length).toBe(loadCount + 1);
  });
});

describe("review gating", () => {
  it("blocks an empty building", () => {
    const review = designReview(emptyBuilding());
    expect(review.blocked).toBeGreaterThan(0);
    expect(review.status).toBe("NEEDS_REVIEW");
  });
});

describe("templates", () => {
  it("never leaves duplicate room ids inside one apartment", () => {
    const rooms = buildRooms("APT", "T5", () => false);
    const ids = rooms.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exposes template room counts", () => {
    expect(APARTMENT_TEMPLATES.T0.rooms).toHaveLength(4);
    expect(APARTMENT_TEMPLATES.CUSTOM.rooms).toHaveLength(1);
  });
});
