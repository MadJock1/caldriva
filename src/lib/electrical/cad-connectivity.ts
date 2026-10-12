import { registeredSymbol } from "./symbol-registry";
import type { CadJunction, CadWire, ElectricalPoint, FloorPlan, WireTerminalRef, XY } from "./model";

const SYMBOL_DRAWING_SCALE_M = 0.32;

export function terminalPosition(point: ElectricalPoint, terminalId: string): XY | null {
  const symbol = point.symbolId ? registeredSymbol(point.symbolId) : null;
  const terminal = symbol?.geometry.terminals.find(item => item.id === terminalId);
  if (!terminal) return null;
  const radians = -point.rotationDeg * Math.PI / 180;
  const x = terminal.x * point.scale * SYMBOL_DRAWING_SCALE_M;
  const y = -terminal.y * point.scale * SYMBOL_DRAWING_SCALE_M;
  return { x: point.x + x * Math.cos(radians) - y * Math.sin(radians), y: point.y + x * Math.sin(radians) + y * Math.cos(radians) };
}

export function snapToTerminal(plan: FloorPlan, point: XY, toleranceM = 0.2): { point: XY; terminal: WireTerminalRef } | null {
  let match: { point: XY; terminal: WireTerminalRef; distance: number } | null = null;
  for (const symbol of plan.points) {
    const definition = symbol.symbolId ? registeredSymbol(symbol.symbolId) : null;
    for (const terminal of definition?.geometry.terminals ?? []) {
      const position = terminalPosition(symbol, terminal.id);
      if (!position) continue;
      const distance = Math.hypot(point.x - position.x, point.y - position.y);
      if (distance <= toleranceM && (!match || distance < match.distance)) match = { point: position, terminal: { pointId: symbol.id, terminalId: terminal.id }, distance };
    }
  }
  return match ? { point: match.point, terminal: match.terminal } : null;
}

export function electricalConnectivity(plan: FloorPlan) {
  const graph = new Map<string, Set<string>>();
  const add = (a: string, b: string) => { if (!graph.has(a)) graph.set(a, new Set()); graph.get(a)!.add(b); };
  for (const wire of plan.cadWires) {
    if (!wire.startTerminal || !wire.endTerminal) continue;
    const a = `${wire.startTerminal.pointId}:${wire.startTerminal.terminalId}`, b = `${wire.endTerminal.pointId}:${wire.endTerminal.terminalId}`;
    add(a, b); add(b, a);
  }
  return graph;
}

export function wireWithTerminalSnaps(plan: FloorPlan, id: string, start: XY, end: XY): CadWire {
  const startSnap = snapToTerminal(plan, start), endSnap = snapToTerminal(plan, end);
  return { id, polyline: [startSnap?.point ?? start, endSnap?.point ?? end], circuitId: null, startTerminal: startSnap?.terminal ?? null, endTerminal: endSnap?.terminal ?? null, label: "", notes: "", layer: "ELEC-LOGICAL-CONNECTIONS", lineType: "continuous", junctionIds: [], state: "LOGICAL" };
}

export const wireLength = (wire: CadWire) => wire.polyline.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - wire.polyline[index].x, point.y - wire.polyline[index].y), 0);
export function moveWireVertex(wire: CadWire, index: number, point: XY): CadWire { if (index < 0 || index >= wire.polyline.length) return wire; return { ...wire, polyline: wire.polyline.map((vertex, i) => i === index ? point : vertex) }; }
export function insertWireVertex(wire: CadWire, index: number, point: XY): CadWire { if (index < 1 || index >= wire.polyline.length) return wire; return { ...wire, polyline: [...wire.polyline.slice(0, index), point, ...wire.polyline.slice(index)] }; }
export function removeWireVertex(wire: CadWire, index: number): CadWire { if (wire.polyline.length <= 2 || index <= 0 || index >= wire.polyline.length - 1) return wire; return { ...wire, polyline: wire.polyline.filter((_, i) => i !== index) }; }
export function reanchorWiresForPoint(plan: FloorPlan, pointId: string): CadWire[] {
  return plan.cadWires.map(wire => {
    const polyline = [...wire.polyline];
    if (wire.startTerminal?.pointId === pointId) { const position = terminalPosition(plan.points.find(point => point.id === pointId)!, wire.startTerminal.terminalId); if (position) polyline[0] = position; }
    if (wire.endTerminal?.pointId === pointId) { const position = terminalPosition(plan.points.find(point => point.id === pointId)!, wire.endTerminal.terminalId); if (position) polyline[polyline.length - 1] = position; }
    return { ...wire, polyline };
  });
}
export function joinWires(first: CadWire, second: CadWire): CadWire | null {
  if (first.circuitId && second.circuitId && first.circuitId !== second.circuitId) return null;
  const a = first.polyline.at(-1)!, b = second.polyline[0];
  if (a.x !== b.x || a.y !== b.y) return null;
  return { ...first, circuitId: first.circuitId ?? second.circuitId, polyline: [...first.polyline, ...second.polyline.slice(1)], endTerminal: second.endTerminal, junctionIds: [...new Set([...first.junctionIds, ...second.junctionIds])] };
}
export function connectivityDiagnostics(plan: FloorPlan) {
  return plan.cadWires.flatMap(wire => {
    const diagnostics: string[] = [];
    if (!wire.startTerminal || !wire.endTerminal) diagnostics.push(`${wire.id}: floating endpoint`);
    if (wireLength(wire) === 0) diagnostics.push(`${wire.id}: zero-length geometry`);
    return diagnostics;
  });
}

function pointOnSegment(point: XY, a: XY, b: XY, tolerance = 0.08) {
  const length = Math.hypot(b.x - a.x, b.y - a.y); if (!length) return Math.hypot(point.x - a.x, point.y - a.y) <= tolerance;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (length * length)));
  return Math.hypot(point.x - (a.x + t * (b.x - a.x)), point.y - (a.y + t * (b.y - a.y))) <= tolerance;
}
export function createJunction(plan: FloorPlan, id: string, point: XY): { junction: CadJunction; wires: CadWire[] } | null {
  const wireIds = plan.cadWires.filter(wire => wire.polyline.slice(1).some((vertex, index) => pointOnSegment(point, wire.polyline[index], vertex))).map(wire => wire.id);
  if (wireIds.length < 2) return null;
  return { junction: { id, x: point.x, y: point.y, wireIds, note: "" }, wires: plan.cadWires.map(wire => wireIds.includes(wire.id) ? { ...wire, junctionIds: [...new Set([...wire.junctionIds, id])] } : wire) };
}
