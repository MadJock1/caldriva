import { z } from "zod";
import {
  APARTMENT_TEMPLATES,
  buildRooms,
  makeLoad,
} from "./templates";
import {
  apartmentTemplateIds,
  electricalBuildingSchema,
  floorCode,
  floorDefaultName,
  initialElectricalBuilding,
  serviceSchema,
  uniqueId,
  type Apartment,
  type ApartmentTemplateId,
  type ApplianceKind,
  type ElectricalBuilding,
  type Floor,
  type FloorKind,
  type LoadItem,
  type Room,
} from "./model";

export const briefFloorSchema = z.object({
  level: z.number().int().min(-10).max(200),
  kind: z.enum(["basement", "ground", "upper", "roof"]),
  template: z.enum(apartmentTemplateIds),
  apartmentCount: z.number().int().min(0).max(200),
});
export type BriefFloor = z.infer<typeof briefFloorSchema>;

export const commonBriefSchema = z.object({
  lifts: z.number().int().min(0).max(50).default(0),
  sharedLightingPerFloor: z.boolean().default(true),
  waterPump: z.boolean().default(false),
  hvac: z.boolean().default(false),
  evChargers: z.number().int().min(0).max(500).default(0),
  garage: z.boolean().default(false),
  technicalRooms: z.number().int().min(0).max(50).default(0),
});
export type CommonBrief = z.infer<typeof commonBriefSchema>;

export const briefSchema = z.object({
  name: z.string().trim().min(1).max(150),
  country: z.string().trim().min(1).max(80),
  jurisdiction: z.string().trim().min(1).max(120),
  category: z.enum(["residential", "mixed_use", "commercial", "industrial"]),
  floors: z.array(briefFloorSchema).min(1).max(220),
  common: commonBriefSchema,
  service: serviceSchema.partial().default({}),
});
export type BuildingBrief = z.infer<typeof briefSchema>;

export const defaultCommonBrief: CommonBrief = {
  lifts: 1,
  sharedLightingPerFloor: true,
  waterPump: false,
  hvac: false,
  evChargers: 0,
  garage: false,
  technicalRooms: 1,
};

export const defaultBrief: BuildingBrief = {
  name: "Residential block",
  country: "Portugal",
  jurisdiction: "Portugal - low-voltage installations (RTIEBT scope)",
  category: "residential",
  floors: [
    { level: 0, kind: "ground", template: "T2", apartmentCount: 4 },
    { level: 1, kind: "upper", template: "T2", apartmentCount: 4 },
    { level: 2, kind: "upper", template: "T2", apartmentCount: 4 },
    { level: 3, kind: "upper", template: "T2", apartmentCount: 4 },
    { level: 4, kind: "upper", template: "T2", apartmentCount: 4 },
  ],
  common: defaultCommonBrief,
  service: {},
};

export function uniformBrief(params: {
  name?: string;
  country?: string;
  jurisdiction?: string;
  category?: BuildingBrief["category"];
  basementLevels?: number;
  includeGround?: boolean;
  upperFloors?: number;
  apartmentsPerFloor?: number;
  template?: ApartmentTemplateId;
  groundTemplate?: ApartmentTemplateId;
  groundApartmentCount?: number;
  common?: CommonBrief;
}): BuildingBrief {
  const {
    name = "Residential block",
    country = "Portugal",
    jurisdiction = "Portugal - low-voltage installations (RTIEBT scope)",
    category = "residential",
    basementLevels = 0,
    includeGround = true,
    upperFloors = 5,
    apartmentsPerFloor = 4,
    template = "T2",
    groundTemplate = template,
    groundApartmentCount = apartmentsPerFloor,
    common = defaultCommonBrief,
  } = params;
  const floors: BriefFloor[] = [];
  for (let level = -basementLevels; level < 0; level += 1) {
    floors.push({ level, kind: "basement", template: "CUSTOM", apartmentCount: 0 });
  }
  if (includeGround) floors.push({ level: 0, kind: "ground", template: groundTemplate, apartmentCount: groundApartmentCount });
  const start = includeGround ? 1 : 0;
  for (let level = start; level < start + upperFloors; level += 1) {
    floors.push({ level, kind: "upper", template, apartmentCount: apartmentsPerFloor });
  }
  return { name, country, jurisdiction, category, floors, common, service: {} };
}

