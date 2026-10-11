export const IEC_VERIFIED = "iec_verified" as const;
export const IEC_KNOWN_CONVENTION = "convention_requires_source_review" as const;
export const IEC_UNVERIFIED = "unverified_requires_source_review" as const;

export type IECVerificationStatus = typeof IEC_VERIFIED | typeof IEC_KNOWN_CONVENTION | typeof IEC_UNVERIFIED;

export type SymbolPrimitive =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "rect"; x: number; y: number; width: number; height: number }
  | { type: "polyline"; points: { x: number; y: number }[]; closed?: boolean }
  | { type: "text"; x: number; y: number; value: string; height: number };

export interface SymbolTerminal {
  id: string;
  label: string;
  x: number;
  y: number;
  role: "line" | "neutral" | "earth" | "load" | "control" | "terminal";
}

export interface IECSymbolMetadata {
  symbolId: string;
  name: string;
  category: string;
  referencePage?: number;
  iecIdentifier?: string;
  geometry: {
    width: number;
    height: number;
    primitives: SymbolPrimitive[];
    terminals: SymbolTerminal[];
  };
  rotation?: number;
  scale?: number;
  electricalProperties?: {
    ratedCurrent?: number;
    ratedVoltage?: number;
    powerFactor?: number;
    poles?: number;
  };
  displayLabel: string;
  verificationStatus: IECVerificationStatus;
  provenance: "iec_official_reviewed" | "qelectrotech_candidate" | "caldriva_custom" | "unverified_import";
  sourceNotes: string;
  description?: string;
}

const REVIEW_REQUIRED = "Symbol geometry is Caldriva-authored and must be reviewed against IEC 60617 or another licensed source before being represented as standards-verified.";

export const CONDUCTORS_SYMBOLS: IECSymbolMetadata[] = [
  {
    symbolId: "CAL-CONDUCTOR-001",
    name: "Conductor",
    category: "conductor",
    geometry: {
      width: 1.2,
      height: 0.2,
      primitives: [{ type: "line", x1: -0.6, y1: 0, x2: 0.6, y2: 0 }],
      terminals: [
        { id: "1", label: "1", x: -0.6, y: 0, role: "terminal" },
        { id: "2", label: "2", x: 0.6, y: 0, role: "terminal" },
      ],
    },
    displayLabel: "WIRE",
    verificationStatus: IEC_UNVERIFIED,
    provenance: "caldriva_custom",
    sourceNotes: REVIEW_REQUIRED,
    description: "Generic conductor line for early CAD connectivity testing.",
  },
  {
    symbolId: "CAL-TERMINAL-001",
    name: "Terminal Block",
    category: "connector",
    geometry: {
      width: 0.8,
      height: 0.5,
      primitives: [
        { type: "rect", x: -0.25, y: -0.2, width: 0.5, height: 0.4 },
        { type: "line", x1: -0.4, y1: 0, x2: -0.25, y2: 0 },
        { type: "line", x1: 0.25, y1: 0, x2: 0.4, y2: 0 },
        { type: "text", x: 0, y: -0.32, value: "X", height: 0.12 },
      ],
      terminals: [
        { id: "1", label: "1", x: -0.4, y: 0, role: "terminal" },
        { id: "2", label: "2", x: 0.4, y: 0, role: "terminal" },
      ],
    },
    displayLabel: "TB",
    verificationStatus: IEC_UNVERIFIED,
    provenance: "caldriva_custom",
    sourceNotes: REVIEW_REQUIRED,
    description: "Generic terminal block symbol.",
  },
];

