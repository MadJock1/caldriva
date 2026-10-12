import { z } from "zod";
import { complianceContextSchema } from "../engineering/compliance/context";
import { distributionSystemSchema } from "./distribution-system";

export const ENGINE_VERSION = "electrical-0.1.0";

export const ROOM_TYPES = [
  "living",
  "bedroom",
  "kitchen",
  "bathroom",
  "hall",
  "corridor",
  "stairs",
  "storage",
  "garage",
  "technical",
  "laundry",
  "balcony",
  "office",
  "retail",
  "other",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const roomTypeLabels: Record<RoomType, string> = {
  living: "Living room",
  bedroom: "Bedroom",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  hall: "Entrance hall",
  corridor: "Corridor",
  stairs: "Stairwell",
  storage: "Storage",
  garage: "Garage",
  technical: "Technical room",
  laundry: "Laundry",
  balcony: "Balcony",
  office: "Office",
  retail: "Retail",
  other: "Other",
};

export const APPLIANCE_KINDS = [
  "lighting",
  "socket",
  "refrigerator",
  "oven",
  "cooktop",
  "dishwasher",
  "washing_machine",
  "dryer",
  "hood",
  "microwave",
  "water_heater",
  "ac",
  "ev_charger",
  "lift",
  "water_pump",
  "shared_lighting",
  "exhaust_fan",
  "hvac_unit",
  "garage_socket",
  "technical_equipment",
  "other",
] as const;
export type ApplianceKind = (typeof APPLIANCE_KINDS)[number];

export type ApplianceSpec = {
  label: string;
  watts: number;
  powerFactor: number;
  volts: number;
  phases: 1 | 3;
  utilisationFactor: number;
  demandFactor: number;
  category: "lighting" | "socket" | "dedicated" | "hvac" | "common" | "other";
};

export const APPLIANCES: Record<ApplianceKind, ApplianceSpec> = {
  lighting: { label: "Lighting point", watts: 12, powerFactor: 0.9, volts: 230, phases: 1, utilisationFactor: 1, demandFactor: 1, category: "lighting" },
  socket: { label: "Socket outlet allowance", watts: 150, powerFactor: 1, volts: 230, phases: 1, utilisationFactor: 1, demandFactor: 0.5, category: "socket" },
  refrigerator: { label: "Refrigerator", watts: 150, powerFactor: 0.85, volts: 230, phases: 1, utilisationFactor: 0.5, demandFactor: 1, category: "dedicated" },
  oven: { label: "Oven", watts: 2500, powerFactor: 1, volts: 230, phases: 1, utilisationFactor: 0.8, demandFactor: 1, category: "dedicated" },
  cooktop: { label: "Cooktop / hob", watts: 6000, powerFactor: 1, volts: 230, phases: 1, utilisationFactor: 0.7, demandFactor: 1, category: "dedicated" },
  dishwasher: { label: "Dishwasher", watts: 2200, powerFactor: 0.95, volts: 230, phases: 1, utilisationFactor: 0.6, demandFactor: 1, category: "dedicated" },
  washing_machine: { label: "Washing machine", watts: 2200, powerFactor: 0.9, volts: 230, phases: 1, utilisationFactor: 0.5, demandFactor: 1, category: "dedicated" },
  dryer: { label: "Tumble dryer", watts: 2500, powerFactor: 1, volts: 230, phases: 1, utilisationFactor: 0.5, demandFactor: 1, category: "dedicated" },
  hood: { label: "Extractor hood", watts: 200, powerFactor: 0.9, volts: 230, phases: 1, utilisationFactor: 1, demandFactor: 1, category: "dedicated" },
  microwave: { label: "Microwave", watts: 1200, powerFactor: 0.95, volts: 230, phases: 1, utilisationFactor: 0.4, demandFactor: 1, category: "dedicated" },
  water_heater: { label: "Electric water heater", watts: 2000, powerFactor: 1, volts: 230, phases: 1, utilisationFactor: 0.5, demandFactor: 1, category: "dedicated" },
  ac: { label: "Split air conditioner", watts: 1200, powerFactor: 0.9, volts: 230, phases: 1, utilisationFactor: 0.8, demandFactor: 1, category: "hvac" },
  ev_charger: { label: "EV charger", watts: 7400, powerFactor: 0.95, volts: 230, phases: 1, utilisationFactor: 1, demandFactor: 1, category: "common" },
  lift: { label: "Lift motor", watts: 6000, powerFactor: 0.85, volts: 400, phases: 3, utilisationFactor: 0.5, demandFactor: 0.7, category: "common" },
  water_pump: { label: "Water pump", watts: 1500, powerFactor: 0.8, volts: 400, phases: 3, utilisationFactor: 0.6, demandFactor: 1, category: "common" },
  shared_lighting: { label: "Shared-area lighting", watts: 300, powerFactor: 0.9, volts: 230, phases: 1, utilisationFactor: 1, demandFactor: 1, category: "common" },
  exhaust_fan: { label: "Bathroom extract fan", watts: 100, powerFactor: 0.8, volts: 230, phases: 1, utilisationFactor: 0.5, demandFactor: 1, category: "other" },
  hvac_unit: { label: "Central HVAC unit", watts: 15000, powerFactor: 0.9, volts: 400, phases: 3, utilisationFactor: 0.9, demandFactor: 1, category: "hvac" },
  garage_socket: { label: "Garage socket allowance", watts: 150, powerFactor: 0.95, volts: 230, phases: 1, utilisationFactor: 1, demandFactor: 0.3, category: "socket" },
  technical_equipment: { label: "Technical equipment", watts: 1000, powerFactor: 0.9, volts: 230, phases: 1, utilisationFactor: 0.8, demandFactor: 1, category: "common" },
  other: { label: "Other load", watts: 100, powerFactor: 1, volts: 230, phases: 1, utilisationFactor: 1, demandFactor: 1, category: "other" },
};

export const CIRCUIT_TYPES = ["LGT", "SOC", "KITCHEN", "HVAC", "DED", "EV", "COMMON", "LIFT", "PUMP", "TECH"] as const;
export type CircuitType = (typeof CIRCUIT_TYPES)[number];

export const circuitTypeLabels: Record<CircuitType, string> = {
  LGT: "Lighting",
  SOC: "Socket outlets",
  KITCHEN: "Kitchen equipment",
  HVAC: "HVAC equipment",
  DED: "Dedicated appliance",
  EV: "EV charging",
  COMMON: "Common services",
  LIFT: "Lift",
  PUMP: "Water pumping",
  TECH: "Technical equipment",
};

export const PHASES = ["L1", "L2", "L3"] as const;
export type Phase = (typeof PHASES)[number];

export const POINT_KINDS = ["lighting", "socket", "switch", "dedicated", "hvac", "data", "db"] as const;
export type PointKind = (typeof POINT_KINDS)[number];

export const pointKindLabels: Record<PointKind, string> = {
  lighting: "Lighting point (ceiling)",
  socket: "Socket outlet",
  switch: "Switch",
  dedicated: "Dedicated appliance point",
  hvac: "HVAC point",
  data: "Data / telecom outlet",
  db: "Distribution board",
};

export const rectSchema = z.object({
  x: z.number().min(0).max(10000),
  y: z.number().min(0).max(10000),
  w: z.number().min(0.1).max(10000),
  h: z.number().min(0.1).max(10000),
});
export type Rect = z.infer<typeof rectSchema>;

export const electricalPointSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(POINT_KINDS),
  x: z.number().min(-1000).max(10000),
  y: z.number().min(-1000).max(10000),
  elevationM: z.number().min(0).max(1000).nullable().default(null),
  symbolId: z.string().min(1).max(80).nullable().default(null),
  deviceReference: z.string().max(80).default(""),
  description: z.string().max(300).default(""),
  rotationDeg: z.number().min(0).lt(360).default(0),
  scale: z.number().min(0.1).max(10).default(1),
  manufacturer: z.string().max(120).default(""),
  productReference: z.string().max(120).default(""),
  datasheetUrl: z.string().max(500).default(""),
  productVerificationStatus: z.enum(["UNVERIFIED", "VERIFIED"]).default("UNVERIFIED"),
  roomId: z.string().max(64).nullable().default(null),
  note: z.string().max(300).default(""),
});
export type ElectricalPoint = z.infer<typeof electricalPointSchema>;