function takenIdSet(building: ElectricalBuilding) {
  const ids = new Set<string>();
  const add = (id: string) => ids.add(id);
  building.commonLoads.forEach(l => add(l.id));
  for (const floor of building.floors) {
    add(floor.id);
    floor.sharedLoads.forEach(l => add(l.id));
    for (const apt of floor.apartments) {
      add(apt.id);
      for (const room of apt.rooms) {
        add(room.id);
        room.loads.forEach(l => add(l.id));
      }
    }
  }
  return ids;
}

function makeApartment(floorId: string, code: string, templateId: ApartmentTemplateId, taken: Set<string>): Apartment {
  const id = uniqueId(code, candidate => taken.has(candidate));
  taken.add(id);
  const rooms = buildRooms(id, templateId, candidate => taken.has(candidate));
  rooms.forEach(room => {
    taken.add(room.id);
    room.loads.forEach(l => taken.add(l.id));
  });
  return { id, code: id, label: APARTMENT_TEMPLATES[templateId].label, templateId, rooms };
}

function makeFloorLoads(floorId: string, brief: BuildingBrief, taken: Set<string>): LoadItem[] {
  const loads: LoadItem[] = [];
  if (brief.common.sharedLightingPerFloor) {
    loads.push(makeLoad(uniqueId(`${floorId}-shared-lighting`, c => taken.has(c)), "shared_lighting", 1, `Shared-area lighting`, null));
    loads.forEach(l => taken.add(l.id));
  }
  return loads;
}

export function generateBuilding(input: BuildingBrief): ElectricalBuilding {
  const brief = briefSchema.parse(input);
  const orderedFloors = [...brief.floors].sort((a, b) => a.level - b.level);
  const seenLevels = new Set<number>();
  const taken = new Set<string>();
  const floors: Floor[] = [];
  for (const entry of orderedFloors) {
    if (seenLevels.has(entry.level)) continue;
    seenLevels.add(entry.level);
    const code = floorCode(entry.level);
    const id = uniqueId(`floor-${code}`, c => taken.has(c));
    taken.add(id);
    const apartments: Apartment[] = [];
    for (let i = 1; i <= entry.apartmentCount; i += 1) {
      apartments.push(makeApartment(id, `${code}-A${i}`, entry.template, taken));
    }
    const sharedLoads = makeFloorLoads(id, brief, taken);
    floors.push({
      id,
      code,
      name: floorDefaultName(entry.level),
      level: entry.level,
      kind: entry.kind as FloorKind,
      apartments,
      sharedLoads,
    });
  }
  const commonLoads = makeCommonLoads(floors, brief, taken);
  const service = serviceSchema.parse({
    ...initialElectricalBuilding.service,
    ...brief.service,
  });
  return electricalBuildingSchema.parse({
    ...initialElectricalBuilding,
    name: brief.name,
    country: brief.country,
    jurisdiction: brief.jurisdiction,
    category: brief.category,
    floors,
    commonLoads,
    service,
    reviewStatus: "DRAFT",
    assumptions: [...initialElectricalBuilding.assumptions],
    provenance: "user-supplied brief; hierarchy and load schedule algorithmically generated",
  });
}

function commonLoad(base: string, kind: ApplianceKind, qty: number, name: string | undefined, taken: Set<string>): LoadItem {
  const id = uniqueId(base, c => taken.has(c));
  taken.add(id);
  return makeLoad(id, kind, qty, name, null);
}

