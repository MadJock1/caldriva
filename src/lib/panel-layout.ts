import { z } from "zod";
import type { MapPoint } from "./building";
import { horizontalRoofArea } from "./building";

export const layoutSettingsSchema = z.object({ width: z.number().min(.2).max(5), length: z.number().min(.2).max(5), setback: z.number().min(.05).max(10), gap: z.number().min(.01).max(2), orientation: z.enum(["portrait", "landscape"]) });
export type LayoutSettings = z.infer<typeof layoutSettingsSchema>;
export const defaultLayout: LayoutSettings = { width: 1.13, length: 1.72, setback: .5, gap: .02, orientation: "portrait" };
export type XY = [number, number];
export type PanelLayout = { roof: XY[]; panels: XY[][]; bounds: [number, number, number, number]; warning: string };
const distance = (p: XY, a: XY, b: XY) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const cross = (a: XY, b: XY, c: XY) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function segmentDistance(a: XY, b: XY, c: XY, d: XY) {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(distance(a, c, d), distance(b, c, d), distance(c, a, b), distance(d, a, b));
}
export function inside(p: XY, ring: XY[]) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
export function rectangleFits(rect: XY[], roof: XY[], setback: number) {
  if (!rect.every(p => inside(p, roof))) return false;
  for (let i = 0; i < 4; i++) for (let j = 0; j < roof.length; j++) {
    if (segmentDistance(rect[i], rect[(i + 1) % 4], roof[j], roof[(j + 1) % roof.length]) < setback - 1e-8) return false;
  }
  return true;
}
/** Conservative horizontal plan grid, not a sloped-surface or shading optimization. */
export function panelLayout(points: MapPoint[], raw: LayoutSettings, azimuth: number): PanelLayout {
  const empty: PanelLayout = { roof: [], panels: [], bounds: [0, 0, 1, 1], warning: "Draw a roof polygon to generate a preliminary layout." };
  if (points.length < 3) return empty;
  const settings = layoutSettingsSchema.parse(raw);
  z.number().min(0).max(360).parse(azimuth);
  horizontalRoofArea(points);
  const [lat, lon] = points[0];
  if (Math.abs(lat) > 80 || points.some(p => Math.abs(p[0] - lat) > .02 || Math.abs(p[1] - lon) > .02)) throw new Error("Layout requires a compact roof below 80° latitude.");
  const angle = azimuth * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  const roof: XY[] = points.map(([a, b]) => { const x = (b - lon) * 111195.08 * Math.cos(lat * Math.PI / 180), y = (a - lat) * 111195.08; return [x * c - y * s, x * s + y * c]; });
  const bounds: PanelLayout["bounds"] = [Math.min(...roof.map(p => p[0])), Math.min(...roof.map(p => p[1])), Math.max(...roof.map(p => p[0])), Math.max(...roof.map(p => p[1]))];
  const width = settings.orientation === "portrait" ? settings.width : settings.length;
  const length = settings.orientation === "portrait" ? settings.length : settings.width;
  const panels: XY[][] = [];
  let attempts = 0;
  for (let y = bounds[1] + settings.setback; y + length <= bounds[3] - settings.setback + 1e-8; y += length + settings.gap) {
    for (let x = bounds[0] + settings.setback; x + width <= bounds[2] - settings.setback + 1e-8; x += width + settings.gap) {
      if (++attempts > 20000 || panels.length >= 1000) throw new Error("Roof layout exceeds the preliminary editor limit (20,000 candidates / 1,000 panels).");
      const rect: XY[] = [[x, y], [x + width, y], [x + width, y + length], [x, y + length]];
      if (rectangleFits(rect, roof, settings.setback)) panels.push(rect);
    }
  }
  return { roof, panels, bounds, warning: "Horizontal plan approximation. No obstacles, inter-row shading, structural checks or sloped-plane fit verification. A grid alternative, not a global optimum." };
}
