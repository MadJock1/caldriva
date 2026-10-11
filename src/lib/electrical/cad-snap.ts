import type { CadEntity, CadPoint, SnapType, CadDocument } from "./cad-model";

const SNAP_TOLERANCE = 1e-6;
const SCREEN_SNAP_TOLERANCE = 10; // pixels

export interface SnapResult {
  point: CadPoint;
  snapType: SnapType;
  entityId?: string;
  entityType?: string;
  screenPoint?: { x: number; y: number };
  priority: number;
}

export interface SnapContext {
  document: CadDocument;
  screenToWorld: (x: number, y: number) => CadPoint;
  worldToScreen: (point: CadPoint) => { x: number; y: number };
  viewport: { x: number; y: number; width: number; height: number };
}

function getEntitySnapPoints(entity: CadEntity): Array<{ point: CadPoint; type: SnapType; priority: number }> {
  const points: Array<{ point: CadPoint; type: SnapType; priority: number }> = [];
  
  switch (entity.type) {
    case "line":
      points.push(
        { point: entity.start, type: "endpoint", priority: 1 },
        { point: entity.end, type: "endpoint", priority: 1 },
        { point: { x: (entity.start.x + entity.end.x) / 2, y: (entity.start.y + entity.end.y) / 2, z: (entity.start.z + entity.end.z) / 2 }, type: "midpoint", priority: 2 }
      );
      break;
      
    case "polyline":
      entity.vertices.forEach((v, i) => {
        points.push({ point: v, type: "endpoint", priority: 1 });
        if (i > 0) {
          const mid = {
            x: (entity.vertices[i-1].x + v.x) / 2,
            y: (entity.vertices[i-1].y + v.y) / 2,
            z: (entity.vertices[i-1].z + v.z) / 2,
          };
          points.push({ point: mid, type: "midpoint", priority: 2 });
        }
      });
      if (entity.closed && entity.vertices.length > 1) {
        const mid = {
          x: (entity.vertices[entity.vertices.length - 1].x + entity.vertices[0].x) / 2,
          y: (entity.vertices[entity.vertices.length - 1].y + entity.vertices[0].y) / 2,
          z: (entity.vertices[entity.vertices.length - 1].z + entity.vertices[0].z) / 2,
        };
        points.push({ point: mid, type: "midpoint", priority: 2 });
      }
      break;
      
    case "circle":
      points.push({ point: entity.center, type: "center", priority: 1 });
      points.push({ point: { x: entity.center.x + entity.radius, y: entity.center.y, z: entity.center.z }, type: "quadrant", priority: 3 });
      points.push({ point: { x: entity.center.x - entity.radius, y: entity.center.y, z: entity.center.z }, type: "quadrant", priority: 3 });
      points.push({ point: { x: entity.center.x, y: entity.center.y + entity.radius, z: entity.center.z }, type: "quadrant", priority: 3 });
      points.push({ point: { x: entity.center.x, y: entity.center.y - entity.radius, z: entity.center.z }, type: "quadrant", priority: 3 });
      break;
      
    case "arc":
      points.push({ point: entity.center, type: "center", priority: 1 });
      points.push({ 
        point: { x: entity.center.x + entity.radius * Math.cos(entity.startAngle), y: entity.center.y + entity.radius * Math.sin(entity.startAngle), z: entity.center.z }, 
        type: "endpoint", priority: 1 
      });
      points.push({ 
        point: { x: entity.center.x + entity.radius * Math.cos(entity.endAngle), y: entity.center.y + entity.radius * Math.sin(entity.endAngle), z: entity.center.z }, 
        type: "endpoint", priority: 1 
      });
      const midAngle = (entity.startAngle + entity.endAngle) / 2;
      points.push({ 
        point: { x: entity.center.x + entity.radius * Math.cos(midAngle), y: entity.center.y + entity.radius * Math.sin(midAngle), z: entity.center.z }, 
        type: "midpoint", priority: 2 
      });
      break;
      
    case "rectangle":
      const { corner, width, height, rotation = 0 } = entity;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const corners = [
        { x: corner.x, y: corner.y, z: corner.z },
        { x: corner.x + width * cos, y: corner.y + width * sin, z: corner.z },
        { x: corner.x + width * cos - height * sin, y: corner.y + width * sin + height * cos, z: corner.z },
        { x: corner.x - height * sin, y: corner.y + height * cos, z: corner.z },
      ];
      corners.forEach(c => points.push({ point: c, type: "endpoint", priority: 1 }));
      const center = {
        x: corner.x + (width * cos - height * sin) / 2,
        y: corner.y + (width * sin + height * cos) / 2,
        z: corner.z,
      };
      points.push({ point: center, type: "center", priority: 2 });
      break;
      
    case "text":
      points.push({ point: entity.position, type: "endpoint", priority: 1 });
      break;
      
    case "dimension":
      entity.definitionPoints.forEach(p => points.push({ point: p, type: "endpoint", priority: 1 }));
      break;
      
    case "blockReference":
    case "symbolInstance":
      points.push({ point: entity.position, type: "endpoint", priority: 1 });
      if (entity.type === "symbolInstance" && entity.connectionPoints) {
        entity.connectionPoints.forEach(cp => {
          if (cp.position) points.push({ point: cp.position, type: "endpoint", priority: 2 });
        });
      }
      break;
  }
  
  return points;
}