function makeCommonLoads(floors: Floor[], brief: BuildingBrief, taken: Set<string>): LoadItem[] {
  const loads: LoadItem[] = [];
  const first = floors[0]?.id ?? "building";
  if (brief.common.lifts > 0) loads.push(commonLoad(`${first}-lift`, "lift", brief.common.lifts, `Lift (${brief.common.lifts})`, taken));
  if (brief.common.waterPump) loads.push(commonLoad(`${first}-water-pump`, "water_pump", 1, "Water booster pump", taken));
  if (brief.common.hvac) loads.push(commonLoad(`${first}-hvac`, "hvac_unit", 1, "Central HVAC unit", taken));
  if (brief.common.evChargers > 0) loads.push(commonLoad(`${first}-ev`, "ev_charger", brief.common.evChargers, `EV chargers (${brief.common.evChargers})`, taken));
  if (brief.common.garage) loads.push(commonLoad(`${first}-garage`, "garage_socket", 4, "Garage general loads", taken));
  for (let i = 1; i <= brief.common.technicalRooms; i += 1) {
    loads.push(commonLoad(`${first}-tech-${i}`, "technical_equipment", 1, `Technical room ${i} equipment`, taken));
  }
  return loads;
}

export function emptyBuilding(): ElectricalBuilding {
  return electricalBuildingSchema.parse({ ...initialElectricalBuilding });
}

export function withFloor(building: ElectricalBuilding, templateId: ApartmentTemplateId): ElectricalBuilding {
  const taken = takenIdSet(building);
  const level = building.floors.length ? Math.max(...building.floors.map(f => f.level)) + 1 : 0;
  const code = floorCode(level);
  const id = uniqueId(`floor-${code}`, c => taken.has(c));
  taken.add(id);
  const apartment: Apartment = makeApartment(id, `${code}-A1`, templateId, taken);
  const floor: Floor = {
    id,
    code,
    name: floorDefaultName(level),
    level,
    kind: level === 0 ? "ground" : "upper",
    apartments: [apartment],
    sharedLoads: [],
  };
  return { ...building, floors: [...building.floors, floor] };
}

export function withoutFloor(building: ElectricalBuilding, floorId: string): ElectricalBuilding {
  return { ...building, floors: building.floors.filter(f => f.id !== floorId) };
}

export function withApartment(building: ElectricalBuilding, floorId: string, templateId: ApartmentTemplateId): ElectricalBuilding {
  const taken = takenIdSet(building);
  return {
    ...building,
    floors: building.floors.map(floor => {
      if (floor.id !== floorId) return floor;
      const code = `${floor.code}-A${floor.apartments.length + 1}`;
      return { ...floor, apartments: [...floor.apartments, makeApartment(floor.id, code, templateId, taken)] };
    }),
  };
}

export function withoutApartment(building: ElectricalBuilding, floorId: string, apartmentId: string): ElectricalBuilding {
  return {
    ...building,
    floors: building.floors.map(floor => (floor.id === floorId ? { ...floor, apartments: floor.apartments.filter(a => a.id !== apartmentId) } : floor)),
  };
}

export function replaceApartment(building: ElectricalBuilding, floorId: string, apartment: Apartment): ElectricalBuilding {
  return {
    ...building,
    floors: building.floors.map(floor =>
      floor.id === floorId ? { ...floor, apartments: floor.apartments.map(a => (a.id === apartment.id ? apartment : a)) } : floor,
    ),
  };
}

export function reTemplateApartment(building: ElectricalBuilding, floorId: string, apartmentId: string, templateId: ApartmentTemplateId): ElectricalBuilding {
  const taken = takenIdSet(building);
  return {
    ...building,
    floors: building.floors.map(floor => {
      if (floor.id !== floorId) return floor;
      return {
        ...floor,
        apartments: floor.apartments.map(apt => {
          if (apt.id !== apartmentId) return apt;
          const rooms = buildRooms(apt.id, templateId, c => taken.has(c));
          return { ...apt, templateId, label: APARTMENT_TEMPLATES[templateId].label, rooms };
        }),
      };
    }),
  };
}