export const planRoomSchema = z.object({
  id: z.string().min(1).max(64),
  roomId: z.string().max(64).nullable().default(null),
  apartmentId: z.string().max(64).nullable().default(null),
  label: z.string().min(1).max(120),
  type: z.enum(ROOM_TYPES),
  rect: rectSchema,
  wallThickness: z.number().min(0).max(0.5).optional(),
  fixedSize: z.boolean().optional(),
  openings: z.array(z.object({
    kind: z.enum(["door", "window"]),
    edge: z.enum(["top", "bottom", "left", "right"]),
    position: z.number().min(0).max(1),
    width: z.number().min(0.2).max(5),
  })).max(30).optional(),
});
export type PlanRoom = z.infer<typeof planRoomSchema>;

export const xySchema = z.object({
  x: z.number().min(-1000).max(10000),
  y: z.number().min(-1000).max(10000),
});
export type XY = z.infer<typeof xySchema>;

export const cableRouteSchema = z.object({
  id: z.string().min(1).max(64),
  circuitId: z.string().max(64).nullable().default(null),
  pointId: z.string().max(64).nullable().default(null),
  polyline: z.array(xySchema).min(2).max(64),
});
export type CableRoute = z.infer<typeof cableRouteSchema>;

export const wireTerminalRefSchema = z.object({ pointId: z.string().min(1).max(64), terminalId: z.string().min(1).max(64) });
export type WireTerminalRef = z.infer<typeof wireTerminalRefSchema>;
export const cadWireSchema = z.object({
  id: z.string().min(1).max(64),
  polyline: z.array(xySchema).min(2).max(256),
  circuitId: z.string().max(64).nullable().default(null),
  startTerminal: wireTerminalRefSchema.nullable().default(null),
  endTerminal: wireTerminalRefSchema.nullable().default(null),
  label: z.string().max(120).default(""),
  notes: z.string().max(500).default(""),
  layer: z.string().max(80).default("ELEC-LOGICAL-CONNECTIONS"),
  lineType: z.enum(["continuous", "dashed"]).default("continuous"),
  junctionIds: z.array(z.string().min(1).max(64)).max(64).default([]),
  state: z.enum(["LOGICAL", "PROPOSED", "REQUIRES_REVIEW", "REVIEWED"]).default("LOGICAL"),
});
export type CadWire = z.infer<typeof cadWireSchema>;
export const cadJunctionSchema = z.object({ id: z.string().min(1).max(64), x: z.number().min(-1000).max(10000), y: z.number().min(-1000).max(10000), wireIds: z.array(z.string().min(1).max(64)).min(2).max(32), note: z.string().max(300).default("") });
export type CadJunction = z.infer<typeof cadJunctionSchema>;

