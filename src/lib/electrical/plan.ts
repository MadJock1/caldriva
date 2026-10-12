import {
  electricalPointSchema,
  floorPlanSchema,
  planRoomSchema,
  uniqueId,
  type CableRoute,
  type CadWire,
  type CadJunction,
  type PhysicalRoute,
  type ElectricalBuilding,
  type ElectricalPoint,
  type FloorPlan,
  type PointKind,
  type Room,
  type PlanRoom,
  routingZoneSchema,
  type RoutingZone,
} from "./model";
import { reanchorWiresForPoint } from "./cad-connectivity";
import { makeLoad } from "./templates";
import { countPoints, generateRoomPoints, planPointSummary, rectArea } from "./geometry";

export function planForFloor(building: ElectricalBuilding, floorId: string): FloorPlan | undefined {
  return building.plans.find(plan => plan.floorId === floorId);
}

function replacePlan(building: ElectricalBuilding, floorId: string, fn: (plan: FloorPlan) => FloorPlan): ElectricalBuilding {
  const existing = building.plans.find(plan => plan.floorId === floorId);
  const base: FloorPlan = existing ?? { id: `plan-${floorId}`, floorId, width: 20, depth: 14, rooms: [], points: [], routes: [], cadWires: [], cadJunctions: [], routingZones: [], physicalRoutes: [] };
  const next = fn(base);
  const parsed = floorPlanSchema.parse(next);
  const plans = existing ? building.plans.map(plan => (plan.floorId === floorId ? parsed : plan)) : [...building.plans, parsed];
  return { ...building, plans };
}

function takenPointIds(plan: FloorPlan) {
  return new Set(plan.points.map(p => p.id));
}

function pruneRoutes(plan: FloorPlan): FloorPlan {
  const ids = new Set(plan.points.map(p => p.id));
  const routes = plan.routes.filter(r => !r.pointId || ids.has(r.pointId));
  return routes.length === plan.routes.length ? plan : { ...plan, routes };
}

export function ensurePlan(building: ElectricalBuilding, floorId: string, width = 20, depth = 14): ElectricalBuilding {
  if (planForFloor(building, floorId)) return building;
  return replacePlan(building, floorId, () => ({ id: `plan-${floorId}`, floorId, width, depth, rooms: [], points: [], routes: [], cadWires: [], cadJunctions: [], routingZones: [], physicalRoutes: [] }));
}

export function setPlanSize(building: ElectricalBuilding, floorId: string, width: number, depth: number): ElectricalBuilding {
  return replacePlan(building, floorId, plan => ({ ...plan, width: Math.max(1, width), depth: Math.max(1, depth) }));
}

export function upsertPlanRoom(building: ElectricalBuilding, floorId: string, room: PlanRoom): ElectricalBuilding {
  return replacePlan(building, floorId, plan => {
    const parsed = planRoomSchema.parse(room);
    const previous = plan.rooms.find(r => r.id === parsed.id);
    const moved = previous && (["x", "y", "w", "h"] as const).some(k => previous.rect[k] !== parsed.rect[k]);
    const points = moved ? plan.points.map(p => p.roomId !== parsed.id ? p : {
      ...p,
      x: parsed.rect.x + (p.x - previous.rect.x) * parsed.rect.w / previous.rect.w,
      y: parsed.rect.y + (p.y - previous.rect.y) * parsed.rect.h / previous.rect.h,
    }) : plan.points;
    return { ...plan, points, routes: moved ? [] : plan.routes, rooms: previous ? plan.rooms.map(r => (r.id === parsed.id ? parsed : r)) : [...plan.rooms, parsed] };
  });
}

export function removePlanRoom(building: ElectricalBuilding, floorId: string, planRoomId: string): ElectricalBuilding {
  return replacePlan(building, floorId, plan => pruneRoutes({
    ...plan,
    rooms: plan.rooms.filter(r => r.id !== planRoomId),
    points: plan.points.filter(p => p.roomId !== planRoomId),
  }));
}

export function addPlanPoint(building: ElectricalBuilding, floorId: string, kind: PointKind, x: number, y: number, roomId: string | null = null, symbolId: string | null = null): ElectricalBuilding {
  return replacePlan(building, floorId, plan => {
    const taken = takenPointIds(plan);
    const id = uniqueId(`${roomId ?? "plan"}-${kind}`, c => taken.has(c));
    const point = electricalPointSchema.parse({ id, kind, x, y, symbolId, roomId, note: "" });
    return { ...plan, points: [...plan.points, point] };
  });
}

export function updatePlanPoint(building: ElectricalBuilding, floorId: string, point: ElectricalPoint): ElectricalBuilding {
  return replacePlan(building, floorId, plan => {
    const parsed = electricalPointSchema.parse(point);
    const previous = plan.points.find(p => p.id === parsed.id);
    const moved = previous && (previous.x !== parsed.x || previous.y !== parsed.y);
    const transformed = previous && (moved || previous.rotationDeg !== parsed.rotationDeg || previous.scale !== parsed.scale);
    const points = plan.points.map(p => (p.id === parsed.id ? parsed : p));
    return { ...plan, routes: moved ? [] : plan.routes, points, cadWires: transformed ? reanchorWiresForPoint({ ...plan, points }, parsed.id) : plan.cadWires };
  });
}

export function removePlanPoint(building: ElectricalBuilding, floorId: string, pointId: string): ElectricalBuilding {
  return replacePlan(building, floorId, plan => ({ ...plan, points: plan.points.filter(p => p.id !== pointId), routes: plan.routes.filter(r => r.pointId !== pointId) }));
}

