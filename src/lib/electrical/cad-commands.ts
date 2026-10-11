import type { CadDocument, CadEntity, CadPoint } from "./cad-model";
import type { IECSymbolMetadata } from "./iec60617";

export type CadTool = "select" | "line" | "rectangle" | "circle" | "symbol" | "move" | "delete";

export interface CadCommandResult {
  document: CadDocument;
  addedEntityIds: string[];
  removedEntityIds: string[];
  updatedEntityIds: string[];
}

let idCounter = 0;

export function cadId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function addEntity(document: CadDocument, entity: CadEntity): CadCommandResult {
  return {
    document: { ...document, entities: [...document.entities, entity] },
    addedEntityIds: [entity.id],
    removedEntityIds: [],
    updatedEntityIds: [],
  };
}

export function removeEntities(document: CadDocument, ids: string[]): CadCommandResult {
  const idSet = new Set(ids);
  return {
    document: { ...document, entities: document.entities.filter((entity) => !idSet.has(entity.id)) },
    addedEntityIds: [],
    removedEntityIds: ids,
    updatedEntityIds: [],
  };
}

export function moveEntities(document: CadDocument, ids: string[], delta: CadPoint): CadCommandResult {
  const idSet = new Set(ids);
  const updated: string[] = [];
  const entities = document.entities.map((entity) => {
    if (!idSet.has(entity.id)) return entity;
    updated.push(entity.id);
    return translateEntity(entity, delta);
  });

  return {
    document: { ...document, entities },
    addedEntityIds: [],
    removedEntityIds: [],
    updatedEntityIds: updated,
  };
}

export function createLineEntity(layerId: string, start: CadPoint, end: CadPoint): CadEntity {
  return {
    id: cadId("line"),
    type: "line",
    layerId,
    color: null,
    lineType: null,
    lineWeight: null,
    visible: true,
    selectable: true,
    metadata: {},
    start,
    end,
  };
}

export function createRectangleEntity(layerId: string, first: CadPoint, second: CadPoint): CadEntity {
  return {
    id: cadId("rect"),
    type: "rectangle",
    layerId,
    color: null,
    lineType: null,
    lineWeight: null,
    visible: true,
    selectable: true,
    metadata: {},
    corner: { x: Math.min(first.x, second.x), y: Math.min(first.y, second.y), z: first.z },
    width: Math.abs(second.x - first.x),
    height: Math.abs(second.y - first.y),
    rotation: 0,
  };
}

export function createCircleEntity(layerId: string, center: CadPoint, edge: CadPoint): CadEntity {
  return {
    id: cadId("circle"),
    type: "circle",
    layerId,
    color: null,
    lineType: null,
    lineWeight: null,
    visible: true,
    selectable: true,
    metadata: {},
    center,
    radius: distance(center, edge),
    startAngle: 0,
    endAngle: Math.PI * 2,
  };
}

export function createSymbolInstanceEntity(layerId: string, symbol: IECSymbolMetadata, position: CadPoint, scale = 1, rotation = 0): CadEntity {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return {
    id: cadId("sym"),
    type: "symbolInstance",
    layerId,
    color: null,
    lineType: null,
    lineWeight: null,
    visible: true,
    selectable: true,
    metadata: {
      symbolName: symbol.name,
      verificationStatus: symbol.verificationStatus,
      provenance: symbol.provenance,
    },
    symbolId: symbol.symbolId,
    position,
    rotation,
    scale,
    attributes: { TAG: symbol.displayLabel },
    connectionPoints: symbol.geometry.terminals.map((terminal) => ({
      id: terminal.id,
      position: {
        x: position.x + (terminal.x * cos - terminal.y * sin) * scale,
        y: position.y + (terminal.x * sin + terminal.y * cos) * scale,
        z: position.z,
      },
      connected: false,
      wireId: null,
    })),
  };
}

export function distance(a: CadPoint, b: CadPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function translatePoint(point: CadPoint, delta: CadPoint): CadPoint {
  return { x: point.x + delta.x, y: point.y + delta.y, z: point.z + delta.z };
}

export function translateEntity(entity: CadEntity, delta: CadPoint): CadEntity {
  switch (entity.type) {
    case "line":
      return { ...entity, start: translatePoint(entity.start, delta), end: translatePoint(entity.end, delta) };
    case "polyline":
      return { ...entity, vertices: entity.vertices.map((point) => translatePoint(point, delta)) };
    case "circle":
    case "arc":
      return { ...entity, center: translatePoint(entity.center, delta) };
    case "rectangle":
      return { ...entity, corner: translatePoint(entity.corner, delta) };
    case "text":
      return { ...entity, position: translatePoint(entity.position, delta) };
    case "dimension":
      return {
        ...entity,
        definitionPoints: entity.definitionPoints.map((point) => translatePoint(point, delta)),
        textPosition: entity.textPosition ? translatePoint(entity.textPosition, delta) : null,
      };
    case "hatch":
      return { ...entity, boundaries: entity.boundaries.map((boundary) => boundary.map((point) => translatePoint(point, delta))) };
    case "blockReference":
      return { ...entity, position: translatePoint(entity.position, delta) };
    case "symbolInstance":
      return {
        ...entity,
        position: translatePoint(entity.position, delta),
        connectionPoints: entity.connectionPoints.map((point) => ({ ...point, position: translatePoint(point.position, delta) })),
      };
  }
}