function findIntersections(entities: CadEntity[]): Array<{ point: CadPoint; entityIds: string[] }> {
  const intersections: Array<{ point: CadPoint; entityIds: string[] }> = [];
  
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const pts = getIntersectionPoints(entities[i], entities[j]);
      pts.forEach(pt => {
        intersections.push({ point: pt, entityIds: [entities[i].id, entities[j].id] });
      });
    }
  }
  
  return intersections;
}

function getIntersectionPoints(a: CadEntity, b: CadEntity): CadPoint[] {
  const points: CadPoint[] = [];
  
  if (a.type === "line" && b.type === "line") {
    const pt = lineLineIntersection(a.start, a.end, b.start, b.end);
    if (pt) points.push(pt);
  } else if (a.type === "line" && (b.type === "circle" || b.type === "arc")) {
    points.push(...lineCircleIntersection(a.start, a.end, b.center, b.radius));
  } else if ((a.type === "circle" || a.type === "arc") && b.type === "line") {
    points.push(...lineCircleIntersection(b.start, b.end, a.center, a.radius));
  } else if (a.type === "circle" && b.type === "circle") {
    points.push(...circleCircleIntersection(a.center, a.radius, b.center, b.radius));
  } else if (a.type === "polyline" && b.type === "polyline") {
    for (let i = 0; i < a.vertices.length - 1; i++) {
      for (let j = 0; j < b.vertices.length - 1; j++) {
        const pt = lineLineIntersection(a.vertices[i], a.vertices[i+1], b.vertices[j], b.vertices[j+1]);
        if (pt) points.push(pt);
      }
    }
  }
  
  return points;
}

function lineLineIntersection(p1: CadPoint, p2: CadPoint, p3: CadPoint, p4: CadPoint): CadPoint | null {
  const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denom) < SNAP_TOLERANCE) return null;
  
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
  const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denom;
  
  if (t >= -SNAP_TOLERANCE && t <= 1 + SNAP_TOLERANCE && u >= -SNAP_TOLERANCE && u <= 1 + SNAP_TOLERANCE) {
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
      z: p1.z + t * (p2.z - p1.z),
    };
  }
  return null;
}

function lineCircleIntersection(p1: CadPoint, p2: CadPoint, center: CadPoint, radius: number): CadPoint[] {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const fx = p1.x - center.x;
  const fy = p1.y - center.y;
  
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -SNAP_TOLERANCE) return [];
  
  const points: CadPoint[] = [];
  if (discriminant < SNAP_TOLERANCE) {
    const t = -b / (2 * a);
    if (t >= -SNAP_TOLERANCE && t <= 1 + SNAP_TOLERANCE) {
      points.push({ x: p1.x + t * dx, y: p1.y + t * dy, z: center.z });
    }
  } else {
    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b + sqrtDisc) / (2 * a);
    const t2 = (-b - sqrtDisc) / (2 * a);
    if (t1 >= -SNAP_TOLERANCE && t1 <= 1 + SNAP_TOLERANCE) {
      points.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy, z: center.z });
    }
    if (t2 >= -SNAP_TOLERANCE && t2 <= 1 + SNAP_TOLERANCE) {
      points.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy, z: center.z });
    }
  }
  return points;
}

function circleCircleIntersection(c1: CadPoint, r1: number, c2: CadPoint, r2: number): CadPoint[] {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  
  if (d > r1 + r2 + SNAP_TOLERANCE) return [];
  if (d < Math.abs(r1 - r2) - SNAP_TOLERANCE) return [];
  if (d < SNAP_TOLERANCE && Math.abs(r1 - r2) < SNAP_TOLERANCE) return [];
  
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < -SNAP_TOLERANCE) return [];
  
  const h = h2 <= 0 ? 0 : Math.sqrt(h2);
  const xm = c1.x + a * dx / d;
  const ym = c1.y + a * dy / d;
  
  const points: CadPoint[] = [
    { x: xm + h * dy / d, y: ym - h * dx / d, z: c1.z },
  ];
  
  if (h > SNAP_TOLERANCE) {
    points.push({ x: xm - h * dy / d, y: ym + h * dx / d, z: c1.z });
  }
  
  return points;
}

