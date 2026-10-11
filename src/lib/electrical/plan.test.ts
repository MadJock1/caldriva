import { describe, expect, it } from "vitest";
import {
  buildingPointSummary,
  countPoints,
  defaultBrief,
  ensurePlan,
  generateAllPoints,
  generateBuilding,
  generatePointsForPlanRoom,
  generateRoomPoints,
  normalizeRect,
  planForFloor,
  rectArea,
  rectContains,
  rectPerimeter,
  removePlanRoom,
  socketCount,
  syncLoadsFromPlan,
  upsertPlanRoom,
  type ElectricalPoint,
  type PlanRoom,
  type Rect,
} from "./index";

function seqIds() {
  let n = 0;
  return (base: string) => `${base}-${(n += 1)}`;
}

describe("geometry", () => {
  it("computes rectangle area and perimeter", () => {
    const rect: Rect = { x: 1, y: 2, w: 3, h: 4 };
    expect(rectArea(rect)).toBe(12);
    expect(rectPerimeter(rect)).toBe(14);
  });

  it("normalizes two drag points into a rectangle", () => {
    expect(normalizeRect({ x: 5, y: 5 }, { x: 2, y: 9 })).toEqual({ x: 2, y: 5, w: 3, h: 4 });
  });

  it("places sockets at the template minimum for a room type", () => {
    const rect: Rect = { x: 0, y: 0, w: 4, h: 3 };
    expect(socketCount(rect, "living")).toBeGreaterThanOrEqual(6);
    expect(socketCount(rect, "bathroom")).toBe(0);
    expect(socketCount(rect, "bedroom")).toBeGreaterThanOrEqual(4);
  });

  it("generates deterministic points that stay near the room", () => {
    const rect: Rect = { x: 2, y: 2, w: 5, h: 4 };
    const a = generateRoomPoints(rect, "living", "room-1", seqIds());
    const b = generateRoomPoints(rect, "living", "room-1", seqIds());
    expect(a).toEqual(b);
    const counts = countPoints(a);
    expect(counts.socket).toBe(socketCount(rect, "living"));
    expect(counts.lighting).toBeGreaterThanOrEqual(1);
    expect(counts.switch).toBe(1);
    for (const point of a) {
      expect(point.x).toBeGreaterThanOrEqual(rect.x - 0.001);
      expect(point.x).toBeLessThanOrEqual(rect.x + rect.w + 0.001);
      expect(point.y).toBeGreaterThanOrEqual(rect.y - 0.001);
      expect(point.y).toBeLessThanOrEqual(rect.y + rect.h + 0.001);
    }
  });

  it("adds dedicated points to kitchens and bathrooms", () => {
    const rect: Rect = { x: 0, y: 0, w: 3, h: 3 };
    expect(countPoints(generateRoomPoints(rect, "kitchen", "k", seqIds())).dedicated).toBe(2);
    expect(countPoints(generateRoomPoints(rect, "bathroom", "b", seqIds())).dedicated).toBe(1);
  });

  it("detects containment", () => {
    const rect: Rect = { x: 0, y: 0, w: 3, h: 3 };
    expect(rectContains(rect, { x: 1, y: 1 })).toBe(true);
    expect(rectContains(rect, { x: 4, y: 1 })).toBe(false);
  });
});

describe("plan mutations", () => {
  const building = generateBuilding(defaultBrief);
  const floor = building.floors[0];
  const living = floor.apartments[0].rooms.find(r => r.type === "living")!;

  it("parses existing buildings with an empty plan list", () => {
    expect(building.plans).toEqual([]);
  });

  it("ensures a plan and places a room linked to a hierarchy room", () => {
    let next = ensurePlan(building, floor.id);
    expect(planForFloor(next, floor.id)).toBeTruthy();
    const room: PlanRoom = { id: "plan-room-1", roomId: living.id, apartmentId: floor.apartments[0].id, label: living.name, type: "living", rect: { x: 0, y: 0, w: 5, h: 4 } };
    next = upsertPlanRoom(next, floor.id, room);
    expect(planForFloor(next, floor.id)!.rooms).toHaveLength(1);
  });

  it("generates points for a plan room and replaces them on regeneration", () => {
    let next = ensurePlan(building, floor.id);
    next = upsertPlanRoom(next, floor.id, { id: "plan-room-1", roomId: living.id, apartmentId: floor.apartments[0].id, label: living.name, type: "living", rect: { x: 0, y: 0, w: 5, h: 4 } });
    next = generatePointsForPlanRoom(next, floor.id, "plan-room-1");
    const first = planForFloor(next, floor.id)!.points.length;
    expect(first).toBeGreaterThan(0);
    next = generatePointsForPlanRoom(next, floor.id, "plan-room-1");
    expect(planForFloor(next, floor.id)!.points.length).toBe(first);
  });

  it("syncs socket and lighting quantities and room area from the plan", () => {
    let next = ensurePlan(building, floor.id);
    const rect: Rect = { x: 0, y: 0, w: 5, h: 4 };
    next = upsertPlanRoom(next, floor.id, { id: "plan-room-1", roomId: living.id, apartmentId: floor.apartments[0].id, label: living.name, type: "living", rect });
    next = generatePointsForPlanRoom(next, floor.id, "plan-room-1");
    next = syncLoadsFromPlan(next, floor.id);
    const synced = next.floors[0].apartments[0].rooms.find(r => r.id === living.id)!;
    const points: ElectricalPoint[] = planForFloor(next, floor.id)!.points;
    expect(synced.loads.find(l => l.kind === "socket")!.quantity).toBe(countPoints(points).socket);
    expect(synced.loads.find(l => l.kind === "lighting")!.quantity).toBe(Math.max(1, countPoints(points).lighting));
    expect(synced.area).toBeCloseTo(rectArea(rect), 6);
  });

  it("removes a plan room together with its points", () => {
    let next = ensurePlan(building, floor.id);
    next = upsertPlanRoom(next, floor.id, { id: "plan-room-1", roomId: living.id, apartmentId: null, label: living.name, type: "living", rect: { x: 0, y: 0, w: 4, h: 4 } });
    next = generatePointsForPlanRoom(next, floor.id, "plan-room-1");
    next = removePlanRoom(next, floor.id, "plan-room-1");
    const plan = planForFloor(next, floor.id)!;
    expect(plan.rooms).toHaveLength(0);
    expect(plan.points.filter(p => p.roomId === "plan-room-1")).toHaveLength(0);
  });

  it("summarizes building points", () => {
    let next = ensurePlan(building, floor.id);
    next = upsertPlanRoom(next, floor.id, { id: "plan-room-1", roomId: null, apartmentId: null, label: "Living", type: "living", rect: { x: 0, y: 0, w: 4, h: 4 } });
    next = generateAllPoints(next, floor.id);
    const summary = buildingPointSummary(next);
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.socket).toBeGreaterThanOrEqual(6);
  });
});
