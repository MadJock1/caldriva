import { z } from "zod";
import { buildingSchema, horizontalRoofArea } from "./building";
import { capacity, solarResultSchema } from "./solar";
import { layoutSettingsSchema } from "./panel-layout";

export const assumptions = [
  "Preliminary automated estimate; not engineer-reviewed, certified or approved.",
  "Crystalline-silicon PV; user-confirmed tilt, compass azimuth, mounting and system losses.",
  "PVGIS terrain horizon included. Nearby obstacle and detailed shading losses are not modelled.",
  "Self-consumption uses an assumed annual share, capped by annual demand; no hourly load matching or battery dispatch.",
  "Simple payback excludes tax, financing, discounting, tariff escalation and degradation.",
  "Panel layout is a horizontal grid approximation, without obstacle exclusions or sloped-plane fit verification. Energy uses the declared panel count, which may differ from the layout.",
] as const;
export const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().trim().min(1).max(100),
  building: buildingSchema,
  layout: layoutSettingsSchema,
  result: solarResultSchema,
  assumptions: z.array(z.string().max(1000)).min(1).max(20),
}).superRefine((s, ctx) => {
  if (Math.abs(capacity(s.building.solar) - s.result.capacityKwp) > .00001) ctx.addIssue({ code: "custom", message: "Result capacity does not match inputs." });
  if (Math.abs(s.result.monthly.reduce((sum, m) => sum + m.E_m, 0) - s.result.annualKwh) > Math.max(1, s.result.annualKwh * .001)) ctx.addIssue({ code: "custom", message: "Monthly and annual production do not match." });
  if (Math.abs(s.result.annualKwh / s.result.capacityKwp - s.result.specificYield) > 1) ctx.addIssue({ code: "custom", message: "Specific yield does not match production." });
  try { horizontalRoofArea(s.building.roof); } catch { ctx.addIssue({ code: "custom", message: "Invalid roof geometry." }); }
});
export type SimulationSnapshot = z.infer<typeof snapshotSchema>;
export const savedSimulationSchema = z.object({ id: z.uuid(), building_id: z.uuid(), building_version: z.number().int().positive(), created_at: z.iso.datetime({ offset: true }), snapshot: snapshotSchema });
export type SavedSimulation = z.infer<typeof savedSimulationSchema>;
export const localScenarioSchema = z.object({ id: z.uuid(), snapshot: snapshotSchema });
export type LocalScenario = z.infer<typeof localScenarioSchema>;
export function snapshotFromRow(row: unknown): SavedSimulation {
  const parsed = z.object({ id: z.uuid(), name: z.string(), building_id: z.uuid(), building_version: z.number(), created_at: z.string(), building_snapshot: buildingSchema, assumptions: z.array(z.string()), calculation_version: z.string(), simulation_inputs: z.object({ data: z.object({ layout: layoutSettingsSchema }) }), simulation_results: z.object({ data: solarResultSchema }) }).parse(row);
  if (parsed.calculation_version !== parsed.simulation_results.data.engineVersion) throw new Error("Calculation version mismatch");
  return savedSimulationSchema.parse({ ...parsed, snapshot: { schemaVersion: 1, name: parsed.name, building: parsed.building_snapshot, layout: parsed.simulation_inputs.data.layout, result: parsed.simulation_results.data, assumptions: parsed.assumptions } });
}