export const EARTHING_SYMBOLS: IECSymbolMetadata[] = [
  {
    symbolId: "CAL-EARTH-001",
    name: "Protective Earth",
    category: "earthing",
    geometry: {
      width: 0.5,
      height: 0.7,
      primitives: [
        { type: "line", x1: 0, y1: 0.3, x2: 0, y2: 0 },
        { type: "line", x1: -0.25, y1: 0, x2: 0.25, y2: 0 },
        { type: "line", x1: -0.18, y1: -0.12, x2: 0.18, y2: -0.12 },
        { type: "line", x1: -0.1, y1: -0.24, x2: 0.1, y2: -0.24 },
      ],
      terminals: [{ id: "PE", label: "PE", x: 0, y: 0.3, role: "earth" }],
    },
    displayLabel: "PE",
    verificationStatus: IEC_UNVERIFIED,
    provenance: "caldriva_custom",
    sourceNotes: REVIEW_REQUIRED,
    description: "Protective earth graphic candidate; not claimed as IEC-verified.",
  },
];

export const SWITCHES_SYMBOLS: IECSymbolMetadata[] = [
  {
    symbolId: "CAL-SWITCH-001",
    name: "Single-Pole Switch",
    category: "switch",
    geometry: {
      width: 1,
      height: 0.6,
      primitives: [
        { type: "circle", cx: -0.35, cy: 0, r: 0.04 },
        { type: "circle", cx: 0.35, cy: 0, r: 0.04 },
        { type: "line", x1: -0.35, y1: 0, x2: 0.2, y2: 0.22 },
        { type: "line", x1: -0.5, y1: 0, x2: -0.39, y2: 0 },
        { type: "line", x1: 0.39, y1: 0, x2: 0.5, y2: 0 },
      ],
      terminals: [
        { id: "L", label: "L", x: -0.5, y: 0, role: "line" },
        { id: "OUT", label: "OUT", x: 0.5, y: 0, role: "load" },
      ],
    },
    displayLabel: "S1",
    electricalProperties: { poles: 1 },
    verificationStatus: IEC_UNVERIFIED,
    provenance: "caldriva_custom",
    sourceNotes: REVIEW_REQUIRED,
    description: "Single-pole switch candidate with two connection terminals.",
  },
  {
    symbolId: "CAL-PUSHBUTTON-NO-001",
    name: "Push Button Normally Open",
    category: "switch",
    geometry: {
      width: 1,
      height: 0.6,
      primitives: [
        { type: "circle", cx: -0.35, cy: 0, r: 0.04 },
        { type: "circle", cx: 0.35, cy: 0, r: 0.04 },
        { type: "line", x1: -0.25, y1: 0.18, x2: 0.25, y2: 0.18 },
        { type: "line", x1: 0, y1: 0.34, x2: 0, y2: 0.18 },
        { type: "line", x1: -0.35, y1: 0, x2: -0.05, y2: 0 },
        { type: "line", x1: 0.12, y1: 0, x2: 0.35, y2: 0 },
      ],
      terminals: [
        { id: "13", label: "13", x: -0.5, y: 0, role: "control" },
        { id: "14", label: "14", x: 0.5, y: 0, role: "control" },
      ],
    },
    displayLabel: "PB-NO",
    verificationStatus: IEC_UNVERIFIED,
    provenance: "caldriva_custom",
    sourceNotes: REVIEW_REQUIRED,
    description: "Normally-open push-button candidate for control schematics.",
  },
];

export const PROTECTIVE_DEVICES_SYMBOLS: IECSymbolMetadata[] = [
  {
    symbolId: "CAL-MCB-001",
    name: "Miniature Circuit Breaker",
    category: "protective_device",
    geometry: {
      width: 0.9,
      height: 1.2,
      primitives: [
        { type: "rect", x: -0.3, y: -0.45, width: 0.6, height: 0.9 },
        { type: "line", x1: 0, y1: 0.6, x2: 0, y2: 0.45 },
        { type: "line", x1: 0, y1: -0.45, x2: 0, y2: -0.6 },
        { type: "line", x1: -0.18, y1: 0.18, x2: 0.18, y2: -0.18 },
        { type: "text", x: 0, y: -0.02, value: "MCB", height: 0.12 },
      ],
      terminals: [
        { id: "1", label: "1", x: 0, y: 0.6, role: "line" },
        { id: "2", label: "2", x: 0, y: -0.6, role: "load" },
      ],
    },
    displayLabel: "MCB",
    electricalProperties: { poles: 1 },
    verificationStatus: IEC_UNVERIFIED,
    provenance: "caldriva_custom",
    sourceNotes: REVIEW_REQUIRED,
    description: "Generic circuit breaker candidate for distribution diagrams.",
  },
];

