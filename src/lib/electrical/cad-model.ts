import { z } from "zod";

export const CAD_UNITS = ["mm", "cm", "m", "in", "ft"] as const;
export type CadUnit = (typeof CAD_UNITS)[number];

export const ENTITY_TYPES = [
  "line",
  "polyline",
  "circle",
  "arc",
  "rectangle",
  "text",
  "dimension",
  "hatch",
  "blockReference",
  "symbolInstance",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const SNAP_TYPES = [
  "endpoint",
  "midpoint",
  "center",
  "intersection",
  "perpendicular",
  "tangent",
  "nearest",
  "grid",
  "quadrant",
] as const;
export type SnapType = (typeof SNAP_TYPES)[number];

export const LAYER_COLORS = [
  "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#FFA500", "#800080", "#008000", "#808080", "#C0C0C0", "#FFFFFF",
] as const;

export const lineTypeSchema = z.enum(["CONTINUOUS", "DASHED", "DOTTED", "DASH_DOT", "DASH_DOT_DOT"]);
export type LineType = z.infer<typeof lineTypeSchema>;

export const lineWeightSchema = z.enum([
  "BY_LAYER", "BY_BLOCK", "DEFAULT",
  "0.00mm", "0.05mm", "0.09mm", "0.13mm", "0.15mm", "0.18mm", "0.20mm",
  "0.25mm", "0.30mm", "0.35mm", "0.40mm", "0.50mm", "0.53mm", "0.60mm",
  "0.70mm", "0.80mm", "0.90mm", "1.00mm", "1.06mm", "1.20mm", "1.40mm", "1.58mm", "2.00mm", "2.11mm"
]);
export type LineWeight = z.infer<typeof lineWeightSchema>;

export const layerSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#FFFFFF"),
  lineType: lineTypeSchema.default("CONTINUOUS"),
  lineWeight: lineWeightSchema.default("BY_LAYER"),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  plot: z.boolean().default(true),
  description: z.string().max(256).default(""),
});
export type CadLayer = z.infer<typeof layerSchema>;

export const pointSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().default(0),
});
export type CadPoint = z.infer<typeof pointSchema>;

export const entityBaseSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(ENTITY_TYPES),
  layerId: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().default(null),
  lineType: lineTypeSchema.nullable().default(null),
  lineWeight: lineWeightSchema.nullable().default(null),
  visible: z.boolean().default(true),
  selectable: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const lineEntitySchema = entityBaseSchema.extend({
  type: z.literal("line"),
  start: pointSchema,
  end: pointSchema,
});

export const polylineEntitySchema = entityBaseSchema.extend({
  type: z.literal("polyline"),
  vertices: z.array(pointSchema).min(2),
  closed: z.boolean().default(false),
  bulge: z.array(z.number()).optional(),
});

export const circleEntitySchema = entityBaseSchema.extend({
  type: z.literal("circle"),
  center: pointSchema,
  radius: z.number().positive(),
  startAngle: z.number().default(0),
  endAngle: z.number().default(Math.PI * 2),
});

export const arcEntitySchema = entityBaseSchema.extend({
  type: z.literal("arc"),
  center: pointSchema,
  radius: z.number().positive(),
  startAngle: z.number(),
  endAngle: z.number(),
});

export const rectangleEntitySchema = entityBaseSchema.extend({
  type: z.literal("rectangle"),
  corner: pointSchema,
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().default(0),
});

export const textEntitySchema = entityBaseSchema.extend({
  type: z.literal("text"),
  position: pointSchema,
  text: z.string().min(1).max(1024),
  height: z.number().positive().default(2.5),
  rotation: z.number().default(0),
  alignment: z.enum(["left", "center", "right", "aligned", "middle", "fit"]).default("left"),
  font: z.string().max(64).default("Standard"),
  obliqueAngle: z.number().default(0),
});

export const dimensionEntitySchema = entityBaseSchema.extend({
  type: z.literal("dimension"),
  dimensionType: z.enum(["linear", "aligned", "angular", "radius", "diameter", "ordinate"]),
  definitionPoints: z.array(pointSchema).min(2).max(4),
  textPosition: pointSchema.nullable().default(null),
  textOverride: z.string().nullable().default(null),
  style: z.string().max(64).default("Standard"),
});

export const hatchEntitySchema = entityBaseSchema.extend({
  type: z.literal("hatch"),
  pattern: z.string().max(64).default("SOLID"),
  scale: z.number().positive().default(1),
  angle: z.number().default(0),
  boundaries: z.array(z.array(pointSchema)).min(1),
  associative: z.boolean().default(true),
});

