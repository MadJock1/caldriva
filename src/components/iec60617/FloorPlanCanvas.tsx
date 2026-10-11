import React, { useRef, useState, useCallback, useEffect } from "react";
import type { ElectricalPoint, CableRoute } from "@/lib/electrical/model";

// ============================================================
// CANVAS CONFIGURATION
// ============================================================

const SCALE = 44; // px per meter (from plan-editor.tsx)
const GRID_SIZE = 50; // mm grid
const GRID_COLOR = "#e0e4e8";
const MAJOR_GRID_INTERVAL = 5; // every 5 grid lines = 250mm = major grid
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3;
const DEFAULT_ZOOM = 1;

// ============================================================
// TYPES & INTERFACES
// ============================================================

type CanvasTool = "select" | "pan" | "add-symbol" | "add-point" | "route" | "delete" | "duplicate";

interface SymbolPlacement {
  symbolId: string;
  x: number; // in model coordinates (meters)
  y: number; // in model coordinates (meters)
  rotation: number; // degrees
  scale: number;
}

interface CanvasState {
  tool: CanvasTool;
  zoom: number;
  offsetX: number; // pan offset in model coordinates
  offsetY: number;
  selectedSymbolId: string | null;
  symbols: SymbolPlacement[];
  points: ElectricalPoint[];
  routes: CableRoute[];
  gridVisible: boolean;
  snapToGrid: boolean;
  autoRoute: boolean;
  isPanning: boolean;
}

const initialCanvasState: CanvasState = {
  tool: "select",
  zoom: DEFAULT_ZOOM,
  offsetX: 0,
  offsetY: 0,
  selectedSymbolId: null,
  symbols: [],
  points: [],
  routes: [],
  gridVisible: true,
  snapToGrid: true,
  autoRoute: false,
  isPanning: false,
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function worldToScreen(x: number, y: number, state: CanvasState) {
  return {
    x: (x - state.offsetX) * SCALE * state.zoom,
    y: (y - state.offsetY) * SCALE * state.zoom,
  };
}

function screenToWorld(sx: number, sy: number, state: CanvasState): { x: number; y: number } {
  return {
    x: sx / (SCALE * state.zoom) + state.offsetX,
    y: sy / (SCALE * state.zoom) + state.offsetY,
  };
}

function snapToGridCoord(value: number, state: CanvasState): number {
  if (!state.snapToGrid) return value;
  return Math.round(value / (GRID_SIZE / SCALE)) * (GRID_SIZE / SCALE);
}

// ============================================================
// SVG COMPONENTS
// ============================================================

const symbolNames: Record<string, string> = {
  "CON-001": "Wire",
  "CON-003": "⏚",
  "CON-005": "L1",
  "CON-006": "L2",
  "CON-007": "L3",
  "SW-001": "S",
  "SW-002": "2W",
  "CB-001": "MCB",
  "CB-003": "RCD",
  "LT-001": "Lamp",
  "LT-002": "FL",
  "LT-003": "LED",
  "SOC-001": "Socket",
  "MT-001": "M3",
  "MT-002": "M1",
};

const pointIcons: Record<string, string> = {
  lighting: "💡",
  socket: "🔌",
  switch: "⏚",
  dedicated: "⚡",
  hvac: "❄️",
  data: "📡",
  db: "📦",
};

interface SymbolRendererProps {
  symbol: SymbolPlacement;
  state: CanvasState;
  isSelected: boolean;
  onClick: (id: string) => void;
}

function SymbolRenderer({ symbol, state, isSelected, onClick }: SymbolRendererProps) {
  const { x, y, rotation, scale } = symbol;
  const screen = worldToScreen(x, y, state);
  const transform = `translate(${screen.x}px, ${screen.y}px) rotate(${rotation}deg) scale(${scale})`;
  const label = symbolNames[symbol.symbolId] || symbol.symbolId;

  return (
    <g transform={transform} style={{ cursor: "pointer" }} onClick={() => onClick(symbol.symbolId)}>
      <rect width="40" height="40" fill="#fff" stroke={isSelected ? "#3b82f4" : "#555"} strokeWidth={isSelected ? 2 : 1} />
      <text x="20" y="22" textAnchor="middle" fill="#333" fontSize="10">{label}</text>
      {isSelected && (
        <rect x="-22" y="-22" width="44" height="44" fill="none" stroke="#3b82f4" strokeWidth="2" strokeDasharray="4,2" />
      )}
    </g>
  );
}

interface PointRendererProps {
  point: ElectricalPoint;
  state: CanvasState;
  isSelected: boolean;
  onClick: (id: string) => void;
}

function PointRenderer({ point, state, isSelected, onClick }: PointRendererProps) {
  const screen = worldToScreen(point.x, point.y, state);
  const icon = pointIcons[point.kind] || "•";

  return (
    <g transform={`translate(${screen.x}px, ${screen.y}px)`} style={{ cursor: "pointer" }} onClick={() => onClick(point.id)}>
      <circle r="8" fill="#3b82f6" stroke={isSelected ? "#fff" : "white"} strokeWidth={isSelected ? 3 : 2} />
      <text x="0" y="5" textAnchor="middle" fill="white" fontSize="12">{icon}</text>
      {isSelected && (
        <circle r="12" fill="none" stroke="#3b82f4" strokeWidth={2} strokeDasharray="4,2" />
      )}
    </g>
  );
}

interface RouteRendererProps {
  route: CableRoute;
  state: CanvasState;
}

function RouteRenderer({ route, state }: RouteRendererProps) {
  const points = route.polyline.map((point: { x: number; y: number }) => worldToScreen(point.x, point.y, state));
  if (points.length < 2) return null;

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += `L${points[i].x},${points[i].y}`;
  }

  return <path d={d} stroke="#ef4444" strokeWidth="1.5" fill="none" opacity={0.85} />;
}

