import { z } from "zod";

export const ENGINE_VERSION = "solar-0.1.0";
export const solarInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  tilt: z.number().min(0).max(90),
  azimuth: z.number().min(0).max(360),
  panels: z.number().int().min(1).max(10000),
  panelWatts: z.number().min(10).max(1000),
  losses: z.number().min(0).max(50),
  mounting: z.enum(["free", "building"]),
});
export type SolarInput = z.infer<typeof solarInputSchema>;
export const financeSchema = z.object({
  consumption: z.number().min(0).max(1e8),
  selfConsumption: z.number().min(0).max(100),
  importTariff: z.number().min(0).max(5),
  exportTariff: z.number().min(0).max(5),
  capex: z.number().min(0).max(1e8),
  annualOpex: z.number().min(0).max(1e7),
});
export type FinanceInput = z.infer<typeof financeSchema>;
export function capacity(input: SolarInput) {
  const validated = solarInputSchema.parse(input);
  return validated.panels * validated.panelWatts / 1000;
}
/** Compass azimuth (N=0,E=90,S=180,W=270) to PVGIS (S=0,E=-90,W=90). */
export function pvgisAspect(azimuth: number) {
  return z.number().min(0).max(360).parse(azimuth) - 180;
}
/** Annual energy balance scenario, not hourly demand matching or battery dispatch. */
export function financialScenario(annualKwh: number, input: FinanceInput) {
  z.number().finite().nonnegative().parse(annualKwh);
  const f = financeSchema.parse(input);
  const selfUsed = Math.min(annualKwh * f.selfConsumption / 100, f.consumption);
  const exported = annualKwh - selfUsed;
  const grossSavings = selfUsed * f.importTariff + exported * f.exportTariff;
  const netSavings = grossSavings - f.annualOpex;
  return { selfUsed, exported, grossSavings, netSavings, payback: netSavings > 0 ? f.capex / netSavings : null };
}

const monthSchema = z.object({ month: z.number().int().min(1).max(12), E_m: z.number().finite().nonnegative() });
export const pvgisSchema = z.object({
  outputs: z.object({
    monthly: z.object({ fixed: z.array(monthSchema).length(12).refine(rows => new Set(rows.map(r => r.month)).size === 12, "Expected distinct months") }),
    totals: z.object({ fixed: z.object({ E_y: z.number().finite().nonnegative() }) }),
  }),
  inputs: z.object({ meteo_data: z.object({ radiation_db: z.string() }) }),
});
export const solarResultSchema = z.object({
  annualKwh: z.number().finite().nonnegative(),
  monthly: z.array(monthSchema).length(12).refine(rows => new Set(rows.map(r => r.month)).size === 12, "Expected 12 distinct months"),
  capacityKwp: z.number().finite().positive(),
  specificYield: z.number().finite().nonnegative(),
  database: z.string().min(1).max(100),
  source: z.string().min(1).max(200),
  calculatedAt: z.iso.datetime(),
  engineVersion: z.string().min(1).max(50),
});
export type SolarResult = z.infer<typeof solarResultSchema>;