export const blockReferenceEntitySchema = entityBaseSchema.extend({
  type: z.literal("blockReference"),
  blockId: z.string().min(1).max(64),
  position: pointSchema,
  scale: z.object({ x: z.number().default(1), y: z.number().default(1), z: z.number().default(1) }),
  rotation: z.number().default(0),
  attributes: z.record(z.string(), z.string()).default({}),
});

export const symbolInstanceEntitySchema = entityBaseSchema.extend({
  type: z.literal("symbolInstance"),
  symbolId: z.string().min(1).max(64),
  position: pointSchema,
  rotation: z.number().default(0),
  scale: z.number().positive().default(1),
  attributes: z.record(z.string(), z.string()).default({}),
  connectionPoints: z.array(z.object({
    id: z.string(),
    position: pointSchema,
    connected: z.boolean().default(false),
    wireId: z.string().nullable().default(null),
  })).default([]),
});

export const cadEntitySchema = z.discriminatedUnion("type", [
  lineEntitySchema,
  polylineEntitySchema,
  circleEntitySchema,
  arcEntitySchema,
  rectangleEntitySchema,
  textEntitySchema,
  dimensionEntitySchema,
  hatchEntitySchema,
  blockReferenceEntitySchema,
  symbolInstanceEntitySchema,
]);
export type CadEntity = z.infer<typeof cadEntitySchema>;

export const blockSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  entities: z.array(cadEntitySchema).default([]),
  basePoint: pointSchema.default({ x: 0, y: 0, z: 0 }),
  description: z.string().max(256).default(""),
  isAnonymous: z.boolean().default(false),
});
export type CadBlock = z.infer<typeof blockSchema>;

export const viewportSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  center: pointSchema,
  width: z.number().positive(),
  height: z.number().positive(),
  scale: z.number().positive().default(1),
  rotation: z.number().default(0),
  layerOverrides: z.record(z.string(), z.object({
    visible: z.boolean().optional(),
    color: z.string().optional(),
    lineWeight: lineWeightSchema.optional(),
  })).default({}),
  displayLocked: z.boolean().default(false),
});
export type Viewport = z.infer<typeof viewportSchema>;

export const layoutSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  paperSize: z.enum(["A4", "A3", "A2", "A1", "A0", "CUSTOM"]),
  paperWidth: z.number().positive(),
  paperHeight: z.number().positive(),
  orientation: z.enum(["portrait", "landscape"]).default("landscape"),
  margins: z.object({
    top: z.number().nonnegative().default(10),
    right: z.number().nonnegative().default(10),
    bottom: z.number().nonnegative().default(10),
    left: z.number().nonnegative().default(10),
  }),
  viewports: z.array(viewportSchema).default([]),
  titleBlockId: z.string().nullable().default(null),
  plotScale: z.number().positive().default(1),
  plotStyle: z.string().max(64).default("monochrome.ctb"),
});
export type CadLayout = z.infer<typeof layoutSchema>;

export const cadDocumentSchema = z.object({
  version: z.literal(1),
  units: z.enum(CAD_UNITS).default("m"),
  precision: z.number().int().min(0).max(8).default(3),
  anglePrecision: z.number().int().min(0).max(8).default(2),
  angleDirection: z.enum(["counterclockwise", "clockwise"]).default("counterclockwise"),
  angleBase: z.number().default(0),
  layers: z.array(layerSchema).default([]),
  blocks: z.array(blockSchema).default([]),
  entities: z.array(cadEntitySchema).default([]),
  layouts: z.array(layoutSchema).default([]),
  activeLayout: z.string().nullable().default(null),
  activeLayer: z.string().min(1).max(64),
  snapSettings: z.object({
    gridEnabled: z.boolean().default(true),
    gridSpacing: z.number().positive().default(1),
    gridMajor: z.number().int().positive().default(10),
    snapEnabled: z.boolean().default(true),
    snapModes: z.array(z.enum(SNAP_TYPES)).default(["endpoint", "midpoint", "center", "intersection", "grid"]),
    orthoMode: z.boolean().default(false),
    polarTracking: z.boolean().default(false),
    polarAngles: z.array(z.number()).default([0, Math.PI/2, Math.PI, 3*Math.PI/2]),
    objectSnapTracking: z.boolean().default(true),
  }),
  limits: z.object({
    min: pointSchema.default({ x: 0, y: 0, z: 0 }),
    max: pointSchema.default({ x: 100, y: 100, z: 0 }),
  }).optional(),
  $schema: z.string().optional(),
});
export type CadDocument = z.infer<typeof cadDocumentSchema>;

