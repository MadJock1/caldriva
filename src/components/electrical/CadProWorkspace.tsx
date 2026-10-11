"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  addEntity,
  cadDocumentSchema,
  createCircleEntity,
  createDefaultCadDocument,
  createLineEntity,
  createRectangleEntity,
  createSymbolInstanceEntity,
  defaultCatalogProvider,
  findEntityAtPoint,
  ALL_IC60617_SYMBOLS,
  removeEntities,
  type CadDocument,
  type CadEntity,
  type CadPoint,
  type CadTool,
  type IECSymbolMetadata,
  type SymbolPrimitive,
} from "@/lib/electrical";

const STORAGE_KEY = "caldriva-electrical-cad-pro-v1";
const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 720;

const tools: { id: CadTool; label: string }[] = [
  { id: "select", label: "Select" },
  { id: "line", label: "Line" },
  { id: "rectangle", label: "Rectangle" },
  { id: "circle", label: "Circle" },
  { id: "symbol", label: "Symbol" },
  { id: "delete", label: "Delete" },
];

export function CadProWorkspace() {
  const [document, setDocument] = useState<CadDocument>(() => {
    if (typeof window === "undefined") return createDefaultCadDocument();
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createDefaultCadDocument();
    try {
      const parsed = cadDocumentSchema.safeParse(JSON.parse(saved));
      return parsed.success ? parsed.data : createDefaultCadDocument();
    } catch {
      return createDefaultCadDocument();
    }
  });
  const [tool, setTool] = useState<CadTool>("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [firstPoint, setFirstPoint] = useState<CadPoint | null>(null);
  const [cursor, setCursor] = useState<CadPoint>({ x: 0, y: 0, z: 0 });
  const [view, setView] = useState({ x: -5, y: -5, scale: 42 });
  const [selectedSymbolId, setSelectedSymbolId] = useState(ALL_IC60617_SYMBOLS[0]?.symbolId ?? "");
  const svgRef = useRef<SVGSVGElement | null>(null);

  const symbolsById = useMemo(() => new Map(ALL_IC60617_SYMBOLS.map((symbol) => [symbol.symbolId, symbol])), []);
  const selectedSymbol = symbolsById.get(selectedSymbolId) ?? ALL_IC60617_SYMBOLS[0] ?? null;
  const catalogStatus = useMemo(() => defaultCatalogProvider.getStatus(), []);

  const activeLayer = useMemo(
    () => document.layers.find((layer) => layer.id === document.activeLayer) ?? document.layers[0],
    [document.activeLayer, document.layers]
  );

  const visibleLayerIds = useMemo(
    () => new Set(document.layers.filter((layer) => layer.visible).map((layer) => layer.id)),
    [document.layers]
  );

  const visibleEntities = useMemo(
    () => document.entities.filter((entity) => entity.visible && visibleLayerIds.has(entity.layerId)),
    [document.entities, visibleLayerIds]
  );

  function worldToScreen(point: CadPoint) {
    return { x: (point.x - view.x) * view.scale, y: VIEWBOX_HEIGHT - (point.y - view.y) * view.scale };
  }

  function screenToWorld(screenX: number, screenY: number): CadPoint {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0, z: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((screenX - rect.left) / rect.width) * VIEWBOX_WIDTH;
    const y = ((screenY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
    return snapPoint({ x: x / view.scale + view.x, y: (VIEWBOX_HEIGHT - y) / view.scale + view.y, z: 0 });
  }

  function snapPoint(point: CadPoint): CadPoint {
    if (!document.snapSettings.snapEnabled || !document.snapSettings.snapModes.includes("grid")) return point;
    const spacing = document.snapSettings.gridSpacing;
    return { x: Math.round(point.x / spacing) * spacing, y: Math.round(point.y / spacing) * spacing, z: point.z };
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    setCursor(screenToWorld(event.clientX, event.clientY));
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const point = screenToWorld(event.clientX, event.clientY);

    if (tool === "delete") {
      if (selectedIds.length > 0) {
        setDocument((current) => removeEntities(current, selectedIds).document);
        setSelectedIds([]);
      }
      return;
    }

    if (tool === "select") {
      const tolerance = 8 / view.scale;
      const entity = findEntityAtPoint(visibleEntities, point, tolerance);
      setSelectedIds(entity ? [entity.id] : []);
      return;
    }

    if (tool === "symbol" && selectedSymbol) {
      const entity = createSymbolInstanceEntity("ELEC-SYMBOLS", selectedSymbol, point);
      setDocument((current) => addEntity(current, entity).document);
      setSelectedIds([entity.id]);
      return;
    }

    if (!firstPoint) {
      setFirstPoint(point);
      return;
    }

    const entity = createEntity(tool, firstPoint, point);
    if (!entity) return;
    setDocument((current) => addEntity(current, entity).document);
    setSelectedIds([entity.id]);
    setFirstPoint(tool === "line" ? point : null);
  }

  function createEntity(currentTool: CadTool, start: CadPoint, end: CadPoint): CadEntity | null {
    switch (currentTool) {
      case "line":
        return createLineEntity(document.activeLayer, start, end);
      case "rectangle":
        if (start.x === end.x || start.y === end.y) return null;
        return createRectangleEntity(document.activeLayer, start, end);
      case "circle":
        if (start.x === end.x && start.y === end.y) return null;
        return createCircleEntity(document.activeLayer, start, end);
      default:
        return null;
    }
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cadDocumentSchema.parse(document)));
  }

  function resetDocument() {
    setDocument(createDefaultCadDocument());
    setSelectedIds([]);
    setFirstPoint(null);
  }

  function setActiveTool(nextTool: CadTool) {
    if (nextTool === "delete" && selectedIds.length > 0) {
      setDocument((current) => removeEntities(current, selectedIds).document);
      setSelectedIds([]);
      setTool("select");
      return;
    }
    setTool(nextTool);
    setFirstPoint(null);
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    setView((current) => ({ ...current, scale: Math.min(180, Math.max(12, current.scale * factor)) }));
  }

  const preview = firstPoint ? createEntity(tool, firstPoint, cursor) : null;

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <div className="border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Caldriva Electrical CAD Pro</p>
            <h1 className="text-xl font-semibold">Model Space Foundation</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={saveLocal}>Save local CAD</Button>
            <Button variant="outline" onClick={resetDocument}>New drawing</Button>
          </div>
        </div>
      </div>

      <div className="grid h-[calc(100vh-74px)] grid-cols-[260px_1fr_280px] overflow-hidden">
        <aside className="border-r border-border bg-surface p-3">
          <h2 className="mb-3 text-sm font-semibold">Draw / Modify</h2>
          <div className="grid grid-cols-2 gap-2">
            {tools.map((item) => (
              <Button key={item.id} size="sm" variant={tool === item.id ? "default" : "outline"} onClick={() => setActiveTool(item.id)}>
                {item.label}
              </Button>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-border bg-background p-3 text-xs text-text-muted">
            <p>Active layer: <span className="text-text-primary">{activeLayer?.name}</span></p>
            <p>Entities: <span className="text-text-primary tabular-nums">{document.entities.length}</span></p>
            <p>Selected: <span className="text-text-primary tabular-nums">{selectedIds.length}</span></p>
          </div>
          <div className="mt-5 rounded-lg border border-warning bg-warning-muted p-3 text-xs">
            <h2 className="mb-1 text-sm font-semibold text-text-primary">Manufacturer Catalog</h2>
            <p className="text-text-muted">{catalogStatus.notice}</p>
            <p className="mt-2 text-text-muted">Verified records: <span className="text-text-primary tabular-nums">{catalogStatus.recordCount}</span></p>
            <p className="mt-2 text-text-muted">Sources to connect: Siemens CAx, Schneider Electric, EPLAN Data Portal, and authorized manual imports.</p>
          </div>
          <div className="mt-5">
            <h2 className="mb-2 text-sm font-semibold">Symbols</h2>
            <p className="mb-2 text-xs text-text-muted">All entries require standards/source review before IEC verification claims.</p>
            <div className="max-h-[42vh] space-y-2 overflow-auto pr-1">
              {ALL_IC60617_SYMBOLS.map((symbol) => (
                <button
                  key={symbol.symbolId}
                  className={`flex w-full items-center gap-2 rounded border px-2 py-2 text-left text-xs ${selectedSymbolId === symbol.symbolId ? "border-primary bg-primary-muted" : "border-border bg-background"}`}
                  onClick={() => { setSelectedSymbolId(symbol.symbolId); setActiveTool("symbol"); }}
                >
                  <SymbolPreview symbol={symbol} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-text-primary">{symbol.name}</span>
                    <span className="block truncate text-text-muted">{symbol.provenance}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="cad-canvas relative overflow-hidden bg-[#101722]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="h-full w-full touch-none"
            role="application"
            aria-label="Electrical CAD model space"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onWheel={handleWheel}
          >
            <CadGrid view={view} />
            {visibleEntities.map((entity) => <CadEntityView key={entity.id} entity={entity} selected={selectedIds.includes(entity.id)} symbolsById={symbolsById} worldToScreen={worldToScreen} />)}
            {preview && <CadEntityView entity={preview} selected={false} preview symbolsById={symbolsById} worldToScreen={worldToScreen} />}
            {firstPoint && <SnapMarker point={firstPoint} worldToScreen={worldToScreen} />}
            <SnapMarker point={cursor} worldToScreen={worldToScreen} />
          </svg>
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-border bg-surface/95 px-3 py-2 font-mono text-xs">
            <span>Command: {firstPoint ? `${tool.toUpperCase()} specify next point` : `${tool.toUpperCase()} ready`}</span>
            <span>X {cursor.x.toFixed(3)}  Y {cursor.y.toFixed(3)}  Zoom {view.scale.toFixed(0)} px/m</span>
          </div>
        </section>

        <aside className="border-l border-border bg-surface p-3">
          <h2 className="mb-3 text-sm font-semibold">Layers</h2>
          <div className="space-y-2 overflow-auto text-xs">
            {document.layers.map((layer) => (
              <button
                key={layer.id}
                className={`flex w-full items-center gap-2 rounded border px-2 py-1 text-left ${document.activeLayer === layer.id ? "border-primary bg-primary-muted" : "border-border bg-background"}`}
                onClick={() => setDocument((current) => ({ ...current, activeLayer: layer.id }))}
              >
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: layer.color }} />
                <span className="truncate">{layer.name}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

function CadGrid({ view }: { view: { x: number; y: number; scale: number } }) {
  const spacing = 1;
  const minX = Math.floor(view.x / spacing) * spacing;
  const maxX = view.x + VIEWBOX_WIDTH / view.scale;
  const minY = Math.floor(view.y / spacing) * spacing;
  const maxY = view.y + VIEWBOX_HEIGHT / view.scale;
  const lines = [];

  for (let x = minX; x <= maxX; x += spacing) {
    const sx = (x - view.x) * view.scale;
    lines.push(<line key={`x-${x}`} x1={sx} y1={0} x2={sx} y2={VIEWBOX_HEIGHT} className={Math.round(x) % 10 === 0 ? "major" : ""} />);
  }
  for (let y = minY; y <= maxY; y += spacing) {
    const sy = VIEWBOX_HEIGHT - (y - view.y) * view.scale;
    lines.push(<line key={`y-${y}`} x1={0} y1={sy} x2={VIEWBOX_WIDTH} y2={sy} className={Math.round(y) % 10 === 0 ? "major" : ""} />);
  }

  return <g className="cad-grid" stroke="#293344" strokeWidth={1}>{lines}</g>;
}

function CadEntityView({ entity, selected, preview = false, symbolsById, worldToScreen }: { entity: CadEntity; selected: boolean; preview?: boolean; symbolsById: Map<string, IECSymbolMetadata>; worldToScreen: (point: CadPoint) => { x: number; y: number } }) {
  const stroke = selected ? "#4F8CFF" : preview ? "#F59E0B" : "#F8FAFC";
  const width = selected ? 3 : 2;

  if (entity.type === "line") {
    const start = worldToScreen(entity.start);
    const end = worldToScreen(entity.end);
    return <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={stroke} strokeWidth={width} strokeDasharray={preview ? "8 5" : undefined} />;
  }

  if (entity.type === "rectangle") {
    const corner = worldToScreen({ x: entity.corner.x, y: entity.corner.y + entity.height, z: entity.corner.z });
    const opposite = worldToScreen({ x: entity.corner.x + entity.width, y: entity.corner.y, z: entity.corner.z });
    return <rect x={corner.x} y={corner.y} width={Math.abs(opposite.x - corner.x)} height={Math.abs(opposite.y - corner.y)} fill="none" stroke={stroke} strokeWidth={width} strokeDasharray={preview ? "8 5" : undefined} />;
  }

  if (entity.type === "circle") {
    const center = worldToScreen(entity.center);
    const edge = worldToScreen({ x: entity.center.x + entity.radius, y: entity.center.y, z: entity.center.z });
    return <circle cx={center.x} cy={center.y} r={Math.abs(edge.x - center.x)} fill="none" stroke={stroke} strokeWidth={width} strokeDasharray={preview ? "8 5" : undefined} />;
  }

  if (entity.type === "symbolInstance") {
    const symbol = symbolsById.get(entity.symbolId);
    if (!symbol) return null;
    return (
      <g>
        {symbol.geometry.primitives.map((primitive, index) => (
          <SymbolPrimitiveView key={index} primitive={primitive} entity={entity} stroke={stroke} width={width} worldToScreen={worldToScreen} />
        ))}
        {entity.connectionPoints.map((terminal) => {
          const point = worldToScreen(terminal.position);
          return <circle key={terminal.id} cx={point.x} cy={point.y} r={selected ? 4 : 2.5} fill={selected ? "#4F8CFF" : "#10B981"} />;
        })}
      </g>
    );
  }

  return null;
}

function SymbolPrimitiveView({ primitive, entity, stroke, width, worldToScreen }: { primitive: SymbolPrimitive; entity: Extract<CadEntity, { type: "symbolInstance" }>; stroke: string; width: number; worldToScreen: (point: CadPoint) => { x: number; y: number } }) {
  const transform = (x: number, y: number) => {
    const cos = Math.cos(entity.rotation);
    const sin = Math.sin(entity.rotation);
    return worldToScreen({
      x: entity.position.x + (x * cos - y * sin) * entity.scale,
      y: entity.position.y + (x * sin + y * cos) * entity.scale,
      z: entity.position.z,
    });
  };

  if (primitive.type === "line") {
    const start = transform(primitive.x1, primitive.y1);
    const end = transform(primitive.x2, primitive.y2);
    return <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={stroke} strokeWidth={width} />;
  }
  if (primitive.type === "circle") {
    const center = transform(primitive.cx, primitive.cy);
    const edge = transform(primitive.cx + primitive.r, primitive.cy);
    return <circle cx={center.x} cy={center.y} r={Math.abs(edge.x - center.x)} fill="none" stroke={stroke} strokeWidth={width} />;
  }
  if (primitive.type === "rect") {
    const corner = transform(primitive.x, primitive.y + primitive.height);
    const opposite = transform(primitive.x + primitive.width, primitive.y);
    return <rect x={Math.min(corner.x, opposite.x)} y={Math.min(corner.y, opposite.y)} width={Math.abs(opposite.x - corner.x)} height={Math.abs(opposite.y - corner.y)} fill="none" stroke={stroke} strokeWidth={width} />;
  }
  if (primitive.type === "polyline") {
    const points = primitive.points.map((point) => transform(point.x, point.y));
    return <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill={primitive.closed ? "#4F8CFF10" : "none"} stroke={stroke} strokeWidth={width} />;
  }
  const point = transform(primitive.x, primitive.y);
  return <text x={point.x} y={point.y} fill={stroke} fontSize={Math.max(8, primitive.height * entity.scale * 42)} textAnchor="middle" dominantBaseline="middle">{primitive.value}</text>;
}

function SymbolPreview({ symbol }: { symbol: IECSymbolMetadata }) {
  return (
    <svg viewBox="-0.7 -0.7 1.4 1.4" className="h-10 w-10 rounded bg-background" aria-hidden="true">
      {symbol.geometry.primitives.map((primitive, index) => <PreviewPrimitive key={index} primitive={primitive} />)}
    </svg>
  );
}

function PreviewPrimitive({ primitive }: { primitive: SymbolPrimitive }) {
  const stroke = "#F8FAFC";
  if (primitive.type === "line") return <line x1={primitive.x1} y1={-primitive.y1} x2={primitive.x2} y2={-primitive.y2} stroke={stroke} strokeWidth={0.04} />;
  if (primitive.type === "circle") return <circle cx={primitive.cx} cy={-primitive.cy} r={primitive.r} fill="none" stroke={stroke} strokeWidth={0.04} />;
  if (primitive.type === "rect") return <rect x={primitive.x} y={-(primitive.y + primitive.height)} width={primitive.width} height={primitive.height} fill="none" stroke={stroke} strokeWidth={0.04} />;
  if (primitive.type === "polyline") return <polyline points={primitive.points.map((point) => `${point.x},${-point.y}`).join(" ")} fill={primitive.closed ? "#4F8CFF20" : "none"} stroke={stroke} strokeWidth={0.04} />;
  return <text x={primitive.x} y={-primitive.y} fill={stroke} fontSize={primitive.height} textAnchor="middle" dominantBaseline="middle">{primitive.value}</text>;
}

function SnapMarker({ point, worldToScreen }: { point: CadPoint; worldToScreen: (point: CadPoint) => { x: number; y: number } }) {
  const screen = worldToScreen(point);
  return <rect className="snap-marker" x={screen.x - 4} y={screen.y - 4} width={8} height={8} fill="none" stroke="#4F8CFF" strokeWidth={1.5} />;
}