export const SOCKETS_SYMBOLS: IECSymbolMetadata[] = [
  {
    symbolId: "CAL-SOCKET-001",
    name: "Socket Outlet",
    category: "socket",
    geometry: {
      width: 0.7,
      height: 0.7,
      primitives: [
        { type: "circle", cx: 0, cy: 0, r: 0.28 },
        { type: "line", x1: -0.1, y1: 0.08, x2: -0.1, y2: -0.08 },
        { type: "line", x1: 0.1, y1: 0.08, x2: 0.1, y2: -0.08 },
      ],
      terminals: [
        { id: "L", label: "L", x: -0.25, y: -0.3, role: "line" },
        { id: "N", label: "N", x: 0, y: -0.3, role: "neutral" },
        { id: "PE", label: "PE", x: 0.25, y: -0.3, role: "earth" },
      ],
    },
    displayLabel: "SO",
    verificationStatus: IEC_UNVERIFIED,
    provenance: "caldriva_custom",
    sourceNotes: REVIEW_REQUIRED,
    description: "Generic socket outlet candidate with L/N/PE terminals.",
  },
];

export const LIGHTING_SYMBOLS: IECSymbolMetadata[] = [
  {
    symbolId: "CAL-LIGHT-001",
    name: "Luminaire",
    category: "lighting",
    geometry: {
      width: 0.8,
      height: 0.8,
      primitives: [
        { type: "circle", cx: 0, cy: 0, r: 0.3 },
        { type: "line", x1: -0.2, y1: -0.2, x2: 0.2, y2: 0.2 },
        { type: "line", x1: -0.2, y1: 0.2, x2: 0.2, y2: -0.2 },
      ],
      terminals: [
        { id: "L", label: "L", x: -0.2, y: -0.35, role: "line" },
        { id: "N", label: "N", x: 0.2, y: -0.35, role: "neutral" },
      ],
    },
    displayLabel: "L",
    verificationStatus: IEC_UNVERIFIED,
    provenance: "caldriva_custom",
    sourceNotes: REVIEW_REQUIRED,
    description: "Generic luminaire candidate for building electrical layouts.",
  },
];

export const CONTACTORS_SYMBOLS: IECSymbolMetadata[] = [];
export const WATER_HEATER_SYMBOLS: IECSymbolMetadata[] = [];
export const MOTORS_SYMBOLS: IECSymbolMetadata[] = [];

export const ALL_IC60617_SYMBOLS: IECSymbolMetadata[] = [
  ...CONDUCTORS_SYMBOLS,
  ...EARTHING_SYMBOLS,
  ...SWITCHES_SYMBOLS,
  ...PROTECTIVE_DEVICES_SYMBOLS,
  ...CONTACTORS_SYMBOLS,
  ...SOCKETS_SYMBOLS,
  ...LIGHTING_SYMBOLS,
  ...WATER_HEATER_SYMBOLS,
  ...MOTORS_SYMBOLS,
];

export function getSymbolsByCategory(category: string) {
  return ALL_IC60617_SYMBOLS.filter((symbol) => symbol.category === category);
}

export function getVerifiedSymbols() {
  return ALL_IC60617_SYMBOLS.filter((symbol) => symbol.verificationStatus === IEC_VERIFIED);
}

export function getUnverifiedSymbols() {
  return ALL_IC60617_SYMBOLS.filter((symbol) => symbol.verificationStatus === IEC_UNVERIFIED);
}

export function getSymbolsByPageRange(minPage: number, maxPage: number) {
  return ALL_IC60617_SYMBOLS.filter((symbol) => {
    if (symbol.referencePage === undefined) return false;
    return symbol.referencePage >= minPage && symbol.referencePage <= maxPage;
  });
}

export function getSymbolById(symbolId: string) {
  return ALL_IC60617_SYMBOLS.find((symbol) => symbol.symbolId === symbolId) ?? null;
}
