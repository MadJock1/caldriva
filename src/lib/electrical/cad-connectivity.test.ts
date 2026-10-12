import { expect, it } from "vitest";
import { createJunction, electricalConnectivity, floorPlanSchema, insertWireVertex, joinWires, moveWireVertex, removeWireVertex, reanchorWiresForPoint, terminalPosition, wireLength, wireWithTerminalSnaps } from "./index";

const plan = floorPlanSchema.parse({ id: "p", floorId: "f", width: 10, depth: 10, rooms: [], routes: [], points: [
  { id: "socket-a", kind: "socket", x: 1, y: 1, symbolId: "CAL-SOCKET-001", rotationDeg: 0, scale: 1 },
  { id: "socket-b", kind: "socket", x: 5, y: 1, symbolId: "CAL-SOCKET-001", rotationDeg: 0, scale: 1 },
] });

it("snaps wire endpoints to stable symbol terminal references", () => {
  const start = terminalPosition(plan.points[0], "L")!;
  const end = terminalPosition(plan.points[1], "N")!;
  const wire = wireWithTerminalSnaps(plan, "w1", start, end);
  expect(wire.startTerminal).toEqual({ pointId: "socket-a", terminalId: "L" });
  expect(wire.endTerminal).toEqual({ pointId: "socket-b", terminalId: "N" });
});

it("does not connect crossing wires unless terminal references are present", () => {
  const crossingOnly = floorPlanSchema.parse({ ...plan, cadWires: [{ id: "a", polyline: [{ x: 0, y: 0 }, { x: 2, y: 2 }] }, { id: "b", polyline: [{ x: 0, y: 2 }, { x: 2, y: 0 }] }] });
  expect(electricalConnectivity(crossingOnly).size).toBe(0);
});

it("creates a connection dot only for an explicitly placed junction", () => {
  const crossing = floorPlanSchema.parse({ ...plan, cadWires: [{ id: "a", polyline: [{ x: 0, y: 0 }, { x: 2, y: 2 }] }, { id: "b", polyline: [{ x: 0, y: 2 }, { x: 2, y: 0 }] }] });
  const result = createJunction(crossing, "j1", { x: 1, y: 1 });
  expect(result?.junction.wireIds).toEqual(["a", "b"]);
  expect(result?.wires.every(wire => wire.junctionIds.includes("j1"))).toBe(true);
});

it("edits multi-segment wire vertices without changing terminal references", () => {
  const wire = { ...wireWithTerminalSnaps(plan, "w", { x: 1, y: 1 }, { x: 5, y: 1 }), polyline: [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 }] };
  const inserted = insertWireVertex(wire, 1, { x: 2, y: 2 });
  const moved = moveWireVertex(inserted, 1, { x: 2, y: 3 });
  const removed = removeWireVertex(moved, 1);
  expect(inserted.polyline).toHaveLength(4); expect(removed.polyline).toHaveLength(3); expect(wireLength(moved)).toBeGreaterThan(4);
  expect(moved.startTerminal).toEqual(wire.startTerminal);
});

it("rejects joins between different circuit assignments", () => {
  const a = { ...wireWithTerminalSnaps(plan, "a", { x: 0, y: 0 }, { x: 1, y: 1 }), circuitId: "circuit-a" };
  const b = { ...wireWithTerminalSnaps(plan, "b", { x: 1, y: 1 }, { x: 2, y: 2 }), circuitId: "circuit-b" };
  expect(joinWires(a, b)).toBeNull();
});

it("reanchors connected endpoints after symbol translation, rotation, and scale", () => {
  const initial = wireWithTerminalSnaps(plan, "w", terminalPosition(plan.points[0], "L")!, terminalPosition(plan.points[1], "N")!);
  const translated = { ...plan, points: [{ ...plan.points[0], x: 2, rotationDeg: 90, scale: 1.5 }, plan.points[1]], cadWires: [initial] };
  const reanchored = reanchorWiresForPoint(translated, "socket-a")[0];
  expect(reanchored.polyline[0]).toEqual(terminalPosition(translated.points[0], "L"));
  expect(reanchored.endTerminal).toEqual(initial.endTerminal);
});
