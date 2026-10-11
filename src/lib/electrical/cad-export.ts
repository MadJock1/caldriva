import type { FloorPlan } from "./model";

/** ASCII DXF, metre units, with the plan's downward Y axis converted to CAD Y-up. */
export function planDxf(plan: FloorPlan): string {
  const pairs: (string | number)[] = [0, "SECTION", 2, "HEADER", 9, "$ACADVER", 1, "AC1015", 9, "$INSUNITS", 70, 6, 0, "ENDSEC", 0, "SECTION", 2, "ENTITIES"];
  const line = (layer: string, x: number, y: number, x2: number, y2: number) => pairs.push(0, "LINE", 8, layer, 10, x, 20, -y, 30, 0, 11, x2, 21, -y2, 31, 0);
  for (const room of plan.rooms) {
    const { x, y, w, h } = room.rect;
    line("ROOMS", x, y, x + w, y); line("ROOMS", x + w, y, x + w, y + h);
    line("ROOMS", x + w, y + h, x, y + h); line("ROOMS", x, y + h, x, y);
  }
  for (const point of plan.points) pairs.push(0, "CIRCLE", 8, point.kind.toUpperCase(), 10, point.x, 20, -point.y, 30, 0, 40, 0.1);
  for (const route of plan.routes) for (let i = 1; i < route.polyline.length; i++) {
    const a = route.polyline[i - 1], b = route.polyline[i];
    line("ROUTES", a.x, a.y, b.x, b.y);
  }
  pairs.push(0, "ENDSEC", 0, "EOF");
  return pairs.join("\r\n") + "\r\n";
}