function replaceRoutesForRoom(plan: FloorPlan, planRoomId: string): FloorPlan {
  const pointIds = new Set(plan.points.filter(p => p.roomId === planRoomId).map(p => p.id));
  return { ...plan, routes: plan.routes.filter(r => !r.pointId || !pointIds.has(r.pointId)) };
}

export function setPlanRoutes(building: ElectricalBuilding, floorId: string, routes: CableRoute[]): ElectricalBuilding {
  return replacePlan(building, floorId, plan => ({ ...plan, routes }));
}

export function setCadWires(building: ElectricalBuilding, floorId: string, cadWires: CadWire[]): ElectricalBuilding {
  return replacePlan(building, floorId, plan => ({ ...plan, cadWires }));
}

export function setCadJunctions(building: ElectricalBuilding, floorId: string, cadJunctions: CadJunction[]): ElectricalBuilding {
  return replacePlan(building, floorId, plan => ({ ...plan, cadJunctions }));
}

export function clearPlanRoutes(building: ElectricalBuilding, floorId: string): ElectricalBuilding {
  return replacePlan(building, floorId, plan => ({ ...plan, routes: [] }));
}

export function setPhysicalRoutes(building: ElectricalBuilding, floorId: string, physicalRoutes: PhysicalRoute[]): ElectricalBuilding {
  return replacePlan(building, floorId, plan => ({ ...plan, physicalRoutes }));
}

export function upsertRoutingZone(building: ElectricalBuilding, floorId: string, zone: RoutingZone): ElectricalBuilding {
  return replacePlan(building, floorId, plan => {
    const parsed = routingZoneSchema.parse(zone);
    const routingZones = plan.routingZones.some(existing => existing.id === parsed.id)
      ? plan.routingZones.map(existing => existing.id === parsed.id ? parsed : existing)
      : [...plan.routingZones, parsed];
    return { ...plan, routingZones, physicalRoutes: [] };
  });
}

export function removeRoutingZone(building: ElectricalBuilding, floorId: string, zoneId: string): ElectricalBuilding {
  return replacePlan(building, floorId, plan => ({ ...plan, routingZones: plan.routingZones.filter(zone => zone.id !== zoneId), physicalRoutes: [] }));
}

export function generatePointsForPlanRoom(building: ElectricalBuilding, floorId: string, planRoomId: string): ElectricalBuilding {
  return replacePlan(building, floorId, plan => {
    const room = plan.rooms.find(r => r.id === planRoomId);
    if (!room) return plan;
    const taken = new Set(plan.points.filter(p => p.roomId !== planRoomId).map(p => p.id));
    const points = generateRoomPoints(room.rect, room.type, room.id, base => uniqueId(base, c => taken.has(c)));
    points.forEach(p => taken.add(p.id));
    const next: FloorPlan = { ...plan, points: [...plan.points.filter(p => p.roomId !== planRoomId), ...points] };
    return replaceRoutesForRoom(next, planRoomId);
  });
}

export function generateAllPoints(building: ElectricalBuilding, floorId: string): ElectricalBuilding {
  return replacePlan(building, floorId, plan => {
    const manual = plan.points.filter(p => !p.roomId);
    const taken = new Set(manual.map(p => p.id));
    const generated: ElectricalPoint[] = [];
    for (const room of plan.rooms) {
      const points = generateRoomPoints(room.rect, room.type, room.id, base => uniqueId(base, c => taken.has(c)));
      points.forEach(p => { taken.add(p.id); generated.push(p); });
    }
    return { ...plan, points: [...manual, ...generated], routes: [] };
  });
}

export function clearPlanPoints(building: ElectricalBuilding, floorId: string): ElectricalBuilding {
  return replacePlan(building, floorId, plan => ({ ...plan, points: [], routes: [] }));
}

function updateRoomById(building: ElectricalBuilding, roomId: string, fn: (room: Room) => Room): ElectricalBuilding {
  return {
    ...building,
    floors: building.floors.map(floor => ({
      ...floor,
      apartments: floor.apartments.map(apartment => ({
        ...apartment,
        rooms: apartment.rooms.map(room => (room.id === roomId ? fn(room) : room)),
      })),
    })),
  };
}

function syncRoomLoads(room: Room, points: ElectricalPoint[], area: number): Room {
  const counts = countPoints(points);
  let loads = [...room.loads];
  const upsert = (kind: "lighting" | "socket", quantity: number) => {
    const index = loads.findIndex(l => l.kind === kind);
    if (index >= 0) {
      loads = loads.map((l, i) => (i === index ? { ...l, quantity } : l));
    } else if (quantity > 0) {
      const id = uniqueId(`${room.id}-${kind}`, c => loads.some(l => l.id === c));
      loads = [...loads, makeLoad(id, kind, quantity, undefined, room.id)];
    }
  };
  upsert("lighting", Math.max(1, counts.lighting));
  if (counts.socket > 0) upsert("socket", counts.socket);
  return { ...room, area, loads };
}

export function syncLoadsFromPlan(building: ElectricalBuilding, floorId: string): ElectricalBuilding {
  const plan = planForFloor(building, floorId);
  if (!plan) return building;
  let next = building;
  for (const planRoom of plan.rooms) {
    if (!planRoom.roomId) continue;
    const points = plan.points.filter(p => p.roomId === planRoom.id);
    next = updateRoomById(next, planRoom.roomId, room => syncRoomLoads(room, points, rectArea(planRoom.rect)));
  }
  return next;
}

export function buildingPointSummary(building: ElectricalBuilding) {
  const points = building.plans.flatMap(plan => plan.points);
  return planPointSummary(points);
}

export function planRoomCounts(plan: FloorPlan) {
  return plan.rooms.map(room => ({ room, points: plan.points.filter(p => p.roomId === room.id).length }));
}