export const CONTAINMENT_TYPES = ["concealed_wall", "ceiling_void", "surface_conduit", "surface_trunking", "cable_tray", "vertical_riser", "underfloor", "other"] as const;
export type ContainmentType = (typeof CONTAINMENT_TYPES)[number];
export const ROUTING_ZONE_TYPES = ["service_corridor", "ceiling_zone", "wall_zone", "shaft", "riser", "underfloor_zone", "surface_zone", "other"] as const;
export type RoutingZoneType = (typeof ROUTING_ZONE_TYPES)[number];
export const ROUTE_STATES = ["LOGICAL", "PROPOSED_PHYSICAL", "REVIEWED_PHYSICAL"] as const;
export type RouteState = (typeof ROUTE_STATES)[number];
export const CONSTRUCTION_ELEMENTS = ["non_structural_partition", "load_bearing_wall", "fire_rated_partition", "floor_slab", "ceiling", "beam", "column", "unknown"] as const;
export type ConstructionElement = (typeof CONSTRUCTION_ELEMENTS)[number];

export const xyzSchema = xySchema.extend({ z: z.number().min(-100).max(1000) });
export type XYZ = z.infer<typeof xyzSchema>;
export const routingZoneSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  type: z.enum(ROUTING_ZONE_TYPES),
  containment: z.enum(CONTAINMENT_TYPES),
  polyline: z.array(xyzSchema).min(2).max(64),
  widthM: z.number().positive().max(10).nullable().default(null),
  heightM: z.number().positive().max(10).nullable().default(null),
  material: z.string().max(120).nullable().default(null),
  installationMethod: z.string().max(200).nullable().default(null),
  firePerformance: z.string().max(200).nullable().default(null),
  availableRoutingZone: z.string().max(200).nullable().default(null),
  crossingElement: z.enum(CONSTRUCTION_ELEMENTS).nullable().default(null),
  crossingId: z.string().max(64).nullable().default(null),
  crossingReviewed: z.boolean().default(false),
  reviewStatus: z.enum(["UNREVIEWED", "REVIEWED"]).default("UNREVIEWED"),
});
export type RoutingZone = z.infer<typeof routingZoneSchema>;
export const physicalRouteSegmentSchema = z.object({
  zoneId: z.string().min(1).max(64),
  start: xyzSchema,
  end: xyzSchema,
  containment: z.enum(CONTAINMENT_TYPES),
  lengthM: z.number().nonnegative(),
  crossingElement: z.enum(CONSTRUCTION_ELEMENTS).nullable().default(null),
  crossingId: z.string().max(64).nullable().default(null),
  reviewed: z.boolean().default(false),
});
export type PhysicalRouteSegment = z.infer<typeof physicalRouteSegmentSchema>;
export const physicalRouteSchema = z.object({
  id: z.string().min(1).max(64),
  circuitId: z.string().max(64).nullable().default(null),
  pointId: z.string().max(64).nullable().default(null),
  state: z.enum(["PROPOSED_PHYSICAL", "REVIEWED_PHYSICAL"]),
  segments: z.array(physicalRouteSegmentSchema).min(1).max(256),
  reviewNote: z.string().max(500).default(""),
});
export type PhysicalRoute = z.infer<typeof physicalRouteSchema>;

