import { z } from "zod";
import { buildingSchema, horizontalRoofArea } from "./building";
import { capacity, solarResultSchema } from "./solar";
import { layoutPanels, layoutSettingsSchema, type LayoutRequest, type LayoutSettings } from "./panel-layout";
import { type PanelModel } from "./solar-panel-catalog";

export const assumptions = [
  "Preliminary automated estimate; not engineer-reviewed, certified or approved.",
  "Crystalline-silicon PV; user-confirmed tilt, compass azimuth, mounting and system losses.",
  "PVGIS terrain horizon included. Nearby obstacle and detailed shading losses are not modelled.",
  "Self-consumption uses an assumed annual share, capped by annual demand; no hourly load matching or battery dispatch.",
  "Simple payback excludes tax, financing, discounting, tariff escalation and degradation.",
  "Panel layout uses real module rectangles at catalogue dimensions on a compact horizontal projection. It excludes roof pitch, inter-row shading, structural and safety-setback verification.",
] as const;

export const panelSelectionSchema = z.object({
  panelModelId: z.string().min(1).max(80),
  label: z.string().min(1).max(160),
  widthM: z.number().min(.2).max(5),
  lengthM: z.number().min(.2).max(5),
  watts: z.number().min(10).max(1000),
  verified: z.boolean(),
  layoutCount: z.number().int().min(0).max(1000),
  countSource: z.enum(["layout", "manual"]).default("layout"),
});
export type PanelSelection = z.infer<typeof panelSelectionSchema>;

export function panelModelFromSelection(selection: PanelSelection): PanelModel {
  const s = panelSelectionSchema.parse(selection);
  return { id: s.panelModelId, label: s.label, watts: s.watts, widthM: s.widthM, lengthM: s.lengthM, verified: s.verified, provenance: "Panel record stored in the scenario snapshot." };
}

function requestFromLayout(layout: LayoutSettings): LayoutRequest {
  return { orientation: layout.orientation, setback: layout.setback, gap: layout.gap };
}

export const snapshotSchema = z.object({
  schemaVersion: z.literal(2),
  name: z.string().trim().min(1).max(100),
  building: buildingSchema,
  layout: layoutSettingsSchema,
  panel: panelSelectionSchema,
  result: solarResultSchema,
  assumptions: z.array(z.string().max(1000)).min(1).max(20),
}).superRefine((s, ctx) => {
  if (Math.abs(capacity(s.building.solar) - s.result.capacityKwp) > .00001) ctx.addIssue({ code: "custom", message: "Result capacity does not match inputs." });
  if (Math.abs(s.result.monthly.reduce((sum, m) => sum + m.E_m, 0) - s.result.annualKwh) > Math.max(1, s.result.annualKwh * .001)) ctx.addIssue({ code: "custom", message: "Monthly and annual production do not match." });
  if (Math.abs(s.result.annualKwh / s.result.capacityKwp - s.result.specificYield) > 1) ctx.addIssue({ code: "custom", message: "Specific yield does not match production." });
  try { horizontalRoofArea(s.building.roof); } catch { ctx.addIssue({ code: "custom", message: "Invalid roof geometry." }); }
});
export type SimulationSnapshot = z.infer<typeof snapshotSchema>;

/** Upgrades legacy version 1 snapshots (declared panel count, no panel record) to version 2. */
export function migrateSimulationSnapshot(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const snapshot = raw as Record<string, unknown>;
  if (snapshot.schemaVersion !== 1) return raw;
  const building = snapshot.building as { solar?: { panelWatts?: number; panels?: number } } | undefined;
  const layout = snapshot.layout as { width?: number; length?: number } | undefined;
  const watts = building?.solar?.panelWatts ?? 430;
  const declared = building?.solar?.panels ?? 0;
  const panel: PanelSelection = {
    panelModelId: "legacy-declared",
    label: `Declared panel ${watts} Wp (legacy snapshot)`,
    widthM: layout?.width ?? 1.13,
    lengthM: layout?.length ?? 1.76,
    watts,
    verified: false,
    layoutCount: declared,
    countSource: "manual",
  };
  return { ...snapshot, schemaVersion: 2, panel };
}

export function parseSimulationSnapshot(raw: unknown): SimulationSnapshot {
  return snapshotSchema.parse(migrateSimulationSnapshot(raw));
}

export const migratedSnapshotSchema = z.preprocess(migrateSimulationSnapshot, snapshotSchema);

export const savedSimulationSchema = z.object({ id: z.uuid(), building_id: z.uuid(), building_version: z.number().int().positive(), created_at: z.iso.datetime({ offset: true }), snapshot: migratedSnapshotSchema });
export type SavedSimulation = z.infer<typeof savedSimulationSchema>;
export const localScenarioSchema = z.object({ id: z.uuid(), snapshot: migratedSnapshotSchema });
export type LocalScenario = z.infer<typeof localScenarioSchema>;

/** Recomputes the layout panel count from the stored snapshot inputs, never from browser-supplied derived values. */
export function recomputeLayoutCount(snapshot: SimulationSnapshot): number {
  const s = snapshotSchema.parse(snapshot);
  return layoutPanels(s.building.roof, panelModelFromSelection(s.panel), requestFromLayout(s.layout), s.building.solar.azimuth, s.building.roofObstacles).count;
}

export function snapshotFromRow(row: unknown): SavedSimulation {
  const parsed = z.object({ id: z.uuid(), name: z.string(), building_id: z.uuid(), building_version: z.number(), created_at: z.string(), building_snapshot: buildingSchema, assumptions: z.array(z.string()), calculation_version: z.string(), simulation_inputs: z.object({ data: z.object({ layout: layoutSettingsSchema, panel: panelSelectionSchema.nullish() }) }), simulation_results: z.object({ data: solarResultSchema }) }).parse(row);
  if (parsed.calculation_version !== parsed.simulation_results.data.engineVersion) throw new Error("Calculation version mismatch");
  const panel = parsed.simulation_inputs.data.panel ?? undefined;
  return savedSimulationSchema.parse({ ...parsed, snapshot: { schemaVersion: panel ? 2 : 1, name: parsed.name, building: parsed.building_snapshot, layout: parsed.simulation_inputs.data.layout, panel, result: parsed.simulation_results.data, assumptions: parsed.assumptions } });
}
