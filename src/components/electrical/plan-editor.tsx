"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SymbolPalette } from "@/components/iec60617/SymbolPalette";
import { planDxf } from "@/lib/electrical/cad-export";
import {
  autoRoutePlan,
  clampRect,
  clearPlanRoutes,
  countPoints,
  ensurePlan,
  generateAllPoints,
  generatePhysicalRoutes,
  generatePointsForPlanRoom,
  normalizeRect,
  planForFloor,
  planPointSummary,
  planRoomCounts,
  pointCircuitMap,
  pointCoverageStats,
  pointKindLabels,
  pointRequiresCircuit,
  rectArea,
  roomGeometryDiagnostics,
  removePlanPoint,
  removePlanRoom,
  removeRoutingZone,
  ROOM_TYPES,
  roomTypeLabels,
  routeLength,
  routeDiagnostics,
  setPlanSize,
  setCadWires,
  setCadJunctions,
  snapToTerminal,
  moveWireVertex,
  createJunction,
  syncLoadsFromPlan,
  updatePlanPoint,
  wireWithTerminalSnaps,
  upsertPlanRoom,
  upsertRoutingZone,
  clearPlanPoints,
  addPlanPoint,
  POINT_KINDS,
  type ElectricalBuilding,
  type ElectricalPoint,
  type PlanRoom,
  type PointKind,
  type Rect,
  type RoutingZone,
  type RoomType,
  type XY,
  getSymbolById,
  type SymbolPrimitive,
  RESIDENTIAL_SYMBOL_IDS,
  registeredSymbol,
} from "@/lib/electrical";

const SCALE = 44;
const GRID_SNAP = 0.1; // 0.1 m = 10 cm
const ELECTRICAL_SYMBOL_TOOLS = [
  { id: "CAL-SOCKET-001", label: "Socket" },
  { id: "CAL-LIGHT-001", label: "Light" },
  { id: "CAL-SWITCH-001", label: "Switch" },
  { id: "CAL-MCB-001", label: "MCB" },
  { id: "CAL-TERMINAL-001", label: "Dedicated" },
] as const;
const snap = (v: number) => Number((Math.round(v / GRID_SNAP) * GRID_SNAP).toFixed(3));

function snapRect(rect: Rect): Rect {
  return { x: snap(rect.x), y: snap(rect.y), w: snap(rect.w), h: snap(rect.h) };
}

type CadTool = "select" | "room" | "pan" | "add-symbol" | "wire" | "junction";

type SnapTarget = 
  | { kind: "grid"; point: XY }
  | { kind: "vertex"; point: XY; roomId: string }
  | { kind: "edge"; point: XY; roomId: string; edge: "left" | "right" | "top" | "bottom" }
  | { kind: "center"; point: XY; roomId: string }
  | { kind: "alignment"; point: XY; axis: "x" | "y"; roomId: string };

type HistoryEntry = ElectricalBuilding;

const pointColour: Record<PointKind, string> = {
  lighting: "var(--color-warning)",
  socket: "var(--color-primary)",
  switch: "var(--color-text-secondary)",
  dedicated: "var(--color-success)",
  hvac: "var(--color-primary)",
  data: "var(--color-text-muted)",
  db: "var(--color-error)",
};

type Drag =
  | { mode: "create"; start: XY }
  | { mode: "move"; from: XY; room: PlanRoom; rooms: PlanRoom[] }
  | { mode: "resize"; from: XY; room: PlanRoom }
  | { mode: "point"; from: XY; point: ElectricalPoint }
  | { mode: "wire-vertex"; wireId: string; index: number }
  | { mode: "marquee"; start: XY }
  | { mode: "pan"; from: XY }
  | null;

function toPlan(e: { clientX: number; clientY: number }, svg: SVGSVGElement | null) {
  if (!svg) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x / SCALE, y: local.y / SCALE };
}

function dist2(a: XY, b: XY) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; }

function nextWireId(ids: string[]) {
  const taken = new Set(ids); let index = 1;
  while (taken.has(`wire-${index}`)) index += 1;
  return `wire-${index}`;
}

function findSnapTargets(
  cursor: XY,
  rooms: PlanRoom[]
): SnapTarget[] {
  const targets: SnapTarget[] = [];
  const gridSize = GRID_SNAP;
  // Grid snap
  const gx = Math.round(cursor.x / gridSize) * gridSize;
  const gy = Math.round(cursor.y / gridSize) * gridSize;
  if (dist2(cursor, { x: gx, y: gy }) < 0.02) targets.push({ kind: "grid", point: { x: gx, y: gy } });
  // Room vertices, edges, centers, alignment
  for (const r of rooms) {
    const { x, y, w, h } = r.rect;
    const verts = [
      { x, y, kind: "vertex" as const, label: "nw" },
      { x: x + w, y, kind: "vertex" as const, label: "ne" },
      { x, y: y + h, kind: "vertex" as const, label: "sw" },
      { x: x + w, y: y + h, kind: "vertex" as const, label: "se" },
    ];
    for (const v of verts) {
      if (dist2(cursor, v) < 0.0025) targets.push({ kind: v.kind, point: { x: v.x, y: v.y }, roomId: r.id });
    }
    // Edges midpoints
    const edges = [
      { x, y: y + h / 2, edge: "left" as const },
      { x: x + w, y: y + h / 2, edge: "right" as const },
      { x: x + w / 2, y, edge: "top" as const },
      { x: x + w / 2, y: y + h, edge: "bottom" as const },
    ];
    for (const e of edges) {
      if (dist2(cursor, e) < 0.0025) targets.push({ kind: "edge", point: { x: e.x, y: e.y }, roomId: r.id, edge: e.edge });
    }
    // Center
    const center = { x: x + w / 2, y: y + h / 2 };
    if (dist2(cursor, center) < 0.0025) targets.push({ kind: "center", point: center, roomId: r.id });
    // Alignment guides (edges and centers)
    if (Math.abs(cursor.x - x) < 0.02) targets.push({ kind: "alignment", point: { x, y: cursor.y }, axis: "x", roomId: r.id });
    if (Math.abs(cursor.x - (x + w)) < 0.02) targets.push({ kind: "alignment", point: { x: x + w, y: cursor.y }, axis: "x", roomId: r.id });
    if (Math.abs(cursor.x - (x + w / 2)) < 0.02) targets.push({ kind: "alignment", point: { x: x + w / 2, y: cursor.y }, axis: "x", roomId: r.id });
    if (Math.abs(cursor.y - y) < 0.02) targets.push({ kind: "alignment", point: { x: cursor.x, y }, axis: "y", roomId: r.id });
    if (Math.abs(cursor.y - (y + h)) < 0.02) targets.push({ kind: "alignment", point: { x: cursor.x, y: y + h }, axis: "y", roomId: r.id });
    if (Math.abs(cursor.y - (y + h / 2)) < 0.02) targets.push({ kind: "alignment", point: { x: cursor.x, y: y + h / 2 }, axis: "y", roomId: r.id });
  }
  return targets;
}

function applySnap(cursor: XY, targets: SnapTarget[]): { point: XY; guides: SnapTarget[] } {
  const priority = ["vertex", "edge", "center"];
  for (const kind of priority) {
    const match = targets.find(t => t.kind === kind);
    if (match) return { point: match.point, guides: [match] };
  }
  const guides = targets.filter(t => t.kind === "alignment");
  return { point: { x: guides.find(t => t.kind === "alignment" && t.axis === "x")?.point.x ?? snap(cursor.x), y: guides.find(t => t.kind === "alignment" && t.axis === "y")?.point.y ?? snap(cursor.y) }, guides };
}

