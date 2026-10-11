import type { CadEntity, CadPoint } from "./cad-model";

export function getEntityBounds(entity: CadEntity): { min: CadPoint; max: CadPoint } {
  const points = entityPoints(entity);
  return {
    min: {
      x: Math.min(...points.map((point) => point.x)),
      y: Math.min(...points.map((point) => point.y)),
      z: Math.min(...points.map((point) => point.z)),
    },
    max: {
      x: Math.max(...points.map((point) => point.x)),
      y: Math.max(...points.map((point) => point.y)),
      z: Math.max(...points.map((point) => point.z)),
    },
  };
}

export function findEntityAtPoint(entities: CadEntity[], point: CadPoint, tolerance: number): CadEntity | null {
  let best: { entity: CadEntity; distance: number } | null = null;

  for (const entity of entities) {
    const distance = distanceToEntity(entity, point);
    if (distance <= tolerance && (!best || distance < best.distance)) best = { entity, distance };
  }

  return best?.entity ?? null;
}

function distanceToEntity(entity: CadEntity, point: CadPoint): number {
  switch (entity.type) {
    case "line":
      return distanceToSegment(point, entity.start, entity.end);
    case "rectangle": {
      const p1 = entity.corner;
      const p2 = { x: entity.corner.x + entity.width, y: entity.corner.y, z: entity.corner.z };
      const p3 = { x: entity.corner.x + entity.width, y: entity.corner.y + entity.height, z: entity.corner.z };
      const p4 = { x: entity.corner.x, y: entity.corner.y + entity.height, z: entity.corner.z };
      return Math.min(distanceToSegment(point, p1, p2), distanceToSegment(point, p2, p3), distanceToSegment(point, p3, p4), distanceToSegment(point, p4, p1));
    }
    case "circle":
      return Math.abs(Math.hypot(point.x - entity.center.x, point.y - entity.center.y) - entity.radius);
    case "polyline":
      return Math.min(...entity.vertices.slice(1).map((vertex, index) => distanceToSegment(point, entity.vertices[index], vertex)));
    default: {
      const bounds = getEntityBounds(entity);
      return point.x >= bounds.min.x && point.x <= bounds.max.x && point.y >= bounds.min.y && point.y <= bounds.max.y ? 0 : Number.POSITIVE_INFINITY;
    }
  }
}

function distanceToSegment(point: CadPoint, start: CadPoint, end: CadPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function entityPoints(entity: CadEntity): CadPoint[] {
  switch (entity.type) {
    case "line":
      return [entity.start, entity.end];
    case "polyline":
      return entity.vertices;
    case "circle":
    case "arc":
      return [
        { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius, z: entity.center.z },
        { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius, z: entity.center.z },
      ];
    case "rectangle":
      return [entity.corner, { x: entity.corner.x + entity.width, y: entity.corner.y + entity.height, z: entity.corner.z }];
    case "text":
      return [entity.position];
    case "dimension":
      return entity.definitionPoints;
    case "hatch":
      return entity.boundaries.flat();
    case "blockReference":
    case "symbolInstance":
      return [entity.position];
  }
}