export function replaceRoom(building: ElectricalBuilding, floorId: string, apartmentId: string, room: Room): ElectricalBuilding {
  return {
    ...building,
    floors: building.floors.map(floor =>
      floor.id !== floorId
        ? floor
        : {
            ...floor,
            apartments: floor.apartments.map(apt =>
              apt.id !== apartmentId ? apt : { ...apt, rooms: apt.rooms.map(r => (r.id === room.id ? room : r)) },
            ),
          },
    ),
  };
}

export function replaceLoadInRoom(building: ElectricalBuilding, floorId: string, apartmentId: string, roomId: string, load: LoadItem): ElectricalBuilding {
  return {
    ...building,
    floors: building.floors.map(floor =>
      floor.id !== floorId
        ? floor
        : {
            ...floor,
            apartments: floor.apartments.map(apt =>
              apt.id !== apartmentId
                ? apt
                : { ...apt, rooms: apt.rooms.map(room => (room.id !== roomId ? room : { ...room, loads: room.loads.map(l => (l.id === load.id ? load : l)) })) },
            ),
          },
    ),
  };
}

export function addLoadToRoom(building: ElectricalBuilding, floorId: string, apartmentId: string, roomId: string, kind: ApplianceKind): ElectricalBuilding {
  const taken = takenIdSet(building);
  return {
    ...building,
    floors: building.floors.map(floor =>
      floor.id !== floorId
        ? floor
        : {
            ...floor,
            apartments: floor.apartments.map(apt =>
              apt.id !== apartmentId
                ? apt
                : {
                    ...apt,
                    rooms: apt.rooms.map(room => {
                      if (room.id !== roomId) return room;
                      const id = uniqueId(`${room.id}-${kind}`, c => taken.has(c));
                      return { ...room, loads: [...room.loads, makeLoad(id, kind, 1, undefined, room.id)] };
                    }),
                  },
            ),
          },
    ),
  };
}

export function removeLoadFromRoom(building: ElectricalBuilding, floorId: string, apartmentId: string, roomId: string, loadId: string): ElectricalBuilding {
  return {
    ...building,
    floors: building.floors.map(floor =>
      floor.id !== floorId
        ? floor
        : {
            ...floor,
            apartments: floor.apartments.map(apt =>
              apt.id !== apartmentId
                ? apt
                : { ...apt, rooms: apt.rooms.map(room => (room.id !== roomId ? room : { ...room, loads: room.loads.filter(l => l.id !== loadId) })) },
            ),
          },
    ),
  };
}

export function updateService(building: ElectricalBuilding, patch: Partial<ElectricalBuilding["service"]>): ElectricalBuilding {
  return { ...building, service: { ...building.service, ...patch } };
}

export function updateCommonLoad(building: ElectricalBuilding, load: LoadItem): ElectricalBuilding {
  return { ...building, commonLoads: building.commonLoads.map(l => (l.id === load.id ? load : l)) };
}

export function addCommonLoad(building: ElectricalBuilding, kind: ApplianceKind): ElectricalBuilding {
  const taken = takenIdSet(building);
  const id = uniqueId(`building-${kind}`, c => taken.has(c));
  return { ...building, commonLoads: [...building.commonLoads, makeLoad(id, kind, 1, undefined, null)] };
}

export function removeCommonLoad(building: ElectricalBuilding, loadId: string): ElectricalBuilding {
  return { ...building, commonLoads: building.commonLoads.filter(l => l.id !== loadId) };
}

export function updateFloorSharedLoad(building: ElectricalBuilding, floorId: string, load: LoadItem): ElectricalBuilding {
  return {
    ...building,
    floors: building.floors.map(floor => (floor.id === floorId ? { ...floor, sharedLoads: floor.sharedLoads.map(l => (l.id === load.id ? load : l)) } : floor)),
  };
}

export function allApartments(building: ElectricalBuilding) {
  return building.floors.flatMap(floor => floor.apartments.map(apartment => ({ floor, apartment })));
}