function LibrarySymbol({ primitives, colour }: { primitives: SymbolPrimitive[]; colour: string }) {
  const scale = 14;
  return <>{primitives.map((primitive, index) => {
    if (primitive.type === "line") return <line key={index} x1={primitive.x1 * scale} y1={-primitive.y1 * scale} x2={primitive.x2 * scale} y2={-primitive.y2 * scale} stroke={colour} vectorEffect="non-scaling-stroke" />;
    if (primitive.type === "circle") return <circle key={index} cx={primitive.cx * scale} cy={-primitive.cy * scale} r={primitive.r * scale} fill="var(--color-background)" stroke={colour} vectorEffect="non-scaling-stroke" />;
    if (primitive.type === "rect") return <rect key={index} x={primitive.x * scale} y={-(primitive.y + primitive.height) * scale} width={primitive.width * scale} height={primitive.height * scale} fill="var(--color-background)" stroke={colour} vectorEffect="non-scaling-stroke" />;
    if (primitive.type === "polyline") return <polyline key={index} points={primitive.points.map(point => `${point.x * scale},${-point.y * scale}`).join(" ")} fill={primitive.closed ? "var(--color-background)" : "none"} stroke={colour} vectorEffect="non-scaling-stroke" />;
    return <text key={index} x={primitive.x * scale} y={-primitive.y * scale} textAnchor="middle" fill={colour} fontSize={primitive.height * scale}>{primitive.value}</text>;
  })}</>;
}