interface GridRendererProps {
  state: CanvasState;
  canvasWidth: number;
  canvasHeight: number;
}

function GridRenderer({ state, canvasWidth, canvasHeight }: GridRendererProps) {
  const lines: React.ReactElement[] = [];
  const cols = Math.ceil(canvasWidth / (GRID_SIZE * state.zoom)) + 2;
  const rows = Math.ceil(canvasHeight / (GRID_SIZE * state.zoom)) + 2;

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * GRID_SIZE / SCALE - state.offsetX;
      const y = j * GRID_SIZE / SCALE - state.offsetY;
      const isMajor = i % MAJOR_GRID_INTERVAL === 0 || j % MAJOR_GRID_INTERVAL === 0;
      const color = isMajor ? "#a0a0a0" : GRID_COLOR;
      const width = isMajor ? 1 : 0.5;
      const screenX = x * SCALE * state.zoom;
      const screenY = y * SCALE * state.zoom;

      lines.push(
        <line key={`v-${i}-${j}`} x1={screenX} y1={0} x2={screenX} y2={canvasHeight} stroke={color} strokeWidth={width} />
      );
      lines.push(
        <line key={`h-${i}-${j}`} x1={0} y1={screenY} x2={canvasWidth} y2={screenY} stroke={color} strokeWidth={width} />
      );
    }
  }

  return <g>{lines}</g>;
}

// ============================================================
// FLOORPLANCANVAS COMPONENT
// ============================================================