export const floorPlanSchema = z.object({
  id: z.string().min(1).max(64),
  floorId: z.string().min(1).max(64),
  width: z.number().min(1).max(10000),
  depth: z.number().min(1).max(10000),
  rooms: z.array(planRoomSchema).max(500),
  points: z.array(electricalPointSchema).max(5000),
  routes: z.array(cableRouteSchema).max(5000).default([]),
  cadWires: z.array(cadWireSchema).max(5000).default([]),
  cadJunctions: z.array(cadJunctionSchema).max(5000).default([]),
  routingZones: z.array(routingZoneSchema).max(1000).default([]),
  physicalRoutes: z.array(physicalRouteSchema).max(5000).default([]),
});
export type FloorPlan = z.infer<typeof floorPlanSchema>;

export const DEFAULT_CABLE_CSA: Record<CircuitType, number> = {
  LGT: 1.5,
  SOC: 2.5,
  KITCHEN: 2.5,
  HVAC: 2.5,
  DED: 2.5,
  EV: 6,
  LIFT: 6,
  PUMP: 4,
  TECH: 2.5,
  COMMON: 2.5,
};

export const cableAssumptionsSchema = z.object({
  material: z.enum(["copper", "aluminium"]),
  maxDropPercent: z.number().min(0.5).max(10),
  csaByType: z.record(z.string(), z.number().min(0.5).max(400)),
});
export type CableAssumptions = z.infer<typeof cableAssumptionsSchema>;
export const defaultCableAssumptions: CableAssumptions = { material: "copper", maxDropPercent: 3, csaByType: {} };

export const REVIEW_STATUSES = ["DRAFT", "GENERATED", "NEEDS_REVIEW", "ENGINEER_REVIEWED", "APPROVED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const loadItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  kind: z.enum(APPLIANCE_KINDS),
  ratedWatts: z.number().min(0).max(1e7),
  powerFactor: z.number().min(0.1).max(1),
  volts: z.number().min(24).max(1000),
  phases: z.union([z.literal(1), z.literal(3)]),
  quantity: z.number().int().min(0).max(10000),
  utilisationFactor: z.number().min(0).max(1),
  demandFactor: z.number().min(0).max(1),
  phase: z.enum(PHASES).nullable().default(null),
  roomId: z.string().max(64).nullable().default(null),
  circuitId: z.string().max(64).nullable().default(null),
  note: z.string().max(300).default(""),
});
export type LoadItem = z.infer<typeof loadItemSchema>;

export const roomSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  type: z.enum(ROOM_TYPES),
  area: z.number().min(0).max(100000).default(0),
  loads: z.array(loadItemSchema).max(200),
});
export type Room = z.infer<typeof roomSchema>;

export const apartmentSchema = z.object({
  id: z.string().min(1).max(64),
  code: z.string().min(1).max(32),
  label: z.string().min(1).max(120),
  templateId: z.string().min(1).max(32),
  rooms: z.array(roomSchema).max(100),
});
export type Apartment = z.infer<typeof apartmentSchema>;