function PointSymbol({ point, selected, onPointerDown }: { point: ElectricalPoint; selected: boolean; onPointerDown: (e: React.PointerEvent) => void }) {
  const colour = pointColour[point.kind];
  const librarySymbol = point.symbolId ? getSymbolById(point.symbolId) : null;
  return (
    <g transform={`translate(${point.x * SCALE} ${point.y * SCALE}) rotate(${-point.rotationDeg}) scale(${point.scale})`} onPointerDown={onPointerDown} style={{ cursor: "grab" }}>
      {librarySymbol ? <LibrarySymbol primitives={librarySymbol.geometry.primitives} colour={colour} /> : point.kind === "switch" ? (
        <g><circle r={4} fill="var(--color-background)" stroke={colour} strokeWidth={selected ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" /><line x1={-2} y1={2} x2={2.5} y2={-2.5} stroke={colour} vectorEffect="non-scaling-stroke" /></g>
      ) : point.kind === "lighting" ? (
        <g>
          <circle r={5} fill="none" stroke={colour} strokeWidth={selected ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
          <line x1={-7} y1={0} x2={7} y2={0} stroke={colour} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={-7} x2={0} y2={7} stroke={colour} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>
      ) : point.kind === "dedicated" ? (
        <polygon points="0,-6 6,4 -6,4" fill="var(--color-background)" stroke={colour} strokeWidth={selected ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
      ) : point.kind === "socket" ? (
        <g><circle r={5} fill="var(--color-background)" stroke={colour} strokeWidth={selected ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" /><line x1={-1.7} y1={-1.8} x2={-1.7} y2={1.8} stroke={colour} vectorEffect="non-scaling-stroke" /><line x1={1.7} y1={-1.8} x2={1.7} y2={1.8} stroke={colour} vectorEffect="non-scaling-stroke" /></g>
      ) : point.kind === "db" ? (
        <g><rect x={-6} y={-5} width={12} height={10} fill="var(--color-background)" stroke={colour} strokeWidth={selected ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" /><text textAnchor="middle" y={3} fontSize={7} fill={colour}>DB</text></g>
      ) : (
        <circle r={5} fill="var(--color-background)" stroke={colour} strokeWidth={selected ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />
      )}
      <title>{`${librarySymbol?.name ?? pointKindLabels[point.kind]} · (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) m${librarySymbol ? " · IEC 60617 candidate, source review required" : ""}`}</title>
    </g>
  );
}

export function PlanEditor({ building, onChange: publish }: { building: ElectricalBuilding; onChange: (b: ElectricalBuilding) => void }) {
  const [floorId, setFloorId] = useState(building.floors[0]?.id ?? "");
  const [tool, setTool] = useState<CadTool>("select");
  const [selection, setSelection] = useState<string[]>([]);
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const beforeDrag = useRef<ElectricalBuilding | null>(null);
  const latest = useRef(building);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<XY>({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [showPhysicalRoutes, setShowPhysicalRoutes] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");
  const [physicalRouteMessage, setPhysicalRouteMessage] = useState("");
  const clipboard = useRef<PlanRoom[]>([]);
  const touches = useRef(new Map<number, XY>());
  const pinch = useRef<number | null>(null);
  const [guides, setGuides] = useState<SnapTarget[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [wireVertices, setWireVertices] = useState<XY[]>([]);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>(null);
  function onChange(next: ElectricalBuilding) {
    if (!beforeDrag.current) { setPast(p => [...p.slice(-49), building]); setFuture([]); }
    latest.current = next;
    publish(next);
  }
  function history(redo = false) {
    const source = redo ? future : past;
    const next = source.at(-1);
    if (!next) return;
    if (redo) { setFuture(source.slice(0, -1)); setPast(p => [...p, building]); }
    else { setPast(source.slice(0, -1)); setFuture(p => [...p, building]); }
    publish(next); setSelection([]); setSelectedRoomId(null); setSelectedPointId(null);
  }
  const [newType, setNewType] = useState<RoomType>("living");
  const [attachRoomId, setAttachRoomId] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);
  const [preview, setPreview] = useState<Rect | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(z => Math.max(0.5, Math.min(8, z * (event.deltaY < 0 ? 1.1 : 1 / 1.1))));
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [building.floors.length]);

  const activeFloorId = building.floors.some(f => f.id === floorId) ? floorId : building.floors[0]?.id ?? "";
  const floor = building.floors.find(f => f.id === activeFloorId);
  const plan = activeFloorId ? planForFloor(building, activeFloorId) : undefined;

  useEffect(() => {
    if (activeFloorId && !planForFloor(building, activeFloorId)) publish(ensurePlan(building, activeFloorId));
  }, [activeFloorId, building, publish]);

  const hierarchyRooms = useMemo(
    () => (floor ? floor.apartments.flatMap(a => a.rooms.map(r => ({ id: r.id, apartmentId: a.id, label: `${a.code} · ${r.name}`, type: r.type, area: r.area }))) : []),
    [floor],
  );
  const placedRoomIds = useMemo(() => new Set(plan?.rooms.map(r => r.roomId).filter((x): x is string => Boolean(x))), [plan]);
  const unplaced = hierarchyRooms.filter(r => !placedRoomIds.has(r.id));
  const counts = plan ? countPoints(plan.points) : null;
  const summary = planPointSummary(plan?.points ?? []);
  const coverage = useMemo(() => pointCoverageStats(building), [building]);
  const circuitMap = useMemo(() => pointCircuitMap(building), [building]);
  const selectedRoom = plan?.rooms.find(r => r.id === selectedRoomId) ?? null;
  const selectedPoint = plan?.points.find(p => p.id === selectedPointId) ?? null;
  const selectedRegisteredSymbol = selectedPoint?.symbolId ? registeredSymbol(selectedPoint.symbolId) : null;
  const selectedAssignment = selectedPoint ? circuitMap.get(selectedPoint.id) : undefined;
  const selectedZone = plan?.routingZones.find(zone => zone.id === selectedZoneId) ?? null;
  const selectedWire = plan?.cadWires.find(wire => wire.id === selectedWireId) ?? null;
  const selectedJunction = plan?.cadJunctions.find(junction => junction.id === selectedJunctionId) ?? null;
  const geometryDiagnostics = useMemo(() => plan ? roomGeometryDiagnostics(plan.rooms, plan.width, plan.depth) : [], [plan]);
  const routingDiagnostics = useMemo(() => plan ? routeDiagnostics(plan) : [], [plan]);

  function onBackgroundDown(e: React.PointerEvent) {
    const start = toPlan(e, svgRef.current);
    if (!start) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    if (tool === "pan") { dragRef.current = { mode: "pan", from: start }; return; }
    if (tool === "add-symbol") {
      if (selectedSymbol) {
        placeSymbolAt(selectedSymbol, start.x, start.y);
      }
      return;
    }
    if (tool === "wire" && plan) {
      const snapped = snapToTerminal(plan, start)?.point ?? { x: snap(start.x), y: snap(start.y) };
      setWireVertices(vertices => [...vertices, snapped]);
      return;
    }
    if (tool === "junction" && plan) {
      const junction = createJunction(plan, `junction-${plan.cadJunctions.length + 1}`, { x: snap(start.x), y: snap(start.y) });
      if (junction) { const withWires = setCadWires(building, activeFloorId, junction.wires); onChange(setCadJunctions(withWires, activeFloorId, [...plan.cadJunctions, junction.junction])); }
      return;
    }
    if (tool !== "room") {
      setSelection([]);
      setSelectedRoomId(null);
      setSelectedPointId(null);
      setSelectedWireId(null);
      setSelectedJunctionId(null);
      dragRef.current = { mode: "marquee", start };
      return;
    }
    beforeDrag.current = building;
    latest.current = building;
    dragRef.current = { mode: "create", start };
    setPreview({ x: start.x, y: start.y, w: 0, h: 0 });
    setSelectedRoomId(null);
    setSelectedPointId(null);
  }

  function placeSymbolAt(symbolId: string, x: number, y: number) {
    // For now, add an electrical point with the symbol type
    // In the future, this would place an actual IEC 60617 symbol
    const kindMap: Record<string, PointKind> = {
      "CAL-SWITCH-001": "switch",
      "CAL-PUSHBUTTON-NO-001": "data",
      "SW-002": "switch",
      "SW-003": "switch",
      "CAL-LIGHT-001": "lighting",
      "LT-002": "lighting",
      "LT-003": "lighting",
      "CAL-SOCKET-001": "socket",
      "SOC-002": "socket",
      "SOC-003": "socket",
      "SOC-004": "socket",
      "SOC-005": "socket",
      "CAL-MCB-001": "data",
      "CAL-CONDUCTOR-001": "data",
      "CB-003": "db",
      "CB-004": "db",
      "CAL-TERMINAL-001": "data",
      "CAL-EARTH-001": "data",
      "MT-002": "dedicated",
      "WH-001": "dedicated",
    };
    const kind = kindMap[symbolId] ?? "dedicated";
    onChange(addPlanPoint(building, activeFloorId, kind, x, y, null, symbolId));
  }

  function onRoomDown(e: React.PointerEvent, room: PlanRoom) {
    if (tool !== "select") return;
    e.stopPropagation();
    const start = toPlan(e, svgRef.current);
    if (!start) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    setSelectedRoomId(room.id);
    setSelectedPointId(null);
    const ids = e.shiftKey ? (selection.includes(room.id) ? selection.filter(id => id !== room.id) : [...selection, room.id]) : selection.includes(room.id) ? selection : [room.id];
    setSelection(ids);
    beforeDrag.current = building;
    latest.current = building;
    dragRef.current = { mode: "move", from: start, room, rooms: plan?.rooms.filter(r => ids.includes(r.id)) ?? [] };
  }

  function onResizeDown(e: React.PointerEvent, room: PlanRoom) {
    e.stopPropagation();
    if (room.fixedSize) return;
    const start = toPlan(e, svgRef.current);
    if (!start) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    beforeDrag.current = building;
    latest.current = building;
    dragRef.current = { mode: "resize", from: start, room };
  }

  function onPointDown(e: React.PointerEvent, point: ElectricalPoint) {
    if (tool !== "select") return;
    e.stopPropagation();
    const start = toPlan(e, svgRef.current);
    if (!start) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    setSelectedPointId(point.id);
    setSelectedRoomId(null);
    setSelection([]);
    beforeDrag.current = building;
    latest.current = building;
    dragRef.current = { mode: "point", from: start, point };
  }

  function onWireDown(e: React.PointerEvent, wireId: string) {
    if (tool !== "select") return;
    e.stopPropagation(); setSelectedWireId(wireId); setSelectedJunctionId(null); setSelectedPointId(null); setSelectedRoomId(null); setSelection([]);
  }
  function onWireVertexDown(e: React.PointerEvent, wireId: string, index: number) {
    if (tool !== "select") return;
    e.stopPropagation(); svgRef.current?.setPointerCapture(e.pointerId); beforeDrag.current = building; latest.current = building; dragRef.current = { mode: "wire-vertex", wireId, index };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      const distance = Math.sqrt(dist2(a, b));
      if (pinch.current && distance > 0) { const ratio = distance / pinch.current; setZoom(z => Math.max(0.5, Math.min(8, z * ratio))); }
      pinch.current = distance;
      return;
    }
    const drag = dragRef.current;
    if (!drag || !plan) return;
    const raw = toPlan(e, svgRef.current);
    if (!raw) return;
    if (drag.mode === "pan") { setPan(p => ({ x: p.x + drag.from.x - raw.x, y: p.y + drag.from.y - raw.y })); return; }
    if (drag.mode === "marquee") { setPreview(normalizeRect(drag.start, raw)); return; }
    const result = applySnap(raw, findSnapTargets(raw, plan.rooms.filter(r => !selection.includes(r.id) && r.id !== selectedRoomId)));
    const m = result.point;
    setGuides(result.guides);
    if (drag.mode === "create") {
      setPreview(normalizeRect(drag.start, m));
    } else if (drag.mode === "move") {
      let next = beforeDrag.current ?? building;
      const dx = Math.max(...drag.rooms.map(r => -r.rect.x), Math.min(m.x - drag.from.x, ...drag.rooms.map(r => plan.width - r.rect.x - r.rect.w)));
      const dy = Math.max(...drag.rooms.map(r => -r.rect.y), Math.min(m.y - drag.from.y, ...drag.rooms.map(r => plan.depth - r.rect.y - r.rect.h)));
      for (const room of drag.rooms) next = upsertPlanRoom(next, activeFloorId, { ...room, rect: snapRect({ ...room.rect, x: room.rect.x + dx, y: room.rect.y + dy }) });
      onChange(next);
    } else if (drag.mode === "resize") {
      const w = Math.max(0.5, m.x - drag.room.rect.x);
      const h = Math.max(0.5, m.y - drag.room.rect.y);
      const rect = clampRect({ ...drag.room.rect, w, h }, plan.width, plan.depth);
      onChange(upsertPlanRoom(building, activeFloorId, { ...drag.room, rect: snapRect(rect) }));
    } else if (drag.mode === "point") {
      const x = Math.min(Math.max(0, snap(m.x)), plan.width);
      const y = Math.min(Math.max(0, snap(m.y)), plan.depth);
      onChange(updatePlanPoint(building, activeFloorId, { ...drag.point, x, y }));
    } else if (drag.mode === "wire-vertex") {
      const wire = plan.cadWires.find(item => item.id === drag.wireId);
      if (wire) onChange(setCadWires(building, activeFloorId, plan.cadWires.map(item => item.id === wire.id ? moveWireVertex(item, drag.index, { x: snap(m.x), y: snap(m.y) }) : item)));
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    touches.current.delete(e.pointerId); pinch.current = null;
    const drag = dragRef.current;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    if (drag?.mode === "create" && preview && preview.w >= 0.5 && preview.h >= 0.5 && plan) {
      const rect = clampRect(snapRect(preview), plan.width, plan.depth);
      const attached = hierarchyRooms.find(r => r.id === attachRoomId);
      const idBase = attached ? `pr-${attached.id}` : `pr-${newType}`;
      let n = 1;
      let id = idBase;
      while (plan.rooms.some(r => r.id === id)) { n += 1; id = `${idBase}-${n}`; }
      onChange(upsertPlanRoom(building, activeFloorId, {
        id,
        roomId: attached?.id ?? null,
        apartmentId: attached?.apartmentId ?? null,
        label: attached?.label ?? roomTypeLabels[newType],
        type: attached?.type ?? newType,
        rect,
      }));
      setSelectedRoomId(id);
      setSelection([id]);
    }
    if (drag?.mode === "marquee" && preview && plan) {
      const ids = plan.rooms.filter(r => r.rect.x >= preview.x && r.rect.y >= preview.y && r.rect.x + r.rect.w <= preview.x + preview.w && r.rect.y + r.rect.h <= preview.y + preview.h).map(r => r.id);
      setSelection(ids); setSelectedRoomId(ids[0] ?? null);
    }
    const previous = beforeDrag.current;
    if (previous && latest.current !== previous) { setPast(p => [...p.slice(-49), previous]); setFuture([]); }
    beforeDrag.current = null;
    dragRef.current = null;
    setPreview(null);
    setGuides([]);
  }

  function autoArrange() {
    if (!plan) return;
    const targets = unplaced;
    if (targets.length === 0) return;
    const w = 4;
    const h = 3.2;
    const gap = 0.4;
    let x = 0.5;
    let y = 0.5;
    let rowH = 0;
    let next = building;
    for (const r of targets) {
      if (x + w > plan.width - 0.5) { x = 0.5; y += rowH + gap; rowH = 0; }
      const rect = snapRect({ x, y, w, h });
      next = upsertPlanRoom(next, activeFloorId, { id: `pr-${r.id}`, roomId: r.id, apartmentId: r.apartmentId, label: r.label, type: r.type, rect });
      x += w + gap;
      rowH = Math.max(rowH, h);
    }
    next = generateAllPoints(next, activeFloorId);
    onChange(next);
    setSelectedRoomId(null);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).closest("input,select,textarea")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); history(e.shiftKey); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") { clipboard.current = plan?.rooms.filter(r => selection.includes(r.id)) ?? []; e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") { duplicate(clipboard.current); e.preventDefault(); return; }
    if (e.key === "Escape") {
      if (beforeDrag.current) publish(beforeDrag.current);
      beforeDrag.current = null; dragRef.current = null; setPreview(null); setGuides([]);
      setSelection([]); setSelectedRoomId(null); setSelectedPointId(null); setSelectedWireId(null); setSelectedJunctionId(null); setWireVertices([]); setTool("select"); return;
    }
    if (tool === "wire" && e.key === "Backspace") { setWireVertices(vertices => vertices.slice(0, -1)); e.preventDefault(); return; }
    if (tool === "wire" && e.key === "Enter" && plan && wireVertices.length >= 2) {
      const wire = wireWithTerminalSnaps(plan, nextWireId(plan.cadWires.map(item => item.id)), wireVertices[0], wireVertices.at(-1)!);
      onChange(setCadWires(building, activeFloorId, [...plan.cadWires, { ...wire, polyline: wireVertices }])); setWireVertices([]); e.preventDefault(); return;
    }
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (selection.length) { let next = building; for (const id of selection) next = removePlanRoom(next, activeFloorId, id); onChange(next); setSelection([]); setSelectedRoomId(null); e.preventDefault(); return; }
    if (selectedPointId) { onChange(removePlanPoint(building, activeFloorId, selectedPointId)); setSelectedPointId(null); e.preventDefault(); }
    else if (selectedWireId && plan) { onChange(setCadWires(building, activeFloorId, plan.cadWires.filter(wire => wire.id !== selectedWireId))); setSelectedWireId(null); e.preventDefault(); }
    else if (selectedRoomId) { onChange(removePlanRoom(building, activeFloorId, selectedRoomId)); setSelectedRoomId(null); e.preventDefault(); }
  }

  function duplicate(source = plan?.rooms.filter(r => selection.includes(r.id)) ?? []) {
    if (!plan) return;
    let next = building;
    const ids: string[] = [];
    for (const room of source) {
      const id = `pr-${crypto.randomUUID()}`;
      ids.push(id);
      next = upsertPlanRoom(next, activeFloorId, { ...room, id, roomId: null, apartmentId: null, label: `${room.label.slice(0, 115)} copy`, rect: clampRect({ ...room.rect, x: room.rect.x + 0.5, y: room.rect.y + 0.5 }, plan.width, plan.depth) });
    }
    onChange(next); setSelection(ids); setSelectedRoomId(ids[0] ?? null);
  }

  function constrain(mode: "left" | "top" | "width" | "height") {
    if (!plan || !selectedRoom) return;
    let next = building;
    for (const room of plan.rooms.filter(r => selection.includes(r.id))) {
      if (room.fixedSize && (mode === "width" || mode === "height")) continue;
      const rect = { ...room.rect };
      if (mode === "left") rect.x = selectedRoom.rect.x;
      if (mode === "top") rect.y = selectedRoom.rect.y;
      if (mode === "width") rect.w = selectedRoom.rect.w;
      if (mode === "height") rect.h = selectedRoom.rect.h;
      next = upsertPlanRoom(next, activeFloorId, { ...room, rect: clampRect(rect, plan.width, plan.depth) });
    }
    onChange(next);
  }

  function download(blob: Blob, extension: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `floor-${floor?.code ?? "plan"}.${extension}`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportSvg(png = false) {
    if (!svgRef.current) return;
    const copy = svgRef.current.cloneNode(true) as SVGSVGElement;
    const originals = [svgRef.current, ...svgRef.current.querySelectorAll("*")];
    const clones = [copy, ...copy.querySelectorAll("*")];
    originals.forEach((node, i) => {
      const style = getComputedStyle(node);
      for (const key of ["fill", "stroke", "color", "font-family"]) clones[i].setAttribute(key, style.getPropertyValue(key));
    });
    copy.querySelectorAll("[data-editor-only]").forEach(node => node.remove());
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("viewBox", `0 0 ${width * SCALE} ${depth * SCALE}`);
    copy.setAttribute("width", String(width * SCALE)); copy.setAttribute("height", String(depth * SCALE));
    copy.removeAttribute("style");
    const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" });
    if (!png) { download(blob, "svg"); return; }
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 4096 / Math.max(width * SCALE, depth * SCALE));
      canvas.width = width * SCALE * scale; canvas.height = depth * SCALE * scale;
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(result => { if (result) download(result, "png"); else setExportError("PNG export failed."); });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => { setExportError("PNG export failed."); URL.revokeObjectURL(url); };
    image.src = url;
  }

  if (building.floors.length === 0) {
    return <p className="text-sm text-text-muted">Generate a building first, then lay out each floor plan here.</p>;
  }

  const width = plan?.width ?? 20;
  const depth = plan?.depth ?? 14;
  const gridLines = [];
  for (let gx = 0; gx <= Math.floor(width); gx += 1) gridLines.push(<line key={`vx${gx}`} x1={gx * SCALE} y1={0} x2={gx * SCALE} y2={depth * SCALE} stroke="var(--color-border)" strokeWidth={gx % 5 === 0 ? 1 : 0.5} opacity={gx % 5 === 0 ? 0.7 : 0.3} vectorEffect="non-scaling-stroke" />);
  for (let gy = 0; gy <= Math.floor(depth); gy += 1) gridLines.push(<line key={`hy${gy}`} x1={0} y1={gy * SCALE} x2={width * SCALE} y2={gy * SCALE} stroke="var(--color-border)" strokeWidth={gy % 5 === 0 ? 1 : 0.5} opacity={gy % 5 === 0 ? 0.7 : 0.3} vectorEffect="non-scaling-stroke" />);

  return (
    <div className="space-y-4" onKeyDown={onKeyDown}>
      {geometryDiagnostics.length > 0 && <p role="alert" className="rounded-lg border border-warning bg-warning-muted p-3 text-sm">Conceptual geometry warning: {geometryDiagnostics.filter(d => d.code === "OVERLAP").length / 2} room overlap(s) and {geometryDiagnostics.filter(d => d.code === "OUT_OF_BOUNDS").length} room(s) outside drawing bounds. Review architecture before routing or issuing drawings.</p>}
      {routingDiagnostics.length > 0 && <p role="alert" className="rounded-lg border border-warning bg-warning-muted p-3 text-sm">Route validation warning: {routingDiagnostics.length} issue(s). Route length is preliminary and does not establish constructible containment or permitted wall penetrations.</p>}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Floor
            <select className="ml-2 border border-border bg-surface rounded-lg p-2 text-sm" value={activeFloorId} onChange={e => { setFloorId(e.target.value); setSelection([]); setPan({ x: 0, y: 0 }); setZoom(1); setSelectedRoomId(null); setSelectedPointId(null); }}>
              {[...building.floors].sort((a, b) => b.level - a.level).map(f => <option key={f.id} value={f.id}>{f.code} · {f.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Width (m)
            <Input type="number" min={1} max={200} step={0.5} value={width} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(setPlanSize(building, activeFloorId, n, depth)); }} className="w-24 ml-2 h-9" />
          </label>
          <label className="text-sm">Depth (m)
            <Input type="number" min={1} max={200} step={0.5} value={depth} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(setPlanSize(building, activeFloorId, width, n)); }} className="w-24 ml-2 h-9" />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1" role="group" aria-label="Drawing tool">
            <Button size="sm" variant={tool === "select" ? "default" : "outline"} onClick={() => setTool("select")}>Select</Button>
            <Button size="sm" variant={tool === "room" ? "default" : "outline"} onClick={() => setTool("room")}>Draw room</Button>
            <Button size="sm" variant={tool === "wire" ? "default" : "outline"} onClick={() => { setTool("wire"); setWireVertices([]); }}>Draw wire</Button>
            <Button size="sm" variant={tool === "junction" ? "default" : "outline"} onClick={() => setTool("junction")}>Junction</Button>
            <Button size="sm" variant={tool === "pan" ? "default" : "outline"} onClick={() => setTool("pan")}>Pan</Button>
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Electrical symbol library">
            {ELECTRICAL_SYMBOL_TOOLS.map(symbol => <Button key={symbol.id} size="sm" variant={tool === "add-symbol" && selectedSymbol === symbol.id ? "default" : "outline"} onClick={() => { setTool("add-symbol"); setSelectedSymbol(symbol.id); }}>{symbol.label}</Button>)}
            {tool === "add-symbol" && <span className="self-center text-xs text-text-muted">Click the drawing to place {ELECTRICAL_SYMBOL_TOOLS.find(symbol => symbol.id === selectedSymbol)?.label?.toLowerCase() ?? "symbol"}; select another tool to finish.</span>}
            {tool === "wire" && <span className="self-center text-xs text-text-muted">{wireVertices.length ? `${wireVertices.length} vertex/vertices; Enter commits, Backspace removes last` : "Select a terminal or wire start"}; terminal snaps create logical connectivity.</span>}
          </div>
          <p className="w-full text-xs text-text-muted">IEC 60617 candidate library. Current symbols are Caldriva-authored and require source review before standards representation.</p>
          <label className="text-sm">Type
            <select className="ml-2 border border-border bg-surface rounded-lg p-2 text-sm" value={newType} onChange={e => setNewType(e.target.value as RoomType)}>
              {ROOM_TYPES.map(t => <option key={t} value={t}>{roomTypeLabels[t]}</option>)}
            </select>
          </label>
          <label className="text-sm">Attach to
            <select className="ml-2 border border-border bg-surface rounded-lg p-2 text-sm max-w-[240px]" value={attachRoomId} onChange={e => setAttachRoomId(e.target.value)}>
              <option value="">Unassigned ({roomTypeLabels[newType]})</option>
              {unplaced.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={autoArrange} disabled={unplaced.length === 0}>Auto-arrange {unplaced.length} room(s)</Button>
          <Button size="sm" variant="outline" onClick={() => onChange(generateAllPoints(building, activeFloorId))} disabled={!plan || plan.rooms.length === 0}>Generate all points</Button>
          <Button size="sm" variant="outline" onClick={() => onChange(autoRoutePlan(building, activeFloorId))} disabled={!plan || plan.points.length === 0}>Auto-route points</Button>
          <Button size="sm" variant="outline" onClick={() => { const result = generatePhysicalRoutes(building, activeFloorId); onChange(result.building); setPhysicalRouteMessage(result.generated > 0 ? `${result.generated} proposed physical route(s) generated. ${result.diagnostics.length} item(s) still require review.` : result.diagnostics[0]?.message ?? "NO VERIFIED PHYSICAL ROUTE AVAILABLE"); }} disabled={!plan || plan.points.length === 0}>Generate proposed physical routes</Button>
          <Button size="sm" variant="outline" onClick={() => {
            if (!plan) return;
            const id = `zone-${Date.now()}`;
            const zone: RoutingZone = { id, label: "Unreviewed ceiling zone", type: "ceiling_zone", containment: "ceiling_void", polyline: [{ x: 0.5, y: 0.5, z: 2.7 }, { x: Math.max(0.5, width - 0.5), y: 0.5, z: 2.7 }], widthM: null, heightM: null, material: null, installationMethod: null, firePerformance: null, availableRoutingZone: null, crossingElement: null, crossingId: null, crossingReviewed: false, reviewStatus: "UNREVIEWED" };
            setSelectedZoneId(id); onChange(upsertRoutingZone(building, activeFloorId, zone));
          }} disabled={!plan}>Add routing zone</Button>
          <Button size="sm" variant="outline" onClick={() => onChange(clearPlanPoints(building, activeFloorId))} disabled={!plan || plan.points.length === 0}>Clear points</Button>
          <Button size="sm" variant="outline" onClick={() => onChange(clearPlanRoutes(building, activeFloorId))} disabled={!plan || plan.routes.length === 0}>Clear routes</Button>
          <Button size="sm" variant="outline" onClick={() => onChange(syncLoadsFromPlan(building, activeFloorId))} disabled={!plan || plan.rooms.length === 0}>Sync loads from plan</Button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="CAD controls">
          <Button size="sm" variant="outline" disabled={!past.length} onClick={() => history()}>Undo</Button>
          <Button size="sm" variant="outline" disabled={!future.length} onClick={() => history(true)}>Redo</Button>
          <Button size="sm" variant="outline" disabled={!selection.length} onClick={() => duplicate()}>Duplicate rooms</Button>
          <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(8, z * 1.25))}>Zoom in</Button>
          <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(0.5, z / 1.25))}>Zoom out</Button>
          <Button size="sm" variant="outline" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Fit plan</Button>
          <Button size="sm" variant="outline" onClick={() => exportSvg()}>Export SVG</Button>
          <Button size="sm" variant="outline" onClick={() => exportSvg(true)}>Export PNG</Button>
          <Button size="sm" variant="outline" onClick={() => { if (plan) download(new Blob([planDxf(plan)], { type: "application/dxf" }), "dxf"); }}>Export DXF geometry</Button>
          <span className="text-sm self-center">{Math.round(zoom * 100)}% · {selection.length} rooms selected</span>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dimensions} onChange={e => setDimensions(e.target.checked)} />Show dimensions</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showPoints} onChange={e => setShowPoints(e.target.checked)} />Show electrical points</label>
        {exportError && <p role="alert">{exportError}</p>}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} />
          Show cable routes{plan && plan.routes.length > 0 ? ` (${plan.routes.length})` : ""}
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showPhysicalRoutes} onChange={e => setShowPhysicalRoutes(e.target.checked)} />Show proposed physical routes</label>
        {physicalRouteMessage && <p role="status" className="text-sm text-text-muted">{physicalRouteMessage}</p>}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div className="bg-background border border-border rounded-xl p-2 overflow-auto" tabIndex={0} aria-label="Floor plan editor">
          <svg
            ref={svgRef}
            viewBox={`${pan.x * SCALE} ${pan.y * SCALE} ${width * SCALE / zoom} ${depth * SCALE / zoom}`}
            style={{ width: "100%", height: "auto", maxHeight: "70vh", touchAction: "none", cursor: tool === "room" ? "crosshair" : tool === "add-symbol" ? "crosshair" : "default" }}
            role="img"
            aria-label={`Floor plan for ${floor?.name ?? "floor"}`}
            onPointerDown={onBackgroundDown}
            onPointerDownCapture={e => {
              (e.currentTarget.parentElement as HTMLElement)?.focus({ preventScroll: true });
              if (e.pointerType !== "touch") return;
              touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (touches.current.size === 2) {
                if (beforeDrag.current) publish(beforeDrag.current);
                beforeDrag.current = null; dragRef.current = null; setPreview(null);
                e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation();
                const [a, b] = [...touches.current.values()]; pinch.current = Math.sqrt(dist2(a, b));
              }
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { touches.current.clear(); pinch.current = null; if (beforeDrag.current) publish(beforeDrag.current); beforeDrag.current = null; dragRef.current = null; setPreview(null); setGuides([]); }}
          >
            <rect x={0} y={0} width={width * SCALE} height={depth * SCALE} fill="var(--color-background)" />
            {gridLines}
            {plan?.rooms.map(room => {
              const isSelected = selection.includes(room.id) || room.id === selectedRoomId;
              return (
                <g key={room.id}>
                  <rect
                    data-room-id={room.id}
                    x={room.rect.x * SCALE}
                    y={room.rect.y * SCALE}
                    width={room.rect.w * SCALE}
                    height={room.rect.h * SCALE}
                    fill={isSelected ? "color-mix(in srgb, var(--color-primary) 18%, transparent)" : "color-mix(in srgb, var(--color-surface) 60%, transparent)"}
                    stroke={isSelected ? "var(--color-primary)" : "var(--color-border-strong)"}
                    strokeWidth={room.wallThickness ? room.wallThickness * SCALE : isSelected ? 2 : 1.5}
                    vectorEffect="non-scaling-stroke"
                    style={{ cursor: tool === "room" ? "crosshair" : "move" }}
                    onPointerDown={e => onRoomDown(e, room)}
                  />
                  <text x={room.rect.x * SCALE + 6} y={room.rect.y * SCALE + 15} fill="var(--color-text-primary)" fontSize={11} fontWeight={600} pointerEvents="none">{room.label}</text>
                  {room.openings?.map((opening, i) => {
                    const horizontal = opening.edge === "top" || opening.edge === "bottom";
                    const length = horizontal ? room.rect.w : room.rect.h;
                    const span = Math.min(opening.width, length);
                    const offset = opening.position * (length - span);
                    const x = room.rect.x + (horizontal ? offset : opening.edge === "right" ? room.rect.w : 0);
                    const y = room.rect.y + (!horizontal ? offset : opening.edge === "bottom" ? room.rect.h : 0);
                    return <g key={i} pointerEvents="none" transform={`translate(${x * SCALE} ${y * SCALE}) rotate(${horizontal ? 0 : 90})`}>
                      <line x2={span * SCALE} stroke="var(--color-background)" strokeWidth={Math.max(5, (room.wallThickness ?? 0.1) * SCALE + 2)} />
                      {opening.kind === "window" ? <line x2={span * SCALE} stroke="var(--color-primary)" strokeWidth={2} /> : <path d={`M 0 0 L 0 ${span * SCALE} A ${span * SCALE} ${span * SCALE} 0 0 0 ${span * SCALE} 0`} fill="none" stroke="var(--color-text-secondary)" strokeWidth={1} />}
                    </g>;
                  })}
                  <text x={room.rect.x * SCALE + 6} y={room.rect.y * SCALE + 28} fill="var(--color-text-muted)" fontSize={10} pointerEvents="none">{roomTypeLabels[room.type]} · {rectArea(room.rect).toFixed(1)} m²</text>
                  {dimensions && <g pointerEvents="none" fill="var(--color-text-secondary)" stroke="var(--color-text-muted)" strokeWidth={0.5}>
                    <line x1={room.rect.x * SCALE} x2={(room.rect.x + room.rect.w) * SCALE} y1={(room.rect.y + room.rect.h) * SCALE - 12} y2={(room.rect.y + room.rect.h) * SCALE - 12} />
                    <text stroke="none" textAnchor="middle" fontSize={10} x={(room.rect.x + room.rect.w / 2) * SCALE} y={(room.rect.y + room.rect.h) * SCALE - 16}>{room.rect.w.toFixed(2)} m</text>
                    <line x1={(room.rect.x + room.rect.w) * SCALE - 12} x2={(room.rect.x + room.rect.w) * SCALE - 12} y1={room.rect.y * SCALE} y2={(room.rect.y + room.rect.h) * SCALE} />
                    <text stroke="none" fontSize={10} transform={`translate(${(room.rect.x + room.rect.w) * SCALE - 16} ${(room.rect.y + room.rect.h / 2) * SCALE}) rotate(-90)`} textAnchor="middle">{room.rect.h.toFixed(2)} m</text>
                  </g>}
                  {isSelected && !room.fixedSize && (
                    <rect
                      data-editor-only="true"
                      x={(room.rect.x + room.rect.w) * SCALE - 6}
                      y={(room.rect.y + room.rect.h) * SCALE - 6}
                      width={12}
                      height={12}
                      fill="var(--color-primary)"
                      stroke="var(--color-background)"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: "nwse-resize" }}
                      onPointerDown={e => onResizeDown(e, room)}
                    />
                  )}
                </g>
              );
            })}
            {preview && (
              <rect x={preview.x * SCALE} y={preview.y * SCALE} width={preview.w * SCALE} height={preview.h * SCALE} fill="color-mix(in srgb, var(--color-primary) 12%, transparent)" stroke="var(--color-primary)" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            )}
            {guides.map((g, i) => g.kind === "alignment" ? <line key={i} x1={g.axis === "x" ? g.point.x * SCALE : 0} x2={g.axis === "x" ? g.point.x * SCALE : width * SCALE} y1={g.axis === "y" ? g.point.y * SCALE : 0} y2={g.axis === "y" ? g.point.y * SCALE : depth * SCALE} stroke="var(--color-success)" strokeDasharray="4 3" pointerEvents="none" /> : <circle key={i} cx={g.point.x * SCALE} cy={g.point.y * SCALE} r={4} fill="none" stroke="var(--color-success)" pointerEvents="none" />)}
            {showRoutes && plan?.routes.map(route => (
              <polyline
                key={route.id}
                points={route.polyline.map(p => `${p.x * SCALE},${p.y * SCALE}`).join(" ")}
                fill="none"
                stroke="var(--color-warning)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
                opacity={0.85}
              />
            ))}
            {plan?.cadWires.map(wire => <g key={wire.id}><polyline points={wire.polyline.map(point => `${point.x * SCALE},${point.y * SCALE}`).join(" ")} fill="none" stroke={wire.id === selectedWireId ? "var(--color-warning)" : "var(--color-primary)"} strokeWidth={wire.id === selectedWireId ? 3 : 1.8} vectorEffect="non-scaling-stroke" pointerEvents="stroke" onPointerDown={e => onWireDown(e, wire.id)}><title>{wire.label || `${wire.state} wire`}</title></polyline>{wire.id === selectedWireId && wire.polyline.map((point, index) => <circle key={index} cx={point.x * SCALE} cy={point.y * SCALE} r={4} fill="var(--color-background)" stroke="var(--color-warning)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" onPointerDown={e => onWireVertexDown(e, wire.id, index)} />)}</g>)}
            {plan?.cadJunctions.map(junction => <circle key={junction.id} cx={junction.x * SCALE} cy={junction.y * SCALE} r={selectedJunctionId === junction.id ? 5 : 3.5} fill={selectedJunctionId === junction.id ? "var(--color-warning)" : "var(--color-primary)"} onPointerDown={e => { if (tool !== "select") return; e.stopPropagation(); setSelectedJunctionId(junction.id); setSelectedWireId(null); }}><title>{`Junction ${junction.id}: ${junction.wireIds.length} wires`}</title></circle>)}
            {wireVertices.length > 1 && <polyline points={wireVertices.map(point => `${point.x * SCALE},${point.y * SCALE}`).join(" ")} fill="none" stroke="var(--color-primary)" strokeDasharray="4 3" strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            {plan?.routingZones.map(zone => <polyline key={zone.id} points={zone.polyline.map(point => `${point.x * SCALE},${point.y * SCALE}`).join(" ")} fill="none" stroke={zone.containment === "ceiling_void" ? "#3b82f6" : zone.containment === "concealed_wall" ? "#16a34a" : "#a855f7"} strokeWidth={4} opacity={0.55} vectorEffect="non-scaling-stroke" onPointerDown={e => { e.stopPropagation(); setSelectedZoneId(zone.id); }}><title>{`${zone.label} · ${zone.containment} · z ${zone.polyline[0]?.z.toFixed(2)} m`}</title></polyline>)}
            {showPhysicalRoutes && plan?.physicalRoutes.flatMap(route => route.segments.map((segment, index) => <line key={`${route.id}-${index}`} x1={segment.start.x * SCALE} y1={segment.start.y * SCALE} x2={segment.end.x * SCALE} y2={segment.end.y * SCALE} stroke="#f97316" strokeWidth={3} vectorEffect="non-scaling-stroke"><title>{`${segment.containment} · ${segment.lengthM.toFixed(2)} m · z ${segment.start.z.toFixed(2)} m`}</title></line>))}
            {showPoints && plan?.points.map(point => (
              <PointSymbol key={point.id} point={point} selected={point.id === selectedPointId} onPointerDown={e => onPointDown(e, point)} />
            ))}
          </svg>
        </div>

        <div className="space-y-3">
          <div className="bg-surface border border-border rounded-xl p-3">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Points on this floor</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span>Total</span><strong className="tabular-nums text-right">{summary.total}</strong>
              <span>Lighting</span><strong className="tabular-nums text-right">{summary.lighting}</strong>
              <span>Sockets</span><strong className="tabular-nums text-right">{summary.socket}</strong>
              <span>Switches</span><strong className="tabular-nums text-right">{summary.switch}</strong>
              <span>Dedicated</span><strong className="tabular-nums text-right">{summary.dedicated}</strong>
              <span>On circuits</span><strong className={`tabular-nums text-right ${coverage.uncovered > 0 ? "text-warning" : ""}`}>{coverage.covered}/{coverage.total}</strong>
              {plan && plan.routes.length > 0 && (<><span>Route length</span><strong className="tabular-nums text-right">{plan.routes.reduce((n, r) => n + routeLength(r), 0).toFixed(1)} m</strong></>)}
              <span>Rooms placed</span><strong className="tabular-nums text-right">{plan?.rooms.length ?? 0}</strong>
              <span>Rooms unplaced</span><strong className="tabular-nums text-right">{unplaced.length}</strong>
            </div>
          </div>

          {selectedRoom && plan && (
            <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
              <p className="text-xs text-text-muted uppercase tracking-wider">Selected room</p>
              <Input aria-label="Room label" value={selectedRoom.label} maxLength={120} onChange={e => onChange(upsertPlanRoom(building, activeFloorId, { ...selectedRoom, label: e.target.value }))} className="h-9" />
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "w", "h"] as const).map(key => <label key={key} className="text-xs">Room {key} (m)<Input aria-label={`Room ${key}`} disabled={selectedRoom.fixedSize && (key === "w" || key === "h")} type="number" step={0.1} min={key === "w" || key === "h" ? 0.5 : 0} value={selectedRoom.rect[key]} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(upsertPlanRoom(building, activeFloorId, { ...selectedRoom, rect: clampRect({ ...selectedRoom.rect, [key]: n }, width, depth) })); }} /></label>)}
              </div>
              <label className="text-sm flex gap-2"><input type="checkbox" checked={selectedRoom.fixedSize ?? false} onChange={e => onChange(upsertPlanRoom(building, activeFloorId, { ...selectedRoom, fixedSize: e.target.checked }))} />Lock room dimensions</label>
              <label className="text-xs block">Wall thickness (m)<Input aria-label="Wall thickness" type="number" min={0} max={0.5} step={0.01} value={selectedRoom.wallThickness ?? 0} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(upsertPlanRoom(building, activeFloorId, { ...selectedRoom, wallThickness: Math.max(0, Math.min(0.5, n)) })); }} /></label>
              <div className="flex gap-1">{(["door", "window"] as const).map(kind => <Button key={kind} size="sm" variant="outline" disabled={(selectedRoom.openings?.length ?? 0) >= 30} onClick={() => onChange(upsertPlanRoom(building, activeFloorId, { ...selectedRoom, openings: [...selectedRoom.openings ?? [], { kind, edge: "top", position: 0.5, width: kind === "door" ? 0.9 : 1.2 }] }))}>Add {kind}</Button>)}</div>
              {selectedRoom.openings?.map((opening, i) => <div key={i} className="grid grid-cols-2 gap-1 text-xs">
                <label>{opening.kind} edge<select aria-label={`Opening ${i + 1} edge`} className="bg-surface w-full" value={opening.edge} onChange={e => onChange(upsertPlanRoom(building, activeFloorId, { ...selectedRoom, openings: selectedRoom.openings?.map((o, n) => n === i ? { ...o, edge: e.target.value as typeof o.edge } : o) }))}>{["top", "bottom", "left", "right"].map(edge => <option key={edge}>{edge}</option>)}</select></label>
                <label>Width (m)<Input aria-label={`Opening ${i + 1} width`} type="number" min={0.2} max={5} step={0.1} value={opening.width} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(upsertPlanRoom(building, activeFloorId, { ...selectedRoom, openings: selectedRoom.openings?.map((o, j) => j === i ? { ...o, width: Math.max(0.2, Math.min(5, n)) } : o) })); }} /></label>
                <label>Position<input aria-label={`Opening ${i + 1} position`} type="range" min={0} max={1} step={0.01} value={opening.position} onChange={e => onChange(upsertPlanRoom(building, activeFloorId, { ...selectedRoom, openings: selectedRoom.openings?.map((o, j) => j === i ? { ...o, position: e.target.valueAsNumber } : o) }))} /></label>
                <Button size="sm" variant="ghost" onClick={() => onChange(upsertPlanRoom(building, activeFloorId, { ...selectedRoom, openings: selectedRoom.openings?.filter((_, j) => j !== i) }))}>Remove opening {i + 1}</Button>
              </div>)}
              {selection.length > 1 && <div className="flex flex-wrap gap-1">{(["left", "top", "width", "height"] as const).map(mode => <Button key={mode} size="sm" variant="outline" onClick={() => constrain(mode)}>{mode === "left" || mode === "top" ? "Align" : "Equal"} {mode}</Button>)}</div>}
              <label className="text-sm block">Type
                <select className="mt-1 w-full border border-border bg-surface rounded-lg p-2 text-sm" value={selectedRoom.type} onChange={e => onChange(upsertPlanRoom(building, activeFloorId, { ...selectedRoom, type: e.target.value as RoomType }))}>
                  {ROOM_TYPES.map(t => <option key={t} value={t}>{roomTypeLabels[t]}</option>)}
                </select>
              </label>
              <p className="text-xs text-text-muted">{rectArea(selectedRoom.rect).toFixed(1)} m² · {planRoomCounts(plan).find(r => r.room.id === selectedRoom.id)?.points ?? 0} point(s) · {selectedRoom.roomId ? "linked to hierarchy" : "not linked"}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onChange(generatePointsForPlanRoom(building, activeFloorId, selectedRoom.id))}>Generate points</Button>
                <Button size="sm" variant="ghost" onClick={() => { onChange(removePlanRoom(building, activeFloorId, selectedRoom.id)); setSelectedRoomId(null); }}>Delete room</Button>
              </div>
            </div>
          )}
          {selectedZone && plan && <div className="bg-surface border border-border rounded-xl p-3 space-y-2"><p className="text-xs text-text-muted uppercase tracking-wider">Routing zone</p><Input aria-label="Routing zone label" value={selectedZone.label} onChange={e => onChange(upsertRoutingZone(building, activeFloorId, { ...selectedZone, label: e.target.value }))} className="h-9" /><label className="text-xs block">Containment<select className="mt-1 w-full rounded border border-border bg-background p-2" value={selectedZone.containment} onChange={e => onChange(upsertRoutingZone(building, activeFloorId, { ...selectedZone, containment: e.target.value as RoutingZone["containment"] }))}>{["ceiling_void", "concealed_wall", "surface_conduit", "surface_trunking", "cable_tray", "vertical_riser", "underfloor", "other"].map(value => <option key={value}>{value}</option>)}</select></label><div className="grid grid-cols-2 gap-2">{(["x", "y", "z"] as const).map(axis => <label key={axis} className="text-xs">Start {axis} (m)<Input type="number" step={0.1} value={selectedZone.polyline[0][axis]} onChange={e => { const value = e.target.valueAsNumber; if (!Number.isFinite(value)) return; const polyline = [...selectedZone.polyline]; polyline[0] = { ...polyline[0], [axis]: value }; onChange(upsertRoutingZone(building, activeFloorId, { ...selectedZone, polyline })); }} /></label>)}</div><p className="text-xs text-text-muted">Each zone is a proposed containment centerline. Set dimensions, material, fire performance, crossings, and review status before treating shared occupancy as usable.</p><Button size="sm" variant="outline" onClick={() => { onChange(removeRoutingZone(building, activeFloorId, selectedZone.id)); setSelectedZoneId(null); }}>Remove zone</Button></div>}
          {selectedWire && plan && <div className="bg-surface border border-border rounded-xl p-3 space-y-2"><p className="text-xs text-text-muted uppercase tracking-wider">Wire properties</p><p className="font-mono text-xs">{selectedWire.id}</p><Input aria-label="Wire label" placeholder="Wire reference" value={selectedWire.label} onChange={e => onChange(setCadWires(building, activeFloorId, plan.cadWires.map(wire => wire.id === selectedWire.id ? { ...wire, label: e.target.value } : wire)))} /><Input aria-label="Wire notes" placeholder="Notes" value={selectedWire.notes} onChange={e => onChange(setCadWires(building, activeFloorId, plan.cadWires.map(wire => wire.id === selectedWire.id ? { ...wire, notes: e.target.value } : wire)))} /><p className="text-xs text-text-muted">Vertices: {selectedWire.polyline.length} · Drawing geometry length, not installed cable length.</p><p className="text-xs text-text-muted">Start: {selectedWire.startTerminal ? `${selectedWire.startTerminal.pointId}:${selectedWire.startTerminal.terminalId}` : "floating"} · End: {selectedWire.endTerminal ? `${selectedWire.endTerminal.pointId}:${selectedWire.endTerminal.terminalId}` : "floating"}</p><Button size="sm" variant="ghost" onClick={() => { onChange(setCadWires(building, activeFloorId, plan.cadWires.filter(wire => wire.id !== selectedWire.id))); setSelectedWireId(null); }}>Delete wire</Button></div>}
          {selectedJunction && plan && <div className="bg-surface border border-border rounded-xl p-3 space-y-2"><p className="text-xs text-text-muted uppercase tracking-wider">Junction</p><p className="font-mono text-xs">{selectedJunction.id} · {selectedJunction.wireIds.length} wires</p><Input aria-label="Junction note" placeholder="Junction note" value={selectedJunction.note} onChange={e => onChange(setCadJunctions(building, activeFloorId, plan.cadJunctions.map(junction => junction.id === selectedJunction.id ? { ...junction, note: e.target.value } : junction)))} /><Button size="sm" variant="ghost" onClick={() => { const wires = plan.cadWires.map(wire => ({ ...wire, junctionIds: wire.junctionIds.filter(id => id !== selectedJunction.id) })); const next = setCadWires(building, activeFloorId, wires); onChange(setCadJunctions(next, activeFloorId, plan.cadJunctions.filter(junction => junction.id !== selectedJunction.id))); setSelectedJunctionId(null); }}>Delete junction</Button></div>}

          {selectedPoint && (
            <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
              <p className="text-xs text-text-muted uppercase tracking-wider">Selected point</p>
              <p className="text-sm">{pointKindLabels[selectedPoint.kind]}</p>
               <p className="text-xs text-text-muted">Circuit: {selectedAssignment?.circuit ? <span className="font-mono">{selectedAssignment.circuit.code}</span> : pointRequiresCircuit(selectedPoint.kind) ? "not scheduled" : "control device"}</p>
               {selectedRegisteredSymbol && <p className="text-xs text-text-muted">Symbol: {selectedRegisteredSymbol.name} · {selectedRegisteredSymbol.verification} · {selectedRegisteredSymbol.sourceReference}</p>}
               <label className="text-xs block">Device reference<Input aria-label="Device reference" value={selectedPoint.deviceReference} onChange={e => onChange(updatePlanPoint(building, activeFloorId, { ...selectedPoint, deviceReference: e.target.value }))} /></label>
               <label className="text-xs block">Description<Input aria-label="Symbol description" value={selectedPoint.description} onChange={e => onChange(updatePlanPoint(building, activeFloorId, { ...selectedPoint, description: e.target.value }))} /></label>
               <div className="flex gap-2">
                <Input aria-label="Point x" type="number" step={0.1} value={selectedPoint.x} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(updatePlanPoint(building, activeFloorId, { ...selectedPoint, x: n })); }} className="h-9" />
                <Input aria-label="Point y" type="number" step={0.1} value={selectedPoint.y} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(updatePlanPoint(building, activeFloorId, { ...selectedPoint, y: n })); }} className="h-9" />
               </div>
               <label className="text-xs block">Elevation (m, required for physical routing)<Input aria-label="Point elevation" type="number" min={0} step={0.1} value={selectedPoint.elevationM ?? ""} onChange={e => { const n = e.target.valueAsNumber; onChange(updatePlanPoint(building, activeFloorId, { ...selectedPoint, elevationM: Number.isFinite(n) ? n : null })); }} /></label>
               <div className="grid grid-cols-2 gap-2"><label className="text-xs">Rotation (deg)<Input aria-label="Symbol rotation" type="number" min={0} max={359} value={selectedPoint.rotationDeg} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(updatePlanPoint(building, activeFloorId, { ...selectedPoint, rotationDeg: ((n % 360) + 360) % 360 })); }} /></label><label className="text-xs">Scale<Input aria-label="Symbol scale" type="number" min={0.1} max={10} step={0.1} value={selectedPoint.scale} onChange={e => { const n = e.target.valueAsNumber; if (Number.isFinite(n)) onChange(updatePlanPoint(building, activeFloorId, { ...selectedPoint, scale: Math.max(0.1, Math.min(10, n)) })); }} /></label></div>
               <p className="text-xs text-text-muted">Room: {selectedPoint.roomId ? plan?.rooms.find(room => room.id === selectedPoint.roomId)?.label ?? "linked room" : "unassigned"} · Floor: {floor?.name ?? "unknown"}</p>
               <div className="border-t border-border pt-2 space-y-2"><p className="text-xs text-text-muted uppercase tracking-wider">Catalog</p><Input aria-label="Manufacturer" placeholder="Manufacturer" value={selectedPoint.manufacturer} onChange={e => onChange(updatePlanPoint(building, activeFloorId, { ...selectedPoint, manufacturer: e.target.value }))} /><Input aria-label="Product reference" placeholder="Product reference" value={selectedPoint.productReference} onChange={e => onChange(updatePlanPoint(building, activeFloorId, { ...selectedPoint, productReference: e.target.value }))} /><Input aria-label="Datasheet link" placeholder="Datasheet URL" value={selectedPoint.datasheetUrl} onChange={e => onChange(updatePlanPoint(building, activeFloorId, { ...selectedPoint, datasheetUrl: e.target.value }))} /></div>
              <Button size="sm" variant="ghost" onClick={() => { onChange(removePlanPoint(building, activeFloorId, selectedPoint.id)); setSelectedPointId(null); }}>Delete point</Button>
            </div>
          )}

          <details className="bg-surface border border-border rounded-xl p-3">
            <summary className="cursor-pointer text-xs text-text-muted uppercase tracking-wider">Residential IEC 60617 candidate library</summary>
            <div className="mt-3">
              <SymbolPalette showAll symbolIds={RESIDENTIAL_SYMBOL_IDS} onSymbolSelected={symbol => { setSelectedSymbol(symbol.symbolId); setTool("add-symbol"); }} />
            </div>
            <p className="mt-2 text-xs text-text-muted">Select a symbol, then click the drawing to place it. These records require source review before they are represented as IEC-verified.</p>
          </details>

          {plan && (
            <div className="bg-surface border border-border rounded-xl p-3 space-y-2">
              <p className="text-xs text-text-muted uppercase tracking-wider">Add single point</p>
              <div className="flex flex-wrap gap-1">
                {POINT_KINDS.map(kind => (
                  <Button key={kind} size="sm" variant="outline" onClick={() => onChange(addPlanPoint(building, activeFloorId, kind, Math.round((width / 2) * 10) / 10, Math.round((depth / 2) * 10) / 10, null))}>+ {kind}</Button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface border border-border rounded-xl p-3">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Legend</p>
            <ul className="space-y-1 text-sm">
              {(["lighting", "socket", "switch", "dedicated"] as PointKind[]).map(kind => (
                <li key={kind} className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-full border" style={{ borderColor: pointColour[kind] }} />{pointKindLabels[kind]}</li>
              ))}
            </ul>
            {counts && <p className="text-xs text-text-muted mt-2">Shift-click rooms or drag a selection box to select multiple rooms. Drag rooms to move and the corner square to resize. Ctrl/Cmd+Z undoes; Shift+Ctrl/Cmd+Z redoes. Ctrl/Cmd+C and V copy/paste room geometry. Delete removes the selection. Use Pan to drag the view, Ctrl/Cmd+wheel or pinch to zoom. Alignment and equal-size commands apply once, using the selected room as reference. DXF exports room outlines, points and routes in metres.</p>}
          </div>
        </div>
      </div>

      <p className="text-xs text-text-muted bg-surface border border-border rounded-lg p-3">
        Point placement is a deterministic preliminary proposal based on room type and area (socket outlets every ~3.5 m of wall, minimum per
        room type, ceiling lights sized by area). Cable routes are auto-sketched as L-shaped Manhattan paths from the board anchor (a
        &ldquo;db&rdquo; point if placed, otherwise the floor origin) to each scheduled point; their lengths feed the preliminary voltage-drop
        estimate. Verify all points, routes and lengths against the architectural layout and applicable wiring regulations before use.
        Coordinates are metres relative to the floor origin; they are not georeferenced.
      </p>
    </div>
  );
}