export const DEFAULT_LAYERS: CadLayer[] = [
  { id: "0", name: "0", color: "#FFFFFF", lineType: "CONTINUOUS", lineWeight: "DEFAULT", visible: true, locked: false, plot: true, description: "Default layer" },
  { id: "DEFPOINTS", name: "DEFPOINTS", color: "#FFFF00", lineType: "CONTINUOUS", lineWeight: "DEFAULT", visible: true, locked: false, plot: false, description: "Non-plotting definition points" },
  { id: "ARCH-WALLS", name: "ARCH-WALLS", color: "#00FFFF", lineType: "CONTINUOUS", lineWeight: "0.35mm", visible: true, locked: true, plot: true, description: "Architectural walls (underlay)" },
  { id: "ARCH-DOORS", name: "ARCH-DOORS", color: "#00FFFF", lineType: "CONTINUOUS", lineWeight: "0.25mm", visible: true, locked: true, plot: true, description: "Architectural doors (underlay)" },
  { id: "ARCH-WINDOWS", name: "ARCH-WINDOWS", color: "#00FFFF", lineType: "CONTINUOUS", lineWeight: "0.25mm", visible: true, locked: true, plot: true, description: "Architectural windows (underlay)" },
  { id: "ELEC-LIGHTING", name: "ELEC-LIGHTING", color: "#FFFF00", lineType: "CONTINUOUS", lineWeight: "0.25mm", visible: true, locked: false, plot: true, description: "Lighting circuits" },
  { id: "ELEC-POWER", name: "ELEC-POWER", color: "#FF0000", lineType: "CONTINUOUS", lineWeight: "0.35mm", visible: true, locked: false, plot: true, description: "Power circuits" },
  { id: "ELEC-COMMS", name: "ELEC-COMMS", color: "#00FF00", lineType: "DASHED", lineWeight: "0.25mm", visible: true, locked: false, plot: true, description: "Communications/data" },
  { id: "ELEC-SYMBOLS", name: "ELEC-SYMBOLS", color: "#FFFFFF", lineType: "CONTINUOUS", lineWeight: "0.25mm", visible: true, locked: false, plot: true, description: "Electrical symbols" },
  { id: "ELEC-TEXT", name: "ELEC-TEXT", color: "#FFFFFF", lineType: "CONTINUOUS", lineWeight: "0.18mm", visible: true, locked: false, plot: true, description: "Electrical text and labels" },
  { id: "ELEC-DIMS", name: "ELEC-DIMS", color: "#FFFFFF", lineType: "CONTINUOUS", lineWeight: "0.18mm", visible: true, locked: false, plot: true, description: "Electrical dimensions" },
  { id: "ELEC-DBOARD", name: "ELEC-DBOARD", color: "#FF8000", lineType: "CONTINUOUS", lineWeight: "0.50mm", visible: true, locked: false, plot: true, description: "Distribution boards" },
  { id: "ELEC-CONDUIT", name: "ELEC-CONDUIT", color: "#8080FF", lineType: "DASHED", lineWeight: "0.25mm", visible: true, locked: false, plot: true, description: "Conduit and trunking" },
  { id: "ELEC-EARTH", name: "ELEC-EARTH", color: "#00FF00", lineType: "DASH_DOT", lineWeight: "0.35mm", visible: true, locked: false, plot: true, description: "Earthing and bonding" },
];

export function createDefaultCadDocument(): CadDocument {
  return {
    version: 1,
    units: "m",
    precision: 3,
    anglePrecision: 2,
    angleDirection: "counterclockwise",
    angleBase: 0,
    layers: DEFAULT_LAYERS,
    blocks: [],
    entities: [],
    layouts: [],
    activeLayout: null,
    activeLayer: "ELEC-SYMBOLS",
    snapSettings: {
      gridEnabled: true,
      gridSpacing: 0.1,
      gridMajor: 10,
      snapEnabled: true,
      snapModes: ["endpoint", "midpoint", "center", "intersection", "grid"],
      orthoMode: false,
      polarTracking: false,
      polarAngles: [0, Math.PI/2, Math.PI, 3*Math.PI/2],
      objectSnapTracking: true,
    },
    limits: { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 0 } },
  };
}

export type { CadEntity as Entity, CadLayer as Layer, CadBlock as Block, CadLayout as Layout, CadDocument as Document };
