import { expect, it } from "vitest";
import { defaultBrief, generateBuilding, ensurePlan, upsertPlanRoom, generateAllPoints, planForFloor, setPlanRoutes, updatePlanPoint, electricalBuildingSchema, roomGeometryDiagnostics } from "./index";
import { planDxf } from "./cad-export";
import { routeDiagnostics } from "./routes";

function fixture() {
  let building = generateBuilding(defaultBrief);
  const floorId = building.floors[0].id;
  building = ensurePlan(building, floorId);
  building = upsertPlanRoom(building, floorId, { id: "room", roomId: null, apartmentId: null, label: "Room", type: "living", rect: { x: 1, y: 2, w: 4, h: 3 }, wallThickness: 0.15, fixedSize: false, openings: [{ kind: "door", edge: "top", position: 0.5, width: 0.9 }] });
  building = generateAllPoints(building, floorId);
  const point = planForFloor(building, floorId)!.points[0];
  building = setPlanRoutes(building, floorId, [{ id: "route", circuitId: null, pointId: point.id, polyline: [{ x: 0, y: 0 }, { x: point.x, y: point.y }] }]);
  return { building, floorId };
}

it("moves and scales attached points, clearing stale routes while retaining openings", () => {
  const { building, floorId } = fixture();
  const before = planForFloor(building, floorId)!;
  const next = upsertPlanRoom(building, floorId, { ...before.rooms[0], rect: { x: 3, y: 4, w: 8, h: 6 } });
  const after = planForFloor(next, floorId)!;
  after.points.forEach((p, i) => {
    expect(p.x).toBeCloseTo(3 + (before.points[i].x - 1) * 2);
    expect(p.y).toBeCloseTo(4 + (before.points[i].y - 2) * 2);
  });
  expect(after.routes).toEqual([]);
  expect(after.rooms[0].openings).toEqual(before.rooms[0].openings);
  expect(before.routes).toHaveLength(1);
});

it("retains routes for label changes but invalidates them when an endpoint moves", () => {
  const { building, floorId } = fixture();
  const plan = planForFloor(building, floorId)!;
  const renamed = upsertPlanRoom(building, floorId, { ...plan.rooms[0], label: "Renamed" });
  expect(planForFloor(renamed, floorId)!.routes).toHaveLength(1);
  const moved = updatePlanPoint(renamed, floorId, { ...plan.points[0], x: 2 });
  expect(planForFloor(moved, floorId)!.routes).toHaveLength(0);
});

it("round-trips architectural properties through the saved building schema", () => {
  const { building, floorId } = fixture();
  const restored = electricalBuildingSchema.parse(JSON.parse(JSON.stringify(building)));
  expect(planForFloor(restored, floorId)!.rooms).toEqual(planForFloor(building, floorId)!.rooms);
});

it("exports DXF metre units and flips the room Y coordinates", () => {
  const { building, floorId } = fixture();
  const dxf = planDxf(planForFloor(building, floorId)!);
  expect(dxf).toContain("9\r\n$INSUNITS\r\n70\r\n6");
  expect(dxf).toContain("8\r\nROOMS\r\n10\r\n1\r\n20\r\n-2");
  expect(dxf).toContain("8\r\nROUTES");
  expect(dxf.endsWith("0\r\nEOF\r\n")).toBe(true);
});

it("reports overlapping and out-of-bounds conceptual rooms without changing geometry", () => {
  const diagnostics = roomGeometryDiagnostics([
    { id: "a", rect: { x: 0, y: 0, w: 4, h: 4 } },
    { id: "b", rect: { x: 3, y: 0, w: 4, h: 4 } },
    { id: "c", rect: { x: 8, y: 8, w: 4, h: 4 } },
  ], 10, 10);
  expect(diagnostics).toContainEqual({ roomId: "a", relatedRoomId: "b", code: "OVERLAP" });
  expect(diagnostics).toContainEqual({ roomId: "c", code: "OUT_OF_BOUNDS" });
});

it("flags non-physical route evidence instead of changing recorded route length", () => {
  const { building, floorId } = fixture();
  const plan = planForFloor(building, floorId)!;
  const diagnostics = routeDiagnostics({ ...plan, routes: [
    { id: "a", circuitId: null, pointId: null, polyline: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 99, y: 0 }] },
    { id: "b", circuitId: null, pointId: null, polyline: [{ x: 99, y: 0 }, { x: 0, y: 0 }] },
  ] });
  expect(diagnostics.map(d => d.code)).toContain("ZERO_LENGTH_SEGMENT");
  expect(diagnostics.map(d => d.code)).toContain("OUT_OF_BOUNDS");
  expect(diagnostics.map(d => d.code)).toContain("DUPLICATE_SEGMENT");
});