export const FloorPlanCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [state, setState] = useState<CanvasState>(initialCanvasState);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // ============================================================
  // ZOOM & PAN HANDLERS
  // ============================================================

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom + delta));

    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldBefore = screenToWorld(mouseX, mouseY, state);
      
      setState((prev) => ({ ...prev, zoom: newZoom }));

      const worldAfterNew = screenToWorld(mouseX, mouseY, { ...state, zoom: newZoom });
      setState((prev) => ({
        ...prev,
        offsetX: prev.offsetX - (worldAfterNew.x - worldBefore.x),
        offsetY: prev.offsetY - (worldAfterNew.y - worldBefore.y),
      }));
    }
  }, [state.zoom, state.offsetX, state.offsetY]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const newZoom = state.zoom === DEFAULT_ZOOM ? ZOOM_MAX : DEFAULT_ZOOM;
    setState((prev) => ({ ...prev, zoom: newZoom }));
  }, [state.zoom]);

  // ============================================================
  // SYMBOL PLACEMENT
  // ============================================================

  const handleSymbolClick = useCallback((symbolId: string) => {
    if (state.tool === "add-symbol") {
      // Place symbol at center of view
      const centerX = canvasSize.width / 2;
      const centerY = canvasSize.height / 2;
      const world = screenToWorld(centerX, centerY, state);
      const newSymbol: SymbolPlacement = {
        symbolId,
        x: snapToGridCoord(world.x, state),
        y: snapToGridCoord(world.y, state),
        rotation: 0,
        scale: 1,
      };
      setState((prev) => ({ ...prev, symbols: [...prev.symbols, newSymbol], tool: "select" }));
    } else {
      setState((prev) => ({
        ...prev,
        selectedSymbolId: prev.selectedSymbolId === symbolId ? null : symbolId,
      }));
    }
  }, [state.tool, state, canvasSize]);

  const handlePointClick = useCallback((pointId: string) => {
    setState((prev) => ({
      ...prev,
      selectedSymbolId: prev.selectedSymbolId === pointId ? null : pointId,
    }));
  }, []);

  // ============================================================
  // TOOL CHANGES
  // ============================================================

  const setTool = useCallback((tool: CanvasTool) => {
    setState((prev) => ({ ...prev, tool }));
  }, []);

  const toggleGrid = useCallback(() => {
    setState((prev) => ({ ...prev, gridVisible: !prev.gridVisible }));
  }, []);

  const toggleSnap = useCallback(() => {
    setState((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }));
  }, []);

  const toggleAutoRoute = useCallback(() => {
    setState((prev) => ({ ...prev, autoRoute: !prev.autoRoute }));
  }, []);

  const deleteSelected = useCallback(() => {
    if (!state.selectedSymbolId) return;
    setState((prev) => ({
      ...prev,
      symbols: prev.symbols.filter((s) => s.symbolId !== state.selectedSymbolId),
      points: prev.points.filter((p) => p.id !== state.selectedSymbolId),
      selectedSymbolId: null,
    }));
  }, [state.selectedSymbolId]);

  const duplicateSelected = useCallback(() => {
    if (!state.selectedSymbolId) return;
    const original = state.symbols.find((s) => s.symbolId === state.selectedSymbolId);
    if (!original) return;

    const newSymbol: SymbolPlacement = {
      ...original,
      x: original.x + 20 / (SCALE * state.zoom),
      y: original.y + 20 / (SCALE * state.zoom),
    };

    setState((prev) => ({
      ...prev,
      symbols: [...prev.symbols, newSymbol],
    }));
  }, [state.selectedSymbolId, state.symbols, state.zoom]);

  // ============================================================
  // PAN HANDLING
  // ============================================================

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (state.tool === "pan") {
      e.preventDefault();
      setState({ ...state, isPanning: true });
    }
  }, [state.tool, state]);

  const handleMouseUp = useCallback(() => {
    setState((prev) => ({ ...prev, isPanning: false }));
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (state.isPanning && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setState((prev) => ({
        ...prev,
        offsetX: prev.offsetX - e.movementX / (SCALE * prev.zoom),
        offsetY: prev.offsetY - e.movementY / (SCALE * prev.zoom),
      }));
    }
  }, [state.isPanning, state.zoom]);

  // ============================================================
  // RENDER
  // ============================================================

  const viewBox = {
    x: state.offsetX * SCALE * state.zoom,
    y: state.offsetY * SCALE * state.zoom,
    width: canvasSize.width,
    height: canvasSize.height,
  };

  return (
    <div
      className="floor-plan-canvas"
      ref={canvasRef}
      style={{
        position: "relative",
        width: "100%",
        height: "80vh",
        border: "1px solid #ddd",
        background: "#fff",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
        userSelect: "none",
        cursor: state.tool === "pan" ? "grab" : state.tool === "select" ? "crosshair" : state.tool === "add-symbol" ? "crosshair" : "default",
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ width: "100%", height: "100%", transformOrigin: "0 0" }}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      >
        {/* Grid background */}
        {state.gridVisible && <GridRenderer state={state} canvasWidth={canvasSize.width} canvasHeight={canvasSize.height} />}

        {/* Routes */}
        {state.routes.map((route) => (
          <RouteRenderer key={route.id} route={route} state={state} />
        ))}

        {/* Points */}
        {state.points.map((point) => (
          <PointRenderer
            key={point.id}
            point={point}
            state={state}
            isSelected={state.selectedSymbolId === point.id}
            onClick={handlePointClick}
          />
        ))}

        {/* Symbols */}
        {state.symbols.map((symbol) => (
          <SymbolRenderer
            key={symbol.symbolId}
            symbol={symbol}
            state={state}
            isSelected={state.selectedSymbolId === symbol.symbolId}
            onClick={handleSymbolClick}
          />
        ))}
      </svg>

      {/* Tool-specific overlay */}
      {state.tool === "add-symbol" && (
        <div style={{
          position: "absolute",
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          padding: "8px 16px",
          background: "rgba(59, 130, 244, 0.9)",
          color: "white",
          fontSize: "12px",
          borderRadius: 4,
          minWidth: "120px",
          textAlign: "center",
          zIndex: 100,
        }}>
          <strong>Click to place symbol</strong>
        </div>
      )}

      {state.tool === "pan" && state.isPanning && (
        <div style={{
          position: "absolute",
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          pointerEvents: "none",
          padding: "8px 16px",
          background: "rgba(0, 0, 0, 0.7)",
          color: "white",
          fontSize: "12px",
          borderRadius: 4,
          zIndex: 100,
        }}>
          Panning...
        </div>
      )}
    </div>
  );
};