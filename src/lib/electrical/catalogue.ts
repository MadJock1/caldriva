// Illustrative catalogue data for a pure-TypeScript circuit sizing engine.
//
// None of the numbers in this file are claimed to be standard-compliant, normative
// or manufacturer-verified. They exist so the sizing engine can be developed and
// tested, and every capacity entry is stamped `verified: false` with an explicit
// source string. Replace the values with verified data from the applicable cable
// datasheet and national regulation table before any design decision.

export type ConductorMaterial = "copper" | "aluminium";

export type InstallationMethod =
  | "concealed_in_wall"
  | "surface_conduit"
  | "surface_trunking"
  | "cable_tray"
  | "ceiling_void"
  | "buried_duct"
  | "free_air";

export const INSTALLATION_METHODS: readonly InstallationMethod[] = [
  "concealed_in_wall",
  "surface_conduit",
  "surface_trunking",
  "cable_tray",
  "ceiling_void",
  "buried_duct",
  "free_air",
];

export const installationMethodLabels: Record<InstallationMethod, string> = {
  concealed_in_wall: "Concealed in wall",
  surface_conduit: "Surface conduit",
  surface_trunking: "Surface trunking",
  cable_tray: "Cable tray",
  ceiling_void: "Ceiling void",
  buried_duct: "Buried in duct",
  free_air: "Free air (clipped direct)",
};

// Standard protective-device ratings in amperes. This is the set the engine is
// allowed to select from; the smallest rating that is not below the design
// current is chosen. It is a bounded software list, not a claim that these are
// the only permissible values in any regulation.
export const STANDARD_BREAKER_RATINGS_A: readonly number[] = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100];

// Conductor cross-sectional areas in mm² offered by the engine, ascending.
export const CABLE_SIZES_MM2: readonly number[] = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];

export const CABLE_CAPACITY_DISCLAIMER =
  "Illustrative, editable current-carrying capacities. These are placeholders, not standard or manufacturer values, and are not claimed to comply with any regulation. Replace each entry with verified data from the applicable cable datasheet or national regulation table, including installation method, grouping, ambient temperature and protective-device coordination, before any design decision.";

const ILLUSTRATIVE_CAPACITY_SOURCE =
  "Illustrative placeholder capacity (not a standard or manufacturer value). Replace with the applicable verified datasheet table.";

export type CableCapacityEntry = {
  csaMm2: number;
  capacityA: number;
  source: string;
  verified: false;
};

export type CableCapacityTable = {
  method: InstallationMethod;
  material: ConductorMaterial;
  entries: readonly CableCapacityEntry[];
  source: string;
  verified: false;
  note: string;
};

// Editable placeholder capacities (amperes) for copper conductors, keyed by mm².
// Values differ per installation method only to exercise method-dependent sizing;
// they are not derived from any published table.
const ILLUSTRATIVE_COPPER_CAPACITY_A: Record<InstallationMethod, Record<number, number>> = {
  concealed_in_wall: { 1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 110, 50: 134 },
  surface_conduit: { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125, 50: 151 },
  surface_trunking: { 1.5: 18.5, 2.5: 25, 4: 34, 6: 43, 10: 60, 16: 80, 25: 106, 35: 131, 50: 159 },
  cable_tray: { 1.5: 20, 2.5: 27, 4: 37, 6: 47, 10: 65, 16: 87, 25: 114, 35: 141, 50: 172 },
  ceiling_void: { 1.5: 19, 2.5: 26, 4: 35, 6: 44, 10: 61, 16: 82, 25: 108, 35: 134, 50: 163 },
  buried_duct: { 1.5: 14.5, 2.5: 19.5, 4: 26, 6: 33, 10: 45, 16: 61, 25: 80, 35: 99, 50: 119 },
  free_air: { 1.5: 22, 2.5: 30, 4: 40, 6: 51, 10: 70, 16: 94, 25: 123, 35: 152, 50: 186 },
};

function buildTable(method: InstallationMethod): CableCapacityTable {
  const capacity = ILLUSTRATIVE_COPPER_CAPACITY_A[method];
  return {
    method,
    material: "copper",
    entries: CABLE_SIZES_MM2.map((csaMm2) => ({
      csaMm2,
      capacityA: capacity[csaMm2],
      source: ILLUSTRATIVE_CAPACITY_SOURCE,
      verified: false,
    })),
    source: ILLUSTRATIVE_CAPACITY_SOURCE,
    verified: false,
    note: `Editable illustrative capacities for ${installationMethodLabels[method]} (copper). Not standards-verified.`,
  };
}

// Editable table collection. Callers may replace or patch entries in a copy for a project.
export const cableCapacityTables: Record<InstallationMethod, CableCapacityTable> = {
  concealed_in_wall: buildTable("concealed_in_wall"),
  surface_conduit: buildTable("surface_conduit"),
  surface_trunking: buildTable("surface_trunking"),
  cable_tray: buildTable("cable_tray"),
  ceiling_void: buildTable("ceiling_void"),
  buried_duct: buildTable("buried_duct"),
  free_air: buildTable("free_air"),
};

export function cableCapacityTableFor(method: InstallationMethod): CableCapacityTable {
  return cableCapacityTables[method];
}

export function cableCapacityEntryFor(method: InstallationMethod, csaMm2: number): CableCapacityEntry | undefined {
  return cableCapacityTables[method].entries.find((entry) => entry.csaMm2 === csaMm2);
}

// Resistivity of the conductor at 20 °C in ohm·mm²/m. Copper and aluminium differ.
// The aluminium column is provided for the voltage-drop calculation only; the
// capacity tables above are copper-based and must not be reused for aluminium.
export const CONDUCTOR_RESISTIVITY_OHM_MM2_PER_M: Record<ConductorMaterial, number> = {
  copper: 0.0225,
  aluminium: 0.036,
};

export const VOLTAGE_DROP_ASSUMPTIONS = {
  // ΔV = k · ρ · L · I / A, with k = 2 for single-phase (go and return) and √3 for
  // balanced three-phase. Conductor reactance, power factor and temperature
  // correction are ignored in this preliminary method.
  singlePhaseFactor: 2,
  threePhaseFactor: Math.sqrt(3),
  currentBasis: "Voltage drop is evaluated at the design current (Ib), not the protective-device rating.",
  defaultLimitPct: 3,
  method:
    "Preliminary resistive voltage drop: ΔV = k·ρ·L·I/A (k = 2 single-phase, √3 three-phase). Reactance, power factor and temperature correction are not modelled.",
  resistivitySource: "Numeric resistivity constants for a pure calculation helper; not a regulatory value.",
  verified: false,
} as const;

export const CATALOGUE_DISCLAIMER =
  "Breaker ratings and cable capacities here are bounded software lists and illustrative placeholders. The engine never returns an approval or a standards-compliant certificate; every result requires verification against verified data and a qualified reviewer.";
