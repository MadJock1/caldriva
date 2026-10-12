import type { ElectricalPoint, PointKind, Rect, RoomType } from "./model";

export type RoomGeometryDiagnostic = { roomId: string; code: "OUT_OF_BOUNDS" | "OVERLAP"; relatedRoomId?: string };

export function roomGeometryDiagnostics(rooms: Array<{ id: string; rect: Rect }>, width: number, depth: number): RoomGeometryDiagnostic[] {
  const diagnostics: RoomGeometryDiagnostic[] = [];
  for (let i = 0; i < rooms.length; i += 1) {
    const room = rooms[i];
    const { rect } = room;
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > width || rect.y + rect.h > depth) diagnostics.push({ roomId: room.id, code: "OUT_OF_BOUNDS" });
    for (let j = i + 1; j < rooms.length; j += 1) {
      if (rectsOverlap(rect, rooms[j].rect)) {
        diagnostics.push({ roomId: room.id, relatedRoomId: rooms[j].id, code: "OVERLAP" });
        diagnostics.push({ roomId: rooms[j].id, relatedRoomId: room.id, code: "OVERLAP" });
      }
    }
  }
  return diagnostics;
}

export function rectArea(rect: Rect) {
  return rect.w * rect.h;
}

export function rectPerimeter(rect: Rect) {
  return 2 * (rect.w + rect.h);
}

export function rectCenter(rect: Rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

export function rectContains(rect: Rect, p: { x: number; y: number }) {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

export function rectsOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function clampRect(rect: Rect, width: number, depth: number): Rect {
  const w = Math.min(rect.w, width);
  const h = Math.min(rect.h, depth);
  const x = Math.min(Math.max(0, rect.x), Math.max(0, width - w));
  const y = Math.min(Math.max(0, rect.y), Math.max(0, depth - h));
  return { x, y, w, h };
}

export function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

const SOCKET_MIN: Record<RoomType, number> = {
  living: 6,
  bedroom: 4,
  kitchen: 4,
  bathroom: 0,
  hall: 1,
  corridor: 0,
  stairs: 0,
  storage: 0,
  garage: 1,
  technical: 1,
  laundry: 1,
  balcony: 0,
  office: 4,
  retail: 6,
  other: 0,
};

const LIGHTING_MIN: Record<RoomType, number> = {
  living: 1,
  bedroom: 1,
  kitchen: 1,
  bathroom: 1,
  hall: 1,
  corridor: 1,
  stairs: 1,
  storage: 1,
  garage: 1,
  technical: 1,
  laundry: 1,
  balcony: 1,
  office: 1,
  retail: 2,
  other: 1,
};

export const SOCKET_SPACING_M = 3.5;
const WALL_INSET_M = 0.15;
const CEILING_INSET_M = 0.4;

export function socketCount(rect: Rect, type: RoomType) {
  const min = SOCKET_MIN[type];
  if (min === 0) return 0;
  const bySpacing = Math.ceil(rectPerimeter(rect) / SOCKET_SPACING_M);
  return Math.max(min, Math.min(bySpacing, 24));
}

export function lightingCount(rect: Rect, type: RoomType) {
  const byArea = Math.round(rectArea(rect) / 8);
  return Math.max(LIGHTING_MIN[type], Math.min(byArea, 8));
}

function pointAlongPerimeter(rect: Rect, t: number, inset: number) {
  const w = Math.max(rect.w - 2 * inset, 0.1);
  const h = Math.max(rect.h - 2 * inset, 0.1);
  const x0 = rect.x + inset;
  const y0 = rect.y + inset;
  const total = 2 * (w + h);
  let s = ((t % 1) + 1) % 1 * total;
  if (s <= w) return { x: x0 + s, y: y0 + h };
  s -= w;
  if (s <= h) return { x: x0 + w, y: y0 + h - s };
  s -= h;
  if (s <= w) return { x: x0 + w - s, y: y0 };
  s -= w;
  return { x: x0, y: y0 + s };
}

function pointAtFraction(rect: Rect, fx: number, fy: number) {
  return { x: rect.x + fx * rect.w, y: rect.y + fy * rect.h };
}

export function generateRoomPoints(
  rect: Rect,
  type: RoomType,
  roomId: string | null,
  nextId: (base: string) => string,
): ElectricalPoint[] {
  const points: ElectricalPoint[] = [];
  const make = (kind: PointKind, x: number, y: number) => {
    points.push({ id: nextId(`${roomId ?? "plan"}-${kind}`), kind, x, y, elevationM: null, symbolId: null, deviceReference: "", description: "", rotationDeg: 0, scale: 1, manufacturer: "", productReference: "", datasheetUrl: "", productVerificationStatus: "UNVERIFIED", roomId, note: "" });
  };

  const sockets = socketCount(rect, type);
  for (let i = 0; i < sockets; i += 1) {
    const p = pointAlongPerimeter(rect, (i + 0.5) / sockets, WALL_INSET_M);
    make("socket", p.x, p.y);
  }

  const lights = lightingCount(rect, type);
  if (lights <= 1) {
    const c = rectCenter(rect);
    make("lighting", c.x, c.y);
  } else {
    const cols = Math.max(1, Math.ceil(Math.sqrt((lights * rect.w) / Math.max(rect.h, 0.1))));
    const rows = Math.max(1, Math.ceil(lights / cols));
    const n = cols * rows;
    for (let i = 0; i < n; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const fx = (col + 0.5) / cols;
      const fy = (row + 0.5) / rows;
      const p = pointAtFraction(
        { x: rect.x + CEILING_INSET_M, y: rect.y + CEILING_INSET_M, w: Math.max(rect.w - 2 * CEILING_INSET_M, 0.1), h: Math.max(rect.h - 2 * CEILING_INSET_M, 0.1) },
        fx,
        fy,
      );
      make("lighting", p.x, p.y);
    }
  }

  const sw = pointAlongPerimeter(rect, 0.02, WALL_INSET_M);
  make("switch", sw.x, sw.y);

  if (type === "kitchen") {
    make("dedicated", rect.x + rect.w * 0.3, rect.y + WALL_INSET_M);
    make("dedicated", rect.x + rect.w * 0.7, rect.y + WALL_INSET_M);
  } else if (type === "bathroom") {
    make("dedicated", rect.x + rect.w * 0.5, rect.y + WALL_INSET_M);
  } else if (type === "laundry") {
    make("dedicated", rect.x + rect.w * 0.5, rect.y + WALL_INSET_M);
  }

  return points;
}

export function countPoints(points: ElectricalPoint[]): Record<PointKind, number> {
  const counts: Record<PointKind, number> = { lighting: 0, socket: 0, switch: 0, dedicated: 0, hvac: 0, data: 0, db: 0 };
  for (const point of points) counts[point.kind] += 1;
  return counts;
}

export function planPointSummary(points: ElectricalPoint[]) {
  const counts = countPoints(points);
  return {
    total: points.length,
    lighting: counts.lighting,
    socket: counts.socket,
    switch: counts.switch,
    dedicated: counts.dedicated + counts.hvac + counts.data + counts.db,
  };
}