export function findSnapPoints(
  screenX: number,
  screenY: number,
  context: SnapContext,
  enabledSnapTypes: SnapType[]
): SnapResult[] {
  const worldPoint = context.screenToWorld(screenX, screenY);
  const results: SnapResult[] = [];
  const visibleEntities = context.document.entities.filter(e => e.visible && e.selectable);
  const visibleLayers = new Set(context.document.layers.filter(l => l.visible).map(l => l.id));
  const entitiesOnVisibleLayers = visibleEntities.filter(e => visibleLayers.has(e.layerId));
  
  const entitySnapPoints = new Map<string, Array<{ point: CadPoint; type: SnapType; priority: number }>>();
  
  for (const entity of entitiesOnVisibleLayers) {
    entitySnapPoints.set(entity.id, getEntitySnapPoints(entity));
  }
  
  // Check each entity's snap points
  for (const [entityId, snapPoints] of entitySnapPoints) {
    for (const sp of snapPoints) {
      if (!enabledSnapTypes.includes(sp.type)) continue;
      
      const screenPt = context.worldToScreen(sp.point);
      const dx = screenPt.x - screenX;
      const dy = screenPt.y - screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= SCREEN_SNAP_TOLERANCE) {
        results.push({
          point: sp.point,
          snapType: sp.type,
          entityId,
          entityType: visibleEntities.find(e => e.id === entityId)?.type,
          screenPoint: screenPt,
          priority: sp.priority + dist * 0.01,
        });
      }
    }
  }
  
  // Check grid snap
  if (enabledSnapTypes.includes("grid") && context.document.snapSettings.gridEnabled) {
    const spacing = context.document.snapSettings.gridSpacing;
    const gridX = Math.round(worldPoint.x / spacing) * spacing;
    const gridY = Math.round(worldPoint.y / spacing) * spacing;
    const gridPt: CadPoint = { x: gridX, y: gridY, z: worldPoint.z };
    
    const screenPt = context.worldToScreen(gridPt);
    const dx = screenPt.x - screenX;
    const dy = screenPt.y - screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist <= SCREEN_SNAP_TOLERANCE) {
      results.push({
        point: gridPt,
        snapType: "grid",
        screenPoint: screenPt,
        priority: 100 + dist * 0.01,
      });
    }
  }
  
  // Check intersections (only if enabled)
  if (enabledSnapTypes.includes("intersection")) {
    const intersections = findIntersections(entitiesOnVisibleLayers);
    for (const isect of intersections) {
      const screenPt = context.worldToScreen(isect.point);
      const dx = screenPt.x - screenX;
      const dy = screenPt.y - screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= SCREEN_SNAP_TOLERANCE) {
        results.push({
          point: isect.point,
          snapType: "intersection",
          entityId: isect.entityIds.join(","),
          entityType: "intersection",
          screenPoint: screenPt,
          priority: 5 + dist * 0.01,
        });
      }
    }
  }
  
  // Sort by priority (lower is better)
  results.sort((a, b) => a.priority - b.priority);
  
  // Return best match per snap type
  const bestByType = new Map<SnapType, SnapResult>();
  for (const r of results) {
    const existing = bestByType.get(r.snapType);
    if (!existing || r.priority < existing.priority) {
      bestByType.set(r.snapType, r);
    }
  }
  
  return Array.from(bestByType.values());
}

export function getBestSnap(
  screenX: number,
  screenY: number,
  context: SnapContext,
  enabledSnapTypes: SnapType[]
): SnapResult | null {
  const snaps = findSnapPoints(screenX, screenY, context, enabledSnapTypes);
  return snaps.length > 0 ? snaps[0] : null;
}

export function applyOrthoMode(point: CadPoint, lastPoint: CadPoint, orthoMode: boolean): CadPoint {
  if (!orthoMode) return point;
  
  const dx = point.x - lastPoint.x;
  const dy = point.y - lastPoint.y;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    return { ...point, y: lastPoint.y };
  } else {
    return { ...point, x: lastPoint.x };
  }
}

export function applyPolarTracking(
  point: CadPoint,
  lastPoint: CadPoint,
  polarAngles: number[],
  tolerance: number = Math.PI / 18 // 10 degrees
): CadPoint {
  if (polarAngles.length === 0) return point;
  
  const dx = point.x - lastPoint.x;
  const dy = point.y - lastPoint.y;
  const angle = Math.atan2(dy, dx);
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  for (const polarAngle of polarAngles) {
    const diff = Math.abs(angle - polarAngle);
    if (diff < tolerance || diff > Math.PI * 2 - tolerance) {
      return {
        x: lastPoint.x + dist * Math.cos(polarAngle),
        y: lastPoint.y + dist * Math.sin(polarAngle),
        z: point.z,
      };
    }
  }
  
  return point;
}