export const floorKindSchema = z.enum(["basement", "ground", "upper", "roof"]);
export type FloorKind = z.infer<typeof floorKindSchema>;

export const floorSchema = z.object({
  id: z.string().min(1).max(64),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  level: z.number().int().min(-10).max(200),
  kind: floorKindSchema,
  apartments: z.array(apartmentSchema).max(200),
  sharedLoads: z.array(loadItemSchema).max(200),
});
export type Floor = z.infer<typeof floorSchema>;

export const serviceSchema = z.object({
  voltageV: z.number().min(120).max(1000),
  phases: z.union([z.literal(1), z.literal(3)]),
  supplyType: z.enum(["single", "three"]),
  apartmentDiversity: z.number().min(0.1).max(1).default(1),
  buildingDiversity: z.number().min(0.1).max(1).default(1),
  designMargin: z.number().min(0).max(1).default(0.1),
});
export type ServiceConfig = z.infer<typeof serviceSchema>;

export const electricalBuildingSchema = z.object({
  version: z.literal(2),
  name: z.string().min(1).max(150),
  country: z.string().min(1).max(80),
  jurisdiction: z.string().min(1).max(120),
  category: z.enum(["residential", "mixed_use", "commercial", "industrial"]),
  floors: z.array(floorSchema).max(220),
  plans: z.array(floorPlanSchema).max(220).default([]),
  commonLoads: z.array(loadItemSchema).max(300),
  service: serviceSchema,
  cableAssumptions: cableAssumptionsSchema.default(defaultCableAssumptions),
  compliance: complianceContextSchema.optional(),
  distribution: distributionSystemSchema.nullable().default(null),
  reviewStatus: z.enum(REVIEW_STATUSES).default("DRAFT"),
  assumptions: z.array(z.string().max(600)).max(40),
  provenance: z.string().min(1).max(300),
});
export type ElectricalBuilding = z.infer<typeof electricalBuildingSchema>;

export function migrateElectricalBuildingDraft(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const draft = raw as Record<string, unknown>;
  if (draft.version === 1) return { ...draft, version: 2, distribution: null };
  return raw;
}

export function parseElectricalBuildingDraft(raw: unknown): ElectricalBuilding {
  return electricalBuildingSchema.parse(migrateElectricalBuildingDraft(raw));
}

export const apartmentTemplateIds = ["T0", "T1", "T2", "T3", "T4", "T5", "CUSTOM"] as const;
export type ApartmentTemplateId = (typeof apartmentTemplateIds)[number];

export const initialElectricalBuilding: ElectricalBuilding = {
  version: 2,
  name: "Untitled building",
  country: "Portugal",
  jurisdiction: "Portugal - low-voltage installations (RTIEBT scope)",
  category: "residential",
  floors: [],
  plans: [],
  commonLoads: [],
  service: { voltageV: 400, phases: 3, supplyType: "three", apartmentDiversity: 1, buildingDiversity: 1, designMargin: 0.1 },
  cableAssumptions: defaultCableAssumptions,
  distribution: null,
  reviewStatus: "DRAFT",
  assumptions: [
    "Preliminary automatic electrical model; not engineer-reviewed, certified or approved.",
    "Connected loads and demand use explicit, editable appliance ratings and duty factors, not verified manufacturer data.",
    "No automatic compliance with any wiring regulation is claimed. Portugal (RTIEBT) requires professional confirmation.",
  ],
  provenance: "user-supplied brief; hierarchy and load schedule algorithmically generated",
};

export function roomCode(type: RoomType, index: number) {
  return `${type}${index}`;
}

export function floorCode(level: number) {
  if (level < 0) return `B${Math.abs(level)}`;
  if (level === 0) return "G";
  return `F${level}`;
}

export function floorDefaultName(level: number) {
  if (level < 0) return `Basement ${Math.abs(level)}`;
  if (level === 0) return "Ground floor";
  return `Floor ${level}`;
}

export type AvailableId = (candidate: string) => boolean;

export function uniqueId(base: string, taken: AvailableId) {
  const clean = base.replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "item";
  if (taken(clean)) {
    let n = 2;
    while (taken(`${clean}-${n}`)) n += 1;
    return `${clean}-${n}`;
  }
  return clean;
}
