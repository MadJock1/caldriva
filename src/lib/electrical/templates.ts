import {
  APPLIANCES,
  type ApartmentTemplateId,
  type ApplianceKind,
  type LoadItem,
  type Room,
  type RoomType,
} from "./model";

export type LoadTemplateEntry = { kind: ApplianceKind; quantity: number; label?: string };

export const ROOM_LOAD_TEMPLATES: Record<RoomType, LoadTemplateEntry[]> = {
  living: [
    { kind: "lighting", quantity: 1 },
    { kind: "socket", quantity: 6 },
  ],
  bedroom: [
    { kind: "lighting", quantity: 1 },
    { kind: "socket", quantity: 4 },
  ],
  kitchen: [
    { kind: "lighting", quantity: 1 },
    { kind: "socket", quantity: 4 },
    { kind: "refrigerator", quantity: 1 },
    { kind: "oven", quantity: 1 },
    { kind: "cooktop", quantity: 1 },
    { kind: "hood", quantity: 1 },
  ],
  bathroom: [
    { kind: "lighting", quantity: 1 },
    { kind: "exhaust_fan", quantity: 1 },
  ],
  hall: [{ kind: "lighting", quantity: 1 }, { kind: "socket", quantity: 1 }],
  corridor: [{ kind: "lighting", quantity: 1 }],
  stairs: [{ kind: "lighting", quantity: 1 }],
  storage: [{ kind: "lighting", quantity: 1 }],
  garage: [
    { kind: "lighting", quantity: 1 },
    { kind: "garage_socket", quantity: 1 },
  ],
  technical: [
    { kind: "lighting", quantity: 1 },
    { kind: "technical_equipment", quantity: 1 },
  ],
  laundry: [
    { kind: "lighting", quantity: 1 },
    { kind: "washing_machine", quantity: 1 },
  ],
  balcony: [{ kind: "lighting", quantity: 1 }],
  office: [
    { kind: "lighting", quantity: 1 },
    { kind: "socket", quantity: 4 },
  ],
  retail: [
    { kind: "lighting", quantity: 2 },
    { kind: "socket", quantity: 6 },
  ],
  other: [{ kind: "lighting", quantity: 1 }],
};

export type RoomTemplateEntry = { type: RoomType; count: number; label?: string };

export type ApartmentTemplate = {
  id: ApartmentTemplateId;
  label: string;
  description: string;
  rooms: RoomTemplateEntry[];
};

export const APARTMENT_TEMPLATES: Record<ApartmentTemplateId, ApartmentTemplate> = {
  T0: {
    id: "T0",
    label: "T0 studio",
    description: "Open-plan living/bedroom, kitchen area, one bathroom.",
    rooms: [
      { type: "hall", count: 1 },
      { type: "living", count: 1, label: "Living / bedroom" },
      { type: "kitchen", count: 1, label: "Kitchenette" },
      { type: "bathroom", count: 1 },
    ],
  },
  T1: {
    id: "T1",
    label: "T1 one-bedroom",
    description: "Living room, one bedroom, kitchen, one bathroom.",
    rooms: [
      { type: "hall", count: 1 },
      { type: "living", count: 1 },
      { type: "bedroom", count: 1 },
      { type: "kitchen", count: 1 },
      { type: "bathroom", count: 1 },
    ],
  },
  T2: {
    id: "T2",
    label: "T2 two-bedroom",
    description: "Living room, two bedrooms, kitchen, one bathroom, hall.",
    rooms: [
      { type: "hall", count: 1 },
      { type: "living", count: 1 },
      { type: "bedroom", count: 2 },
      { type: "kitchen", count: 1 },
      { type: "bathroom", count: 1 },
    ],
  },
  T3: {
    id: "T3",
    label: "T3 three-bedroom",
    description: "Living room, three bedrooms, kitchen, two bathrooms, corridor.",
    rooms: [
      { type: "hall", count: 1 },
      { type: "living", count: 1 },
      { type: "bedroom", count: 3 },
      { type: "kitchen", count: 1 },
      { type: "bathroom", count: 2 },
      { type: "corridor", count: 1 },
    ],
  },
  T4: {
    id: "T4",
    label: "T4 four-bedroom",
    description: "Living room, four bedrooms, kitchen, three bathrooms, corridor.",
    rooms: [
      { type: "hall", count: 1 },
      { type: "living", count: 1 },
      { type: "bedroom", count: 4 },
      { type: "kitchen", count: 1 },
      { type: "bathroom", count: 3 },
      { type: "corridor", count: 1 },
    ],
  },
  T5: {
    id: "T5",
    label: "T5 five-bedroom",
    description: "Living room, five bedrooms, kitchen, three bathrooms, corridor.",
    rooms: [
      { type: "hall", count: 1 },
      { type: "living", count: 1 },
      { type: "bedroom", count: 5 },
      { type: "kitchen", count: 1 },
      { type: "bathroom", count: 3 },
      { type: "corridor", count: 1 },
    ],
  },
  CUSTOM: {
    id: "CUSTOM",
    label: "Custom",
    description: "Start from a living room and add rooms manually.",
    rooms: [{ type: "living", count: 1 }],
  },
};

export function makeLoad(
  id: string,
  kind: ApplianceKind,
  quantity: number,
  nameOverride?: string,
  roomId: string | null = null,
): LoadItem {
  const spec = APPLIANCES[kind];
  return {
    id,
    name: nameOverride ?? spec.label,
    kind,
    ratedWatts: spec.watts,
    powerFactor: spec.powerFactor,
    volts: spec.volts,
    phases: spec.phases,
    quantity,
    utilisationFactor: spec.utilisationFactor,
    demandFactor: spec.demandFactor,
    phase: null,
    roomId,
    circuitId: null,
    note: "",
  };
}

export function buildRoomLoads(roomId: string, type: RoomType, taken: (id: string) => boolean): LoadItem[] {
  const entries = ROOM_LOAD_TEMPLATES[type] ?? [];
  const loads: LoadItem[] = [];
  for (const entry of entries) {
    const base = `${roomId}-${entry.kind}`;
    let id = base;
    let n = 2;
    while (taken(id) || loads.some(l => l.id === id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    loads.push(makeLoad(id, entry.kind, entry.quantity, entry.label, roomId));
  }
  return loads;
}

export function buildRooms(
  apartmentId: string,
  templateId: ApartmentTemplateId,
  taken: (id: string) => boolean,
): Room[] {
  const template = APARTMENT_TEMPLATES[templateId];
  const rooms: Room[] = [];
  const counters: Partial<Record<RoomType, number>> = {};
  for (const entry of template.rooms) {
    for (let i = 0; i < entry.count; i += 1) {
      counters[entry.type] = (counters[entry.type] ?? 0) + 1;
      const index = counters[entry.type] as number;
      const base = `${apartmentId}-${entry.type}${index}`;
      let id = base;
      let n = 2;
      while (taken(id)) {
        id = `${base}-${n}`;
        n += 1;
      }
      const name = entry.count > 1 ? `${entry.label ?? roomTypeName(entry.type)} ${index}` : entry.label ?? roomTypeName(entry.type);
      const type: RoomType = entry.type;
      const loads = buildRoomLoads(id, type, candidate => rooms.some(r => r.id === candidate));
      rooms.push({ id, name, type, area: 0, loads });
    }
  }
  return rooms;
}

function roomTypeName(type: RoomType) {
  const map: Record<RoomType, string> = {
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
    other: "Room",
  };
  return map[type];
}
